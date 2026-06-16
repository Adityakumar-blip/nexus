// Server-side data-access layer for Nexus, built on the Firebase Admin SDK.
//
// This mirrors the client-side store.ts but is callable from API routes (the
// /api/keys management endpoint and the /api/mcp server). The Admin SDK bypasses
// Firestore security rules, so EVERY function here is scoped by ownerId: reads
// filter on it, writes stamp it, and updates/deletes verify it first. That keeps
// an API key strictly limited to its owner's data — the same boundary the web
// app gets from firestore.rules.

import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type {
  Project,
  Task,
  Note,
  Milestone,
  ProjectStatus,
  MilestoneStatus,
  TaskStatus,
  TaskType,
  Priority,
} from "./types";

const COL = {
  projects: "projects",
  tasks: "tasks",
  notes: "notes",
  milestones: "milestones",
} as const;

// --- serialization helpers -------------------------------------------------

function ts(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  return Date.now();
}

function nullableTs(value: unknown): number | null {
  if (value == null) return null;
  return ts(value);
}

/** Thrown when a document is missing or not owned by the caller. */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

// Fetch a document and assert it belongs to ownerId. Returns the snapshot data.
async function getOwned(
  collection: string,
  id: string,
  ownerId: string,
): Promise<FirebaseFirestore.DocumentData> {
  const snap = await adminDb().collection(collection).doc(id).get();
  if (!snap.exists || snap.data()?.ownerId !== ownerId) {
    throw new NotFoundError(`${collection}/${id} not found`);
  }
  return snap.data()!;
}

// --- projects --------------------------------------------------------------

function mapProject(id: string, data: FirebaseFirestore.DocumentData): Project {
  return {
    id,
    name: data.name ?? "",
    description: data.description ?? "",
    color: data.color ?? "blue",
    status: (data.status ?? "active") as ProjectStatus,
    ownerId: data.ownerId,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

export async function listProjects(ownerId: string): Promise<Project[]> {
  const snap = await adminDb()
    .collection(COL.projects)
    .where("ownerId", "==", ownerId)
    .get();
  const projects = snap.docs.map((d) => mapProject(d.id, d.data()));
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  return projects;
}

export async function getProject(
  ownerId: string,
  id: string,
): Promise<Project> {
  return mapProject(id, await getOwned(COL.projects, id, ownerId));
}

export async function createProject(
  ownerId: string,
  input: { name: string; description?: string; color?: string; status?: ProjectStatus },
): Promise<Project> {
  const ref = await adminDb().collection(COL.projects).add({
    name: input.name,
    description: input.description ?? "",
    color: input.color ?? "blue",
    status: input.status ?? "active",
    ownerId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getProject(ownerId, ref.id);
}

export async function updateProject(
  ownerId: string,
  id: string,
  patch: Partial<Pick<Project, "name" | "description" | "color" | "status">>,
): Promise<Project> {
  await getOwned(COL.projects, id, ownerId);
  await adminDb()
    .collection(COL.projects)
    .doc(id)
    .update({ ...prune(patch), updatedAt: FieldValue.serverTimestamp() });
  return getProject(ownerId, id);
}

export async function deleteProject(
  ownerId: string,
  id: string,
  cascade = true,
): Promise<{ deletedProject: string; deletedTasks: number; deletedMilestones: number }> {
  await getOwned(COL.projects, id, ownerId);
  let deletedTasks = 0;
  let deletedMilestones = 0;

  if (cascade) {
    const db = adminDb();
    const [tasks, milestones] = await Promise.all([
      db.collection(COL.tasks).where("ownerId", "==", ownerId).where("projectId", "==", id).get(),
      db.collection(COL.milestones).where("ownerId", "==", ownerId).where("projectId", "==", id).get(),
    ]);
    const batch = db.batch();
    tasks.docs.forEach((d) => batch.delete(d.ref));
    milestones.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection(COL.projects).doc(id));
    await batch.commit();
    deletedTasks = tasks.size;
    deletedMilestones = milestones.size;
  } else {
    await adminDb().collection(COL.projects).doc(id).delete();
  }

  return { deletedProject: id, deletedTasks, deletedMilestones };
}

// --- milestones ------------------------------------------------------------

function mapMilestone(id: string, data: FirebaseFirestore.DocumentData): Milestone {
  return {
    id,
    projectId: data.projectId,
    name: data.name ?? "",
    description: data.description ?? "",
    status: (data.status ?? "planned") as MilestoneStatus,
    targetDate: nullableTs(data.targetDate),
    ownerId: data.ownerId,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

const MILESTONE_WEIGHT: Record<MilestoneStatus, number> = {
  active: 0,
  planned: 1,
  shipped: 2,
};

export async function listMilestones(
  ownerId: string,
  projectId?: string,
): Promise<Milestone[]> {
  let q = adminDb()
    .collection(COL.milestones)
    .where("ownerId", "==", ownerId) as FirebaseFirestore.Query;
  if (projectId) q = q.where("projectId", "==", projectId);
  const snap = await q.get();
  const items = snap.docs.map((d) => mapMilestone(d.id, d.data()));
  items.sort((a, b) => {
    const w = MILESTONE_WEIGHT[a.status] - MILESTONE_WEIGHT[b.status];
    if (w !== 0) return w;
    const at = a.targetDate ?? Number.POSITIVE_INFINITY;
    const bt = b.targetDate ?? Number.POSITIVE_INFINITY;
    return at - bt || b.createdAt - a.createdAt;
  });
  return items;
}

export async function createMilestone(
  ownerId: string,
  input: {
    projectId: string;
    name: string;
    description?: string;
    status?: MilestoneStatus;
    targetDate?: number | null;
  },
): Promise<Milestone> {
  // Ensure the project exists and is owned by the caller.
  await getOwned(COL.projects, input.projectId, ownerId);
  const ref = await adminDb().collection(COL.milestones).add({
    projectId: input.projectId,
    name: input.name,
    description: input.description ?? "",
    status: input.status ?? "planned",
    targetDate: input.targetDate ?? null,
    ownerId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return mapMilestone(ref.id, await getOwned(COL.milestones, ref.id, ownerId));
}

export async function updateMilestone(
  ownerId: string,
  id: string,
  patch: Partial<Pick<Milestone, "name" | "description" | "status" | "targetDate">>,
): Promise<Milestone> {
  await getOwned(COL.milestones, id, ownerId);
  await adminDb()
    .collection(COL.milestones)
    .doc(id)
    .update({ ...prune(patch), updatedAt: FieldValue.serverTimestamp() });
  return mapMilestone(id, await getOwned(COL.milestones, id, ownerId));
}

export async function deleteMilestone(ownerId: string, id: string): Promise<void> {
  await getOwned(COL.milestones, id, ownerId);
  await adminDb().collection(COL.milestones).doc(id).delete();
}

// --- tasks -----------------------------------------------------------------

function mapTask(id: string, data: FirebaseFirestore.DocumentData): Task {
  return {
    id,
    projectId: data.projectId,
    milestoneId: data.milestoneId ?? null,
    title: data.title ?? "",
    description: data.description ?? "",
    status: (data.status ?? "todo") as TaskStatus,
    type: (data.type ?? "feature") as TaskType,
    priority: (data.priority ?? "medium") as Priority,
    order: data.order ?? 0,
    dueDate: nullableTs(data.dueDate),
    ownerId: data.ownerId,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

export async function listTasks(
  ownerId: string,
  filter: { projectId?: string; milestoneId?: string; status?: TaskStatus } = {},
): Promise<Task[]> {
  let q = adminDb()
    .collection(COL.tasks)
    .where("ownerId", "==", ownerId) as FirebaseFirestore.Query;
  if (filter.projectId) q = q.where("projectId", "==", filter.projectId);
  const snap = await q.get();
  let tasks = snap.docs.map((d) => mapTask(d.id, d.data()));
  // Remaining filters applied in memory to avoid composite indexes.
  if (filter.milestoneId) tasks = tasks.filter((t) => t.milestoneId === filter.milestoneId);
  if (filter.status) tasks = tasks.filter((t) => t.status === filter.status);
  tasks.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  return tasks;
}

export async function createTask(
  ownerId: string,
  input: {
    projectId: string;
    title: string;
    description?: string;
    type?: TaskType;
    priority?: Priority;
    status?: TaskStatus;
    milestoneId?: string | null;
    dueDate?: number | null;
  },
): Promise<Task> {
  await getOwned(COL.projects, input.projectId, ownerId);
  if (input.milestoneId) await getOwned(COL.milestones, input.milestoneId, ownerId);
  const ref = await adminDb().collection(COL.tasks).add({
    projectId: input.projectId,
    milestoneId: input.milestoneId ?? null,
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "todo",
    type: input.type ?? "feature",
    priority: input.priority ?? "medium",
    order: Date.now(),
    dueDate: input.dueDate ?? null,
    ownerId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return mapTask(ref.id, await getOwned(COL.tasks, ref.id, ownerId));
}

export async function updateTask(
  ownerId: string,
  id: string,
  patch: Partial<
    Pick<Task, "title" | "description" | "status" | "type" | "priority" | "order" | "dueDate" | "milestoneId">
  >,
): Promise<Task> {
  await getOwned(COL.tasks, id, ownerId);
  if (patch.milestoneId) await getOwned(COL.milestones, patch.milestoneId, ownerId);
  await adminDb()
    .collection(COL.tasks)
    .doc(id)
    .update({ ...prune(patch), updatedAt: FieldValue.serverTimestamp() });
  return mapTask(id, await getOwned(COL.tasks, id, ownerId));
}

export async function deleteTask(ownerId: string, id: string): Promise<void> {
  await getOwned(COL.tasks, id, ownerId);
  await adminDb().collection(COL.tasks).doc(id).delete();
}

// --- notes (knowledge base) ------------------------------------------------

function mapNote(id: string, data: FirebaseFirestore.DocumentData): Note {
  return {
    id,
    title: data.title ?? "",
    content: data.content ?? "",
    tags: data.tags ?? [],
    projectId: data.projectId ?? null,
    pinned: data.pinned ?? false,
    ownerId: data.ownerId,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

export async function listNotes(
  ownerId: string,
  filter: { query?: string; projectId?: string } = {},
): Promise<Note[]> {
  const snap = await adminDb()
    .collection(COL.notes)
    .where("ownerId", "==", ownerId)
    .get();
  let notes = snap.docs.map((d) => mapNote(d.id, d.data()));
  if (filter.projectId) notes = notes.filter((n) => n.projectId === filter.projectId);
  const q = filter.query?.trim().toLowerCase();
  if (q) {
    notes = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  notes.sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
  );
  return notes;
}

export async function getNote(ownerId: string, id: string): Promise<Note> {
  return mapNote(id, await getOwned(COL.notes, id, ownerId));
}

export async function createNote(
  ownerId: string,
  input: {
    title: string;
    content?: string;
    tags?: string[];
    projectId?: string | null;
    pinned?: boolean;
  },
): Promise<Note> {
  if (input.projectId) await getOwned(COL.projects, input.projectId, ownerId);
  const ref = await adminDb().collection(COL.notes).add({
    title: input.title,
    content: input.content ?? "",
    tags: input.tags ?? [],
    projectId: input.projectId ?? null,
    pinned: input.pinned ?? false,
    ownerId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return getNote(ownerId, ref.id);
}

export async function updateNote(
  ownerId: string,
  id: string,
  patch: Partial<Pick<Note, "title" | "content" | "tags" | "projectId" | "pinned">>,
): Promise<Note> {
  await getOwned(COL.notes, id, ownerId);
  if (patch.projectId) await getOwned(COL.projects, patch.projectId, ownerId);
  await adminDb()
    .collection(COL.notes)
    .doc(id)
    .update({ ...prune(patch), updatedAt: FieldValue.serverTimestamp() });
  return getNote(ownerId, id);
}

export async function deleteNote(ownerId: string, id: string): Promise<void> {
  await getOwned(COL.notes, id, ownerId);
  await adminDb().collection(COL.notes).doc(id).delete();
}

// Drop undefined fields so an update never writes `undefined` to Firestore.
function prune<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

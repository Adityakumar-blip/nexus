// Firestore data-access layer for Nexus.
//
// Every read is scoped to the signed-in user (ownerId == uid) which matches the
// security rules in firestore.rules. Functions return unsubscribe handles for
// realtime listeners, or promises for one-shot mutations.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Project,
  Task,
  Note,
  Milestone,
  ProjectStatus,
  MilestoneStatus,
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

function mapTask(id: string, data: DocumentData): Task {
  return {
    id,
    projectId: data.projectId,
    milestoneId: data.milestoneId ?? null,
    title: data.title ?? "",
    description: data.description ?? "",
    status: data.status ?? "todo",
    type: data.type ?? "feature",
    priority: data.priority ?? "medium",
    order: data.order ?? 0,
    dueDate: nullableTs(data.dueDate),
    ownerId: data.ownerId,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

// --- projects --------------------------------------------------------------

export function watchProjects(
  uid: string,
  cb: (projects: Project[]) => void,
): () => void {
  // Equality filter only; we sort client-side to avoid needing a composite index.
  const q = query(
    collection(db, COL.projects),
    where("ownerId", "==", uid),
  );
  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const projects = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? "",
        description: data.description ?? "",
        color: data.color ?? "blue",
        status: (data.status ?? "active") as ProjectStatus,
        ownerId: data.ownerId,
        createdAt: ts(data.createdAt),
        updatedAt: ts(data.updatedAt),
      };
    });
    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    cb(projects);
  });
}

export async function createProject(
  uid: string,
  input: { name: string; description?: string; color?: string },
): Promise<string> {
  const ref = await addDoc(collection(db, COL.projects), {
    name: input.name,
    description: input.description ?? "",
    color: input.color ?? "blue",
    status: "active",
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "description" | "color" | "status">>,
): Promise<void> {
  await updateDoc(doc(db, COL.projects, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.projects, id));
}

// --- tasks -----------------------------------------------------------------

export function watchTasks(
  uid: string,
  projectId: string,
  cb: (tasks: Task[]) => void,
): () => void {
  const q = query(
    collection(db, COL.tasks),
    where("ownerId", "==", uid),
    where("projectId", "==", projectId),
  );
  return onSnapshot(q, (snap) => {
    const tasks = snap.docs.map((d) => {
      const data = d.data();
      return mapTask(d.id, data);
    });
    // sort client-side so we don't need a composite index
    tasks.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    cb(tasks);
  });
}

// Watch every task across all the user's projects (for dashboard stats).
export function watchAllTasks(
  uid: string,
  cb: (tasks: Task[]) => void,
): () => void {
  const q = query(collection(db, COL.tasks), where("ownerId", "==", uid));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => mapTask(d.id, d.data())));
  });
}

export async function createTask(
  uid: string,
  input: {
    projectId: string;
    title: string;
    description?: string;
    type?: Task["type"];
    priority?: Task["priority"];
    status?: Task["status"];
    milestoneId?: string | null;
    dueDate?: number | null;
    order?: number;
  },
): Promise<string> {
  const ref = await addDoc(collection(db, COL.tasks), {
    projectId: input.projectId,
    milestoneId: input.milestoneId ?? null,
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "todo",
    type: input.type ?? "feature",
    priority: input.priority ?? "medium",
    order: input.order ?? Date.now(),
    dueDate: input.dueDate ?? null,
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(
  id: string,
  patch: Partial<
    Pick<
      Task,
      | "title"
      | "description"
      | "status"
      | "type"
      | "priority"
      | "order"
      | "dueDate"
      | "milestoneId"
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, COL.tasks, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.tasks, id));
}

// --- notes (knowledge base) ------------------------------------------------

export function watchNotes(
  uid: string,
  cb: (notes: Note[]) => void,
): () => void {
  const q = query(collection(db, COL.notes), where("ownerId", "==", uid));
  return onSnapshot(q, (snap) => {
    const notes = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title ?? "",
        content: data.content ?? "",
        tags: data.tags ?? [],
        projectId: data.projectId ?? null,
        pinned: data.pinned ?? false,
        ownerId: data.ownerId,
        createdAt: ts(data.createdAt),
        updatedAt: ts(data.updatedAt),
      } as Note;
    });
    // pinned first, then most recently updated
    notes.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
    );
    cb(notes);
  });
}

export async function createNote(
  uid: string,
  input: {
    title: string;
    content?: string;
    tags?: string[];
    projectId?: string | null;
  },
): Promise<string> {
  const ref = await addDoc(collection(db, COL.notes), {
    title: input.title,
    content: input.content ?? "",
    tags: input.tags ?? [],
    projectId: input.projectId ?? null,
    pinned: false,
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateNote(
  id: string,
  patch: Partial<
    Pick<Note, "title" | "content" | "tags" | "projectId" | "pinned">
  >,
): Promise<void> {
  await updateDoc(doc(db, COL.notes, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.notes, id));
}

// --- milestones (releases) -------------------------------------------------

function mapMilestone(id: string, data: DocumentData): Milestone {
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

// status weight for ordering: active first, then planned, then shipped
const MILESTONE_WEIGHT: Record<MilestoneStatus, number> = {
  active: 0,
  planned: 1,
  shipped: 2,
};

function sortMilestones(a: Milestone, b: Milestone): number {
  const w = MILESTONE_WEIGHT[a.status] - MILESTONE_WEIGHT[b.status];
  if (w !== 0) return w;
  // within a status, soonest target first (nulls last), then newest
  const at = a.targetDate ?? Number.POSITIVE_INFINITY;
  const bt = b.targetDate ?? Number.POSITIVE_INFINITY;
  return at - bt || b.createdAt - a.createdAt;
}

export function watchMilestones(
  uid: string,
  projectId: string,
  cb: (milestones: Milestone[]) => void,
): () => void {
  const q = query(
    collection(db, COL.milestones),
    where("ownerId", "==", uid),
    where("projectId", "==", projectId),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => mapMilestone(d.id, d.data()));
    items.sort(sortMilestones);
    cb(items);
  });
}

// Every milestone across the user's projects (for the global roadmap).
export function watchAllMilestones(
  uid: string,
  cb: (milestones: Milestone[]) => void,
): () => void {
  const q = query(collection(db, COL.milestones), where("ownerId", "==", uid));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => mapMilestone(d.id, d.data()));
    items.sort(sortMilestones);
    cb(items);
  });
}

export async function createMilestone(
  uid: string,
  input: {
    projectId: string;
    name: string;
    description?: string;
    status?: MilestoneStatus;
    targetDate?: number | null;
  },
): Promise<string> {
  const ref = await addDoc(collection(db, COL.milestones), {
    projectId: input.projectId,
    name: input.name,
    description: input.description ?? "",
    status: input.status ?? "planned",
    targetDate: input.targetDate ?? null,
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMilestone(
  id: string,
  patch: Partial<
    Pick<Milestone, "name" | "description" | "status" | "targetDate">
  >,
): Promise<void> {
  await updateDoc(doc(db, COL.milestones, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMilestone(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.milestones, id));
}

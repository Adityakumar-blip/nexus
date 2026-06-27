// Firestore data-access layer for Nexus.
//
// Every read is scoped to the signed-in user (ownerId == uid) which matches the
// security rules in firestore.rules. Functions return unsubscribe handles for
// realtime listeners, or promises for one-shot mutations.

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  onSnapshot,
  query,
  where,
  documentId,
  arrayUnion,
  arrayRemove,
  deleteField,
  serverTimestamp,
  Timestamp,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import type {
  Project,
  Task,
  Note,
  Doc,
  Milestone,
  ProjectStatus,
  MilestoneStatus,
  Organization,
  UserProfile,
  Comment,
  ProjectRole,
} from "./types";

const COL = {
  projects: "projects",
  tasks: "tasks",
  notes: "notes",
  docs: "documents",
  milestones: "milestones",
  organizations: "organizations",
  users: "users",
  comments: "comments",
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
    parentId: data.parentId ?? null,
    title: data.title ?? "",
    description: data.description ?? "",
    status: data.status ?? "todo",
    type: data.type ?? "feature",
    priority: data.priority ?? "medium",
    order: data.order ?? 0,
    dueDate: nullableTs(data.dueDate),
    assigneeId: data.assigneeId ?? null,
    note: data.note ?? "",
    docId: data.docId ?? null,
    ownerId: data.ownerId,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

function mapProject(id: string, data: DocumentData): Project {
  return {
    id,
    name: data.name ?? "",
    description: data.description ?? "",
    color: data.color ?? "blue",
    status: (data.status ?? "active") as ProjectStatus,
    ownerId: data.ownerId,
    orgId: data.orgId ?? null,
    // Legacy projects predate sharing: treat the owner as the sole admin member.
    memberIds: data.memberIds ?? [data.ownerId],
    roles: data.roles ?? { [data.ownerId]: "admin" },
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

// --- projects --------------------------------------------------------------

export function watchProjects(
  uid: string,
  cb: (projects: Project[]) => void,
): () => void {
  // Two single-field listeners merged client-side: projects you OWN, and
  // projects you've been added to as a member. Keeping them separate avoids a
  // composite index and keeps legacy (pre-sharing) owned projects visible even
  // before they have a `memberIds` array. Results are de-duped by id.
  const owned = new Map<string, Project>();
  const shared = new Map<string, Project>();

  function emit() {
    const merged = new Map<string, Project>([...owned, ...shared]);
    const projects = [...merged.values()];
    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    cb(projects);
  }

  const u1 = onSnapshot(
    query(collection(db, COL.projects), where("ownerId", "==", uid)),
    (snap: QuerySnapshot<DocumentData>) => {
      owned.clear();
      snap.docs.forEach((d) => owned.set(d.id, mapProject(d.id, d.data())));
      emit();
    },
  );
  const u2 = onSnapshot(
    query(
      collection(db, COL.projects),
      where("memberIds", "array-contains", uid),
    ),
    (snap: QuerySnapshot<DocumentData>) => {
      shared.clear();
      snap.docs.forEach((d) => shared.set(d.id, mapProject(d.id, d.data())));
      emit();
    },
  );
  return () => {
    u1();
    u2();
  };
}

export async function createProject(
  uid: string,
  input: {
    name: string;
    description?: string;
    color?: string;
    orgId?: string | null;
  },
): Promise<string> {
  const ref = await addDoc(collection(db, COL.projects), {
    name: input.name,
    description: input.description ?? "",
    color: input.color ?? "blue",
    status: "active",
    ownerId: uid,
    // The creator is the first member and an admin of their own project.
    orgId: input.orgId ?? null,
    memberIds: [uid],
    roles: { [uid]: "admin" satisfies ProjectRole },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProject(
  id: string,
  patch: Partial<
    Pick<Project, "name" | "description" | "color" | "status" | "orgId">
  >,
): Promise<void> {
  await updateDoc(doc(db, COL.projects, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

// --- project membership ----------------------------------------------------

// Add (or re-role) a member on a project. Caller must be a project admin (the
// rules enforce this). The member's uid lands in both `memberIds` (queried on)
// and the `roles` map.
export async function setProjectMember(
  projectId: string,
  memberUid: string,
  role: ProjectRole,
): Promise<void> {
  await updateDoc(doc(db, COL.projects, projectId), {
    memberIds: arrayUnion(memberUid),
    [`roles.${memberUid}`]: role,
    updatedAt: serverTimestamp(),
  });
}

export async function removeProjectMember(
  projectId: string,
  memberUid: string,
): Promise<void> {
  await updateDoc(doc(db, COL.projects, projectId), {
    memberIds: arrayRemove(memberUid),
    [`roles.${memberUid}`]: deleteField(),
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
  // Scoped by project only (not ownerId) so collaborators see each other's
  // tasks. The security rules gate access to project members; `uid` is kept in
  // the signature for callers and future per-user filtering.
  void uid;
  const q = query(
    collection(db, COL.tasks),
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
    parentId?: string | null;
    dueDate?: number | null;
    assigneeId?: string | null;
    note?: string;
    order?: number;
  },
): Promise<string> {
  const ref = await addDoc(collection(db, COL.tasks), {
    projectId: input.projectId,
    milestoneId: input.milestoneId ?? null,
    parentId: input.parentId ?? null,
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "todo",
    type: input.type ?? "feature",
    priority: input.priority ?? "medium",
    order: input.order ?? Date.now(),
    dueDate: input.dueDate ?? null,
    assigneeId: input.assigneeId ?? null,
    note: input.note ?? "",
    docId: null,
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
      | "parentId"
      | "assigneeId"
      | "note"
      | "docId"
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, COL.tasks, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

// Deletes a task and, in a single batch, any sub-tasks that hang off it so the
// board never ends up with orphaned children pointing at a missing parent.
export async function deleteTask(uid: string, id: string): Promise<void> {
  void uid;
  // Find sub-tasks by parent only (not ownerId) so a collaborator's children are
  // cascaded too; the rules gate who may actually delete each one.
  const subs = await getDocs(
    query(collection(db, COL.tasks), where("parentId", "==", id)),
  );
  if (subs.empty) {
    await deleteDoc(doc(db, COL.tasks, id));
    return;
  }
  const batch = writeBatch(db);
  subs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, COL.tasks, id));
  await batch.commit();
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

// --- documents (Notion-style nested docs) ----------------------------------

function mapDoc(id: string, data: DocumentData): Doc {
  return {
    id,
    title: data.title ?? "",
    icon: data.icon ?? null,
    content: data.content ?? "",
    contentText: data.contentText ?? "",
    parentId: data.parentId ?? null,
    projectId: data.projectId ?? null,
    order: data.order ?? 0,
    ownerId: data.ownerId,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

// Watch every doc the user owns. The tree (parent/child) and per-project views
// are derived client-side, so a single owner-scoped listener feeds them all and
// we avoid composite indexes.
export function watchDocs(uid: string, cb: (docs: Doc[]) => void): () => void {
  const q = query(collection(db, COL.docs), where("ownerId", "==", uid));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => mapDoc(d.id, d.data()));
    // siblings ordered by `order`, then newest; the tree builder reads this order
    docs.sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
    cb(docs);
  });
}

export async function createDocument(
  uid: string,
  input: {
    title?: string;
    content?: string;
    contentText?: string;
    icon?: string | null;
    parentId?: string | null;
    projectId?: string | null;
    order?: number;
  },
): Promise<string> {
  const ref = await addDoc(collection(db, COL.docs), {
    title: input.title ?? "Untitled",
    content: input.content ?? "",
    contentText: input.contentText ?? "",
    icon: input.icon ?? null,
    parentId: input.parentId ?? null,
    projectId: input.projectId ?? null,
    order: input.order ?? Date.now(),
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDocument(
  id: string,
  patch: Partial<
    Pick<
      Doc,
      | "title"
      | "content"
      | "contentText"
      | "icon"
      | "parentId"
      | "projectId"
      | "order"
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, COL.docs, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

// Deletes a doc and its entire subtree so the tree never holds orphaned children
// pointing at a missing parent. We resolve descendants client-side from the full
// owned set, then delete them in batches (Firestore caps a batch at 500 writes).
export async function deleteDocument(uid: string, id: string): Promise<void> {
  const all = await getDocs(
    query(collection(db, COL.docs), where("ownerId", "==", uid)),
  );
  const childrenOf = new Map<string | null, string[]>();
  all.forEach((d) => {
    const parentId = (d.data().parentId ?? null) as string | null;
    const list = childrenOf.get(parentId) ?? [];
    list.push(d.id);
    childrenOf.set(parentId, list);
  });

  const toDelete: string[] = [];
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    toDelete.push(current);
    stack.push(...(childrenOf.get(current) ?? []));
  }

  for (let i = 0; i < toDelete.length; i += 450) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + 450).forEach((docId) => {
      batch.delete(doc(db, COL.docs, docId));
    });
    await batch.commit();
  }
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
  // Project-scoped so collaborators share the same milestones; rules gate access.
  void uid;
  const q = query(
    collection(db, COL.milestones),
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

// --- user profiles ---------------------------------------------------------

function mapProfile(id: string, data: DocumentData): UserProfile {
  return {
    uid: id,
    name: data.name ?? "",
    email: data.email ?? "",
    photoURL: data.photoURL ?? null,
    updatedAt: ts(data.updatedAt),
  };
}

// Mirror the signed-in Firebase user into a queryable `users/{uid}` document so
// teammates can resolve them by uid for member lists, assignment, and comments.
export async function upsertUserProfile(user: User): Promise<void> {
  await setDoc(
    doc(db, COL.users, user.uid),
    {
      uid: user.uid,
      name: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// Fetch profiles for a set of uids (chunked — Firestore caps `in` at 10).
export async function fetchUserProfiles(
  uids: string[],
): Promise<Map<string, UserProfile>> {
  const out = new Map<string, UserProfile>();
  const unique = [...new Set(uids)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await getDocs(
      query(collection(db, COL.users), where(documentId(), "in", chunk)),
    );
    snap.docs.forEach((d) => out.set(d.id, mapProfile(d.id, d.data())));
  }
  return out;
}

// --- organizations ---------------------------------------------------------

function mapOrg(id: string, data: DocumentData): Organization {
  return {
    id,
    name: data.name ?? "",
    ownerId: data.ownerId,
    memberIds: data.memberIds ?? [],
    joinCode: data.joinCode ?? "",
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

// Short, unambiguous, shareable join code (no easily-confused characters).
function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function watchOrganizations(
  uid: string,
  cb: (orgs: Organization[]) => void,
): () => void {
  const q = query(
    collection(db, COL.organizations),
    where("memberIds", "array-contains", uid),
  );
  return onSnapshot(q, (snap) => {
    const orgs = snap.docs.map((d) => mapOrg(d.id, d.data()));
    orgs.sort((a, b) => a.createdAt - b.createdAt);
    cb(orgs);
  });
}

export async function createOrganization(
  uid: string,
  name: string,
): Promise<string> {
  const ref = await addDoc(collection(db, COL.organizations), {
    name: name.trim() || "My organization",
    ownerId: uid,
    memberIds: [uid],
    joinCode: generateJoinCode(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameOrganization(
  id: string,
  name: string,
): Promise<void> {
  await updateDoc(doc(db, COL.organizations, id), {
    name: name.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteOrganization(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.organizations, id));
}

// Remove a member from the org (owner-only per rules). Does not touch the
// member's existing per-project access.
export async function removeOrgMember(
  orgId: string,
  memberUid: string,
): Promise<void> {
  await updateDoc(doc(db, COL.organizations, orgId), {
    memberIds: arrayRemove(memberUid),
    updatedAt: serverTimestamp(),
  });
}

// --- comments --------------------------------------------------------------

function mapComment(id: string, data: DocumentData): Comment {
  return {
    id,
    taskId: data.taskId,
    projectId: data.projectId,
    authorId: data.authorId,
    body: data.body ?? "",
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

export function watchComments(
  taskId: string,
  cb: (comments: Comment[]) => void,
): () => void {
  const q = query(collection(db, COL.comments), where("taskId", "==", taskId));
  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map((d) => mapComment(d.id, d.data()));
    comments.sort((a, b) => a.createdAt - b.createdAt);
    cb(comments);
  });
}

export async function addComment(
  uid: string,
  input: { taskId: string; projectId: string; body: string },
): Promise<string> {
  const ref = await addDoc(collection(db, COL.comments), {
    taskId: input.taskId,
    projectId: input.projectId,
    authorId: uid,
    body: input.body.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteComment(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.comments, id));
}

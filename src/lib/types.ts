// Core domain model for Nexus (projects + knowledge).
// Firestore stores timestamps as `Timestamp`; we convert to millis (number) on read
// so the rest of the app deals in plain serializable values.

export type TaskStatus = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high";
export type ProjectStatus = "active" | "archived";
export type TaskType = "feature" | "bug" | "improvement" | "chore";
export type MilestoneStatus = "planned" | "active" | "shipped";

// Per-project collaboration role.
//   admin  — manage the project, its members, and all tasks
//   member — create/edit/assign tasks and comment
//   viewer — read tasks and comment only (cannot edit tasks)
export type ProjectRole = "admin" | "member" | "viewer";

// A lightweight, public-ish mirror of a Firebase Auth user, written on sign-in.
// Firebase Auth users aren't queryable from the client, so we keep this so we can
// render assignees/commenters by name and resolve teammates for collaboration.
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  updatedAt: number;
}

// An organization is the people pool for collaboration: members can be added to
// the org's projects. Joining is by shareable code or email invite.
export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[]; // everyone in the org
  joinCode: string; // shareable code to join the org
  createdAt: number;
  updatedAt: number;
}

// A comment on a task. Anyone with access to the task's project (any role,
// including viewer) may post one.
export interface Comment {
  id: string;
  taskId: string;
  projectId: string;
  authorId: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string; // tailwind-ish accent token, e.g. "blue"
  status: ProjectStatus;
  ownerId: string;
  // Collaboration. `orgId` links the project to an organization (the member
  // pool). `memberIds` lists everyone with access (always includes the owner)
  // and is what we query on; `roles` maps each member uid → their project role.
  orgId: string | null;
  memberIds: string[];
  roles: Record<string, ProjectRole>;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId: string | null; // optional link to a milestone/release
  parentId: string | null; // optional link to a parent task (this task is a sub-task)
  title: string;
  description: string;
  status: TaskStatus;
  type: TaskType;
  priority: Priority;
  order: number; // sort order within a status column
  dueDate: number | null;
  assigneeId: string | null; // uid of the project member this task is assigned to
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

// A milestone groups tasks toward a shippable release. It is the planning +
// shipping spine that lets a single project be driven end-to-end: plan → build → ship.
export interface Milestone {
  id: string;
  projectId: string;
  name: string; // e.g. "v1.0 — Public launch"
  description: string;
  status: MilestoneStatus;
  targetDate: number | null;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string; // markdown
  tags: string[];
  projectId: string | null; // optional link to a project
  pinned: boolean;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

// A Notion-style document. Unlike a Note (a flat markdown card), a Doc forms a
// tree: any doc may have a `parentId` pointing at another doc, so docs nest into
// pages and sub-pages. `content` is the editor's block JSON (stringified); we
// also keep a plain-text/markdown rendering in `contentText` for search and for
// the MCP/API to read without parsing block JSON.
export interface Doc {
  id: string;
  title: string;
  icon: string | null; // emoji shown in the tree, e.g. "📄"
  content: string; // BlockNote block JSON, stringified
  contentText: string; // markdown/plain-text export — search + MCP readability
  parentId: string | null; // parent doc (null = top level)
  projectId: string | null; // optional link to a project
  order: number; // sort order among siblings
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "feature", label: "Feature" },
  { value: "improvement", label: "Improvement" },
  { value: "bug", label: "Bug" },
  { value: "chore", label: "Chore" },
];

export const MILESTONE_STATUSES: { value: MilestoneStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "shipped", label: "Shipped" },
];

export const PROJECT_ROLES: {
  value: ProjectRole;
  label: string;
  hint: string;
}[] = [
  { value: "admin", label: "Admin", hint: "Manage project, members & tasks" },
  { value: "member", label: "Member", hint: "Edit & assign tasks, comment" },
  { value: "viewer", label: "Viewer", hint: "View tasks & comment only" },
];

export const PROJECT_COLORS = [
  "blue",
  "violet",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "fuchsia",
  "lime",
] as const;

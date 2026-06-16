// Core domain model for Nexus (projects + knowledge).
// Firestore stores timestamps as `Timestamp`; we convert to millis (number) on read
// so the rest of the app deals in plain serializable values.

export type TaskStatus = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high";
export type ProjectStatus = "active" | "archived";
export type TaskType = "feature" | "bug" | "improvement" | "chore";
export type MilestoneStatus = "planned" | "active" | "shipped";

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string; // tailwind-ish accent token, e.g. "blue"
  status: ProjectStatus;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId: string | null; // optional link to a milestone/release
  title: string;
  description: string;
  status: TaskStatus;
  type: TaskType;
  priority: Priority;
  order: number; // sort order within a status column
  dueDate: number | null;
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

// Linear-style multi-dimensional task filtering. The board page owns a single
// `TaskFilters` value; everything here is pure so it can be tested and memoized.

import type { Task, TaskStatus, Priority, TaskType } from "./types";

// Due-date presets. These intentionally overlap (e.g. "overdue" and "this week"
// can both be on) and are OR-ed together within the dimension.
export type DuePreset = "overdue" | "today" | "week" | "month" | "none" | "has";

export const DUE_PRESETS: { value: DuePreset; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due this week" },
  { value: "month", label: "Due this month" },
  { value: "has", label: "Has a due date" },
  { value: "none", label: "No due date" },
];

// Sentinel for "unassigned" inside the assignee dimension (uids otherwise).
export const UNASSIGNED = "__unassigned__";

export interface TaskFilters {
  search: string;
  status: TaskStatus[];
  priority: Priority[];
  type: TaskType[];
  assignee: string[]; // member uids, or UNASSIGNED
  due: DuePreset[];
}

export const EMPTY_FILTERS: TaskFilters = {
  search: "",
  status: [],
  priority: [],
  type: [],
  assignee: [],
  due: [],
};

export type SortKey =
  | "manual"
  | "priority"
  | "due"
  | "created"
  | "updated"
  | "title";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "priority", label: "Priority" },
  { value: "due", label: "Due date" },
  { value: "created", label: "Recently created" },
  { value: "updated", label: "Recently updated" },
  { value: "title", label: "Title (A–Z)" },
];

// Which dimensions are currently narrowing the list. Search counts as one.
export function activeFilterCount(f: TaskFilters): number {
  return (
    (f.search.trim() ? 1 : 0) +
    (f.status.length ? 1 : 0) +
    (f.priority.length ? 1 : 0) +
    (f.type.length ? 1 : 0) +
    (f.assignee.length ? 1 : 0) +
    (f.due.length ? 1 : 0)
  );
}

export function hasActiveFilters(f: TaskFilters): boolean {
  return activeFilterCount(f) > 0;
}

const DAY = 86_400_000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function matchesDue(task: Task, presets: DuePreset[], now: number): boolean {
  if (presets.length === 0) return true;
  const today0 = startOfDay(now);
  const tomorrow0 = today0 + DAY;
  const weekEnd = today0 + 7 * DAY;
  const monthEnd = today0 + 30 * DAY;
  const due = task.dueDate;
  return presets.some((p) => {
    switch (p) {
      case "none":
        return due == null;
      case "has":
        return due != null;
      case "overdue":
        return due != null && due < now && task.status !== "done";
      case "today":
        return due != null && due >= today0 && due < tomorrow0;
      case "week":
        return due != null && due >= today0 && due < weekEnd;
      case "month":
        return due != null && due >= today0 && due < monthEnd;
      default:
        return false;
    }
  });
}

function textHit(task: Task, q: string): boolean {
  return (
    task.title.toLowerCase().includes(q) ||
    task.description.toLowerCase().includes(q)
  );
}

// Everything except free-text search — applied to top-level tasks.
function matchesFacets(task: Task, f: TaskFilters, now: number): boolean {
  if (f.status.length && !f.status.includes(task.status)) return false;
  if (f.priority.length && !f.priority.includes(task.priority)) return false;
  if (f.type.length && !f.type.includes(task.type)) return false;
  if (f.assignee.length) {
    const key = task.assigneeId ?? UNASSIGNED;
    if (!f.assignee.includes(key)) return false;
  }
  if (!matchesDue(task, f.due, now)) return false;
  return true;
}

// A top-level task passes when it clears every active facet AND the search query
// hits the task or any of its sub-tasks (so a parent never drops its matching
// children out of view).
export function taskMatches(
  task: Task,
  subtasks: Task[],
  f: TaskFilters,
  now: number,
): boolean {
  if (!matchesFacets(task, f, now)) return false;
  const q = f.search.trim().toLowerCase();
  if (!q) return true;
  return textHit(task, q) || subtasks.some((s) => textHit(s, q));
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

// Returns a new array; "manual" preserves the caller's incoming order (the
// Firestore `order`/`createdAt` sort) so drag-and-drop stays meaningful.
export function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  if (sort === "manual") return tasks;
  const arr = [...tasks];
  switch (sort) {
    case "priority":
      arr.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          a.order - b.order,
      );
      break;
    case "due":
      // Tasks without a due date sink to the bottom.
      arr.sort(
        (a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity),
      );
      break;
    case "created":
      arr.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "updated":
      arr.sort((a, b) => b.updatedAt - a.updatedAt);
      break;
    case "title":
      arr.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return arr;
}

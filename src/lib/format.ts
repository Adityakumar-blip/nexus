// Small presentation helpers shared across the UI.

export function initials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return "?";
  const base = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0]
    : nameOrEmail;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: day > 365 ? "numeric" : undefined,
  });
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isOverdue(dueMs: number | null): boolean {
  if (dueMs == null) return false;
  return dueMs < Date.now();
}

// Human label for a target date relative to today, e.g. "Due in 5 days",
// "Due today", "3 days overdue". Used by milestones on the roadmap.
export function targetLabel(targetMs: number | null): string | null {
  if (targetMs == null) return null;
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round(
    (startOfDay(targetMs) - startOfDay(Date.now())) / 86_400_000,
  );
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${-days} days overdue`;
  if (days <= 14) return `Due in ${days} days`;
  return `Due ${formatDate(targetMs)}`;
}

// Accent classes per project color token. Kept here so projects and tasks
// share one palette. Tailwind needs these as literal strings to keep them.
export const COLOR_CLASSES: Record<
  string,
  { dot: string; soft: string; text: string; ring: string }
> = {
  blue: {
    dot: "bg-blue-500",
    soft: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/30",
  },
  violet: {
    dot: "bg-violet-500",
    soft: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/30",
  },
  emerald: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
  },
  amber: {
    dot: "bg-amber-500",
    soft: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30",
  },
  rose: {
    dot: "bg-rose-500",
    soft: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30",
  },
  cyan: {
    dot: "bg-cyan-500",
    soft: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
    ring: "ring-cyan-500/30",
  },
  fuchsia: {
    dot: "bg-fuchsia-500",
    soft: "bg-fuchsia-500/10",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    ring: "ring-fuchsia-500/30",
  },
  lime: {
    dot: "bg-lime-500",
    soft: "bg-lime-500/10",
    text: "text-lime-600 dark:text-lime-400",
    ring: "ring-lime-500/30",
  },
};

export function colorClasses(token: string) {
  return COLOR_CLASSES[token] ?? COLOR_CLASSES.blue;
}

export const PRIORITY_CLASSES: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-rose-600 dark:text-rose-400",
};

// Badge styling per task type. Literal class strings so Tailwind keeps them.
export const TASK_TYPE_META: Record<
  string,
  { label: string; badge: string }
> = {
  feature: {
    label: "Feature",
    badge:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  improvement: {
    label: "Improvement",
    badge:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  bug: {
    label: "Bug",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  chore: {
    label: "Chore",
    badge: "bg-muted text-muted-foreground border-transparent",
  },
};

export function taskTypeMeta(type: string) {
  return TASK_TYPE_META[type] ?? TASK_TYPE_META.feature;
}

// Styling + label per milestone status.
export const MILESTONE_STATUS_META: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  planned: {
    label: "Planned",
    dot: "bg-muted-foreground",
    badge: "bg-muted text-muted-foreground border-transparent",
  },
  active: {
    label: "Active",
    dot: "bg-blue-500",
    badge:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  shipped: {
    label: "Shipped",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
};

export function milestoneStatusMeta(status: string) {
  return MILESTONE_STATUS_META[status] ?? MILESTONE_STATUS_META.planned;
}

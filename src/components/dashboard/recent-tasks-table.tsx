"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Check,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  ListChecks,
} from "lucide-react";
import { TASK_STATUSES, type TaskStatus, type UserProfile } from "@/lib/types";
import { STATUS_BADGE, STATUS_DOT, formatDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserAvatar, displayName } from "@/components/user-avatar";
import { ProgressBar, RangeMenu } from "@/components/dashboard/primitives";

export interface RecentTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  done: boolean;
  projectName?: string;
  projectColor?: string; // tailwind bg-* class for the dot
  assignee?: UserProfile;
  progress: number; // 0–100
  dueDate: number | null;
}

type SortKey = "title" | "project" | "status" | "progress" | "due";
type Filter = "all" | "active" | "completed" | "overdue";

const STATUS_LABEL = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s.label]),
) as Record<TaskStatus, string>;

// The "Recent Tasks" table: searchable, status-filterable, sortable, with an
// inline complete toggle, assignee, project, status pill, and a progress bar.
export function RecentTasksTable({
  rows,
  onToggleDone,
  onOpen,
}: {
  rows: RecentTaskRow[];
  onToggleDone?: (id: string, done: boolean) => void;
  onOpen?: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "due",
    dir: 1,
  });

  const view = useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const needle = q.toLowerCase();
      r = r.filter((x) => x.title.toLowerCase().includes(needle));
    }
    if (filter === "active") r = r.filter((x) => !x.done);
    else if (filter === "completed") r = r.filter((x) => x.done);
    else if (filter === "overdue")
      r = r.filter((x) => !x.done && isOverdue(x.dueDate));

    const dir = sort.dir;
    return [...r].sort((a, b) => {
      switch (sort.key) {
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "project":
          return dir * (a.projectName ?? "").localeCompare(b.projectName ?? "");
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "progress":
          return dir * (a.progress - b.progress);
        case "due":
          return dir * ((a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));
      }
    });
  }, [rows, q, filter, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="text-muted-foreground size-4" />
          Recent Tasks
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search task"
              className="h-8 w-44 pl-8 text-sm"
            />
          </div>
          <RangeMenu<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All tasks" },
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
              { value: "overdue", label: "Overdue" },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-muted-foreground border-y text-xs">
              <Th onClick={() => toggleSort("title")} sort={sort} col="title">
                Task
              </Th>
              <Th>Assigned To</Th>
              <Th onClick={() => toggleSort("project")} sort={sort} col="project">
                Project
              </Th>
              <Th onClick={() => toggleSort("status")} sort={sort} col="status">
                Status
              </Th>
              <Th
                onClick={() => toggleSort("progress")}
                sort={sort}
                col="progress"
              >
                Progress
              </Th>
              <Th onClick={() => toggleSort("due")} sort={sort} col="due">
                Due Date
              </Th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {view.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-muted-foreground py-10 text-center text-sm"
                >
                  No tasks to show.
                </td>
              </tr>
            ) : (
              view.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-muted/40 group transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        aria-label={t.done ? "Mark not done" : "Mark done"}
                        onClick={() => onToggleDone?.(t.id, !t.done)}
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                          t.done
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-muted-foreground/40 hover:border-foreground",
                        )}
                      >
                        {t.done && <Check className="size-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpen?.(t.id)}
                        className={cn(
                          "truncate text-left font-medium hover:underline",
                          t.done && "text-muted-foreground line-through",
                        )}
                      >
                        {t.title}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {t.assignee ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar profile={t.assignee} className="size-6" />
                        <span className="text-muted-foreground truncate text-xs">
                          {displayName(t.assignee)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          t.projectColor ?? "bg-muted-foreground",
                        )}
                      />
                      <span className="truncate">{t.projectName ?? "—"}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                        STATUS_BADGE[t.status],
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          STATUS_DOT[t.status],
                        )}
                      />
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {t.progress > 0 || t.done ? (
                      <div className="flex items-center gap-2">
                        <ProgressBar value={t.progress} className="w-24" />
                        <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
                          {Math.round(t.progress)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">
                        Not started
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-xs whitespace-nowrap",
                      !t.done && isOverdue(t.dueDate)
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {t.dueDate != null ? formatDate(t.dueDate) : "—"}
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      aria-label="Task actions"
                      onClick={() => onOpen?.(t.id)}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-7 items-center justify-center rounded-md opacity-0 transition group-hover:opacity-100"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({
  children,
  onClick,
  sort,
  col,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  sort?: { key: SortKey; dir: 1 | -1 };
  col?: SortKey;
}) {
  const active = sort && col && sort.key === col;
  return (
    <th className="px-4 py-2.5 text-left font-medium">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          {children}
          {active ? (
            sort!.dir === 1 ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )
          ) : (
            <ChevronsUpDown className="size-3 opacity-40" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

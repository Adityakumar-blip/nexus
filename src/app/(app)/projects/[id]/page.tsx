"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Calendar,
  Flag,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  watchProjects,
  watchTasks,
  watchMilestones,
  updateTask,
} from "@/lib/store";
import {
  TASK_STATUSES,
  type Project,
  type Task,
  type TaskStatus,
  type Milestone,
} from "@/lib/types";
import {
  colorClasses,
  formatDate,
  isOverdue,
  targetLabel,
  taskTypeMeta,
  milestoneStatusMeta,
  PRIORITY_CLASSES,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { TaskDialog } from "@/components/task-dialog";
import { ProjectDialog } from "@/components/project-dialog";
import { MilestoneDialog } from "@/components/milestone-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Filter sentinels alongside real milestone ids.
const ALL = "all";
const NO_MS = "none";

export default function ProjectBoardPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    task?: Task;
    status: TaskStatus;
  }>({ open: false, status: "todo" });
  const [editProject, setEditProject] = useState(false);
  const [milestoneDialog, setMilestoneDialog] = useState<{
    open: boolean;
    milestone?: Milestone;
  }>({ open: false });
  const [filter, setFilter] = useState<string>(ALL);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (!user) return;
    const u1 = watchProjects(user.uid, setProjects);
    const u2 = watchTasks(user.uid, projectId, setTasks);
    const u3 = watchMilestones(user.uid, projectId, setMilestones);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user, projectId]);

  // Honor a deep link from the roadmap, e.g. /projects/abc?m=<milestoneId>.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    if (m) setFilter(m);
  }, []);

  const project = useMemo(
    () => (projects ?? []).find((p) => p.id === projectId),
    [projects, projectId],
  );

  const visibleTasks = useMemo(() => {
    const all = tasks ?? [];
    if (filter === ALL) return all;
    if (filter === NO_MS) return all.filter((t) => !t.milestoneId);
    return all.filter((t) => t.milestoneId === filter);
  }, [tasks, filter]);

  const grouped = useMemo(() => {
    const g: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    visibleTasks.forEach((t) => g[t.status]?.push(t));
    return g;
  }, [visibleTasks]);

  // done/total per milestone for the chips + progress bar
  const progressFor = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    (tasks ?? []).forEach((t) => {
      if (!t.milestoneId) return;
      const cur = map.get(t.milestoneId) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (t.status === "done") cur.done += 1;
      map.set(t.milestoneId, cur);
    });
    return map;
  }, [tasks]);

  const activeMilestone = useMemo(
    () => milestones.find((m) => m.id === filter),
    [milestones, filter],
  );

  async function moveTask(taskId: string, status: TaskStatus) {
    const task = (tasks ?? []).find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    try {
      await updateTask(taskId, { status });
    } catch {
      toast.error("Could not move task");
    }
  }

  function openNew(status: TaskStatus) {
    setTaskDialog({ open: true, status });
  }

  function openEdit(task: Task) {
    setTaskDialog({ open: true, task, status: task.status });
  }

  // Project list loaded but this id not found
  if (projects !== null && !project) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">This project doesn&apos;t exist.</p>
        <Button variant="outline" onClick={() => router.push("/projects")}>
          <ArrowLeft className="size-4" />
          Back to projects
        </Button>
      </div>
    );
  }

  const cc = colorClasses(project?.color ?? "blue");
  const loading = tasks === null || projects === null;
  const defaultMilestoneId =
    filter === ALL || filter === NO_MS ? null : filter;

  return (
    <>
      <div className="border-b px-6 py-5">
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Projects
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className={`size-3 rounded-full ${cc.dot}`} />
              <h1 className="text-2xl font-semibold tracking-tight">
                {project ? project.name : <Skeleton className="h-7 w-40" />}
              </h1>
            </div>
            {project?.description && (
              <p className="text-muted-foreground max-w-2xl text-sm">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {project && (
              <Button variant="outline" onClick={() => setEditProject(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            )}
            <Button onClick={() => openNew("todo")}>
              <Plus className="size-4" />
              Add task
            </Button>
          </div>
        </div>

        {/* Releases / milestones filter bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FilterChip
            active={filter === ALL}
            onClick={() => setFilter(ALL)}
            label="All tasks"
          />
          {milestones.map((m) => {
            const p = progressFor.get(m.id);
            const sm = milestoneStatusMeta(m.status);
            return (
              <FilterChip
                key={m.id}
                active={filter === m.id}
                onClick={() => setFilter(m.id)}
                label={m.name}
                dot={sm.dot}
                count={p ? `${p.done}/${p.total}` : undefined}
              />
            );
          })}
          <FilterChip
            active={filter === NO_MS}
            onClick={() => setFilter(NO_MS)}
            label="No milestone"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setMilestoneDialog({ open: true })}
          >
            <Rocket className="size-3.5" />
            New milestone
          </Button>
        </div>

        {/* Selected milestone detail */}
        {activeMilestone && (
          <MilestoneBanner
            milestone={activeMilestone}
            progress={progressFor.get(activeMilestone.id)}
            onEdit={() =>
              setMilestoneDialog({ open: true, milestone: activeMilestone })
            }
          />
        )}
      </div>

      <div className="grid auto-rows-min gap-4 p-6 md:grid-cols-3">
        {TASK_STATUSES.map((col) => {
          const items = grouped[col.value];
          const isOver = dragOver === col.value;
          return (
            <div
              key={col.value}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.value);
              }}
              onDragLeave={() => setDragOver((s) => (s === col.value ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) moveTask(dragId, col.value);
                setDragId(null);
                setDragOver(null);
              }}
              className={cn(
                "bg-muted/40 flex flex-col gap-3 rounded-xl border p-3 transition-colors",
                isOver && "border-primary bg-accent",
              )}
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{col.label}</h2>
                  <Badge variant="secondary" className="rounded-full">
                    {loading ? "·" : items.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => openNew(col.value)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="flex min-h-12 flex-col gap-2">
                {loading ? (
                  <>
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                  </>
                ) : items.length === 0 ? (
                  <button
                    onClick={() => openNew(col.value)}
                    className="text-muted-foreground hover:border-foreground/30 hover:text-foreground rounded-lg border border-dashed py-6 text-center text-xs transition-colors"
                  >
                    Add a task
                  </button>
                ) : (
                  items.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      milestoneName={
                        filter === ALL && t.milestoneId
                          ? milestones.find((m) => m.id === t.milestoneId)?.name
                          : undefined
                      }
                      dragging={dragId === t.id}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOver(null);
                      }}
                      onClick={() => openEdit(t)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(open) => setTaskDialog((s) => ({ ...s, open }))}
        projectId={projectId}
        task={taskDialog.task}
        defaultStatus={taskDialog.status}
        defaultMilestoneId={defaultMilestoneId}
        milestones={milestones}
      />
      {project && (
        <ProjectDialog
          open={editProject}
          onOpenChange={setEditProject}
          project={project}
        />
      )}
      <MilestoneDialog
        open={milestoneDialog.open}
        onOpenChange={(open) =>
          setMilestoneDialog((s) => ({ ...s, open }))
        }
        projectId={projectId}
        milestone={milestoneDialog.milestone}
      />
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  dot,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dot?: string;
  count?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground hover:border-foreground/30",
      )}
    >
      {dot && <span className={cn("size-2 rounded-full", dot)} />}
      <span className="max-w-[14rem] truncate">{label}</span>
      {count && (
        <span
          className={cn(
            "tabular-nums",
            active ? "text-background/70" : "text-muted-foreground/70",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function MilestoneBanner({
  milestone,
  progress,
  onEdit,
}: {
  milestone: Milestone;
  progress?: { done: number; total: number };
  onEdit: () => void;
}) {
  const sm = milestoneStatusMeta(milestone.status);
  const pct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;
  const overdue =
    milestone.status !== "shipped" && isOverdue(milestone.targetDate);
  return (
    <div className="bg-muted/40 mt-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", sm.badge)}>
              <span className={cn("size-1.5 rounded-full", sm.dot)} />
              {sm.label}
            </span>
            <h3 className="text-sm font-semibold">{milestone.name}</h3>
          </div>
          {milestone.description && (
            <p className="text-muted-foreground max-w-2xl text-sm">
              {milestone.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {milestone.targetDate != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <Calendar className="size-3" />
              {targetLabel(milestone.targetDate)}
            </span>
          )}
          <Button variant="ghost" size="sm" className="h-7" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
          <div
            className="bg-foreground h-full rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-muted-foreground w-20 text-right text-xs tabular-nums">
          {progress?.done ?? 0}/{progress?.total ?? 0} done
        </span>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  milestoneName,
  dragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  task: Task;
  milestoneName?: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const overdue = task.status !== "done" && isOverdue(task.dueDate);
  const tm = taskTypeMeta(task.type);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "bg-card group cursor-pointer space-y-2 rounded-lg border p-3 shadow-sm transition-all hover:shadow-md",
        dragging && "opacity-40",
        task.status === "done" && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            tm.badge,
          )}
        >
          {tm.label}
        </span>
        {milestoneName && (
          <span className="text-muted-foreground inline-flex items-center gap-1 truncate text-[10px]">
            <Rocket className="size-3 shrink-0" />
            <span className="truncate">{milestoneName}</span>
          </span>
        )}
      </div>
      <p
        className={cn(
          "text-sm leading-snug font-medium",
          task.status === "done" && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </p>
      {task.description && (
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {task.description}
        </p>
      )}
      {(task.dueDate != null || task.priority !== "medium") && (
        <div className="flex items-center gap-3 pt-0.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs capitalize",
              PRIORITY_CLASSES[task.priority],
            )}
          >
            <Flag className="size-3" />
            {task.priority}
          </span>
          {task.dueDate != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <Calendar className="size-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

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
  ChevronRight,
  CheckCircle2,
  Circle,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  watchProjects,
  watchTasks,
  watchMilestones,
  updateTask,
  fetchUserProfiles,
} from "@/lib/store";
import {
  TASK_STATUSES,
  type Project,
  type Task,
  type TaskStatus,
  type Milestone,
  type ProjectRole,
  type UserProfile,
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
import { ProjectMembersDialog } from "@/components/project-members-dialog";
import { MilestoneDialog } from "@/components/milestone-dialog";
import { DocsWorkspace } from "@/components/docs-workspace";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Inline status dot colors for the list view.
const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
};

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
    parentId?: string | null;
  }>({ open: false, status: "todo" });
  const [editProject, setEditProject] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [milestoneDialog, setMilestoneDialog] = useState<{
    open: boolean;
    milestone?: Milestone;
  }>({ open: false });
  const [filter, setFilter] = useState<string>(ALL);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [view, setView] = useState<"board" | "docs">("board");
  const [layout, setLayout] = useState<"kanban" | "list">("kanban");

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

  // The current user's role on this project drives what they can do: admins and
  // members edit tasks; viewers can only read and comment.
  const myRole: ProjectRole | null = useMemo(() => {
    if (!project || !user) return null;
    if (project.ownerId === user.uid) return "admin";
    return project.roles[user.uid] ?? null;
  }, [project, user]);
  const canEdit = myRole === "admin" || myRole === "member";

  // Load profiles for project members so we can show avatars + assignees.
  const memberIds = project?.memberIds;
  useEffect(() => {
    if (!memberIds || memberIds.length === 0) return;
    fetchUserProfiles(memberIds).then((m) =>
      setProfiles((prev) => new Map([...prev, ...m])),
    );
  }, [memberIds]);

  const visibleTasks = useMemo(() => {
    const all = tasks ?? [];
    if (filter === ALL) return all;
    if (filter === NO_MS) return all.filter((t) => !t.milestoneId);
    return all.filter((t) => t.milestoneId === filter);
  }, [tasks, filter]);

  // Top-level cards on the board are tasks without a parent; sub-tasks are
  // nested inside their parent's card instead of getting their own column slot.
  const grouped = useMemo(() => {
    const g: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    visibleTasks.forEach((t) => {
      if (t.parentId) return;
      g[t.status]?.push(t);
    });
    return g;
  }, [visibleTasks]);

  // parentId -> its sub-tasks (drawn from all tasks, not just the filtered set,
  // so a parent's children always travel with it).
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    (tasks ?? []).forEach((t) => {
      if (!t.parentId) return;
      const list = map.get(t.parentId) ?? [];
      list.push(t);
      map.set(t.parentId, list);
    });
    for (const list of map.values()) {
      list.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    }
    return map;
  }, [tasks]);

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
    setTaskDialog({ open: true, status, parentId: null });
  }

  function openEdit(task: Task) {
    setTaskDialog({ open: true, task, status: task.status });
  }

  function openNewSubtask(parent: Task) {
    setTaskDialog({ open: true, status: "todo", parentId: parent.id });
  }

  async function toggleSubtask(task: Task) {
    try {
      await updateTask(task.id, {
        status: task.status === "done" ? "todo" : "done",
      });
    } catch {
      toast.error("Could not update sub-task");
    }
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
            {view === "board" && (
              <div className="bg-muted/60 flex items-center rounded-md border p-0.5">
                <LayoutToggle
                  active={layout === "kanban"}
                  onClick={() => setLayout("kanban")}
                  label="Board view"
                  icon={<LayoutGrid className="size-4" />}
                />
                <LayoutToggle
                  active={layout === "list"}
                  onClick={() => setLayout("list")}
                  label="List view"
                  icon={<List className="size-4" />}
                />
              </div>
            )}
            {project && (
              <Button
                variant="outline"
                onClick={() => setMembersOpen(true)}
                className="gap-2"
              >
                <MemberAvatars
                  members={project.memberIds}
                  profiles={profiles}
                />
                <span>Members</span>
              </Button>
            )}
            {project && myRole === "admin" && (
              <Button variant="outline" onClick={() => setEditProject(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            )}
            {view === "board" && canEdit && (
              <Button onClick={() => openNew("todo")}>
                <Plus className="size-4" />
                Add task
              </Button>
            )}
          </div>
        </div>

        {/* View switcher: board vs docs */}
        <div className="mt-4 flex gap-1">
          <ViewTab
            active={view === "board"}
            onClick={() => setView("board")}
            label="Board"
          />
          <ViewTab
            active={view === "docs"}
            onClick={() => setView("docs")}
            label="Docs"
          />
        </div>

        {view === "board" && (
          <>
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
          </>
        )}
      </div>

      {view === "docs" ? (
        <div className="h-[calc(100svh-185px)]">
          <DocsWorkspace projectId={projectId} />
        </div>
      ) : layout === "list" ? (
        <TaskListView
          loading={loading}
          grouped={grouped}
          subtasksByParent={subtasksByParent}
          milestones={milestones}
          showMilestone={filter === ALL}
          profiles={profiles}
          canEdit={canEdit}
          onOpenTask={openEdit}
          onStatusChange={moveTask}
          onAddTask={() => openNew("todo")}
        />
      ) : (
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
                      subtasks={subtasksByParent.get(t.id) ?? []}
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
                      onEditSubtask={openEdit}
                      onToggleSubtask={toggleSubtask}
                      onAddSubtask={() => openNewSubtask(t)}
                      assignee={
                        t.assigneeId ? profiles.get(t.assigneeId) : undefined
                      }
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(open) => setTaskDialog((s) => ({ ...s, open }))}
        projectId={projectId}
        task={taskDialog.task}
        defaultStatus={taskDialog.status}
        defaultMilestoneId={defaultMilestoneId}
        defaultParentId={taskDialog.parentId ?? null}
        milestones={milestones}
        tasks={tasks ?? []}
        canEdit={canEdit}
        memberIds={project?.memberIds ?? []}
        profiles={profiles}
      />
      {project && (
        <ProjectDialog
          open={editProject}
          onOpenChange={setEditProject}
          project={project}
        />
      )}
      {project && (
        <ProjectMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
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

function ViewTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
      )}
    >
      {label}
    </button>
  );
}

function LayoutToggle({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-sm transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}

function TaskListView({
  loading,
  grouped,
  subtasksByParent,
  milestones,
  showMilestone,
  profiles,
  canEdit,
  onOpenTask,
  onStatusChange,
  onAddTask,
}: {
  loading: boolean;
  grouped: Record<TaskStatus, Task[]>;
  subtasksByParent: Map<string, Task[]>;
  milestones: Milestone[];
  showMilestone: boolean;
  profiles: Map<string, UserProfile>;
  canEdit: boolean;
  onOpenTask: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onAddTask: () => void;
}) {
  // One flat list — not split by status. We keep a stable order (To Do →
  // In Progress → Done) so rows don't jump around as statuses change.
  const items = [
    ...grouped.todo,
    ...grouped.in_progress,
    ...grouped.done,
  ];

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {items.length === 0 ? (
        <button
          onClick={onAddTask}
          className="text-muted-foreground hover:border-foreground/30 hover:text-foreground w-full rounded-lg border border-dashed py-8 text-center text-sm transition-colors"
        >
          Add a task
        </button>
      ) : (
        <div className="divide-y overflow-hidden rounded-lg border">
          {items.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              subtasks={subtasksByParent.get(t.id) ?? []}
              milestoneName={
                showMilestone && t.milestoneId
                  ? milestones.find((m) => m.id === t.milestoneId)?.name
                  : undefined
              }
              assignee={t.assigneeId ? profiles.get(t.assigneeId) : undefined}
              canEdit={canEdit}
              onClick={() => onOpenTask(t)}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  subtasks,
  milestoneName,
  assignee,
  canEdit,
  onClick,
  onStatusChange,
}: {
  task: Task;
  subtasks: Task[];
  milestoneName?: string;
  assignee?: UserProfile;
  canEdit: boolean;
  onClick: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const overdue = task.status !== "done" && isOverdue(task.dueDate);
  const tm = taskTypeMeta(task.type);
  const doneCount = subtasks.filter((s) => s.status === "done").length;
  return (
    <div
      onClick={onClick}
      className={cn(
        "hover:bg-muted/50 flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors",
        task.status === "done" && "opacity-70",
      )}
    >
      {/* Inline status — change it without opening the task. */}
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Select
          value={task.status}
          onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}
          disabled={!canEdit}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-[8.5rem] gap-1.5 border-transparent bg-transparent text-xs shadow-none hover:bg-transparent disabled:opacity-100"
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  STATUS_DOT[task.status],
                )}
              />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn("size-2 rounded-full", STATUS_DOT[s.value])}
                  />
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
          tm.badge,
        )}
      >
        {tm.label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium",
          task.status === "done" && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </span>
      {subtasks.length > 0 && (
        <span className="text-muted-foreground hidden shrink-0 items-center gap-1 text-xs tabular-nums sm:inline-flex">
          <CheckCircle2 className="size-3" />
          {doneCount}/{subtasks.length}
        </span>
      )}
      {milestoneName && (
        <span className="text-muted-foreground hidden shrink-0 items-center gap-1 text-xs md:inline-flex">
          <Rocket className="size-3" />
          <span className="max-w-[10rem] truncate">{milestoneName}</span>
        </span>
      )}
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 text-xs capitalize",
          PRIORITY_CLASSES[task.priority],
        )}
      >
        <Flag className="size-3" />
        <span className="hidden sm:inline">{task.priority}</span>
      </span>
      {task.dueDate != null && (
        <span
          className={cn(
            "hidden shrink-0 items-center gap-1 text-xs sm:inline-flex",
            overdue ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <Calendar className="size-3" />
          {formatDate(task.dueDate)}
        </span>
      )}
      {assignee && (
        <UserAvatar profile={assignee} className="size-6 shrink-0" />
      )}
    </div>
  );
}

// A small overlapping stack of member avatars for the project header.
function MemberAvatars({
  members,
  profiles,
}: {
  members: string[];
  profiles: Map<string, UserProfile>;
}) {
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((uid) => (
        <UserAvatar
          key={uid}
          profile={profiles.get(uid)}
          className="ring-background size-5 ring-2"
        />
      ))}
      {extra > 0 && (
        <span className="bg-muted ring-background text-muted-foreground inline-flex size-5 items-center justify-center rounded-full text-[9px] font-medium ring-2">
          +{extra}
        </span>
      )}
    </div>
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
  subtasks,
  milestoneName,
  dragging,
  onDragStart,
  onDragEnd,
  onClick,
  onEditSubtask,
  onToggleSubtask,
  onAddSubtask,
  assignee,
}: {
  task: Task;
  subtasks: Task[];
  milestoneName?: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onEditSubtask: (task: Task) => void;
  onToggleSubtask: (task: Task) => void;
  onAddSubtask: () => void;
  assignee?: UserProfile;
}) {
  const [expanded, setExpanded] = useState(false);
  const overdue = task.status !== "done" && isOverdue(task.dueDate);
  const tm = taskTypeMeta(task.type);
  const doneCount = subtasks.filter((s) => s.status === "done").length;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
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
          <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1 truncate text-[10px]">
            <Rocket className="size-3 shrink-0" />
            <span className="truncate">{milestoneName}</span>
          </span>
        )}
        {assignee && (
          <UserAvatar
            profile={assignee}
            className="ml-auto size-5 shrink-0"
          />
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

      <div className="border-t pt-2">
        {subtasks.length > 0 ? (
          <>
            <button
              onClick={(e) => {
                stop(e);
                setExpanded((v) => !v);
              }}
              className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-xs"
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform",
                  expanded && "rotate-90",
                )}
              />
              <span className="tabular-nums">
                {doneCount}/{subtasks.length}
              </span>
              <span>sub-tasks</span>
            </button>
            {expanded && (
              <div className="mt-2 space-y-1">
                {subtasks.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        stop(e);
                        onToggleSubtask(s);
                      }}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label={
                        s.status === "done"
                          ? "Mark sub-task not done"
                          : "Mark sub-task done"
                      }
                    >
                      {s.status === "done" ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : (
                        <Circle className="size-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        stop(e);
                        onEditSubtask(s);
                      }}
                      className={cn(
                        "hover:text-foreground truncate text-left text-xs",
                        s.status === "done"
                          ? "text-muted-foreground line-through"
                          : "text-foreground",
                      )}
                    >
                      {s.title}
                    </button>
                  </div>
                ))}
                <button
                  onClick={(e) => {
                    stop(e);
                    onAddSubtask();
                  }}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                >
                  <Plus className="size-3" />
                  Add sub-task
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={(e) => {
              stop(e);
              onAddSubtask();
            }}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Plus className="size-3" />
            Add sub-task
          </button>
        )}
      </div>
    </div>
  );
}

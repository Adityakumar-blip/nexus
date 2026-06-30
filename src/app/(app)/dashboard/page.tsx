"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  startOfDay,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import {
  FolderKanban,
  CheckCircle2,
  Circle,
  CalendarClock,
  AlertTriangle,
  Plus,
  UserPlus,
  HelpCircle,
  Bell,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  watchProjects,
  watchAllTasks,
  watchAllMilestones,
  fetchUserProfiles,
  updateTask,
} from "@/lib/store";
import type { Project, Task, Milestone, UserProfile } from "@/lib/types";
import {
  colorClasses,
  colorHex,
  isOverdue,
  taskProgress,
  initials,
} from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  SectionLabel,
  RangeMenu,
} from "@/components/dashboard/primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProductivityCard } from "@/components/dashboard/productivity-card";
import { DeadlineCalendar } from "@/components/dashboard/deadline-calendar";
import {
  RecentTasksTable,
  type RecentTaskRow,
} from "@/components/dashboard/recent-tasks-table";
import { TaskDialog } from "@/components/task-dialog";

const DAY = 86_400_000;

type Period = "weekly" | "monthly";

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [period, setPeriod] = useState<Period>("monthly");
  const [chartRange, setChartRange] = useState<Period>("weekly");
  // Captured once so the stat/chart memos stay pure across re-renders; refreshes
  // on navigation back to the dashboard.
  const [now] = useState(() => Date.now());
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    task?: Task;
    projectId: string;
  }>({ open: false, projectId: "" });

  useEffect(() => {
    if (!user) return;
    const u1 = watchProjects(user.uid, setProjects);
    const u2 = watchAllTasks(user.uid, setTasks);
    const u3 = watchAllMilestones(user.uid, setMilestones);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user]);

  // Resolve assignee avatars.
  const assigneeIds = useMemo(
    () =>
      [...new Set((tasks ?? []).map((t) => t.assigneeId).filter(Boolean))] as string[],
    [tasks],
  );
  useEffect(() => {
    if (assigneeIds.length === 0) return;
    fetchUserProfiles(assigneeIds).then((m) =>
      setProfiles((prev) => new Map([...prev, ...m])),
    );
  }, [assigneeIds]);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    (projects ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const subtasksByParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    (tasks ?? []).forEach((t) => {
      if (!t.parentId) return;
      const list = map.get(t.parentId) ?? [];
      list.push(t);
      map.set(t.parentId, list);
    });
    return map;
  }, [tasks]);

  const loading = projects === null || tasks === null;
  const all = useMemo(() => tasks ?? [], [tasks]);

  // ---- Overview stats + deltas -------------------------------------------
  const stats = useMemo(() => {
    const win = period === "weekly" ? 7 * DAY : 30 * DAY;
    const curStart = now - win;
    const prevStart = now - 2 * win;

    const doneTasks = all.filter((t) => t.status === "done");
    const completedCur = doneTasks.filter((t) => t.updatedAt >= curStart).length;
    const completedPrev = doneTasks.filter(
      (t) => t.updatedAt >= prevStart && t.updatedAt < curStart,
    ).length;

    const projCur = (projects ?? []).filter((p) => p.createdAt >= curStart).length;
    const projPrev = (projects ?? []).filter(
      (p) => p.createdAt >= prevStart && p.createdAt < curStart,
    ).length;

    const upcoming = all.filter(
      (t) =>
        t.status !== "done" &&
        t.dueDate != null &&
        t.dueDate >= startOfDay(now).getTime() &&
        t.dueDate <= now + 14 * DAY,
    ).length;

    return {
      activeProjects: projects?.length ?? 0,
      projectsDelta: pctChange(projCur, projPrev),
      completed: doneTasks.length,
      completedDelta: pctChange(completedCur, completedPrev),
      todo: all.filter((t) => t.status === "todo").length,
      upcoming,
      overdue: all.filter((t) => t.status !== "done" && isOverdue(t.dueDate))
        .length,
    };
  }, [all, projects, period, now]);

  // ---- Productivity chart -------------------------------------------------
  const chart = useMemo(() => {
    const bucketCount = chartRange === "weekly" ? 7 : 10;
    const bucketDays = chartRange === "weekly" ? 1 : 3;
    const totalDays = bucketCount * bucketDays;
    const startMs = startOfDay(addDays(new Date(), -(totalDays - 1))).getTime();
    const span = bucketDays * DAY;
    const idx = (ms: number) => Math.floor((ms - startMs) / span);

    const completed = new Array(bucketCount).fill(0);
    const created = new Array(bucketCount).fill(0);
    const due = new Array(bucketCount).fill(0);
    for (const t of all) {
      if (t.status === "done") {
        const i = idx(t.updatedAt);
        if (i >= 0 && i < bucketCount) completed[i] += 1;
      }
      const ci = idx(t.createdAt);
      if (ci >= 0 && ci < bucketCount) created[ci] += 1;
      if (t.dueDate != null) {
        const di = idx(t.dueDate);
        if (di >= 0 && di < bucketCount) due[di] += 1;
      }
    }
    const labels = Array.from({ length: bucketCount }, (_, i) =>
      format(new Date(startMs + i * span), chartRange === "weekly" ? "EEE" : "MMM d"),
    );
    const completedTotal = completed.reduce((a, b) => a + b, 0);
    return { labels, completed, created, due, completedTotal };
  }, [all, chartRange]);

  const legend = useMemo(() => {
    const active = all.filter((t) => t.status !== "done").length;
    const overdue = all.filter(
      (t) => t.status !== "done" && isOverdue(t.dueDate),
    ).length;
    const complete = all.filter((t) => t.status === "done").length;
    const pct = all.length ? Math.round((complete / all.length) * 100) : 0;
    return { active, overdue, complete, pct };
  }, [all]);

  // ---- Recent tasks -------------------------------------------------------
  const recentRows: RecentTaskRow[] = useMemo(() => {
    return all
      .filter((t) => !t.parentId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8)
      .map((t) => {
        const subs = subtasksByParent.get(t.id) ?? [];
        const subDone = subs.filter((s) => s.status === "done").length;
        const proj = projectById.get(t.projectId);
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          done: t.status === "done",
          projectName: proj?.name,
          projectColor: proj ? colorClasses(proj.color).dot : undefined,
          assignee: t.assigneeId ? profiles.get(t.assigneeId) : undefined,
          progress: taskProgress(t.status, subDone, subs.length) * 100,
          dueDate: t.dueDate,
        };
      });
  }, [all, subtasksByParent, projectById, profiles]);

  // ---- Deadlines ----------------------------------------------------------
  const deadlineItems = useMemo(() => {
    const fromTasks = all
      .filter((t) => t.status !== "done" && t.dueDate != null)
      .map((t) => {
        const proj = projectById.get(t.projectId);
        return {
          id: t.id,
          title: t.title,
          date: t.dueDate as number,
          color: colorHex(proj?.color ?? "blue"),
          href: `/projects/${t.projectId}`,
        };
      });
    const fromMs = milestones
      .filter((m) => m.status !== "shipped" && m.targetDate != null)
      .map((m) => {
        const proj = projectById.get(m.projectId);
        return {
          id: `m-${m.id}`,
          title: m.name,
          date: m.targetDate as number,
          color: colorHex(proj?.color ?? "violet"),
          href: `/projects/${m.projectId}?m=${m.id}`,
        };
      });
    return [...fromTasks, ...fromMs];
  }, [all, milestones, projectById]);

  // ---- Actions ------------------------------------------------------------
  async function toggleDone(id: string, done: boolean) {
    try {
      await updateTask(id, { status: done ? "done" : "todo" });
    } catch {
      /* surfaced elsewhere */
    }
  }
  function openTask(id: string) {
    const t = all.find((x) => x.id === id);
    if (t) setTaskDialog({ open: true, task: t, projectId: t.projectId });
  }
  function addTask() {
    const first = projects?.[0];
    if (first) setTaskDialog({ open: true, projectId: first.id });
  }

  const dialogProject = projectById.get(taskDialog.projectId);
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const rangeLabel =
    period === "monthly"
      ? `${format(monthStart, "MMM dd")} – ${format(monthEnd, "MMM dd, yyyy")}`
      : `${format(addDays(new Date(), -6), "MMM dd")} – ${format(new Date(), "MMM dd, yyyy")}`;

  const headerProfile: UserProfile | null = user
    ? {
        uid: user.uid,
        name: user.displayName ?? "",
        email: user.email ?? "",
        photoURL: user.photoURL ?? null,
        appearanceTheme: null,
        updatedAt: 0,
      }
    : null;

  return (
    <>
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button asChild className="gap-2">
            <Link href="/organizations">
              <UserPlus className="size-4" />
              Add Member
            </Link>
          </Button>
          <IconButton label="Help">
            <HelpCircle className="size-4" />
          </IconButton>
          <IconButton label="Notifications">
            <Bell className="size-4" />
          </IconButton>
          <Avatar className="size-8">
            {headerProfile?.photoURL && (
              <AvatarImage src={headerProfile.photoURL} alt="" />
            )}
            <AvatarFallback className="text-xs font-medium">
              {initials(headerProfile?.name || headerProfile?.email)}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div className="space-y-6 p-6">
        {/* Overview */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <SectionLabel>Overview</SectionLabel>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <RefreshCw className="size-3" />
                Last sync · Just now
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RangeMenu<Period>
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
              <span className="bg-background hidden h-8 items-center rounded-lg border px-2.5 text-xs font-medium sm:inline-flex">
                {rangeLabel}
              </span>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={addTask}
                disabled={!projects?.length}
              >
                <Plus className="size-4" />
                Add Task
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="Active Projects"
              value={stats.activeProjects}
              icon={FolderKanban}
              tone="blue"
              delta={stats.projectsDelta}
              loading={loading}
            />
            <StatCard
              label="Task Completed"
              value={stats.completed}
              icon={CheckCircle2}
              tone="emerald"
              delta={stats.completedDelta}
              loading={loading}
            />
            <StatCard
              label="To Do Tasks"
              value={stats.todo}
              icon={Circle}
              tone="amber"
              loading={loading}
            />
            <StatCard
              label="Upcoming Deadlines"
              value={stats.upcoming}
              icon={CalendarClock}
              tone="violet"
              loading={loading}
            />
            <StatCard
              label="Overdue Tasks"
              value={stats.overdue}
              icon={AlertTriangle}
              tone="rose"
              loading={loading}
            />
          </div>
        </section>

        {/* Productivity + Deadlines */}
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <ProductivityCard
            headline={`${chart.completedTotal} ${chart.completedTotal === 1 ? "task" : "tasks"}`}
            subtitle="Completed in the selected range"
            delta={stats.completedDelta}
            percentage={legend.pct}
            series={[
              { key: "created", label: "Active", color: "#3b82f6", values: chart.created },
              { key: "due", label: "Overdue", color: "#f59e0b", values: chart.due },
              { key: "completed", label: "Complete", color: "#10b981", values: chart.completed },
            ]}
            labels={chart.labels}
            totals={[
              { label: "Active", value: legend.active, color: "#3b82f6" },
              { label: "Overdue", value: legend.overdue, color: "#f59e0b" },
              { label: "Complete", value: legend.complete, color: "#10b981" },
            ]}
            headerRight={
              <RangeMenu<Period>
                value={chartRange}
                onChange={setChartRange}
                options={[
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
            }
          />
          <DeadlineCalendar items={deadlineItems} />
        </div>

        {/* Recent tasks */}
        <RecentTasksTable
          rows={recentRows}
          onToggleDone={toggleDone}
          onOpen={openTask}
        />
      </div>

      {dialogProject && (
        <TaskDialog
          open={taskDialog.open}
          onOpenChange={(open) => setTaskDialog((s) => ({ ...s, open }))}
          projectId={taskDialog.projectId}
          task={taskDialog.task}
          milestones={milestones.filter(
            (m) => m.projectId === taskDialog.projectId,
          )}
          tasks={all.filter((t) => t.projectId === taskDialog.projectId)}
          canEdit
          memberIds={dialogProject.memberIds}
          profiles={profiles}
        />
      )}
    </>
  );
}

function IconButton({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-9 items-center justify-center rounded-lg border transition-colors"
    >
      {children}
    </button>
  );
}

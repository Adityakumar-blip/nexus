"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  BookOpen,
  Rocket,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  watchProjects,
  watchAllTasks,
  watchNotes,
  watchAllMilestones,
} from "@/lib/store";
import type { Project, Task, Note, Milestone } from "@/lib/types";
import {
  colorClasses,
  relativeTime,
  isOverdue,
  formatDate,
  targetLabel,
  milestoneStatusMeta,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ProjectDialog } from "@/components/project-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const u1 = watchProjects(user.uid, setProjects);
    const u2 = watchAllTasks(user.uid, setTasks);
    const u3 = watchNotes(user.uid, setNotes);
    const u4 = watchAllMilestones(user.uid, setMilestones);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [user]);

  const projectName = useMemo(() => {
    const map = new Map<string, Project>();
    (projects ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const stats = useMemo(() => {
    const t = tasks ?? [];
    return {
      projects: projects?.length ?? 0,
      todo: t.filter((x) => x.status === "todo").length,
      inProgress: t.filter((x) => x.status === "in_progress").length,
      done: t.filter((x) => x.status === "done").length,
      overdue: t.filter((x) => x.status !== "done" && isOverdue(x.dueDate))
        .length,
    };
  }, [projects, tasks]);

  const upcoming = useMemo(() => {
    return (tasks ?? [])
      .filter((t) => t.status !== "done" && t.dueDate != null)
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
      .slice(0, 5);
  }, [tasks]);

  // Active/planned releases with live progress for the roadmap snapshot.
  const releases = useMemo(() => {
    const prog = new Map<string, { done: number; total: number }>();
    (tasks ?? []).forEach((t) => {
      if (!t.milestoneId) return;
      const cur = prog.get(t.milestoneId) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (t.status === "done") cur.done += 1;
      prog.set(t.milestoneId, cur);
    });
    return milestones
      .filter((m) => m.status !== "shipped")
      .slice(0, 4)
      .map((m) => ({
        milestone: m,
        project: projectName.get(m.projectId),
        progress: prog.get(m.id) ?? { done: 0, total: 0 },
      }));
  }, [milestones, tasks, projectName]);

  const loading = projects === null || tasks === null || notes === null;
  const greeting = user?.displayName?.split(" ")[0] || "there";

  return (
    <>
      <PageHeader
        title={`Welcome back, ${greeting}`}
        description="Here's what's happening across your workspace."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            label="Projects"
            value={stats.projects}
            icon={<FolderKanban className="size-4" />}
            loading={loading}
          />
          <StatCard
            label="To do"
            value={stats.todo}
            icon={<Circle className="size-4" />}
            loading={loading}
          />
          <StatCard
            label="In progress"
            value={stats.inProgress}
            icon={<Clock className="size-4" />}
            loading={loading}
          />
          <StatCard
            label="Done"
            value={stats.done}
            icon={<CheckCircle2 className="size-4" />}
            loading={loading}
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            icon={<AlertTriangle className="size-4" />}
            loading={loading}
            emphasize={stats.overdue > 0}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent projects */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent projects</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">
                  View all <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <SkeletonRows />
              ) : (projects ?? []).length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No projects yet. Create your first one to get started.
                </p>
              ) : (
                (projects ?? []).slice(0, 5).map((p) => {
                  const cc = colorClasses(p.color);
                  const open = (tasks ?? []).filter(
                    (t) => t.projectId === p.id && t.status !== "done",
                  ).length;
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="hover:bg-accent flex items-center gap-3 rounded-lg p-2 transition-colors"
                    >
                      <span className={`size-2.5 rounded-full ${cc.dot}`} />
                      <span className="flex-1 truncate text-sm font-medium">
                        {p.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {open} open
                      </span>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Upcoming tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming &amp; due</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <SkeletonRows />
              ) : upcoming.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Nothing due. You&apos;re all caught up.
                </p>
              ) : (
                upcoming.map((t) => (
                  <Link
                    key={t.id}
                    href={`/projects/${t.projectId}`}
                    className="hover:bg-accent flex items-center gap-3 rounded-lg p-2 transition-colors"
                  >
                    <span className="flex-1 truncate text-sm">{t.title}</span>
                    {projectName.get(t.projectId) && (
                      <span className="text-muted-foreground hidden truncate text-xs sm:inline">
                        {projectName.get(t.projectId)!.name}
                      </span>
                    )}
                    <Badge
                      variant={
                        isOverdue(t.dueDate) ? "destructive" : "secondary"
                      }
                    >
                      {formatDate(t.dueDate!)}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active releases */}
        {!loading && releases.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Active releases</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/roadmap">
                  Roadmap <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {releases.map(({ milestone: m, project, progress }) => {
                const sm = milestoneStatusMeta(m.status);
                const pct =
                  progress.total > 0
                    ? Math.round((progress.done / progress.total) * 100)
                    : 0;
                const overdue = isOverdue(m.targetDate);
                return (
                  <Link
                    key={m.id}
                    href={`/projects/${m.projectId}?m=${m.id}`}
                    className="hover:bg-accent rounded-lg border p-3 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <Rocket className="text-muted-foreground size-3.5 shrink-0" />
                        <span className="truncate">{m.name}</span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                          sm.badge,
                        )}
                      >
                        {sm.label}
                      </span>
                    </div>
                    {project && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {project.name}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                        <div
                          className="bg-foreground h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {progress.done}/{progress.total}
                      </span>
                    </div>
                    {m.targetDate != null && (
                      <p
                        className={cn(
                          "mt-1.5 text-xs",
                          overdue ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {targetLabel(m.targetDate)}
                      </p>
                    )}
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent notes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/knowledge">
                View all <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonRows />
            ) : (notes ?? []).length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-center text-sm">
                <BookOpen className="size-5" />
                No notes yet.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(notes ?? []).slice(0, 6).map((n) => (
                  <Link
                    key={n.id}
                    href="/knowledge"
                    className="hover:bg-accent rounded-lg border p-3 transition-colors"
                  >
                    <p className="truncate text-sm font-medium">
                      {n.title || "Untitled"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {relativeTime(n.updatedAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  loading,
  emphasize,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  loading: boolean;
  emphasize?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div
          className={`flex size-9 items-center justify-center rounded-lg ${
            emphasize
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-6 w-8" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          )}
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

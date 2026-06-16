"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Rocket, Plus, Calendar, Pencil, FolderKanban } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  watchProjects,
  watchAllMilestones,
  watchAllTasks,
} from "@/lib/store";
import {
  MILESTONE_STATUSES,
  type Project,
  type Milestone,
  type Task,
  type MilestoneStatus,
} from "@/lib/types";
import {
  colorClasses,
  isOverdue,
  targetLabel,
  milestoneStatusMeta,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MilestoneDialog } from "@/components/milestone-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoadmapPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dialog, setDialog] = useState<{
    open: boolean;
    milestone?: Milestone;
  }>({ open: false });

  useEffect(() => {
    if (!user) return;
    const u1 = watchProjects(user.uid, setProjects);
    const u2 = watchAllMilestones(user.uid, setMilestones);
    const u3 = watchAllTasks(user.uid, setTasks);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user]);

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    (projects ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const progressFor = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    tasks.forEach((t) => {
      if (!t.milestoneId) return;
      const cur = map.get(t.milestoneId) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (t.status === "done") cur.done += 1;
      map.set(t.milestoneId, cur);
    });
    return map;
  }, [tasks]);

  const byStatus = useMemo(() => {
    const g: Record<MilestoneStatus, Milestone[]> = {
      active: [],
      planned: [],
      shipped: [],
    };
    (milestones ?? []).forEach((m) => g[m.status]?.push(m));
    return g;
  }, [milestones]);

  const loading = projects === null || milestones === null;
  const hasProjects = (projects ?? []).length > 0;
  const isEmpty =
    !loading && (milestones ?? []).length === 0;

  return (
    <>
      <PageHeader
        title="Roadmap"
        description="Every release across your products — planned, in flight, and shipped."
        action={
          <Button
            onClick={() => setDialog({ open: true })}
            disabled={!hasProjects}
          >
            <Plus className="size-4" />
            New milestone
          </Button>
        }
      />

      <div className="space-y-8 p-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : !hasProjects ? (
          <EmptyState
            icon={FolderKanban}
            title="Create a project first"
            description="Milestones live inside projects. Add a project, then plan its releases here."
            action={
              <Button asChild>
                <Link href="/projects">
                  <Plus className="size-4" />
                  Go to projects
                </Link>
              </Button>
            }
          />
        ) : isEmpty ? (
          <EmptyState
            icon={Rocket}
            title="No milestones yet"
            description="Group tasks into releases with a target date to drive each product end-to-end."
            action={
              <Button onClick={() => setDialog({ open: true })}>
                <Plus className="size-4" />
                New milestone
              </Button>
            }
          />
        ) : (
          MILESTONE_STATUSES.map((s) => {
            const items = byStatus[s.value];
            if (items.length === 0) return null;
            const sm = milestoneStatusMeta(s.value);
            return (
              <section key={s.value} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", sm.dot)} />
                  <h2 className="text-sm font-semibold">{s.label}</h2>
                  <span className="text-muted-foreground text-xs">
                    {items.length}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((m) => (
                    <MilestoneCard
                      key={m.id}
                      milestone={m}
                      project={projectMap.get(m.projectId)}
                      progress={progressFor.get(m.id)}
                      onEdit={() => setDialog({ open: true, milestone: m })}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      <MilestoneDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        milestone={dialog.milestone}
        projects={projects ?? []}
      />
    </>
  );
}

function MilestoneCard({
  milestone,
  project,
  progress,
  onEdit,
}: {
  milestone: Milestone;
  project?: Project;
  progress?: { done: number; total: number };
  onEdit: () => void;
}) {
  const sm = milestoneStatusMeta(milestone.status);
  const cc = colorClasses(project?.color ?? "blue");
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;
  const overdue =
    milestone.status !== "shipped" && isOverdue(milestone.targetDate);

  return (
    <div className="bg-card group flex flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        {project ? (
          <Link
            href={`/projects/${project.id}?m=${milestone.id}`}
            className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1.5 text-xs"
          >
            <span className={cn("size-2 shrink-0 rounded-full", cc.dot)} />
            <span className="truncate">{project.name}</span>
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs">Unknown project</span>
        )}
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            sm.badge,
          )}
        >
          {sm.label}
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="leading-snug font-medium">{milestone.name}</h3>
        {milestone.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {milestone.description}
          </p>
        )}
      </div>

      <div className="mt-auto space-y-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-foreground h-full rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
            {progress?.done ?? 0}/{progress?.total ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          {milestone.targetDate != null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <Calendar className="size-3" />
              {targetLabel(milestone.targetDate)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">No target date</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}

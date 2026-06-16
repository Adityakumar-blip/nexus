"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  watchProjects,
  watchAllTasks,
  deleteProject,
} from "@/lib/store";
import type { Project, Task } from "@/lib/types";
import { colorClasses, relativeTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ProjectDialog } from "@/components/project-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    const u1 = watchProjects(user.uid, setProjects);
    const u2 = watchAllTasks(user.uid, setTasks);
    return () => {
      u1();
      u2();
    };
  }, [user]);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setDialogOpen(true);
  }

  async function handleDelete(p: Project) {
    if (
      !confirm(
        `Delete "${p.name}"? Its tasks remain in the database but the project will be removed.`,
      )
    )
      return;
    try {
      await deleteProject(p.id);
      toast.success("Project deleted");
    } catch {
      toast.error("Could not delete project");
    }
  }

  const loading = projects === null;

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every initiative with its own board of tasks."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New project
          </Button>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : projects!.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create a project to start tracking tasks on a board."
            action={
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                New project
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects!.map((p) => {
              const cc = colorClasses(p.color);
              const projectTasks = tasks.filter((t) => t.projectId === p.id);
              const open = projectTasks.filter(
                (t) => t.status !== "done",
              ).length;
              const done = projectTasks.length - open;
              return (
                <Card
                  key={p.id}
                  className={`group relative overflow-hidden transition-shadow hover:shadow-md`}
                >
                  <span
                    className={`absolute inset-x-0 top-0 h-1 ${cc.dot}`}
                  />
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-2"
                      >
                        <span className={`size-2.5 rounded-full ${cc.dot}`} />
                        <span className="font-medium">{p.name}</span>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(p)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <Link href={`/projects/${p.id}`} className="block">
                      <p className="text-muted-foreground line-clamp-2 min-h-[2.5rem] text-sm">
                        {p.description || "No description."}
                      </p>
                      <div className="text-muted-foreground mt-3 flex items-center gap-3 text-xs">
                        <span>{open} open</span>
                        <span>·</span>
                        <span>{done} done</span>
                        <span className="ml-auto">
                          {relativeTime(p.updatedAt)}
                        </span>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editing}
      />
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Link2, Search, Rocket, ListChecks } from "lucide-react";
import type { Project, Task, Milestone } from "@/lib/types";
import { taskKey, milestoneStatusMeta, STATUS_DOT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_PROJECTS = "__all__";
const MAX_RESULTS = 40;

// Build the markdown deep-link a reference inserts into a note.
function taskLink(t: Task) {
  return `[${taskKey(t.id)} · ${t.title}](/projects/${t.projectId}?task=${t.id})`;
}
function milestoneLink(m: Milestone) {
  return `[🚀 ${m.name}](/projects/${m.projectId}?m=${m.id})`;
}

// A picker that lets you search a project's tasks or milestones and insert a
// markdown deep-link to one — so a note can reference live work items.
export function NoteReferencePicker({
  projects,
  tasks,
  milestones,
  defaultProjectId,
  onInsert,
}: {
  projects: Project[];
  tasks: Task[];
  milestones: Milestone[];
  defaultProjectId: string | null;
  onInsert: (markdown: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>(
    defaultProjectId ?? ALL_PROJECTS,
  );
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();

  const ms = useMemo(() => {
    let list = milestones;
    if (projectFilter !== ALL_PROJECTS)
      list = list.filter((m) => m.projectId === projectFilter);
    if (needle) list = list.filter((m) => m.name.toLowerCase().includes(needle));
    return list.slice(0, MAX_RESULTS);
  }, [milestones, projectFilter, needle]);

  const ts = useMemo(() => {
    let list = tasks.filter((t) => !t.parentId);
    if (projectFilter !== ALL_PROJECTS)
      list = list.filter((t) => t.projectId === projectFilter);
    if (needle)
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(needle) ||
          taskKey(t.id).toLowerCase().includes(needle),
      );
    return list.slice(0, MAX_RESULTS);
  }, [tasks, projectFilter, needle]);

  function pick(markdown: string) {
    onInsert(markdown);
    setOpen(false);
    setQ("");
  }

  const empty = ms.length === 0 && ts.length === 0;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Link2 className="size-4" />
          Link task / milestone
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="space-y-2 border-b p-2">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks & milestones…"
              className="bg-background h-8 w-full rounded-md border pr-2 pl-8 text-sm outline-none"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-1">
          {empty ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-xs">
              No matches. Try another project or search term.
            </p>
          ) : (
            <>
              {ms.length > 0 && (
                <>
                  <GroupLabel icon={Rocket}>Milestones</GroupLabel>
                  {ms.map((m) => {
                    const sm = milestoneStatusMeta(m.status);
                    return (
                      <RowButton key={m.id} onClick={() => pick(milestoneLink(m))}>
                        <span className={cn("size-2 shrink-0 rounded-full", sm.dot)} />
                        <span className="truncate">{m.name}</span>
                      </RowButton>
                    );
                  })}
                </>
              )}
              {ts.length > 0 && (
                <>
                  <GroupLabel icon={ListChecks}>Tasks</GroupLabel>
                  {ts.map((t) => (
                    <RowButton key={t.id} onClick={() => pick(taskLink(t))}>
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          STATUS_DOT[t.status],
                        )}
                      />
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                        {taskKey(t.id)}
                      </span>
                      <span className="truncate">{t.title}</span>
                    </RowButton>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GroupLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Rocket;
  children: React.ReactNode;
}) {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 px-2 pt-2 pb-1 text-[11px] font-medium tracking-wider uppercase">
      <Icon className="size-3" />
      {children}
    </div>
  );
}

function RowButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
    >
      {children}
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from "@/lib/store";
import {
  MILESTONE_STATUSES,
  type Milestone,
  type MilestoneStatus,
  type Project,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MilestoneDialog({
  open,
  onOpenChange,
  milestone,
  projectId,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: Milestone;
  /** When set, the milestone belongs to this project and the picker is hidden. */
  projectId?: string;
  /** Selectable projects when no fixed projectId is provided (roadmap view). */
  projects?: Project[];
}) {
  const { user } = useAuth();
  const editing = Boolean(milestone);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("planned");
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const showPicker = !projectId && (projects?.length ?? 0) > 0;

  useEffect(() => {
    if (open) {
      setName(milestone?.name ?? "");
      setDescription(milestone?.description ?? "");
      setStatus(milestone?.status ?? "planned");
      setTargetDate(
        milestone?.targetDate ? new Date(milestone.targetDate) : undefined,
      );
      setSelectedProject(
        milestone?.projectId ?? projectId ?? projects?.[0]?.id ?? "",
      );
    }
  }, [open, milestone, projectId, projects]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pid = projectId ?? selectedProject;
    if (!user || !name.trim() || !pid) return;
    setBusy(true);
    const targetMs = targetDate ? targetDate.getTime() : null;
    try {
      if (milestone) {
        await updateMilestone(milestone.id, {
          name: name.trim(),
          description: description.trim(),
          status,
          targetDate: targetMs,
        });
        toast.success("Milestone updated");
      } else {
        await createMilestone(user.uid, {
          projectId: pid,
          name: name.trim(),
          description: description.trim(),
          status,
          targetDate: targetMs,
        });
        toast.success("Milestone created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Could not save milestone");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!milestone) return;
    if (
      !confirm(
        `Delete "${milestone.name}"? Tasks in it keep their work but lose the release link.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteMilestone(milestone.id);
      toast.success("Milestone deleted");
      onOpenChange(false);
    } catch {
      toast.error("Could not delete milestone");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit milestone" : "New milestone"}
          </DialogTitle>
          <DialogDescription>
            A release that groups tasks toward something shippable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ms-name">Name</Label>
            <Input
              id="ms-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.0 — Public launch"
              autoFocus
              required
            />
          </div>

          {showPicker && (
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects!.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ms-desc">Goal</Label>
            <Textarea
              id="ms-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does shipping this release mean?"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as MilestoneStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ms-target">Target date</Label>
              <DatePicker
                id="ms-target"
                value={targetDate}
                onChange={setTargetDate}
                placeholder="No target date"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  busy ||
                  !name.trim() ||
                  (!projectId && !selectedProject)
                }
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

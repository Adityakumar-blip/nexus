"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  createProject,
  updateProject,
  watchOrganizations,
} from "@/lib/store";
import {
  PROJECT_COLORS,
  type Project,
  type Organization,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/lib/format";
import { Button } from "@/components/ui/button";
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

const NO_ORG = "none";

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}) {
  const { user } = useAuth();
  const editing = Boolean(project);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>("blue");
  const [orgId, setOrgId] = useState<string>(NO_ORG);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return watchOrganizations(user.uid, setOrgs);
  }, [user]);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setColor(project?.color ?? "blue");
      setOrgId(project?.orgId ?? NO_ORG);
    }
  }, [open, project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const orgValue = orgId === NO_ORG ? null : orgId;
      if (project) {
        await updateProject(project.id, {
          name: name.trim(),
          description: description.trim(),
          color,
          orgId: orgValue,
        });
        toast.success("Project updated");
      } else {
        await createProject(user.uid, {
          name: name.trim(),
          description: description.trim(),
          color,
          orgId: orgValue,
        });
        toast.success("Project created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Could not save project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the details of your project."
              : "Group related tasks and notes under a project."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website redesign"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => {
                const cc = colorClasses(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                      cc.dot,
                      color === c ? "ring-foreground" : "ring-transparent",
                    )}
                  />
                );
              })}
            </div>
          </div>
          {orgs.length > 0 && (
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ORG}>Personal (no sharing)</SelectItem>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Link to an organization to add its members to this project.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

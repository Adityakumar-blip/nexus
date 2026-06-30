"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Crown, UserPlus, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  watchOrganizations,
  fetchUserProfiles,
  setProjectMember,
  removeProjectMember,
  updateProject,
} from "@/lib/store";
import {
  PROJECT_ROLES,
  type Project,
  type Organization,
  type ProjectRole,
  type UserProfile,
} from "@/lib/types";
import { UserAvatar, displayName } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProjectMembersDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [addUid, setAddUid] = useState<string>("");
  const [linkOrgId, setLinkOrgId] = useState<string>("");
  const [linking, setLinking] = useState(false);

  const isAdmin = project.roles[user?.uid ?? ""] === "admin"
    || project.ownerId === user?.uid;
  const org = useMemo(
    () => orgs.find((o) => o.id === project.orgId),
    [orgs, project.orgId],
  );

  useEffect(() => {
    if (!user || !open) return;
    return watchOrganizations(user.uid, setOrgs);
  }, [user, open]);

  // Load profiles for everyone we might show (org pool + current members).
  useEffect(() => {
    if (!open) return;
    const uids = [
      ...new Set([...(org?.memberIds ?? []), ...project.memberIds]),
    ];
    if (uids.length === 0) return;
    fetchUserProfiles(uids).then((m) =>
      setProfiles((prev) => new Map([...prev, ...m])),
    );
  }, [open, org?.memberIds, project.memberIds]);

  const candidates = useMemo(
    () => (org?.memberIds ?? []).filter((uid) => !project.memberIds.includes(uid)),
    [org?.memberIds, project.memberIds],
  );

  async function handleAdd() {
    if (!addUid) return;
    try {
      await setProjectMember(project.id, addUid, "member");
      toast.success("Member added");
      setAddUid("");
    } catch {
      toast.error("Could not add member");
    }
  }

  async function handleRole(uid: string, role: ProjectRole) {
    try {
      await setProjectMember(project.id, uid, role);
    } catch {
      toast.error("Could not change role");
    }
  }

  async function handleRemove(uid: string) {
    try {
      await removeProjectMember(project.id, uid);
      toast.success("Member removed");
    } catch {
      toast.error("Could not remove member");
    }
  }

  async function handleLinkOrganization() {
    const targetOrgId = linkOrgId || orgs[0]?.id;
    if (!targetOrgId) return;
    setLinking(true);
    try {
      await updateProject(project.id, { orgId: targetOrgId });
      toast.success("Organization linked");
      setLinkOrgId("");
    } catch {
      toast.error("Could not link organization");
    } finally {
      setLinking(false);
    }
  }

  const members = useMemo(
    () =>
      [...project.memberIds].sort((a, b) =>
        a === project.ownerId ? -1 : b === project.ownerId ? 1 : 0,
      ),
    [project.memberIds, project.ownerId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project members</DialogTitle>
          <DialogDescription>
            Add people from your organization and set what they can do.
          </DialogDescription>
        </DialogHeader>

        {!project.orgId ? (
          <div className="space-y-4 rounded-lg border border-dashed p-4">
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium">No organization linked</p>
              <p className="text-muted-foreground text-sm">
                Link this project to one of your organizations before adding
                members.
              </p>
            </div>
            {isAdmin ? (
              orgs.length > 0 ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="project-link-org">Organization</Label>
                    <Select
                      value={linkOrgId || orgs[0]?.id || ""}
                      onValueChange={setLinkOrgId}
                    >
                      <SelectTrigger id="project-link-org" className="w-full">
                        <SelectValue placeholder="Choose an organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgs.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleLinkOrganization}
                    disabled={!linkOrgId || linking}
                    className="w-full"
                  >
                    <Link2 className="size-4" />
                    Link organization
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-center text-sm">
                  Create or join an organization first, then link this project.
                </p>
              )
            ) : (
              <p className="text-muted-foreground text-center text-sm">
                Ask a project admin to link an organization before inviting
                members.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add a member from the org pool */}
            {isAdmin && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select value={addUid} onValueChange={setAddUid}>
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          candidates.length
                            ? "Add a member…"
                            : "Everyone is already added"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((uid) => (
                        <SelectItem key={uid} value={uid}>
                          {displayName(profiles.get(uid))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={!addUid}>
                  <UserPlus className="size-4" />
                  Add
                </Button>
              </div>
            )}

            {/* Current members */}
            <div className="divide-y rounded-lg border">
              {members.map((uid) => {
                const p = profiles.get(uid);
                const isProjectOwner = uid === project.ownerId;
                const role: ProjectRole = isProjectOwner
                  ? "admin"
                  : (project.roles[uid] ?? "member");
                return (
                  <div key={uid} className="flex items-center gap-3 px-3 py-2">
                    <UserAvatar profile={p} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{displayName(p)}</span>
                        {isProjectOwner && (
                          <Crown className="size-3.5 text-amber-500" />
                        )}
                      </div>
                      {p?.email && (
                        <div className="text-muted-foreground truncate text-xs">
                          {p.email}
                        </div>
                      )}
                    </div>
                    {isProjectOwner || !isAdmin ? (
                      <span className="text-muted-foreground w-24 text-right text-xs capitalize">
                        {role}
                      </span>
                    ) : (
                      <Select
                        value={role}
                        onValueChange={(v) => handleRole(uid, v as ProjectRole)}
                      >
                        <SelectTrigger size="sm" className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {isAdmin && !isProjectOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-7"
                        onClick={() => handleRemove(uid)}
                        aria-label="Remove member"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

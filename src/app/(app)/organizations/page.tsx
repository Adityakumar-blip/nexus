"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Plus,
  Copy,
  Check,
  UserPlus,
  LogIn,
  Trash2,
  Crown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  watchOrganizations,
  createOrganization,
  removeOrgMember,
  fetchUserProfiles,
} from "@/lib/store";
import { joinOrgByCode, inviteToOrg } from "@/lib/org-api";
import type { Organization, UserProfile } from "@/lib/types";
import { UserAvatar, displayName } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationsPage() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return watchOrganizations(user.uid, setOrgs);
  }, [user]);

  // Load profiles for everyone across all the user's orgs.
  useEffect(() => {
    if (!orgs) return;
    const uids = [...new Set(orgs.flatMap((o) => o.memberIds))];
    if (uids.length === 0) return;
    let active = true;
    fetchUserProfiles(uids).then((m) => {
      if (active) setProfiles((prev) => new Map([...prev, ...m]));
    });
    return () => {
      active = false;
    };
  }, [orgs]);

  const refreshProfiles = useCallback((uids: string[]) => {
    fetchUserProfiles(uids).then((m) =>
      setProfiles((prev) => new Map([...prev, ...m])),
    );
  }, []);

  async function handleCreate() {
    if (!user || !newName.trim()) return;
    setBusy(true);
    try {
      await createOrganization(user.uid, newName.trim());
      toast.success("Organization created");
      setNewName("");
      setCreating(false);
    } catch {
      toast.error("Could not create organization");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user || !joinCode.trim()) return;
    setBusy(true);
    try {
      const { name } = await joinOrgByCode(user, joinCode.trim());
      toast.success(`Joined ${name || "organization"}`);
      setJoinCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <>
      <div className="border-b px-6 py-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Boxes className="size-6" />
          Organizations
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Organizations are your collaboration pools. Add teammates here, then
          add them to individual projects with a role.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 p-6">
        {/* Create / join */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-muted/40 space-y-3 rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="size-4" />
              New organization
            </div>
            {creating ? (
              <div className="space-y-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Acme Inc."
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={busy || !newName.trim()}>
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                Create organization
              </Button>
            )}
          </div>

          <div className="bg-muted/40 space-y-3 rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <LogIn className="size-4" />
              Join with a code
            </div>
            <div className="space-y-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCD2345"
                className="font-mono tracking-widest"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleJoin}
                disabled={busy || !joinCode.trim()}
              >
                Join
              </Button>
            </div>
          </div>
        </div>

        {/* Org list */}
        {orgs === null ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : orgs.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed py-10 text-center text-sm">
            You&apos;re not in any organization yet. Create one to start
            collaborating.
          </p>
        ) : (
          <div className="space-y-6">
            {orgs.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                currentUid={user.uid}
                profiles={profiles}
                onInvited={(uid) => refreshProfiles([uid])}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function OrgCard({
  org,
  currentUid,
  profiles,
  onInvited,
}: {
  org: Organization;
  currentUid: string;
  profiles: Map<string, UserProfile>;
  onInvited: (uid: string) => void;
}) {
  const { user } = useAuth();
  const isOwner = org.ownerId === currentUid;
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const members = useMemo(
    () =>
      [...org.memberIds].sort((a, b) =>
        a === org.ownerId ? -1 : b === org.ownerId ? 1 : 0,
      ),
    [org.memberIds, org.ownerId],
  );

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(org.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function handleInvite() {
    if (!user || !email.trim()) return;
    setInviting(true);
    try {
      const res = await inviteToOrg(user, org.id, email.trim());
      onInvited(res.uid);
      toast.success(`Invited ${res.name || res.email}`);
      setEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(uid: string) {
    if (!confirm("Remove this member from the organization?")) return;
    try {
      await removeOrgMember(org.id, uid);
      toast.success("Member removed");
    } catch {
      toast.error("Could not remove member");
    }
  }

  return (
    <div className="space-y-4 rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{org.name}</h2>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Join code</span>
          <button
            onClick={copyCode}
            className="bg-muted hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-sm tracking-widest transition-colors"
          >
            {org.joinCode}
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Invite by email */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`invite-${org.id}`} className="text-xs">
            Invite by email
          </Label>
          <Input
            id={`invite-${org.id}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          />
        </div>
        <Button onClick={handleInvite} disabled={inviting || !email.trim()}>
          {inviting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          Invite
        </Button>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        They must already have a Nexus account. Or share the join code above.
      </p>

      {/* Members */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs font-medium">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </div>
        <div className="divide-y rounded-lg border">
          {members.map((uid) => {
            const p = profiles.get(uid);
            return (
              <div key={uid} className="flex items-center gap-3 px-3 py-2">
                <UserAvatar profile={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{displayName(p)}</span>
                    {uid === org.ownerId && (
                      <Crown className="size-3.5 text-amber-500" />
                    )}
                    {uid === currentUid && (
                      <span className="text-muted-foreground text-xs">(you)</span>
                    )}
                  </div>
                  {p?.email && (
                    <div className="text-muted-foreground truncate text-xs">
                      {p.email}
                    </div>
                  )}
                </div>
                {isOwner && uid !== org.ownerId && (
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
    </div>
  );
}

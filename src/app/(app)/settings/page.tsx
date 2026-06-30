"use client";

import { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Loader2,
  Copy,
  Check,
  Terminal,
  SwatchBook,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { APP_COLOR_THEMES } from "@/lib/appearance";
import { relativeTime } from "@/lib/format";
import { useThemeSwitch } from "@/components/theme-provider";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { colorTheme, setColorTheme } = useThemeSwitch();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate-key dialog
  const [genOpen, setGenOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  // One-time reveal of a freshly created token
  const [newToken, setNewToken] = useState<string | null>(null);

  // Authenticated fetch against /api/keys using the user's Firebase ID token.
  const authedFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();
      return fetch(input, {
        ...init,
        headers: {
          ...init.headers,
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });
    },
    [user],
  );

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authedFetch("/api/keys");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed to load keys (${res.status})`);
        setKeys([]);
        return;
      }
      const body = await res.json();
      setError(null);
      setKeys(body.keys ?? []);
    } catch {
      setError("Could not reach the server.");
      setKeys([]);
    }
  }, [user, authedFetch]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await load();
    })();
  }, [user, load]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authedFetch("/api/keys", {
        method: "POST",
        body: JSON.stringify({ label }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setGenOpen(false);
      setLabel("");
      setNewToken(body.token);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(key: ApiKey) {
    if (!confirm(`Revoke "${key.label}"? Any agent using it stops working.`))
      return;
    try {
      const res = await authedFetch(`/api/keys?id=${encodeURIComponent(key.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Key revoked");
      load();
    } catch {
      toast.error("Could not revoke key");
    }
  }

  const loading = keys === null;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage MCP access keys to control Nexus from Claude and other agents."
      />

      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SwatchBook className="size-4" />
              Appearance
            </CardTitle>
            <CardDescription>
              Pick a product palette for your workspace. This preference is saved
              to your account and reused on your next visit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {APP_COLOR_THEMES.map((theme) => {
                const active = colorTheme === theme.value;
                return (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => setColorTheme(theme.value)}
                    className={`group rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? "border-primary bg-accent/60 shadow-sm"
                        : "hover:border-primary/35 hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{theme.label}</span>
                          {active && (
                            <Badge variant="secondary" className="rounded-full">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {theme.description}
                        </p>
                      </div>
                      <div className="flex -space-x-2">
                        {theme.swatches.map((swatch) => (
                          <span
                            key={swatch}
                            className="ring-background size-7 rounded-full ring-2"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground inline-flex rounded-md px-2 py-1 text-xs font-medium">
                        Primary
                      </span>
                      <span className="bg-card text-card-foreground inline-flex rounded-md border px-2 py-1 text-xs font-medium">
                        Card
                      </span>
                      <span className="bg-muted text-muted-foreground inline-flex rounded-md px-2 py-1 text-xs font-medium">
                        Muted
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-4" />
                  MCP Access Keys
                </CardTitle>
                <CardDescription>
                  A key lets an AI agent read and write your projects,
                  milestones, tasks, and notes on your behalf. Treat it like a
                  password — you can revoke it anytime.
                </CardDescription>
              </div>
              <Button onClick={() => setGenOpen(true)} disabled={!user}>
                <Plus className="size-4" />
                Generate key
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md border border-destructive/20 px-3 py-2 text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : keys.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title="No keys yet"
                description="Generate a key to connect Claude Code, Cursor, or any MCP-capable agent."
              />
            ) : (
              <ul className="divide-y rounded-lg border">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center justify-between gap-4 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {k.label}
                        </span>
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {k.prefix}…
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Created {relativeTime(k.createdAt)}
                        {" · "}
                        {k.lastUsedAt
                          ? `last used ${relativeTime(k.lastUsedAt)}`
                          : "never used"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleRevoke(k)}
                      aria-label={`Revoke ${k.label}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate MCP key</DialogTitle>
            <DialogDescription>
              Give the key a name so you remember where it&apos;s used.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-label">Label</Label>
              <Input
                id="key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="My laptop — Claude Code"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setGenOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !label.trim()}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-time reveal dialog */}
      <RevealDialog token={newToken} onClose={() => setNewToken(null)} />
    </>
  );
}

function RevealDialog({
  token,
  onClose,
}: {
  token: string | null;
  onClose: () => void;
}) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const command = token
    ? `claude mcp add --transport http nexus ${origin}/api/mcp \\\n  --header "Authorization: Bearer ${token}"`
    : "";

  return (
    <Dialog open={Boolean(token)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your new key</DialogTitle>
          <DialogDescription>
            Copy it now — for your security it won&apos;t be shown again. If you
            lose it, just generate a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Key</Label>
            <CopyField value={token ?? ""} mono />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Terminal className="size-3.5" />
              Add to Claude Code
            </Label>
            <CopyField value={command} mono block />
            <p className="text-muted-foreground text-xs">
              Or point any MCP-capable agent at{" "}
              <code className="font-mono">{origin}/api/mcp</code> with this key
              as a Bearer token. The Nexus dev server must be running for the
              agent to reach it.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyField({
  value,
  mono,
  block,
}: {
  value: string;
  mono?: boolean;
  block?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="bg-muted flex items-start gap-2 rounded-md border p-2">
      <pre
        className={`min-w-0 flex-1 overflow-x-auto text-xs ${
          mono ? "font-mono" : ""
        } ${block ? "whitespace-pre" : "truncate whitespace-nowrap"}`}
      >
        {value}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={copy}
        aria-label="Copy"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

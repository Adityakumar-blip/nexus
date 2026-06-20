"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Search, Trash2, Loader2, Smile } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  watchDocs,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@/lib/store";
import type { Doc } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { DocEditor, type DocEditorChange } from "@/components/doc-editor";
import {
  DocTree,
  buildDocTree,
  ancestorIds,
} from "@/components/doc-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ICONS = ["📄", "📝", "📚", "💡", "🚀", "🐛", "🎯", "🔧", "📌", "✅", "🧭", "🗂️"];

// Shared docs UI. With no `projectId` it's the global workspace; with one it
// scopes to a single project (new docs inherit that project).
export function DocsWorkspace({
  projectId = null,
}: {
  projectId?: string | null;
}) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    return watchDocs(user.uid, setDocs);
  }, [user]);

  // Scope to a project when embedded in a project page.
  const scoped = useMemo(
    () =>
      (docs ?? []).filter((d) =>
        projectId ? d.projectId === projectId : true,
      ),
    [docs, projectId],
  );

  // Search filters the tree down to matches plus their ancestors (so nesting
  // context is preserved), and forces those branches open.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    const keep = new Set<string>();
    for (const d of scoped) {
      if (
        d.title.toLowerCase().includes(q) ||
        d.contentText.toLowerCase().includes(q)
      ) {
        keep.add(d.id);
        for (const a of ancestorIds(scoped, d.id)) keep.add(a);
      }
    }
    return scoped.filter((d) => keep.has(d.id));
  }, [scoped, search]);

  const tree = useMemo(() => buildDocTree(visible), [visible]);

  // Keep a valid selection.
  useEffect(() => {
    if (docs === null) return;
    if (selectedId && scoped.some((d) => d.id === selectedId)) return;
    setSelectedId(scoped[0]?.id ?? null);
  }, [docs, scoped, selectedId]);

  // Auto-expand the path to the selected doc, and all branches while searching.
  useEffect(() => {
    if (search.trim()) {
      setExpanded(new Set(visible.map((d) => d.id)));
      return;
    }
    if (!selectedId) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const a of ancestorIds(scoped, selectedId)) next.add(a);
      return next;
    });
  }, [selectedId, scoped, visible, search]);

  const selected = useMemo(
    () => scoped.find((d) => d.id === selectedId) ?? null,
    [scoped, selectedId],
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(parentId: string | null) {
    if (!user) return;
    try {
      const id = await createDocument(user.uid, {
        title: "Untitled",
        parentId,
        projectId,
      });
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
      setSelectedId(id);
    } catch {
      toast.error("Could not create page");
    }
  }

  const loading = docs === null;

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[18rem_1fr]">
      {/* Tree sidebar */}
      <div className="flex flex-col border-r">
        <div className="flex items-center gap-2 border-b p-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search docs…"
              className="h-8 pl-8"
            />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            onClick={() => handleCreate(null)}
            aria-label="New page"
            title="New page"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-1">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-5/6" />
              <Skeleton className="h-7 w-4/6" />
            </div>
          ) : tree.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-xs">
              {search.trim()
                ? `No docs match “${search}”.`
                : "No pages yet."}
            </p>
          ) : (
            <DocTree
              nodes={tree}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={toggle}
              onSelect={setSelectedId}
              onCreateChild={(id) => handleCreate(id)}
            />
          )}
        </div>
      </div>

      {/* Editor pane */}
      {loading ? (
        <div className="p-6">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : selected ? (
        <DocPane
          key={selected.id}
          doc={selected}
          allDocs={scoped}
          onSelect={setSelectedId}
        />
      ) : (
        <div className="p-6">
          <EmptyState
            icon={FileText}
            title="No page selected"
            description="Create a page to start writing. Pages can nest into sub-pages."
            action={
              <Button onClick={() => handleCreate(null)}>
                <Plus className="size-4" />
                New page
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}

function DocPane({
  doc,
  allDocs,
  onSelect,
}: {
  doc: Doc;
  allDocs: Doc[];
  onSelect: (id: string) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [saving, setSaving] = useState(false);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Breadcrumb: ancestor chain, outermost first.
  const crumbs = useMemo(() => {
    const ids = ancestorIds(allDocs, doc.id).reverse();
    const byId = new Map(allDocs.map((d) => [d.id, d]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as Doc[];
  }, [allDocs, doc.id]);

  function saveTitle(value: string) {
    setTitle(value);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateDocument(doc.id, { title: value.trim() || "Untitled" });
      } catch {
        toast.error("Could not save");
      } finally {
        setSaving(false);
      }
    }, 700);
  }

  async function saveContent(change: DocEditorChange) {
    setSaving(true);
    try {
      await updateDocument(doc.id, {
        content: change.content,
        contentText: change.contentText,
      });
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function setIcon(icon: string | null) {
    try {
      await updateDocument(doc.id, { icon });
    } catch {
      toast.error("Could not update icon");
    }
  }

  async function handleDelete() {
    const kids = allDocs.some((d) => d.parentId === doc.id);
    const msg = kids
      ? `Delete "${doc.title || "this page"}" and all its sub-pages?`
      : `Delete "${doc.title || "this page"}"?`;
    if (!confirm(msg)) return;
    try {
      // deleteDocument scopes its subtree cascade by ownerId, which the doc carries.
      await deleteDocument(doc.ownerId, doc.id);
      toast.success("Page deleted");
    } catch {
      toast.error("Could not delete page");
    }
  }

  return (
    <div className="flex flex-col overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <div className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
          {crumbs.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <button
                onClick={() => onSelect(c.id)}
                className="hover:text-foreground max-w-[10rem] truncate"
              >
                {c.icon ? `${c.icon} ` : ""}
                {c.title || "Untitled"}
              </button>
              <span>/</span>
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {saving ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Saving…
              </span>
            ) : (
              `Saved · ${relativeTime(doc.updatedAt)}`
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            aria-label="Delete page"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* icon + title */}
          <div className="mb-2 flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="hover:bg-accent flex size-10 items-center justify-center rounded-md text-2xl leading-none transition-colors"
                  aria-label="Set icon"
                >
                  {doc.icon ?? (
                    <Smile className="text-muted-foreground size-5" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="grid grid-cols-6 gap-1">
                  {ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setIcon(emoji)}
                      className="hover:bg-accent flex size-8 items-center justify-center rounded text-xl"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {doc.icon && (
                  <button
                    onClick={() => setIcon(null)}
                    className="text-muted-foreground hover:text-foreground mt-1 w-full text-center text-xs"
                  >
                    Remove
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <input
            value={title}
            onChange={(e) => saveTitle(e.target.value)}
            placeholder="Untitled"
            className="placeholder:text-muted-foreground mb-4 w-full bg-transparent text-3xl font-bold tracking-tight outline-none"
          />

          {/* block editor */}
          <DocEditor
            docId={doc.id}
            initialContent={doc.content}
            onSave={saveContent}
          />
        </div>
      </div>
    </div>
  );
}


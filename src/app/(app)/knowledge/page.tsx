"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Loader2,
  Tag as TagIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  watchNotes,
  watchProjects,
  createNote,
  updateNote,
  deleteNote,
} from "@/lib/store";
import type { Note, Project } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MarkdownView } from "@/components/markdown-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_PROJECT = "__none__";

export default function KnowledgePage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const u1 = watchNotes(user.uid, setNotes);
    const u2 = watchProjects(user.uid, setProjects);
    return () => {
      u1();
      u2();
    };
  }, [user]);

  const filtered = useMemo(() => {
    const list = notes ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [notes, search]);

  // keep a valid selection
  useEffect(() => {
    if (notes === null) return;
    if (selectedId && notes.some((n) => n.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? notes[0]?.id ?? null);
  }, [notes, filtered, selectedId]);

  const selected = useMemo(
    () => (notes ?? []).find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  async function handleNew() {
    if (!user) return;
    try {
      const id = await createNote(user.uid, { title: "Untitled note" });
      setSelectedId(id);
      toast.success("Note created");
    } catch {
      toast.error("Could not create note");
    }
  }

  const loading = notes === null;

  return (
    <>
      <PageHeader
        title="Knowledge"
        description="Capture docs, decisions, and ideas in markdown."
        action={
          <Button onClick={handleNew}>
            <Plus className="size-4" />
            New note
          </Button>
        }
      />

      {loading ? (
        <div className="p-6">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : notes!.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={BookOpen}
            title="Your knowledge base is empty"
            description="Notes support markdown, tags, and links to projects."
            action={
              <Button onClick={handleNew}>
                <Plus className="size-4" />
                New note
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid h-[calc(100svh-89px)] grid-cols-1 md:grid-cols-[20rem_1fr]">
          {/* List */}
          <div className="flex flex-col border-r">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes…"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground p-4 text-center text-sm">
                  No notes match “{search}”.
                </p>
              ) : (
                filtered.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className={cn(
                      "mb-1 w-full rounded-lg p-3 text-left transition-colors",
                      n.id === selectedId
                        ? "bg-accent"
                        : "hover:bg-accent/60",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {n.pinned && (
                        <Pin className="size-3 shrink-0 fill-current" />
                      )}
                      <span className="truncate text-sm font-medium">
                        {n.title || "Untitled"}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                      {n.content.replace(/[#*`>_-]/g, "").trim() ||
                        "No content"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-muted-foreground text-[11px]">
                        {relativeTime(n.updatedAt)}
                      </span>
                      {n.tags.slice(0, 2).map((t) => (
                        <Badge
                          key={t}
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Editor */}
          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              projects={projects}
            />
          ) : (
            <div className="text-muted-foreground flex items-center justify-center">
              Select a note
            </div>
          )}
        </div>
      )}
    </>
  );
}

function NoteEditor({ note, projects }: { note: Note; projects: Project[] }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [tagInput, setTagInput] = useState("");
  const [projectId, setProjectId] = useState<string>(
    note.projectId ?? NO_PROJECT,
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave whenever an edited field changes.
  useEffect(() => {
    if (!dirty) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateNote(note.id, {
          title: title.trim() || "Untitled note",
          content,
          tags,
          projectId: projectId === NO_PROJECT ? null : projectId,
        });
        setDirty(false);
      } catch {
        toast.error("Could not save note");
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [title, content, tags, projectId, dirty, note.id]);

  function edited<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase().replace(/,$/, "");
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setDirty(true);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
    setDirty(true);
  }

  async function togglePin() {
    try {
      await updateNote(note.id, { pinned: !note.pinned });
    } catch {
      toast.error("Could not update note");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${note.title || "this note"}"?`)) return;
    try {
      await deleteNote(note.id);
      toast.success("Note deleted");
    } catch {
      toast.error("Could not delete note");
    }
  }

  return (
    <div className="flex flex-col overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <span className="text-muted-foreground text-xs">
          {saving ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Saving…
            </span>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            `Saved · ${relativeTime(note.updatedAt)}`
          )}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={togglePin}>
            {note.pinned ? (
              <>
                <PinOff className="size-4" /> Unpin
              </>
            ) : (
              <>
                <Pin className="size-4" /> Pin
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-6">
          <input
            value={title}
            onChange={(e) => edited(setTitle)(e.target.value)}
            placeholder="Note title"
            className="placeholder:text-muted-foreground w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
          />

          {/* meta row */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={projectId}
              onValueChange={(v) => edited(setProjectId)(v)}
            >
              <SelectTrigger size="sm" className="w-48">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <div className="relative">
              <TagIcon className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                onBlur={() => tagInput && addTag(tagInput)}
                placeholder="Add tag"
                className="placeholder:text-muted-foreground h-7 w-24 bg-transparent pl-7 text-sm outline-none"
              />
            </div>
          </div>

          {/* editor / preview */}
          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="write">
              <Textarea
                value={content}
                onChange={(e) => edited(setContent)(e.target.value)}
                placeholder="Start writing… markdown supported (# headings, **bold**, - lists, `code`)."
                className="min-h-[50vh] resize-y font-mono text-sm leading-relaxed"
              />
            </TabsContent>
            <TabsContent value="preview">
              <div className="min-h-[50vh] rounded-md border p-4">
                {content.trim() ? (
                  <MarkdownView content={content} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nothing to preview yet.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

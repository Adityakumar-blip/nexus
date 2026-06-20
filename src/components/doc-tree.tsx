"use client";

import { ChevronRight, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc } from "@/lib/types";

export interface DocNode {
  doc: Doc;
  children: DocNode[];
}

// Build a parent/child tree from the flat doc list. Docs whose parent isn't in
// the set (e.g. a project-scoped view, or a dangling parentId) surface as roots
// so nothing is ever hidden.
export function buildDocTree(docs: Doc[]): DocNode[] {
  const ids = new Set(docs.map((d) => d.id));
  const byParent = new Map<string | null, Doc[]>();
  for (const d of docs) {
    const key = d.parentId && ids.has(d.parentId) ? d.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(d);
    byParent.set(key, list);
  }
  const build = (parentId: string | null): DocNode[] =>
    (byParent.get(parentId) ?? []).map((doc) => ({
      doc,
      children: build(doc.id),
    }));
  return build(null);
}

// Ids of every ancestor of `id`, nearest first — used to auto-expand the path to
// the selected doc.
export function ancestorIds(docs: Doc[], id: string): string[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const out: string[] = [];
  let cur = byId.get(id)?.parentId ?? null;
  while (cur && byId.has(cur)) {
    out.push(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return out;
}

export function DocTree({
  nodes,
  depth = 0,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  onCreateChild,
}: {
  nodes: DocNode[];
  depth?: number;
  selectedId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const { doc, children } = node;
        const isOpen = expanded.has(doc.id);
        const hasChildren = children.length > 0;
        return (
          <li key={doc.id}>
            <div
              className={cn(
                "group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors",
                doc.id === selectedId
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60",
              )}
              style={{ paddingLeft: depth * 12 }}
            >
              <button
                onClick={() => hasChildren && onToggle(doc.id)}
                className="flex size-5 shrink-0 items-center justify-center"
                aria-label={isOpen ? "Collapse" : "Expand"}
                tabIndex={hasChildren ? 0 : -1}
              >
                {hasChildren ? (
                  <ChevronRight
                    className={cn(
                      "text-muted-foreground size-3.5 transition-transform",
                      isOpen && "rotate-90",
                    )}
                  />
                ) : null}
              </button>
              <button
                onClick={() => onSelect(doc.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
              >
                <span className="shrink-0 text-sm leading-none">
                  {doc.icon ?? <FileText className="size-3.5" />}
                </span>
                <span className="truncate">{doc.title || "Untitled"}</span>
              </button>
              <button
                onClick={() => onCreateChild(doc.id)}
                className="hover:bg-accent text-muted-foreground hover:text-foreground flex size-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Add sub-page"
                title="Add sub-page"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {hasChildren && isOpen && (
              <DocTree
                nodes={children}
                depth={depth + 1}
                selectedId={selectedId}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
                onCreateChild={onCreateChild}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { DocEditorChange } from "./doc-editor-inner";

// BlockNote can't render on the server, so the actual editor is loaded client-only.
const DocEditorInner = dynamic(() => import("./doc-editor-inner"), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground px-1 py-2 text-sm">Loading editor…</div>
  ),
});

export type { DocEditorChange };

// Editor with debounced autosave. `onSave` fires ~700ms after the user stops
// typing (same cadence as the knowledge/notes editor), and a final flush runs on
// unmount / doc switch so nothing is lost.
export function DocEditor({
  docId,
  initialContent,
  editable = true,
  onSave,
  debounceMs = 700,
}: {
  docId: string;
  initialContent: string;
  editable?: boolean;
  onSave?: (change: DocEditorChange) => void;
  debounceMs?: number;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<DocEditorChange | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current && onSaveRef.current) {
      onSaveRef.current(pending.current);
      pending.current = null;
    }
  }, []);

  const handleChange = useCallback(
    (change: DocEditorChange) => {
      pending.current = change;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, debounceMs);
    },
    [flush, debounceMs],
  );

  // Flush any pending edit when switching docs or unmounting.
  useEffect(() => () => flush(), [docId, flush]);

  return (
    <DocEditorInner
      docId={docId}
      initialContent={initialContent}
      editable={editable}
      onChange={handleChange}
    />
  );
}

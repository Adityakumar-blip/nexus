"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import type { Block, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";

export interface DocEditorChange {
  content: string; // block JSON, stringified
  contentText: string; // markdown export for search / MCP
}

// Parse stored block JSON back into BlockNote's initial content. BlockNote needs
// either `undefined` or a non-empty block array, so anything empty/invalid maps
// to undefined (a fresh empty editor).
function parseContent(content: string): PartialBlock[] | undefined {
  if (!content) return undefined;
  try {
    const blocks = JSON.parse(content);
    if (Array.isArray(blocks) && blocks.length > 0) return blocks as PartialBlock[];
    return undefined;
  } catch {
    return undefined;
  }
}

// The actual editor. Mounted client-only (see doc-editor.tsx) because BlockNote
// touches the DOM and cannot render during SSR.
export default function DocEditorInner({
  docId,
  initialContent,
  editable = true,
  onChange,
}: {
  docId: string; // remount the editor when the active doc changes
  initialContent: string;
  editable?: boolean;
  onChange?: (change: DocEditorChange) => void;
}) {
  const { resolvedTheme } = useTheme();
  const initial = useMemo(() => parseContent(initialContent), [initialContent]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useCreateBlockNote({ initialContent: initial }, [docId]);

  // Push edits up as both block JSON and a markdown rendering. We read the doc
  // off the editor instance each change so the callback stays current.
  useEffect(() => {
    if (!editor) return;
    return editor.onChange(async () => {
      const cb = onChangeRef.current;
      if (!cb) return;
      const blocks = editor.document as Block[];
      const contentText = await editor.blocksToMarkdownLossy(blocks);
      cb({ content: JSON.stringify(blocks), contentText });
    });
  }, [editor]);

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}

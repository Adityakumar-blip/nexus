// Builds the seed content for a feature doc created from a task. Returns
// BlockNote partial-block JSON (what the editor hydrates from) plus a markdown
// mirror for search / MCP, so "create a doc for each feature" yields a real,
// structured page rather than a blank one.

import type { Task } from "./types";

const TYPE_ICON: Record<string, string> = {
  feature: "🚀",
  bug: "🐛",
  improvement: "✅",
  chore: "🔧",
};

const TYPE_LABEL: Record<string, string> = {
  feature: "Feature",
  bug: "Bug",
  improvement: "Improvement",
  chore: "Chore",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Needs Review",
  done: "Done",
  later: "Later",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export interface FeatureDocSeed {
  title: string;
  icon: string;
  content: string; // stringified BlockNote PartialBlock[]
  contentText: string; // markdown mirror
}

export function buildFeatureDocSeed(task: Task): FeatureDocSeed {
  const title = task.title.trim() || "Untitled feature";
  const meta = `${TYPE_LABEL[task.type] ?? task.type} · ${
    PRIORITY_LABEL[task.priority] ?? task.priority
  } priority · ${STATUS_LABEL[task.status] ?? task.status}`;
  const overview = task.description.trim() || "_Describe what this feature does and why it matters._";

  // PartialBlock[] — strings are valid block content; BlockNote fills defaults.
  const blocks: unknown[] = [
    { type: "heading", props: { level: 2 }, content: "Overview" },
    { type: "paragraph", content: meta },
    { type: "paragraph", content: task.description.trim() || "" },
    { type: "heading", props: { level: 2 }, content: "Acceptance criteria" },
    { type: "bulletListItem", content: "" },
    { type: "heading", props: { level: 2 }, content: "Implementation notes" },
    { type: "paragraph", content: "" },
    { type: "heading", props: { level: 2 }, content: "Open questions" },
    { type: "paragraph", content: "" },
  ];

  // Carry over the agent's flag note if there is one, so context isn't lost.
  if (task.note.trim()) {
    blocks.push(
      { type: "heading", props: { level: 2 }, content: "Notes from the board" },
      { type: "paragraph", content: task.note.trim() },
    );
  }

  const md = [
    `# ${title}`,
    "",
    `## Overview`,
    meta,
    "",
    overview,
    "",
    `## Acceptance criteria`,
    "- ",
    "",
    `## Implementation notes`,
    "",
    `## Open questions`,
    "",
    ...(task.note.trim()
      ? [`## Notes from the board`, task.note.trim(), ""]
      : []),
  ].join("\n");

  return {
    title,
    icon: TYPE_ICON[task.type] ?? "📄",
    content: JSON.stringify(blocks),
    contentText: md,
  };
}

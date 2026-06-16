// Nexus remote MCP server.
//
// Exposes Nexus (projects · milestones · tasks · knowledge) as MCP tools so
// Claude Code, Cursor, or any MCP-capable agent can drive it. Authentication is
// a Personal Access Token (PAT) presented as a Bearer credential; we resolve it
// to the owning user's uid and scope every tool to that user.
//
// Routing: this catch-all sits at /api/[transport]. With basePath "/api" the
// Streamable HTTP transport is served at /api/mcp. The static /api/keys route
// takes precedence over this dynamic segment, so the two coexist.

import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyApiKey } from "@/lib/api-keys";
import { NotFoundError } from "@/lib/nexus-admin";
import * as nexus from "@/lib/nexus-admin";
import { PROJECT_COLORS } from "@/lib/types";
import type { Project, Milestone, Task, Note } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- result helpers --------------------------------------------------------

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

const err = (message: string): ToolResult => ({
  content: [{ type: "text", text: `Error: ${message}` }],
  isError: true,
});

// Run a tool body with the resolved owner uid, mapping errors to tool errors.
async function handle(
  extra: { authInfo?: { extra?: Record<string, unknown> } },
  fn: (ownerId: string) => Promise<unknown>,
): Promise<ToolResult> {
  const ownerId = extra.authInfo?.extra?.ownerId;
  if (typeof ownerId !== "string") {
    return err("Unauthorized — invalid or missing Nexus API key.");
  }
  try {
    return ok(await fn(ownerId));
  } catch (e) {
    if (e instanceof NotFoundError) return err(e.message);
    return err(e instanceof Error ? e.message : "Unknown error");
  }
}

// --- date helpers ----------------------------------------------------------

const iso = (ms: number) => new Date(ms).toISOString();

function msToDateString(ms: number | null): string | null {
  if (ms == null) return null;
  const d = new Date(ms);
  const off = d.getTimezoneOffset();
  return new Date(ms - off * 60000).toISOString().slice(0, 10);
}

// Convert an incoming YYYY-MM-DD into epoch ms. undefined => leave unchanged,
// null/"" => clear the field.
function dateToMs(s: string | null | undefined): number | null | undefined {
  if (s === undefined) return undefined;
  if (s === null || s === "") return null;
  return new Date(s + "T00:00:00").getTime();
}

// --- presenters (humanize dates for the agent) -----------------------------

const presentProject = (p: Project) => ({
  ...p,
  createdAt: iso(p.createdAt),
  updatedAt: iso(p.updatedAt),
});
const presentMilestone = (m: Milestone) => ({
  ...m,
  targetDate: msToDateString(m.targetDate),
  createdAt: iso(m.createdAt),
  updatedAt: iso(m.updatedAt),
});
const presentTask = (t: Task) => ({
  ...t,
  dueDate: msToDateString(t.dueDate),
  createdAt: iso(t.createdAt),
  updatedAt: iso(t.updatedAt),
});
const presentNote = (n: Note) => ({
  ...n,
  createdAt: iso(n.createdAt),
  updatedAt: iso(n.updatedAt),
});

// --- shared enums ----------------------------------------------------------

const projectStatus = z.enum(["active", "archived"]);
const milestoneStatus = z.enum(["planned", "active", "shipped"]);
const taskStatus = z.enum(["todo", "in_progress", "done"]);
const taskType = z.enum(["feature", "bug", "improvement", "chore"]);
const priority = z.enum(["low", "medium", "high"]);
const projectColor = z.enum([...PROJECT_COLORS]);
const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("Date as YYYY-MM-DD");

// ---------------------------------------------------------------------------

const handler = createMcpHandler(
  (server) => {
    // --- projects ----------------------------------------------------------
    server.tool(
      "list_projects",
      "List all of the user's projects, newest first.",
      {},
      (_args, extra) =>
        handle(extra, async (uid) =>
          (await nexus.listProjects(uid)).map(presentProject),
        ),
    );

    server.tool(
      "create_project",
      "Create a new project.",
      {
        name: z.string().min(1),
        description: z.string().optional(),
        color: projectColor.optional(),
        status: projectStatus.optional(),
      },
      (args, extra) =>
        handle(extra, async (uid) =>
          presentProject(await nexus.createProject(uid, args)),
        ),
    );

    server.tool(
      "update_project",
      "Update fields on an existing project. Only provided fields change.",
      {
        id: z.string().describe("Project id"),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        color: projectColor.optional(),
        status: projectStatus.optional(),
      },
      ({ id, ...patch }, extra) =>
        handle(extra, async (uid) =>
          presentProject(await nexus.updateProject(uid, id, patch)),
        ),
    );

    server.tool(
      "delete_project",
      "Delete a project. By default also deletes its tasks and milestones (cascade).",
      {
        id: z.string().describe("Project id"),
        cascade: z
          .boolean()
          .optional()
          .describe("Delete child tasks & milestones too (default true)"),
      },
      ({ id, cascade }, extra) =>
        handle(extra, (uid) => nexus.deleteProject(uid, id, cascade ?? true)),
    );

    // --- milestones --------------------------------------------------------
    server.tool(
      "list_milestones",
      "List milestones, optionally filtered to one project. Ordered active → planned → shipped.",
      { projectId: z.string().optional() },
      ({ projectId }, extra) =>
        handle(extra, async (uid) =>
          (await nexus.listMilestones(uid, projectId)).map(presentMilestone),
        ),
    );

    server.tool(
      "create_milestone",
      "Create a milestone (release) inside a project.",
      {
        projectId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        status: milestoneStatus.optional(),
        targetDate: dateInput.nullable().optional(),
      },
      ({ targetDate, ...rest }, extra) =>
        handle(extra, async (uid) =>
          presentMilestone(
            await nexus.createMilestone(uid, {
              ...rest,
              targetDate: dateToMs(targetDate),
            }),
          ),
        ),
    );

    server.tool(
      "update_milestone",
      "Update a milestone. Pass targetDate as null to clear it.",
      {
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        status: milestoneStatus.optional(),
        targetDate: dateInput.nullable().optional(),
      },
      ({ id, targetDate, ...patch }, extra) =>
        handle(extra, async (uid) =>
          presentMilestone(
            await nexus.updateMilestone(uid, id, {
              ...patch,
              targetDate: dateToMs(targetDate),
            }),
          ),
        ),
    );

    server.tool(
      "delete_milestone",
      "Delete a milestone. Its tasks keep their work but lose the release link.",
      { id: z.string() },
      ({ id }, extra) =>
        handle(extra, async (uid) => {
          await nexus.deleteMilestone(uid, id);
          return { deleted: id };
        }),
    );

    // --- tasks -------------------------------------------------------------
    server.tool(
      "list_tasks",
      "List tasks. Filter by project, milestone, and/or status.",
      {
        projectId: z.string().optional(),
        milestoneId: z.string().optional(),
        status: taskStatus.optional(),
      },
      (filter, extra) =>
        handle(extra, async (uid) =>
          (await nexus.listTasks(uid, filter)).map(presentTask),
        ),
    );

    server.tool(
      "create_task",
      "Create a task in a project (optionally linked to a milestone).",
      {
        projectId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        type: taskType.optional(),
        priority: priority.optional(),
        status: taskStatus.optional(),
        milestoneId: z.string().nullable().optional(),
        dueDate: dateInput.nullable().optional(),
      },
      ({ dueDate, ...rest }, extra) =>
        handle(extra, async (uid) =>
          presentTask(
            await nexus.createTask(uid, { ...rest, dueDate: dateToMs(dueDate) }),
          ),
        ),
    );

    server.tool(
      "update_task",
      "Update a task. Pass milestoneId/dueDate as null to clear them.",
      {
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        type: taskType.optional(),
        priority: priority.optional(),
        status: taskStatus.optional(),
        milestoneId: z.string().nullable().optional(),
        dueDate: dateInput.nullable().optional(),
      },
      ({ id, dueDate, ...patch }, extra) =>
        handle(extra, async (uid) =>
          presentTask(
            await nexus.updateTask(uid, id, {
              ...patch,
              dueDate: dateToMs(dueDate),
            }),
          ),
        ),
    );

    server.tool(
      "delete_task",
      "Delete a task permanently.",
      { id: z.string() },
      ({ id }, extra) =>
        handle(extra, async (uid) => {
          await nexus.deleteTask(uid, id);
          return { deleted: id };
        }),
    );

    // --- notes (knowledge base) -------------------------------------------
    server.tool(
      "search_notes",
      "Search the knowledge base by text (title/content/tags) and/or project. Empty query returns all notes.",
      {
        query: z.string().optional(),
        projectId: z.string().optional(),
      },
      (filter, extra) =>
        handle(extra, async (uid) =>
          (await nexus.listNotes(uid, filter)).map(presentNote),
        ),
    );

    server.tool(
      "get_note",
      "Fetch a single note (including full markdown content) by id.",
      { id: z.string() },
      ({ id }, extra) =>
        handle(extra, async (uid) => presentNote(await nexus.getNote(uid, id))),
    );

    server.tool(
      "create_note",
      "Create a knowledge-base note. Content is markdown.",
      {
        title: z.string().min(1),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
        projectId: z.string().nullable().optional(),
        pinned: z.boolean().optional(),
      },
      (args, extra) =>
        handle(extra, async (uid) =>
          presentNote(await nexus.createNote(uid, args)),
        ),
    );

    server.tool(
      "update_note",
      "Update a note. Pass projectId as null to unlink it from a project.",
      {
        id: z.string(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
        projectId: z.string().nullable().optional(),
        pinned: z.boolean().optional(),
      },
      ({ id, ...patch }, extra) =>
        handle(extra, async (uid) =>
          presentNote(await nexus.updateNote(uid, id, patch)),
        ),
    );

    server.tool(
      "delete_note",
      "Delete a note permanently.",
      { id: z.string() },
      ({ id }, extra) =>
        handle(extra, async (uid) => {
          await nexus.deleteNote(uid, id);
          return { deleted: id };
        }),
    );
  },
  {
    serverInfo: { name: "nexus", version: "0.1.0" },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
  },
);

// Wrap with bearer-token auth: resolve the PAT to an owner uid, exposed to tools
// via extra.authInfo.extra.ownerId. Returning undefined yields a 401.
const authedHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    let ownerId: string | null = null;
    try {
      ownerId = await verifyApiKey(bearerToken);
    } catch {
      return undefined;
    }
    if (!ownerId) return undefined;
    return {
      token: bearerToken,
      clientId: ownerId,
      scopes: [],
      extra: { ownerId },
    };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };

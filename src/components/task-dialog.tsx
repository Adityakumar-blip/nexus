"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Trash2,
  Send,
  FileText,
  FilePlus2,
  Circle,
  Flag,
  Tag,
  CalendarClock,
  User,
  Rocket,
  ListTree,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  createTask,
  updateTask,
  deleteTask,
  createDocument,
  watchComments,
  addComment,
  deleteComment,
} from "@/lib/store";
import { buildFeatureDocSeed } from "@/lib/feature-doc";
import {
  PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  type Task,
  type TaskStatus,
  type TaskType,
  type Priority,
  type Milestone,
  type UserProfile,
  type Comment,
} from "@/lib/types";
import {
  relativeTime,
  priorityBadge,
  taskKey,
  taskTypeMeta,
  STATUS_DOT,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { UserAvatar, displayName } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NO_MILESTONE = "none";
const NO_PARENT = "none";
const UNASSIGNED = "none";

export function TaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  defaultStatus = "todo",
  defaultMilestoneId = null,
  defaultParentId = null,
  milestones = [],
  tasks = [],
  canEdit = true,
  memberIds = [],
  profiles = new Map(),
  onOpenDoc,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task?: Task;
  defaultStatus?: TaskStatus;
  defaultMilestoneId?: string | null;
  defaultParentId?: string | null;
  milestones?: Milestone[];
  tasks?: Task[];
  canEdit?: boolean;
  memberIds?: string[];
  profiles?: Map<string, UserProfile>;
  onOpenDoc?: (docId: string) => void;
}) {
  const { user } = useAuth();
  const editing = Boolean(task);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [type, setType] = useState<TaskType>("feature");
  const [priority, setPriority] = useState<Priority>("medium");
  const [milestoneId, setMilestoneId] = useState<string>(NO_MILESTONE);
  const [parentId, setParentId] = useState<string>(NO_PARENT);
  const [assigneeId, setAssigneeId] = useState<string>(UNASSIGNED);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting] = useState(false);

  // Only top-level tasks can be parents (we keep the hierarchy one level deep),
  // and a task can't be its own parent.
  const eligibleParents = tasks.filter(
    (t) => !t.parentId && t.id !== task?.id,
  );
  // A task that already has sub-tasks can't itself become a sub-task.
  const hasChildren = task ? tasks.some((t) => t.parentId === task.id) : false;
  const canPickParent = !hasChildren && eligibleParents.length > 0;
  const isSubtask = parentId !== NO_PARENT;

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? defaultStatus);
      setType(task?.type ?? "feature");
      setPriority(task?.priority ?? "medium");
      setMilestoneId(task?.milestoneId ?? defaultMilestoneId ?? NO_MILESTONE);
      setParentId(task?.parentId ?? defaultParentId ?? NO_PARENT);
      setAssigneeId(task?.assigneeId ?? UNASSIGNED);
      setDueDate(task?.dueDate ? new Date(task.dueDate) : undefined);
      setNote(task?.note ?? "");
    }
  }, [open, task, defaultStatus, defaultMilestoneId, defaultParentId]);

  // Live comment thread for the task being edited.
  const taskId = task?.id;
  useEffect(() => {
    if (!open || !taskId) {
      setComments([]);
      return;
    }
    return watchComments(taskId, setComments);
  }, [open, taskId]);

  async function handlePostComment() {
    if (!user || !task || !commentBody.trim()) return;
    setPosting(true);
    try {
      await addComment(user.uid, {
        taskId: task.id,
        projectId,
        body: commentBody,
      });
      setCommentBody("");
    } catch {
      toast.error("Could not post comment");
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteComment(id: string) {
    try {
      await deleteComment(id);
    } catch {
      toast.error("Could not delete comment");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setBusy(true);
    const dueMs = dueDate ? dueDate.getTime() : null;
    const parent = parentId === NO_PARENT ? null : parentId;
    // A sub-task inherits its parent's milestone; otherwise use the picked one.
    const ms = parent
      ? (tasks.find((t) => t.id === parent)?.milestoneId ?? null)
      : milestoneId === NO_MILESTONE
        ? null
        : milestoneId;
    const assignee = assigneeId === UNASSIGNED ? null : assigneeId;
    try {
      if (task) {
        await updateTask(task.id, {
          title: title.trim(),
          description: description.trim(),
          status,
          type,
          priority,
          milestoneId: ms,
          parentId: parent,
          dueDate: dueMs,
          assigneeId: assignee,
          note: note.trim(),
        });
        toast.success("Task updated");
      } else {
        await createTask(user.uid, {
          projectId,
          title: title.trim(),
          description: description.trim(),
          status,
          type,
          priority,
          milestoneId: ms,
          parentId: parent,
          dueDate: dueMs,
          assigneeId: assignee,
          note: note.trim(),
        });
        toast.success(parent ? "Sub-task added" : "Task added");
      }
      onOpenChange(false);
    } catch {
      toast.error("Could not save task");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!task || !user) return;
    const childCount = tasks.filter((t) => t.parentId === task.id).length;
    const message = childCount
      ? `Delete "${task.title}" and its ${childCount} sub-task${childCount > 1 ? "s" : ""}?`
      : `Delete "${task.title}"?`;
    if (!confirm(message)) return;
    setBusy(true);
    try {
      await deleteTask(user.uid, task.id);
      toast.success("Task deleted");
      onOpenChange(false);
    } catch {
      toast.error("Could not delete task");
    } finally {
      setBusy(false);
    }
  }

  // Create a linked feature doc seeded from this task (or open the existing one).
  // Uses the current form values so unsaved edits flow into the doc.
  async function handleDoc() {
    if (!task || !user) return;
    if (task.docId) {
      onOpenDoc?.(task.docId);
      onOpenChange(false);
      return;
    }
    setDocBusy(true);
    try {
      const seed = buildFeatureDocSeed({
        ...task,
        title: title.trim() || task.title,
        description: description.trim(),
        type,
        priority,
        status,
        note: note.trim(),
      });
      const docId = await createDocument(user.uid, {
        title: seed.title,
        icon: seed.icon,
        content: seed.content,
        contentText: seed.contentText,
        projectId,
      });
      await updateTask(task.id, { docId });
      toast.success("Feature doc created");
      onOpenDoc?.(docId);
      onOpenChange(false);
    } catch {
      toast.error("Could not create doc");
    } finally {
      setDocBusy(false);
    }
  }

  const tm = taskTypeMeta(type);
  const pr = priorityBadge(priority);
  const eyebrow = editing
    ? isSubtask
      ? "Edit sub-task"
      : "Edit task"
    : isSubtask
      ? "New sub-task"
      : "New task";

  // The structured property panel (status, assignee, priority, …) plus the
  // notes and feature-doc affordances. Shared by the create form and the
  // editing "Details" tab.
  const detailsBody = (
    <>
      <fieldset disabled={!canEdit} className="space-y-5">
        <div className="bg-muted/30 divide-border/60 divide-y rounded-xl border">
          <Field icon={Circle} label="Status">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as TaskStatus)}
            >
              <SelectTrigger size="sm" className={PROP_TRIGGER}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn("size-2 rounded-full", STATUS_DOT[status])}
                  />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("size-2 rounded-full", STATUS_DOT[s.value])}
                      />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {memberIds.length > 0 && (
            <Field icon={User} label="Assignee">
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger size="sm" className={PROP_TRIGGER}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {memberIds.map((uid) => (
                    <SelectItem key={uid} value={uid}>
                      <span className="flex items-center gap-2">
                        <UserAvatar
                          profile={profiles.get(uid)}
                          className="size-4"
                        />
                        {displayName(profiles.get(uid))}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field icon={CalendarClock} label="Due date">
            <DatePicker
              id="task-due"
              value={dueDate}
              onChange={setDueDate}
              placeholder="No due date"
              className="h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60"
            />
          </Field>

          <Field icon={Flag} label="Priority">
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Priority)}
            >
              <SelectTrigger size="sm" className={PROP_TRIGGER}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                      pr.badge,
                    )}
                  >
                    {pr.label}
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field icon={Tag} label="Type">
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger size="sm" className={PROP_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {canPickParent && (
            <Field icon={ListTree} label="Parent">
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger size="sm" className={PROP_TRIGGER}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>No parent</SelectItem>
                  {eligibleParents.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {milestones.length > 0 && !isSubtask && (
            <Field icon={Rocket} label="Milestone">
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger size="sm" className={PROP_TRIGGER}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MILESTONE}>No milestone</SelectItem>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        {isSubtask && canPickParent && (
          <p className="text-muted-foreground -mt-3 px-1 text-xs">
            A sub-task inherits its parent&apos;s milestone.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="task-desc">Description</Label>
          <Textarea
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, context, or acceptance criteria…"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-note">Review note</Label>
          <Textarea
            id="task-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Flag for a human: why this needs review, what's blocking, or what to pick up later…"
            rows={2}
          />
          <p className="text-muted-foreground text-xs">
            Shown on the card — pair it with “Needs Review” or “Later” so nothing
            slips through.
          </p>
        </div>
      </fieldset>

      {/* Feature doc — create a linked, structured doc (or open it). */}
      {editing && task && (
        <div className="border-t pt-5">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleDoc}
            disabled={docBusy || (!task.docId && !canEdit)}
          >
            {docBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : task.docId ? (
              <FileText className="size-4" />
            ) : (
              <FilePlus2 className="size-4" />
            )}
            {task.docId ? "Open feature doc" : "Create feature doc"}
          </Button>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {task.docId
              ? "A doc is linked to this feature."
              : "Generate a structured doc for this feature in the project's Docs."}
          </p>
        </div>
      )}
    </>
  );

  // The comment thread + composer (the "Discussion" tab when editing).
  const discussionBody = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
            <MessageSquare className="size-6 opacity-60" />
            <p className="text-sm">No comments yet.</p>
            <p className="text-xs">Start the conversation below.</p>
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <UserAvatar
                profile={profiles.get(c.authorId)}
                className="mt-0.5 size-7 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {displayName(profiles.get(c.authorId))}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {relativeTime(c.createdAt)}
                  </span>
                  {c.authorId === user?.uid && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(c.id)}
                      className="text-muted-foreground hover:text-destructive ml-auto text-xs"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="bg-muted/50 mt-1 rounded-lg rounded-tl-sm px-3 py-2">
                  <p className="text-sm break-words whitespace-pre-wrap">
                    {c.body}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="bg-background mt-4 flex items-end gap-2 border-t pt-4">
        <Textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="Write a comment…  (⌘↵ to send)"
          rows={2}
          className="min-h-0 flex-1"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handlePostComment();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          onClick={handlePostComment}
          disabled={posting || !commentBody.trim()}
          aria-label="Post comment"
        >
          {posting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
          {/* Detail-panel header: chips, editable title, task key. */}
          <SheetHeader className="gap-3 border-b p-6 pr-12 pb-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                  tm.badge,
                )}
              >
                {tm.label}
              </span>
              <SheetTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {eyebrow}
              </SheetTitle>
              {editing && task && (
                <span className="text-muted-foreground/70 ml-auto font-mono text-[11px] tabular-nums">
                  {taskKey(task.id)}
                </span>
              )}
            </div>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title…"
              autoFocus
              required
              disabled={!canEdit}
              className="hover:bg-muted/50 focus-visible:bg-muted/50 -mx-1.5 h-auto rounded-md border-0 bg-transparent px-1.5 py-1 text-lg font-semibold shadow-none transition-colors focus-visible:ring-0 disabled:opacity-100 md:text-lg"
            />
          </SheetHeader>

          {editing && task ? (
            <Tabs
              defaultValue="details"
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <div className="px-6 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="discussion" className="flex-1">
                    <MessageSquare className="size-3.5" />
                    Discussion
                    {comments.length > 0 && (
                      <span className="bg-muted-foreground/15 ml-1 rounded-full px-1.5 text-[10px] tabular-nums">
                        {comments.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent
                value="details"
                className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6"
              >
                {detailsBody}
              </TabsContent>
              <TabsContent
                value="discussion"
                className="min-h-0 flex-1 overflow-hidden p-6"
              >
                {discussionBody}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              {detailsBody}
            </div>
          )}

          <SheetFooter className="flex-row items-center justify-between border-t">
            {editing && canEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {canEdit ? "Cancel" : "Close"}
              </Button>
              {canEdit && (
                <Button type="submit" disabled={busy || !title.trim()}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Add task"}
                </Button>
              )}
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// Borderless trigger styling so the property selects read as a clean,
// inline detail panel rather than a stack of form inputs.
const PROP_TRIGGER =
  "h-8 w-full justify-between border-0 bg-transparent px-2 shadow-none hover:bg-muted/60 data-[state=open]:bg-muted/60 focus-visible:ring-0 disabled:opacity-100";

// One labelled row in the property panel: an icon + label on the left, the
// editable control on the right.
function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2 px-2 py-1">
      <span className="text-muted-foreground inline-flex items-center gap-2 pl-1 text-sm">
        <Icon className="size-4 shrink-0" />
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

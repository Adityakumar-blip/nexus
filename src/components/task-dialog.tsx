"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  createTask,
  updateTask,
  deleteTask,
  watchComments,
  addComment,
  deleteComment,
} from "@/lib/store";
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
import { relativeTime } from "@/lib/format";
import { UserAvatar, displayName } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [busy, setBusy] = useState(false);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b">
          <SheetTitle>
            {editing
              ? isSubtask
                ? "Edit sub-task"
                : "Edit task"
              : isSubtask
                ? "New sub-task"
                : "New task"}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <fieldset disabled={!canEdit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Design the landing page"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Notes</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any details…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as TaskType)}
              >
                <SelectTrigger className="w-full">
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
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <DatePicker
                id="task-due"
                value={dueDate}
                onChange={setDueDate}
                placeholder="No due date"
              />
            </div>
          </div>
          {memberIds.length > 0 && (
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="w-full">
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
            </div>
          )}
          {canPickParent && (
            <div className="space-y-2">
              <Label>Parent task</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="w-full">
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
              {isSubtask && (
                <p className="text-muted-foreground text-xs">
                  A sub-task inherits its parent&apos;s milestone.
                </p>
              )}
            </div>
          )}
          {milestones.length > 0 && !isSubtask && (
            <div className="space-y-2">
              <Label>Milestone</Label>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger className="w-full">
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
            </div>
          )}
          </fieldset>

          {/* Comments — available to everyone with access, including viewers. */}
          {editing && task && (
            <div className="space-y-3 border-t pt-5">
              <Label>
                Comments
                {comments.length > 0 && (
                  <span className="text-muted-foreground ml-1 font-normal">
                    ({comments.length})
                  </span>
                )}
              </Label>
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No comments yet.
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <UserAvatar
                        profile={profiles.get(c.authorId)}
                        className="mt-0.5 size-6 shrink-0"
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
                        <p className="text-sm break-words whitespace-pre-wrap">
                          {c.body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-end gap-2">
                <Textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Write a comment…"
                  rows={2}
                  className="min-h-0 flex-1"
                  onKeyDown={(e) => {
                    if (
                      (e.metaKey || e.ctrlKey) &&
                      e.key === "Enter"
                    ) {
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
          )}
          </div>
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
                  {editing ? "Save" : "Add task"}
                </Button>
              )}
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

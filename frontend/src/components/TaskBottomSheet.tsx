/**
 * TaskBottomSheet — slide-over panel showing full To-Do details.
 * side="bottom"  → mobile slide-up sheet (default)
 * side="right"   → desktop slide-in panel from the right
 */
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  formatDueDate,
  getUserInitials,
  isOverdue,
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/taskHelpers";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Archive,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  FileText,
  MessageSquare,
  Mountain,
  Pencil,
  RefreshCw,
  RotateCcw,
  Timer,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import TaskDialog from "./TaskDialog";
import { TaskCommentThread } from "./TaskCommentThread";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { TaskCardData } from "./TaskCard";

export interface TaskBottomSheetProps {
  task: TaskCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeName?: string | null;
  projectName?: string;
  onUpdated?: () => void;
  /** Which edge the sheet slides in from. Defaults to "bottom". Use "right" for desktop. */
  side?: "bottom" | "right";
}

const STATUS_META: Record<TaskStatus, { label: string; icon: React.ReactNode; color: string }> = {
  todo: { label: "To Do", icon: <Circle className="h-3.5 w-3.5" />, color: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: <Timer className="h-3.5 w-3.5" />, color: "text-blue-500" },
  done: { label: "Done", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-green-500" },
};

export default function TaskBottomSheet({
  task,
  open,
  onOpenChange,
  assigneeName,
  projectName,
  onUpdated,
  side = "bottom",
}: TaskBottomSheetProps) {
  const { user: _currentUser } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const utils = trpc.useUtils();

  const isRight = side === "right";

  const { data: subtasks } = trpc.subtasks.listByTask.useQuery(
    { taskId: task?.id ?? 0 },
    { enabled: !!task && open }
  );

  const toggleSubtask = trpc.subtasks.toggle.useMutation({
    onSuccess: () => {
      utils.subtasks.listByTask.invalidate({ taskId: task?.id });
      utils.tasks.listAll.invalidate();
    },
  });

  const updateStatus = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.listAll.invalidate();
      utils.dashboard.stats.invalidate();
      onUpdated?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveTask = trpc.tasks.archive.useMutation({
    onSuccess: () => {
      toast.success("To-Do archived");
      utils.tasks.listAll.invalidate();
      utils.dashboard.stats.invalidate();
      onOpenChange(false);
      onUpdated?.();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!task) return null;

  const isDone = task.status === "done";
  const overdue = isOverdue(task.dueDate) && !isDone;
  const statusMeta = STATUS_META[task.status];
  const subtaskTotal = task.subtaskTotal ?? subtasks?.length ?? 0;
  const subtaskDone = task.subtaskDone ?? subtasks?.filter((s) => s.completed).length ?? 0;
  const subtaskProgress = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;

  const hasRecurrence = task.recurrenceType !== "none";
  const recurrenceLabel = hasRecurrence
    ? task.recurrenceType === "biweekly"
      ? "Every 2 weeks"
      : `Every ${task.recurrenceInterval} ${
          task.recurrenceType === "daily"
            ? "day"
            : task.recurrenceType === "weekly"
            ? "week"
            : "month"
        }${task.recurrenceInterval > 1 ? "s" : ""}`
    : null;

  function handleMarkDone() {
    const newStatus: TaskStatus = isDone ? "todo" : "done";
    updateStatus.mutate({ id: task!.id, status: newStatus });
    toast.success(isDone ? "To-Do reopened" : "To-Do marked as done! 🎉");
  }

  function cycleStatus() {
    const cycle: TaskStatus[] = ["todo", "in_progress", "done"];
    const idx = cycle.indexOf(task!.status);
    const next = cycle[(idx + 1) % cycle.length];
    updateStatus.mutate({ id: task!.id, status: next });
    toast.success(`Moved to ${STATUS_META[next].label}`);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={side}
          className={
            isRight
              ? "w-full sm:max-w-[420px] p-0 flex flex-col"
              : "h-[90dvh] rounded-t-2xl p-0 flex flex-col"
          }
        >
          {/* Drag handle — bottom sheet only */}
          {!isRight && (
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
          )}

          {/* Header */}
          <SheetHeader className={`px-5 pb-3 shrink-0 ${isRight ? "pt-6" : "pt-2"}`}>
            <div className="flex items-start gap-3">
              {/* Status cycle button */}
              <button
                onClick={cycleStatus}
                className={`mt-0.5 shrink-0 transition-colors hover:opacity-70 ${statusMeta.color}`}
                title={`Status: ${statusMeta.label} — click to advance`}
              >
                {statusMeta.icon}
              </button>
              <SheetTitle
                className={`text-base font-semibold text-left leading-snug flex-1 ${
                  isDone ? "line-through text-muted-foreground" : ""
                }`}
              >
                {task.title}
              </SheetTitle>
            </div>
          </SheetHeader>

          <Separator />

          <ScrollArea className="flex-1 px-5">
            <div className="py-4 space-y-5">
              {/* Meta badges */}
              <div className="flex flex-wrap gap-2 items-center">
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    PRIORITY_BADGE_CLASS[task.priority as TaskPriority]
                  }`}
                >
                  {PRIORITY_LABELS[task.priority as TaskPriority]}
                </span>

                <span
                  className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary ${statusMeta.color}`}
                >
                  {statusMeta.icon}
                  {statusMeta.label}
                </span>

                {task.dueDate && (
                  <span
                    className={`flex items-center gap-1 text-[11px] font-medium ${
                      overdue ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {overdue ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Calendar className="h-3.5 w-3.5" />
                    )}
                    {formatDueDate(task.dueDate)}
                    {overdue && (
                      <span className="text-destructive font-semibold ml-0.5">Overdue</span>
                    )}
                  </span>
                )}

                {hasRecurrence && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                    <RefreshCw className="h-3 w-3" />
                    {recurrenceLabel}
                  </span>
                )}
              </div>

              {/* Project */}
              {projectName && (
                <div className="flex items-center gap-2">
                  <Mountain className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-medium text-primary/80 uppercase tracking-wide">
                    {projectName}
                  </span>
                </div>
              )}

              {/* Assignee */}
              {assigneeName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Avatar className="h-6 w-6 border border-border">
                    <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                      {getUserInitials(assigneeName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">{assigneeName}</span>
                </div>
              )}

              {/* Notes */}
              {(task.notes || task.description) && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Notes
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap bg-secondary/40 rounded-lg px-3 py-2">
                    {task.notes || task.description}
                  </p>
                </div>
              )}

              {/* Subtasks */}
              {subtaskTotal > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <CheckSquare className="h-3.5 w-3.5" />
                      Subtasks
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {subtaskDone}/{subtaskTotal} · {subtaskProgress}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                  {subtasks && subtasks.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {subtasks.map((st) => (
                        <button
                          key={st.id}
                          className="w-full flex items-center gap-2.5 text-left group"
                          onClick={() =>
                            toggleSubtask.mutate({ id: st.id, completed: !st.completed })
                          }
                        >
                          <div
                            className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                              st.completed
                                ? "bg-primary border-primary"
                                : "border-border group-hover:border-primary/60"
                            }`}
                          >
                            {st.completed && (
                              <svg
                                className="w-2.5 h-2.5 text-primary-foreground"
                                fill="none"
                                viewBox="0 0 12 12"
                              >
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={`text-sm ${
                              st.completed
                                ? "line-through text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {st.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          {/* Action bar */}
          <div className="px-5 py-4 flex flex-col gap-2 shrink-0">
            <Button
              className="w-full gap-2"
              variant={isDone ? "outline" : "default"}
              onClick={handleMarkDone}
              disabled={updateStatus.isPending}
            >
              {isDone ? (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Reopen To-Do
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Mark as Done
                </>
              )}
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setCommentsOpen(true)}
              >
                <MessageSquare className="h-4 w-4" />
                Comments
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => archiveTask.mutate(task.id)}
                disabled={archiveTask.isPending}
                title="Archive"
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit dialog (opens on top of sheet) */}
      {editOpen && (
        <TaskDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          projectId={task.projectId}
          task={task}
          onSuccess={() => {
            setEditOpen(false);
            onUpdated?.();
          }}
        />
      )}

      {/* Comment thread */}
      <TaskCommentThread
        taskId={task.id}
        taskTitle={task.title}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />
    </>
  );
}

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatDueDate,
  getUserInitials,
  isOverdue,
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/taskHelpers";
import { useDeleteTask, useArchiveTask, useUpdateTask, useSubtasks, useToggleSubtask, useComments, QK } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/useMobile";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import TaskDialog from "./TaskDialog";
import { TaskCommentThread } from "./TaskCommentThread";
import TaskBottomSheet from "./TaskBottomSheet";

export type TaskCardData = {
  id: number;
  title: string;
  description: string | null;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: number | null;
  assigneeId: number | null;
  projectId: number | null;
  creatorId: number;
  commentCount?: number;
  recurrenceType: "none" | "daily" | "biweekly" | "weekly" | "monthly";
  recurrenceInterval: number;
  recurrenceEndsAt: number | null;
  /** Pre-computed subtask counts from listAll (avoids extra query) */
  subtaskTotal?: number;
  subtaskDone?: number;
  sortOrder?: number | null;
};

type Props = {
  task: TaskCardData;
  assigneeName?: string | null;
  projectName?: string;
  showProject?: boolean;
  onUpdated?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: number) => void;
  /** When true, a checkbox overlay appears for bulk selection */
  selectMode?: boolean;
  /** Whether this card is currently selected */
  selected?: boolean;
  /** Called when the checkbox is toggled */
  onSelectToggle?: (id: number) => void;
};

// Status cycle: todo → in_progress → done → todo
const STATUS_CYCLE: TaskStatus[] = ["todo", "in_progress", "done"];

export default function TaskCard({
  task,
  assigneeName,
  projectName,
  showProject = false,
  onUpdated,
  draggable = false,
  onDragStart,
  selectMode = false,
  selected = false,
  onSelectToggle,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<TaskStatus | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  const currentStatus = optimisticStatus ?? task.status;
  const isDone = currentStatus === "done";

  const deleteTask = useDeleteTask();
  const archiveTask = useArchiveTask();
  const updateStatus = useUpdateTask();

  function handleMarkDone(e: React.MouseEvent) {
    e.stopPropagation();
    const newStatus: TaskStatus = isDone ? "todo" : "done";
    setOptimisticStatus(newStatus);
    updateStatus.mutate(
      { id: task.id, status: newStatus },
      {
        onSuccess: () => { setOptimisticStatus(null); onUpdated?.(); },
        onError: (err: any) => { setOptimisticStatus(null); toast.error(err.message); },
      }
    );
    toast.success(isDone ? "To-Do reopened" : "To-Do marked as done! 🎉");
  }

  // Swipe right → advance status, swipe left → regress status
  function advanceStatus() {
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    const next = STATUS_CYCLE[Math.min(idx + 1, STATUS_CYCLE.length - 1)];
    if (next === currentStatus) return;
    setOptimisticStatus(next);
    updateStatus.mutate(
      { id: task.id, status: next },
      {
        onSuccess: () => { setOptimisticStatus(null); onUpdated?.(); },
        onError: (err: any) => { setOptimisticStatus(null); toast.error(err.message); },
      }
    );
    const labels: Record<TaskStatus, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };
    toast.success(`Moved to ${labels[next]}`);
  }

  function regressStatus() {
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    const prev = STATUS_CYCLE[Math.max(idx - 1, 0)];
    if (prev === currentStatus) return;
    setOptimisticStatus(prev);
    updateStatus.mutate(
      { id: task.id, status: prev },
      {
        onSuccess: () => { setOptimisticStatus(null); onUpdated?.(); },
        onError: (err: any) => { setOptimisticStatus(null); toast.error(err.message); },
      }
    );
    const labels: Record<TaskStatus, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };
    toast.success(`Moved back to ${labels[prev]}`);
  }

  const { swipeState, handlers: swipeHandlers } = useSwipeGesture({
    onSwipeRight: advanceStatus,
    onSwipeLeft: regressStatus,
    threshold: 60,
  });

  // Subtasks (read from cache only — fetched by TaskCommentThread when opened)
  const subtasks = qc.getQueryData<any[]>(QK.subtasks(task.id));
  const toggleSubtask = useToggleSubtask();

  // Live comment count from cache (exclude activity entries)
  const cachedComments = qc.getQueryData<any[]>(QK.comments(task.id));
  const commentCount = cachedComments
    ? cachedComments.filter((c) => !(c as any).isActivity).length
    : (task.commentCount ?? 0);

  const overdue = isOverdue(task.dueDate) && !isDone;
  const hasRecurrence = task.recurrenceType !== "none";
  const recurrenceLabel = hasRecurrence
    ? task.recurrenceType === "biweekly"
      ? "Every 2 weeks"
      : `Every ${task.recurrenceInterval} ${task.recurrenceType === "daily" ? "day" : task.recurrenceType === "weekly" ? "week" : "month"}${task.recurrenceInterval > 1 ? "s" : ""}`
    : null;

  // Prefer pre-computed counts from listAll; fall back to lazy-loaded subtasks
  const subtaskTotal = task.subtaskTotal ?? subtasks?.length ?? 0;
  const subtaskDone = task.subtaskDone ?? subtasks?.filter((s) => s.completed).length ?? 0;
  const subtaskProgress = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;

  // Swipe visual feedback: clamp translateX to ±80px and show edge glow
  const swipeX = Math.max(-80, Math.min(80, swipeState.deltaX * 0.4));
  const swipeGlow =
    swipeState.isSwiping && swipeState.deltaX > 20
      ? "shadow-[inset_4px_0_0_theme(colors.green.400)]"
      : swipeState.isSwiping && swipeState.deltaX < -20
      ? "shadow-[inset_-4px_0_0_theme(colors.blue.400)]"
      : "";

  function handleCardClick() {
    if (selectMode) {
      onSelectToggle?.(task.id);
      return;
    }
    // Open detail sheet on both mobile and desktop
    setBottomSheetOpen(true);
  }

  return (
    <>
      <div
        className={`task-card glass-card rounded-xl p-4 select-none relative transition-shadow duration-150 ${
          draggable && !selectMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${isDone ? "opacity-75" : ""} ${overdue ? "border-l-[3px] border-l-destructive bg-destructive/[0.03]" : ""} ${
          selectMode ? "cursor-pointer" : ""
        } ${selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""} ${swipeGlow}`}
        style={
          swipeState.isSwiping && isMobile
            ? { transform: `translateX(${swipeX}px)`, transition: "none" }
            : { transform: "translateX(0)", transition: "transform 0.2s ease" }
        }
        draggable={draggable && !selectMode}
        onDragStart={draggable && !selectMode ? (e) => onDragStart?.(e, task.id) : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleCardClick}
        {...(isMobile ? swipeHandlers : {})}
      >
        {/* Select mode checkbox */}
        {selectMode && (
          <div
            className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              selected
                ? "bg-primary border-primary"
                : "bg-background/80 border-border hover:border-primary"
            }`}
            onClick={(e) => { e.stopPropagation(); onSelectToggle?.(task.id); }}
          >
            {selected && (
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        )}

        {/* Swipe hint labels (mobile only, shown while swiping) */}
        {isMobile && swipeState.isSwiping && (
          <>
            {swipeState.deltaX > 20 && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-500 opacity-80 pointer-events-none">
                Advance ›
              </div>
            )}
            {swipeState.deltaX < -20 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-400 opacity-80 pointer-events-none">
                ‹ Back
              </div>
            )}
          </>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className={`text-sm font-medium leading-snug line-clamp-2 flex-1 transition-all duration-200 ${isDone ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-secondary/60 transition-colors shrink-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setCommentsOpen(true)} className="cursor-pointer">
                <MessageSquare className="mr-2 h-3.5 w-3.5" />
                Comments
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit To-Do
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => archiveTask.mutate(task.id, {
                  onSuccess: () => { toast.success("To-Do archived"); onUpdated?.(); },
                  onError: (err: any) => toast.error(err.message),
                })}
                className="cursor-pointer text-muted-foreground focus:text-foreground"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmOpen(true); }}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete Permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Notes preview */}
        {(task.notes || task.description) && (
          <p className="text-xs text-muted-foreground/80 line-clamp-1 mb-2 flex items-center gap-1 italic">
            <FileText className="h-3 w-3 shrink-0" />
            {task.notes || task.description}
          </p>
        )}

        {/* Project name */}
        {showProject && projectName && (
          <p className="text-[10px] font-medium text-primary/70 uppercase tracking-wider mb-2">{projectName}</p>
        )}

        {/* Recurrence badge */}
        {hasRecurrence && (
          <div className="flex items-center gap-1 mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
              <RefreshCw className="h-2.5 w-2.5" />
              {recurrenceLabel}
            </span>
          </div>
        )}

        {/* Subtask progress bar */}
        {subtaskTotal > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CheckSquare className="h-3 w-3" />
                {subtaskDone}/{subtaskTotal} subtasks
              </span>
              <span className="text-[10px] text-muted-foreground">{subtaskProgress}%</span>
            </div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Priority badge */}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_BADGE_CLASS[task.priority]}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>

            {/* Due date */}
            {task.dueDate && (
              <span className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                {formatDueDate(task.dueDate)}
              </span>
            )}
          </div>

          {/* Right side: comment count + assignee */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCommentsOpen(true);
              }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors group"
              title="View comments"
            >
              <MessageSquare className="h-3 w-3 group-hover:text-primary transition-colors" />
              <span>{commentCount}</span>
            </button>

            {assigneeName && (
              <Avatar className="h-6 w-6 border border-border shrink-0">
                <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                  {getUserInitials(assigneeName)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>

        {/* ── Hover action bar (desktop): Mark as Done / Reopen ── */}
        {!isMobile && (
          <div
            className={`absolute inset-x-0 bottom-0 flex items-center justify-center pb-2 pt-6 rounded-b-xl transition-all duration-200 pointer-events-none ${
              hovered ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-1"
            }`}
            style={{
              background: "linear-gradient(to top, var(--card) 60%, transparent 100%)",
            }}
          >
            <button
              onClick={handleMarkDone}
              disabled={updateStatus.isPending}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border shadow-sm transition-all duration-150 active:scale-95 ${
                isDone
                  ? "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                  : "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 hover:border-emerald-600 shadow-emerald-200"
              }`}
            >
              {isDone ? (
                <>
                  <RotateCcw className="h-3 w-3" />
                  Reopen
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark as Done
                </>
              )}
            </button>
          </div>
        )}

        {/* Mobile tap hint (only shown when not swiping) */}
        {isMobile && !swipeState.isSwiping && !selectMode && (
          <div className="absolute bottom-1.5 right-2 text-[9px] text-muted-foreground/40 pointer-events-none">
            tap for details · swipe to move
          </div>
        )}
      </div>

      {/* Detail sheet — right-side on desktop, bottom on mobile */}
      <TaskBottomSheet
        task={bottomSheetOpen ? task : null}
        open={bottomSheetOpen}
        onOpenChange={setBottomSheetOpen}
        assigneeName={assigneeName}
        projectName={projectName}
        onUpdated={onUpdated}
        side={isMobile ? "bottom" : "right"}
      />

      {/* Edit dialog (desktop) */}
      {!isMobile && (
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

      {/* Comment thread slide-over */}
      <TaskCommentThread
        taskId={task.id}
        taskTitle={task.title}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />

      {/* Permanent delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete To-Do permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>&ldquo;{task.title}&rdquo;</strong> will be permanently removed and cannot be
              recovered. This is different from archiving, which keeps the record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTask.mutate(task.id, {
                onSuccess: () => { toast.success("To-Do deleted"); onUpdated?.(); },
                onError: (err: any) => toast.error(err.message),
              })}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useProjects,
  useProjectMembers,
  useUsers,
  useSubtasks,
  useCreateSubtask,
  useToggleSubtask,
  useDeleteSubtask,
  useCreateTask,
  useUpdateTask,
  QK,
} from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type TaskInput = {
  id: number;
  title: string;
  description: string | null;
  notes: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: number | null;
  assigneeId: number | null;
  projectId: number | null;
  recurrenceType: "none" | "daily" | "biweekly" | "weekly" | "monthly";
  recurrenceInterval: number;
  recurrenceEndsAt: number | null;
};

type SubtaskDraft = { id: string; title: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: number | null;
  task?: TaskInput;
  defaultStatus?: "todo" | "in_progress" | "done";
  onSuccess?: () => void;
};

const RECURRENCE_OPTIONS: { value: "none" | "daily" | "biweekly" | "weekly" | "monthly"; label: string }[] = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function TaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  defaultStatus = "todo",
  onSuccess,
}: Props) {
  const isEdit = !!task;
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [status, setStatus] = useState<"todo" | "in_progress" | "done">(defaultStatus);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);

  // Recurrence
  const [recurrenceType, setRecurrenceType] = useState<"none" | "daily" | "biweekly" | "weekly" | "monthly">("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndsAt, setRecurrenceEndsAt] = useState<Date | undefined>(undefined);

  // Subtasks
  const [subtaskDrafts, setSubtaskDrafts] = useState<SubtaskDraft[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  // For standalone creation (no projectId passed), allow user to optionally link a Project
  const { data: allProjects } = useProjects();
  const effectiveProjectId = projectId ?? (selectedProjectId ? parseInt(selectedProjectId) : null);
  const { data: members } = useProjectMembers(effectiveProjectId ?? 0);
  // When no project is linked, fall back to all org users so any user can be assigned
  const { data: allUsers } = useUsers();
  const assignableUsers = effectiveProjectId
    ? (members ?? []).map((m: any) => ({ id: m.userId, name: m.user?.name, email: m.user?.email }))
    : (allUsers ?? []).map((u: any) => ({ id: u.id, name: u.name, email: u.email }));

  // Existing subtasks (edit mode)
  const { data: existingSubtasks } = useSubtasks(task?.id ?? 0);

  const createSubtaskMutation = useCreateSubtask();
  const toggleSubtaskMutation = useToggleSubtask();
  const deleteSubtaskMutation = useDeleteSubtask();

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setNotes(task?.notes ?? task?.description ?? "");
      setAssigneeId(task?.assigneeId?.toString() ?? "");
      setStatus(task?.status ?? defaultStatus);
      setPriority(task?.priority ?? "medium");
      setDueDate(task?.dueDate ? new Date(task.dueDate) : undefined);
      const rt = (task?.recurrenceType ?? "none") as "none" | "daily" | "biweekly" | "weekly" | "monthly";
      setRecurrenceType(rt);
      setRecurrenceInterval(task?.recurrenceInterval ?? 1);
      setRecurrenceEndsAt(task?.recurrenceEndsAt ? new Date(task.recurrenceEndsAt) : undefined);
      if (!task) {
        setSubtaskDrafts([]);
        setNewSubtaskTitle("");
        setSelectedProjectId("");
      }
    }
  }, [open, task, defaultStatus]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.tasks });
    if (effectiveProjectId) qc.invalidateQueries({ queryKey: QK.tasksByProject(effectiveProjectId) });
    qc.invalidateQueries({ queryKey: QK.dashboardStats });
  };

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const isPending = createTask.isPending || updateTask.isPending;

  function addSubtaskDraft() {
    const t = newSubtaskTitle.trim();
    if (!t) return;
    setSubtaskDrafts((prev) => [...prev, { id: crypto.randomUUID(), title: t }]);
    setNewSubtaskTitle("");
    subtaskInputRef.current?.focus();
  }

  function removeSubtaskDraft(id: string) {
    setSubtaskDrafts((prev) => prev.filter((s) => s.id !== id));
  }

  async function addSubtaskToExisting() {
    const t = newSubtaskTitle.trim();
    if (!t || !task) return;
    setNewSubtaskTitle("");
    await createSubtaskMutation.mutateAsync({ taskId: task.id, title: t });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      projectId: effectiveProjectId ?? undefined,
      assigneeId: assigneeId ? parseInt(assigneeId) : undefined,
      status,
      priority,
      dueDate: dueDate ? dueDate.getTime() : undefined,
      recurrenceType,
      recurrenceInterval,
      recurrenceEndsAt: recurrenceEndsAt ? recurrenceEndsAt.getTime() : undefined,
    };

    if (isEdit && task) {
      updateTask.mutate(
        {
          id: task.id,
          ...payload,
          assigneeId: assigneeId ? parseInt(assigneeId) : null,
          dueDate: dueDate ? dueDate.getTime() : null,
          recurrenceEndsAt: recurrenceEndsAt ? recurrenceEndsAt.getTime() : null,
          notes: notes.trim() || null,
          description: null,
        },
        {
          onSuccess: () => {
            toast.success("To-Do updated");
            invalidate();
            onOpenChange(false);
            onSuccess?.();
          },
          onError: (err: any) => toast.error(err.message),
        }
      );
    } else {
      createTask.mutate(
        {
          ...payload,
          subtasks: subtaskDrafts.map((s) => s.title),
        },
        {
          onSuccess: () => {
            toast.success("To-Do created");
            invalidate();
            onOpenChange(false);
            onSuccess?.();
          },
          onError: (err: any) => toast.error(err.message),
        }
      );
    }
  };

  const unitLabel = recurrenceType === "daily" ? "day" : recurrenceType === "biweekly" ? "week" : recurrenceType === "weekly" ? "week" : "month";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit To-Do" : "Create To-Do"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              placeholder="e.g. Prepare Belt Test Ceremony"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-input"
            />
          </div>

          {/* Notes (replaces both Description and old Notes) */}
          <div className="space-y-1.5">
            <Label htmlFor="task-notes">
              Notes
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                optional
              </span>
            </Label>
            <Textarea
              id="task-notes"
              placeholder="Add details, links, or reminders…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-input resize-none"
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger className="bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project (optional link) — only shown when creating standalone To-Dos */}
          {!projectId && !isEdit && allProjects && allProjects.length > 0 && (
            <div className="space-y-1.5">
              <Label>
                Link to Project
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional</span>
              </Label>
              <Select
                value={selectedProjectId || "none"}
                onValueChange={(v) => setSelectedProjectId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="bg-input">
                  <SelectValue placeholder="No Project (standalone)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project (standalone)</SelectItem>
                  {allProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assignee + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select
                value={assigneeId || "unassigned"}
                onValueChange={(v) => setAssigneeId(v === "unassigned" ? "" : v)}
              >
                <SelectTrigger className="bg-input">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.name || u.email || `User #${u.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-input border-border"
                value={dueDate ? format(dueDate, "yyyy-MM-dd") : ""}
                onChange={e => setDueDate(e.target.value ? new Date(e.target.value + "T00:00:00") : undefined)}
              />
              {dueDate && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setDueDate(undefined)}
                >
                  Clear due date
                </button>
              )}
            </div>
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Subtasks
              {isEdit && existingSubtasks && existingSubtasks.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({existingSubtasks.filter((s) => s.completed).length}/{existingSubtasks.length} done)
                </span>
              )}
              {!isEdit && subtaskDrafts.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({subtaskDrafts.length})
                </span>
              )}
            </Label>

            {/* Existing subtasks (edit mode) */}
            {isEdit && existingSubtasks && existingSubtasks.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                {existingSubtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={sub.completed}
                      onChange={(e) => toggleSubtaskMutation.mutate({ id: sub.id, completed: e.target.checked, taskId: task?.id ?? 0 })}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                    />
                    <span className={`flex-1 text-sm ${sub.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {sub.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSubtaskMutation.mutate({ id: sub.id, taskId: task?.id ?? 0 })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Draft subtasks (create mode) */}
            {!isEdit && subtaskDrafts.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                {subtaskDrafts.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 group">
                    <div className="h-4 w-4 rounded border border-border bg-background shrink-0" />
                    <span className="flex-1 text-sm text-foreground">{sub.title}</span>
                    <button
                      type="button"
                      onClick={() => removeSubtaskDraft(sub.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add subtask input */}
            <div className="flex gap-2">
              <Input
                ref={subtaskInputRef}
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add a subtask and press Enter…"
                className="text-sm bg-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    isEdit ? addSubtaskToExisting() : addSubtaskDraft();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={isEdit ? addSubtaskToExisting : addSubtaskDraft}
                disabled={!newSubtaskTitle.trim()}
                className="shrink-0 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── Recurrence ── clean inline design */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              Repeat
            </Label>

            {/* Pill-style type selector */}
            <div className="flex gap-2 flex-wrap">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecurrenceType(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    recurrenceType === opt.value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Interval + end date — only shown when a repeat type is selected */}
            {recurrenceType !== "none" && (
              <div className="flex items-center gap-3 flex-wrap rounded-lg bg-muted/40 border border-border px-4 py-3">
                <span className="text-sm text-muted-foreground">Every</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(Math.max(1, Number(e.target.value)))}
                  className="w-16 bg-input text-center"
                />
                <span className="text-sm text-foreground font-medium">
                  {unitLabel}{recurrenceInterval > 1 ? "s" : ""}
                </span>

                <span className="text-muted-foreground text-sm mx-1">·</span>

                <span className="text-sm text-muted-foreground">Ends</span>
                <input
                  type="date"
                  className="border rounded-lg px-2 py-1 text-sm bg-input border-border"
                  value={recurrenceEndsAt ? format(recurrenceEndsAt, "yyyy-MM-dd") : ""}
                  onChange={e => setRecurrenceEndsAt(e.target.value ? new Date(e.target.value + "T00:00:00") : undefined)}
                />
                {recurrenceEndsAt && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setRecurrenceEndsAt(undefined)}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create To-Do"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

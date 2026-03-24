import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TaskDialog from "@/components/TaskDialog";
import {
  formatDueDate,
  isOverdue,
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/taskHelpers";
import { useMyTasks, useProjects, useUsers, useUpdateTask } from "@/hooks/useApi";
import {
  AlertCircle,
  Calendar,
  CheckSquare,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function MyTasks() {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created");
  const [editTask, setEditTask] = useState<any>(null);
  const { data: myTasks, isLoading } = useMyTasks();
  const { data: projects } = useProjects();
  const { data: users } = useUsers();

  const updateTask = useUpdateTask();

  const projectMap = new Map(projects?.map((p) => [p.id, p.name]) ?? []);
  const userMap = new Map(users?.map((u) => [u.id, u.name]) ?? []);

  const filtered = (myTasks ?? []).filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "priority") return PRIORITY_ORDER[a.priority as TaskPriority] - PRIORITY_ORDER[b.priority as TaskPriority];
    if (sortBy === "due") {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate - b.dueDate;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const statusGroups: TaskStatus[] = ["todo", "in_progress", "done"];

  const stats = {
    total: myTasks?.length ?? 0,
    assigned: myTasks?.filter((t) => t.assigneeId === user?.id).length ?? 0,
    overdue: myTasks?.filter((t) => isOverdue(t.dueDate) && t.status !== "done").length ?? 0,
    done: myTasks?.filter((t) => t.status === "done").length ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My To-Dos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">To-Dos you created or are assigned to</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Assigned to Me", value: stats.assigned, color: "text-primary" },
          { label: "Overdue", value: stats.overdue, color: "text-destructive" },
          { label: "Completed", value: stats.done, color: "text-green-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border/60">
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 h-8 text-xs bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36 h-8 text-xs bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Newest First</SelectItem>
            <SelectItem value="priority">By Priority</SelectItem>
            <SelectItem value="due">By Due Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* To-Do list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <CheckSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold">No To-Dos found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterStatus !== "all" || filterPriority !== "all"
                ? "Try adjusting your filters"
                : "You have no To-Dos yet"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((task) => {
            const overdue = isOverdue(task.dueDate) && task.status !== "done";
            return (
              <div
                key={task.id}
                className="glass-card rounded-xl p-4 flex items-start gap-4 hover:border-primary/20 transition-all"
              >
                {/* Status indicator */}
                <div className="mt-0.5">
                  <button
                    onClick={() => {
                      const nextStatus: Record<TaskStatus, TaskStatus> = {
                        todo: "in_progress",
                        in_progress: "done",
                        done: "todo",
                      };
                      updateTask.mutate(
                        { id: task.id, status: nextStatus[task.status as TaskStatus] },
                        {
                          onSuccess: () => toast.success("To-Do updated"),
                          onError: (e: any) => toast.error(e.message),
                        }
                      );
                    }}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      task.status === "done"
                        ? "border-green-400 bg-green-400/20"
                        : task.status === "in_progress"
                        ? "border-blue-400 bg-blue-400/20"
                        : "border-muted-foreground/40 hover:border-primary"
                    }`}
                    title="Click to advance status"
                  >
                    {task.status === "done" && (
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    )}
                    {task.status === "in_progress" && (
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                    )}
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h4 className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </h4>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_BADGE_CLASS[task.priority as TaskPriority]}`}>
                      {PRIORITY_LABELS[task.priority as TaskPriority]}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {task.projectId && projectMap.get(task.projectId) && (
                      <span className="text-[10px] font-medium text-primary/70 uppercase tracking-wider">
                        {projectMap.get(task.projectId!)}
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[task.status as TaskStatus]}`}>
                      {STATUS_LABELS[task.status as TaskStatus]}
                    </span>
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                        {formatDueDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit button */}
                <button
                  onClick={() => setEditTask(task)}
                  className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit To-Do dialog */}
      {editTask && (
        <TaskDialog
          open={!!editTask}
          onOpenChange={(v) => !v && setEditTask(null)}
          projectId={editTask.projectId}
          task={editTask}
          onSuccess={() => setEditTask(null)}
        />
      )}
    </div>
  );
}

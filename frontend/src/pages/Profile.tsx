import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDueDate,
  getUserInitials,
  isOverdue,
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/taskHelpers";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  FolderKanban,
  Loader2,
  Shield,
  Timer,
  User,
} from "lucide-react";
import { useLocation } from "wouter";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: myTasks, isLoading: tasksLoading } = trpc.users.myTasks.useQuery();
  const { data: projects, isLoading: projectsLoading } = trpc.projects.list.useQuery();
  const { data: allUsers } = trpc.users.list.useQuery();

  const userMap = new Map(allUsers?.map((u) => [u.id, u.name]) ?? []);
  const projectMap = new Map(projects?.map((p) => [p.id, p.name]) ?? []);

  const assignedTasks = myTasks?.filter((t) => t.assigneeId === user?.id) ?? [];
  const overdueCount = assignedTasks.filter((t) => isOverdue(t.dueDate) && t.status !== "done").length;

  const tasksByStatus = {
    todo: assignedTasks.filter((t) => t.status === "todo"),
    in_progress: assignedTasks.filter((t) => t.status === "in_progress"),
    done: assignedTasks.filter((t) => t.status === "done"),
  };

  if (tasksLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Profile header */}
      <Card className="bg-card border-border/60">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-2 border-primary/20">
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {getUserInitials(user?.name ?? "")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{user?.name || "User"}</h1>
                {user?.role === "admin" && (
                  <Badge className="gap-1 bg-primary/15 text-primary border-primary/30">
                    <Shield className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
              </div>
              {user?.email && (
                <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
              )}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <span>{projects?.length ?? 0} Rocks</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span>{tasksByStatus.done.length} To-Dos Done</span>
                </div>
                {overdueCount > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{overdueCount} Overdue</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task summary */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Assigned To-Dos</h2>

          {/* Status summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "To Do", value: tasksByStatus.todo.length, icon: <Circle className="h-4 w-4" />, color: "text-muted-foreground" },
              { label: "In Progress", value: tasksByStatus.in_progress.length, icon: <Timer className="h-4 w-4" />, color: "text-blue-400" },
              { label: "Done", value: tasksByStatus.done.length, icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-400" },
            ].map((s) => (
              <Card key={s.label} className="bg-card border-border/60">
                <CardContent className="p-4 text-center">
                  <div className={`flex items-center justify-center gap-1.5 mb-1 ${s.color}`}>
                    {s.icon}
                  </div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent assigned tasks */}
          <div className="space-y-2">
            {assignedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 bg-secondary/20 rounded-xl border border-border/40">
                <User className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No To-Dos assigned to you</p>
              </div>
            ) : (
              assignedTasks.slice(0, 10).map((task) => {
                const overdue = isOverdue(task.dueDate) && task.status !== "done";
                return (
                  <div key={task.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{task.title}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[task.status as TaskStatus]}`}>
                          {STATUS_LABELS[task.status as TaskStatus]}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_BADGE_CLASS[task.priority as TaskPriority]}`}>
                          {PRIORITY_LABELS[task.priority as TaskPriority]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {task.projectId && projectMap.get(task.projectId) && (
                          <span className="text-[10px] text-primary/70 font-medium uppercase tracking-wider">
                            {projectMap.get(task.projectId!)}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={`flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                            {formatDueDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Projects sidebar */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">My Rocks</h2>
          <div className="space-y-2">
            {projects?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 bg-secondary/20 rounded-xl border border-border/40">
                <FolderKanban className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No rocks yet</p>
              </div>
            ) : (
              projects?.map((project) => {
                const projectTasks = myTasks?.filter((t) => t.projectId === project.id) ?? [];
                const done = projectTasks.filter((t) => t.status === "done").length;
                const progress = projectTasks.length > 0 ? Math.round((done / projectTasks.length) * 100) : 0;
                return (
                  <button
                    key={project.id}
                    onClick={() => setLocation(`/projects/${project.id}`)}
                    className="w-full glass-card rounded-xl p-3 text-left hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{project.name}</span>
                      {project.ownerId === user?.id && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary shrink-0">
                          Owner
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{projectTasks.length} To-Dos</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

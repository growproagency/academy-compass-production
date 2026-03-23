import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  TrendingUp,
  ListTodo,
  Loader2,
  User,
} from "lucide-react";
import { useLocation, useParams } from "wouter";

const PROJECT_STATUS_COLORS: Record<string, string> = {
  on_track: "bg-emerald-100 text-emerald-700",
  off_track: "bg-red-100 text-red-700",
  assist: "bg-amber-100 text-amber-700",
  complete: "bg-indigo-100 text-indigo-700",
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  on_track: "On Track",
  off_track: "Off Track",
  assist: "Needs Assist",
  complete: "Complete",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color ?? "bg-primary/10"}`}>
            <Icon className={`h-4 w-4 ${color ? "" : "text-primary"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MemberScorecard() {
  const params = useParams<{ id: string }>();
  const userId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();

  const { data, isLoading, error } = trpc.users.scorecard.useQuery(
    { userId },
    { enabled: !!userId && !isNaN(userId) }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card className="border-destructive/30">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Member not found or you don't have access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, projects, stats, recentActivity } = data;
  const isOwnScorecard = currentUser?.id === userId;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 -ml-2"
        onClick={() => navigate(currentUser?.role === "admin" ? "/admin" : "/")}
      >
        <ArrowLeft className="h-4 w-4" />
        {currentUser?.role === "admin" ? "Back to Admin Panel" : "Back to Dashboard"}
      </Button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-primary">
            {(user.name ?? "?").slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.name ?? "Unknown Member"}</h1>
          <p className="text-sm text-muted-foreground">{user.email ?? ""}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs capitalize">
              {user.role}
            </Badge>
            {isOwnScorecard && (
              <Badge variant="outline" className="text-xs">Your Scorecard</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Target}
          label="Projects"
          value={stats.totalProjects}
          sub={`${stats.ownedProjects} owned`}
          color="bg-indigo-100"
        />
        <StatCard
          icon={ListTodo}
          label="To-Dos"
          value={stats.totalTasks}
          sub={`${stats.doneTasks} done`}
          color="bg-emerald-100"
        />
        <StatCard
          icon={TrendingUp}
          label="Completion Rate"
          value={stats.taskCompletionRate != null ? `${stats.taskCompletionRate}%` : "—"}
          sub="tasks done"
          color="bg-blue-100"
        />
        <StatCard
          icon={stats.overdueTasks > 0 ? AlertTriangle : CheckCircle2}
          label="Overdue"
          value={stats.overdueTasks}
          sub="tasks past due"
          color={stats.overdueTasks > 0 ? "bg-red-100" : "bg-emerald-100"}
        />
      </div>

      {/* Milestone on-time rate */}
      {stats.milestoneOnTimeRate != null && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Milestone On-Time Rate</p>
              <span className="text-sm font-bold">{stats.milestoneOnTimeRate}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${stats.milestoneOnTimeRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Percentage of completed milestones finished on or before their due date
            </p>
          </CardContent>
        </Card>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Target className="h-4 w-4" /> Projects ({projects.length})
          </h2>
          <div className="space-y-2">
            {projects.map((project) => (
              <Card key={project.id} className="border-border/60">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{project.name}</p>
                    {project.dueDate && (
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(project.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <Badge className={`text-xs shrink-0 ${PROJECT_STATUS_COLORS[project.projectStatus]}`} variant="outline">
                    {PROJECT_STATUS_LABELS[project.projectStatus]}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Clock className="h-4 w-4" /> Recent Activity
          </h2>
          <div className="space-y-2">
            {recentActivity.map((task) => (
              <div key={task.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                <Badge
                  className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${TASK_STATUS_COLORS[task.status]}`}
                  variant="outline"
                >
                  {TASK_STATUS_LABELS[task.status]}
                </Badge>
                <p className="text-sm flex-1 truncate">{task.title}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(task.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && recentActivity.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <User className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No Projects or To-Dos assigned yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

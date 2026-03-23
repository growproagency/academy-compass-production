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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import TaskCard, { type TaskCardData } from "@/components/TaskCard";
import TaskDialog from "@/components/TaskDialog";
import {
  PRIORITY_ORDER,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/taskHelpers";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  Filter,
  FolderKanban,
  Loader2,
  Layers,
  Mountain,
  Plus,
  Timer,
  Trash2,
  UserCheck,
  X,
  CheckSquare,
  Flag,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Megaphone,
  Pin,
  ChevronRight,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { useLocation } from "wouter";

const COLUMNS: { status: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { status: "todo", label: "To Do", icon: <Circle className="h-4 w-4" />, color: "text-muted-foreground" },
  { status: "in_progress", label: "In Progress", icon: <Timer className="h-4 w-4" />, color: "text-blue-400" },
  { status: "done", label: "Done", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-400" },
];

type DashboardView = "todos" | "projects";
type ProjectStatus = "on_track" | "off_track" | "assist" | "complete";

const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  on_track: {
    label: "On Track",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: <TrendingUp className="h-3 w-3" />,
  },
  off_track: {
    label: "Off Track",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    icon: <TrendingDown className="h-3 w-3" />,
  },
  assist: {
    label: "Assist",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    icon: <HelpCircle className="h-3 w-3" />,
  },
  complete: {
    label: "Complete",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<DashboardView>("todos");

  // ── Projects view state ────────────────────────────────────────────────────
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatus | "all">("all");

  // ── To-Do date range filter ────────────────────────────────────────────────
  type DateRange = "all" | "this_quarter" | "last_quarter";
  const [dateRange, setDateRange] = useState<DateRange>("all");

  // ── To-Do Kanban state ─────────────────────────────────────────────────────
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);

  // ── Bulk select state ──────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: _allTasks, isLoading: tasksLoading } = trpc.tasks.listAll.useQuery();
  const { data: _projectsWithStats, isLoading: projectsLoading } = trpc.projects.listWithStats.useQuery();
  const { data: _healthTrend } = trpc.projects.healthTrend.useQuery();
  const { data: _users } = trpc.users.list.useQuery();

  // Cast from unknown (trpc shim types) to typed arrays
  const allTasks = _allTasks as any[] | undefined;
  const projectsWithStats = _projectsWithStats as any[] | undefined;
  const healthTrend = _healthTrend as any[] | undefined;
  const users = _users as any[] | undefined;

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.listAll.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reorderTask = trpc.tasks.reorder.useMutation({
    onSuccess: () => utils.tasks.listAll.invalidate(),
    onError: (err: any) => toast.error(err.message),
  });

  const bulkDeleteMutation = trpc.tasks.bulkDelete.useMutation({
    onSuccess: (res: any) => {
      utils.tasks.listAll.invalidate();
      const msg = res.forbidden > 0
        ? `Archived ${res.deleted} To-Do${res.deleted !== 1 ? "s" : ""} (${res.forbidden} skipped — no permission).`
        : `Archived ${res.deleted} To-Do${res.deleted !== 1 ? "s" : ""}.`;
      toast.success(msg);
      clearSelection();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Build lookup maps — reuse projectsWithStats (already prefetched) instead of a separate projects.list fetch
  const projectMap = new Map((projectsWithStats ?? []).map((p: any) => [p.id, p.name]));
  const userMap = new Map((users ?? []).map((u: any) => [u.id, u.name]));

  // Derive stats locally from allTasks — no extra round-trip needed
  const now = Date.now();
  const stats = allTasks ? {
    totalTasks: allTasks.length,
    doneTasks: allTasks.filter((t: any) => t.status === "done").length,
    inProgressTasks: allTasks.filter((t: any) => t.status === "in_progress").length,
    overdueTasks: allTasks.filter((t: any) => t.status !== "done" && t.dueDate && t.dueDate < now).length,
    totalProjects: projectsWithStats?.length ?? 0,
  } : null;

  // Filter & sort tasks
  const filteredTasks = (allTasks ?? []).filter((t: any) => {
    if (filterProject !== "all" && t.projectId !== parseInt(filterProject)) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "priority") return PRIORITY_ORDER[a.priority as TaskPriority] - PRIORITY_ORDER[b.priority as TaskPriority];
    if (sortBy === "due") {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate - b.dueDate;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getColumnTasks = (status: TaskStatus) =>
    sortedTasks.filter((t) => t.status === status) as TaskCardData[];

  // Drag & drop handlers (disabled in select mode)
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus, insertBeforeTaskId?: number) => {
    e.preventDefault();
    if (dragTaskId === null) return;
    const task = allTasks?.find((t) => t.id === dragTaskId);
    if (!task) { setDragTaskId(null); setDragOverCol(null); setDragOverTaskId(null); return; }

    const colTasks = (allTasks ?? [])
      .filter((t) => t.status === status)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (task.status !== status) {
      updateTask.mutate({ id: dragTaskId, status });
    }

    if (insertBeforeTaskId !== undefined) {
      const insertIdx = colTasks.findIndex((t) => t.id === insertBeforeTaskId);
      if (insertIdx !== -1) {
        const newOrder = colTasks
          .filter((t) => t.id !== dragTaskId)
          .map((t, i) => ({ id: t.id, sortOrder: i * 10 }));
        newOrder.splice(insertIdx, 0, { id: dragTaskId, sortOrder: -1 });
        newOrder.forEach((item, i) => { item.sortOrder = i * 10; });
        for (const item of newOrder) {
          reorderTask.mutate({ id: item.id, sortOrder: item.sortOrder });
        }
      }
    }

    setDragTaskId(null);
    setDragOverCol(null);
    setDragOverTaskId(null);
  };

  // ── Bulk select helpers ────────────────────────────────────────────────────
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectMode) clearSelection();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectMode, clearSelection]);

  // ── Bulk actions ──────────────────────────────────────────────────────────
  async function bulkChangeStatus(status: TaskStatus) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkPending(true);
    try {
      await Promise.all(ids.map((id) => updateTask.mutateAsync({ id, status })));
      toast.success(`${ids.length} To-Do${ids.length !== 1 ? "s" : ""} moved to ${status === "done" ? "Done" : status === "in_progress" ? "In Progress" : "To Do"}.`);
      clearSelection();
    } catch {
      toast.error("Some updates failed. Please try again.");
    } finally {
      setBulkPending(false);
    }
  }

  async function bulkReassign(assigneeId: number | null) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkPending(true);
    try {
      await Promise.all(ids.map((id) => updateTask.mutateAsync({ id, assigneeId })));
      const name = assigneeId ? (userMap.get(assigneeId) ?? "user") : "nobody";
      toast.success(`${ids.length} To-Do${ids.length !== 1 ? "s" : ""} reassigned to ${name}.`);
      clearSelection();
    } catch {
      toast.error("Some updates failed. Please try again.");
    } finally {
      setBulkPending(false);
    }
  }

  const isLoading = tasksLoading;

  // ── Date range boundaries ─────────────────────────────────────────────────
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentQ = Math.floor(currentMonth / 3);
    const thisQStart = new Date(currentYear, currentQ * 3, 1).getTime();
    const thisQEnd = new Date(currentYear, currentQ * 3 + 3, 0, 23, 59, 59, 999).getTime();
    const lastQStart = new Date(currentYear, (currentQ - 1) * 3, 1).getTime();
    const lastQEnd = thisQStart - 1;
    return { thisQStart, thisQEnd, lastQStart, lastQEnd };
  }, []);

  // ── Filtered tasks for stat cards ─────────────────────────────────────────
  const dateFilteredTasks = useMemo(() => {
    if (!allTasks) return [];
    if (dateRange === "all") return allTasks.filter((t) => !t.archivedAt);
    const { thisQStart, thisQEnd, lastQStart, lastQEnd } = dateRangeBounds;
    const [start, end] = dateRange === "this_quarter" ? [thisQStart, thisQEnd] : [lastQStart, lastQEnd];
    return allTasks.filter((t) => {
      if (t.archivedAt) return false;
      const created = new Date(t.createdAt).getTime();
      return created >= start && created <= end;
    });
  }, [allTasks, dateRange, dateRangeBounds]);

  const dateFilteredStats = useMemo(() => {
    const now = Date.now();
    return {
      total: dateFilteredTasks.length,
      todo: dateFilteredTasks.filter((t) => t.status === "todo").length,
      inProgress: dateFilteredTasks.filter((t) => t.status === "in_progress").length,
      done: dateFilteredTasks.filter((t) => t.status === "done").length,
      overdue: dateFilteredTasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "done").length,
    };
  }, [dateFilteredTasks]);

  const statCards = [
    { label: "Total To-Dos", value: dateRange === "all" ? (stats?.totalTasks ?? 0) : dateFilteredStats.total, icon: <Circle className="h-5 w-5" />, color: "text-foreground" },
    { label: "To Do", value: dateRange === "all" ? ((stats?.totalTasks ?? 0) - (stats?.doneTasks ?? 0) - (stats?.inProgressTasks ?? 0)) : dateFilteredStats.todo, icon: <Circle className="h-5 w-5" />, color: "text-muted-foreground" },
    { label: "In Progress", value: dateRange === "all" ? (stats?.inProgressTasks ?? 0) : dateFilteredStats.inProgress, icon: <Timer className="h-5 w-5" />, color: "text-blue-400" },
    { label: "Done", value: dateRange === "all" ? (stats?.doneTasks ?? 0) : dateFilteredStats.done, icon: <CheckCircle2 className="h-5 w-5" />, color: "text-green-400" },
    { label: "Overdue", value: dateRange === "all" ? (stats?.overdueTasks ?? 0) : dateFilteredStats.overdue, icon: <AlertCircle className="h-5 w-5" />, color: "text-destructive" },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            Welcome back, {user?.name?.split(" ")[0] ?? "Sensei"}
          </p>
        </div>
        {/* Multi-select toggle (only in To-Dos view) */}
        {view === "todos" && (
          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={toggleSelectMode}
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">{selectMode ? "Exit Select" : "Select"}</span>
            <span className="sm:hidden">{selectMode ? "Exit" : "Select"}</span>
          </Button>
        )}
      </div>

      {/* ── Pinned announcement banner ─────────────────────────────────────── */}
      <AnnouncementBanner />

      {/* ── View toggle: Projects | To-Dos ──────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl w-fit">
        <button
          onClick={() => setView("projects")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            view === "projects"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mountain className="h-4 w-4" />
          Projects
        </button>
        <button
          onClick={() => setView("todos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            view === "todos"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          To-Dos
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PROJECTS VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "projects" && (
        <div className="space-y-4">
          {/* Projects summary stats */}
          {(() => {
            const totalOverdueMilestones = projectsWithStats?.reduce((sum, r) => sum + ((r as any).milestoneOverdue ?? 0), 0) ?? 0;
            const projectsWithOverdueMilestones = projectsWithStats?.filter((r) => ((r as any).milestoneOverdue ?? 0) > 0).length ?? 0;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="bg-card border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <Mountain className="h-5 w-5" />
                      <span className="text-xs font-medium text-muted-foreground">Total Projects</span>
                    </div>
                    <p className="text-2xl font-bold">{projectsWithStats?.length ?? 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-amber-500">
                      <Flag className="h-5 w-5" />
                      <span className="text-xs font-medium text-muted-foreground">Milestones</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {projectsWithStats?.reduce((sum, r) => sum + (r.milestoneDone ?? 0), 0) ?? 0}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        / {projectsWithStats?.reduce((sum, r) => sum + (r.milestoneTotal ?? 0), 0) ?? 0} done
                      </span>
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-green-500">
                      <TrendingUp className="h-5 w-5" />
                      <span className="text-xs font-medium text-muted-foreground">On Track</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {projectsWithStats?.filter((r) => (r as any).projectStatus === "on_track").length ?? 0}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        / {projectsWithStats?.length ?? 0} Projects
                      </span>
                    </p>
                  </CardContent>
                </Card>
                {/* Overdue milestones stat card */}
                <button
                  className="text-left"
                  onClick={() => {
                    if (totalOverdueMilestones > 0) {
                      // Filter to only show projects with overdue milestones
                      setProjectStatusFilter("all");
                    }
                  }}
                >
                  <Card className={`border-border/60 h-full transition-colors ${
                    totalOverdueMilestones > 0
                      ? "bg-destructive/5 border-destructive/30 hover:border-destructive/60"
                      : "bg-card"
                  }`}>
                    <CardContent className="p-4">
                      <div className={`flex items-center gap-2 mb-2 ${
                        totalOverdueMilestones > 0 ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-xs font-medium text-muted-foreground">Overdue Milestones</span>
                      </div>
                      <p className={`text-2xl font-bold ${
                        totalOverdueMilestones > 0 ? "text-destructive" : ""
                      }`}>
                        {totalOverdueMilestones}
                      </p>
                      {totalOverdueMilestones > 0 && (
                        <p className="text-xs text-destructive/70 mt-0.5">
                          across {projectsWithOverdueMilestones} Project{projectsWithOverdueMilestones !== 1 ? "s" : ""}
                        </p>
                      )}
                      {totalOverdueMilestones === 0 && (
                        <p className="text-xs text-emerald-500 mt-0.5">All on schedule ✓</p>
                      )}
                    </CardContent>
                  </Card>
                </button>
              </div>
            );
          })()}


          {/* ── Project Health Summary removed per user request ── */}
          {(false as boolean) && projectsWithStats && projectsWithStats.length > 0 && (() => {
            const total = projectsWithStats.length;
            const counts: Record<ProjectStatus, number> = { on_track: 0, off_track: 0, assist: 0, complete: 0 };
            for (const r of projectsWithStats) {
              const s = ((r as any).projectStatus as ProjectStatus) ?? "on_track";
              counts[s] = (counts[s] ?? 0) + 1;
            }
            const totalMilestoneDone = projectsWithStats.reduce((sum, r) => sum + (r.milestoneDone ?? 0), 0);
            const totalMilestoneTotal = projectsWithStats.reduce((sum, r) => sum + (r.milestoneTotal ?? 0), 0);
            const milestonePct = totalMilestoneTotal > 0 ? Math.round((totalMilestoneDone / totalMilestoneTotal) * 100) : 0;

            // Segment widths as percentages
            const segments: { key: ProjectStatus; pct: number }[] = (
              ["complete", "on_track", "assist", "off_track"] as ProjectStatus[]
            ).map((k) => ({ key: k, pct: total > 0 ? Math.round((counts[k] / total) * 100) : 0 }));

            const segmentColors: Record<ProjectStatus, string> = {
              complete: "bg-primary",
              on_track: "bg-emerald-500",
              assist: "bg-amber-400",
              off_track: "bg-destructive",
            };

            return (
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">School-Wide Project Health</p>
                    <span className="text-xs text-muted-foreground">{total} Project{total !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Segmented health bar */}
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    {segments.map(({ key, pct }) =>
                      pct > 0 ? (
                        <div
                          key={key}
                          className={`${segmentColors[key]} transition-all`}
                          style={{ width: `${pct}%` }}
                          title={`${PROJECT_STATUS_CONFIG[key].label}: ${counts[key]}`}
                        />
                      ) : null
                    )}
                    {total === 0 && <div className="bg-muted flex-1" />}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {(["complete", "on_track", "assist", "off_track"] as ProjectStatus[]).map((k) => (
                      counts[k] > 0 ? (
                        <button
                          key={k}
                          onClick={() => setProjectStatusFilter(k)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span className={`inline-block h-2 w-2 rounded-full ${segmentColors[k]}`} />
                          <span className="font-medium">{counts[k]}</span>
                          <span>{PROJECT_STATUS_CONFIG[k].label}</span>
                        </button>
                      ) : null
                    ))}
                  </div>

                  {/* Milestone progress */}
                  {totalMilestoneTotal > 0 && (
                    <div className="pt-1 border-t border-border/40">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Flag className="h-3 w-3" />
                          Overall Milestone Progress
                        </span>
                        <span className="text-xs font-semibold">{milestonePct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${milestonePct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {totalMilestoneDone} of {totalMilestoneTotal} milestones complete
                      </p>
                    </div>
                  )}

                  {/* Health trend sparkline */}
                  {healthTrend && healthTrend.length >= 2 && (
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Weekly Trend (last {healthTrend.length} weeks)</p>
                      <ResponsiveContainer width="100%" height={90}>
                        <AreaChart
                          data={healthTrend.map((s) => ({
                            week: new Date(s.snapshotDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                            "On Track": s.onTrack,
                            "Off Track": s.offTrack,
                            "Assist": s.assist,
                            "Complete": s.complete,
                          }))}
                          margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
                        >
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6 }}
                            itemStyle={{ padding: 0 }}
                          />
                          <Area type="monotone" dataKey="Complete" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" strokeWidth={1.5} />
                          <Area type="monotone" dataKey="On Track" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} strokeWidth={1.5} />
                          <Area type="monotone" dataKey="Assist" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} strokeWidth={1.5} />
                          <Area type="monotone" dataKey="Off Track" stackId="1" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.3)" strokeWidth={1.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {healthTrend && healthTrend.length === 1 && (
                    <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                      Trend chart will appear after the second weekly digest is sent.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Status filter for Projects */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" /> Status:</span>
            {(["all", "on_track", "off_track", "assist", "complete"] as const).map((s) => {
              const cfg = s !== "all" ? PROJECT_STATUS_CONFIG[s] : null;
              const active = projectStatusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setProjectStatusFilter(s)}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                    active
                      ? cfg
                        ? `${cfg.color} ${cfg.bg} ${cfg.border}`
                        : "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-border/60 hover:border-primary/40"
                  }`}
                >
                  {cfg?.icon}
                  {s === "all" ? "All" : cfg?.label}
                </button>
              );
            })}
          </div>

          {/* Projects list */}
          {projectsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : !projectsWithStats || projectsWithStats.length === 0 ? (
            <Card className="p-12 text-center">
              <Mountain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold text-muted-foreground">No Projects yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
                Projects are your 7–14 week strategic goals. Each Project contains Milestones and To-Dos.
              </p>
              <Button onClick={() => setLocation("/projects")}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first Project
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {projectsWithStats
                .filter((project) => {
                  if (projectStatusFilter === "all") return true;
                  return (project as any).projectStatus === projectStatusFilter;
                })
                .map((project) => {
                const milestonePct = (project.milestoneTotal ?? 0) > 0
                  ? Math.round(((project.milestoneDone ?? 0) / (project.milestoneTotal ?? 1)) * 100)
                  : 0;
                const projectDueDate = (project as any).dueDate as number | null | undefined;
                const projectOverdue = projectDueDate ? projectDueDate < Date.now() : false;
                const projectDueDateLabel = projectDueDate
                  ? new Date(projectDueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : null;
                const projectStatus = (project as any).projectStatus as ProjectStatus | null | undefined;
                const statusCfg = projectStatus ? PROJECT_STATUS_CONFIG[projectStatus] : null;
                return (
                  <Card
                    key={project.id}
                    className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${
                      projectOverdue
                        ? "border-l-[3px] border-l-destructive bg-destructive/[0.02]"
                        : ""
                    }`}
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Mountain className={`h-4 w-4 shrink-0 ${projectOverdue ? "text-destructive" : "text-primary"}`} />
                          <h3 className={`font-semibold text-sm truncate ${projectOverdue ? "text-destructive" : ""}`}>
                            {project.name}
                          </h3>
                          {projectOverdue && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full shrink-0">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Overdue
                            </span>
                          )}
                          {statusCfg && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}>
                              {statusCfg.icon}
                              {statusCfg.label}
                            </span>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{project.description}</p>
                        )}

                        {/* Due date row */}
                        {projectDueDateLabel && (
                          <div className={`inline-flex items-center gap-1 text-[10px] font-medium mb-3 ${
                            projectOverdue ? "text-destructive" : "text-muted-foreground"
                          }`}>
                            {projectOverdue
                              ? <AlertCircle className="h-3 w-3" />
                              : <Calendar className="h-3 w-3" />}
                            Due {projectDueDateLabel}
                          </div>
                        )}

                        {/* Milestone progress */}
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                <Flag className="h-3 w-3" />
                                Milestones
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {project.milestoneDone ?? 0}/{project.milestoneTotal ?? 0}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                                style={{ width: `${milestonePct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: overall pct + owner avatar */}
                      <div className="shrink-0 text-right flex flex-col items-end gap-2">
                        <div>
                          <div className="text-xl font-bold text-primary">{milestonePct}%</div>
                          <div className="text-[10px] text-muted-foreground">milestones</div>
                        </div>
                        {(project as any).ownerName && (() => {
                          const ownerName = (project as any).ownerName as string;
                          const initials = ownerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                          return (
                            <div
                              className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold border border-primary/30"
                              title={ownerName}
                            >
                              {initials}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* CTA to manage Projects */}
          {projectsWithStats && projectsWithStats.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setLocation("/projects")}>
              <FolderKanban className="h-4 w-4" />
              Manage all Projects
            </Button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TO-DOS VIEW (Kanban Board)
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "todos" && (
        <div className="space-y-4">
          {/* Date range selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Period:</span>
            {(["all", "this_quarter", "last_quarter"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                  dateRange === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border/60 hover:border-primary/40"
                }`}
              >
                {r === "all" ? "All Time" : r === "this_quarter" ? "This Quarter" : "Last Quarter"}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statCards.map((s) => (
              <Card key={s.label} className="bg-card border-border/60">
                <CardContent className="p-4">
                  <div className={`flex items-center gap-2 mb-2 ${s.color}`}>
                    {s.icon}
                    <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                  </div>
                  {isLoading ? (
                    <div className="h-7 w-10 bg-secondary rounded animate-pulse" />
                  ) : (
                    <p className="text-2xl font-bold">{s.value}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filter:</span>
            </div>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-32 sm:w-40 h-8 text-xs bg-secondary border-border">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {(projectsWithStats ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-28 sm:w-36 h-8 text-xs bg-secondary border-border">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-28 sm:w-36 h-8 text-xs bg-secondary border-border">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Newest First</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
                <SelectItem value="due">By Due Date</SelectItem>
              </SelectContent>
            </Select>
            {selectMode && (
              <p className="text-xs text-muted-foreground ml-auto hidden sm:block">
                Click cards to select · <kbd className="px-1 py-0.5 rounded bg-secondary text-[10px]">Esc</kbd> to exit
              </p>
            )}
          </div>

          {/* Kanban Board */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLUMNS.map(({ status, label, icon, color }) => {
                const colTasks = getColumnTasks(status);
                const isDragTarget = dragOverCol === status;
                const colSelected = colTasks.filter((t) => selectedIds.has(t.id)).length;
                return (
                  <div
                    key={status}
                    className={`kanban-col flex flex-col transition-all ${isDragTarget ? "drag-over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); if (!selectMode) setDragOverCol(status); }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={(e) => { if (!selectMode) handleDrop(e, status); }}
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                      <div className={`flex items-center gap-2 ${color}`}>
                        {icon}
                        <span className="text-sm font-semibold">{label}</span>
                        <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-secondary/80">
                          {colTasks.length}
                        </Badge>
                        {selectMode && colSelected > 0 && (
                          <Badge className="text-xs h-5 px-1.5 bg-primary text-primary-foreground">
                            {colSelected} selected
                          </Badge>
                        )}
                      </div>
                      {!selectMode && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setCreateStatus(status);
                            setCreateOpen(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* To-Dos */}
                    <div className="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[50vh] md:max-h-[calc(100vh-480px)] min-h-[180px]">
                      {colTasks.length === 0 ? (
                        <div
                          className="flex flex-col items-center justify-center h-24 text-center gap-1 rounded-lg border border-dashed border-border/40 mx-1"
                          onDragOver={(e) => { e.preventDefault(); setDragOverCol(status); }}
                          onDrop={(e) => handleDrop(e, status)}
                        >
                          {status === "todo" && (
                            <>
                              <p className="text-xs text-muted-foreground/70 font-medium">Nothing queued</p>
                              <p className="text-[10px] text-muted-foreground/50">Click + to add a To-Do</p>
                            </>
                          )}
                          {status === "in_progress" && (
                            <>
                              <p className="text-xs text-muted-foreground/70 font-medium">Nothing in progress</p>
                              <p className="text-[10px] text-muted-foreground/50">Drag a To-Do here to start it</p>
                            </>
                          )}
                          {status === "done" && (
                            <>
                              <p className="text-xs text-muted-foreground/70 font-medium">Nothing done yet</p>
                              <p className="text-[10px] text-muted-foreground/50">Completed To-Dos appear here</p>
                            </>
                          )}
                        </div>
                      ) : (
                        colTasks.map((task) => (
                          <div
                            key={task.id}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!selectMode) setDragOverTaskId(task.id); }}
                            onDrop={(e) => { e.stopPropagation(); if (!selectMode) handleDrop(e, status, task.id); }}
                            className={`transition-all duration-100 ${dragOverTaskId === task.id && dragTaskId !== task.id ? "border-t-2 border-primary pt-1" : ""}`}
                          >
                            <TaskCard
                              task={task}
                              assigneeName={task.assigneeId ? userMap.get(task.assigneeId) : null}
                              projectName={task.projectId ? projectMap.get(task.projectId) : undefined}
                              showProject
                              draggable={!selectMode}
                              onDragStart={handleDragStart}
                              selectMode={selectMode}
                              selected={selectedIds.has(task.id)}
                              onSelectToggle={toggleSelect}
                              onUpdated={() => {
                                utils.tasks.listAll.invalidate();
                                utils.dashboard.stats.invalidate();
                              }}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Floating bulk action toolbar ─────────────────────────────────────── */}
      {view === "todos" && selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-2 right-2 sm:left-auto sm:right-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl bg-card border border-border shadow-2xl shadow-black/20 backdrop-blur-sm">
          <span className="text-sm font-medium text-foreground mr-1 w-full sm:w-auto text-center sm:text-left">
            {selectedIds.size} selected
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" disabled={bulkPending}>
                <Circle className="h-3.5 w-3.5" />
                Move to
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="mb-1">
              <DropdownMenuItem onClick={() => bulkChangeStatus("todo")}>
                <Circle className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => bulkChangeStatus("in_progress")}>
                <Timer className="mr-2 h-3.5 w-3.5 text-blue-400" />
                In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => bulkChangeStatus("done")}>
                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-green-400" />
                Done
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="gap-1.5 h-8" disabled={bulkPending} onClick={() => bulkChangeStatus("done")}>
            {bulkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Mark Done
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" disabled={bulkPending}>
                <UserCheck className="h-3.5 w-3.5" />
                Reassign
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="mb-1 max-h-48 overflow-y-auto">
              <DropdownMenuItem onClick={() => bulkReassign(null)}>
                <X className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                Unassign
              </DropdownMenuItem>
              {users?.map((u) => (
                <DropdownMenuItem key={u.id} onClick={() => bulkReassign(u.id)}>
                  <UserCheck className="mr-2 h-3.5 w-3.5 text-primary" />
                  {u.name ?? u.email ?? `User #${u.id}`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-destructive border-destructive/40 hover:bg-destructive/10"
            disabled={bulkPending || bulkDeleteMutation.isPending}
            onClick={() => setBulkDeleteConfirmOpen(true)}
          >
            {bulkDeleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={clearSelection}
            title="Clear selection (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedIds.size} To-Do{selectedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive {selectedIds.size} selected To-Do{selectedIds.size !== 1 ? "s" : ""}.
              They will be hidden from the Kanban board but can be restored from the Archive page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setBulkDeleteConfirmOpen(false);
                bulkDeleteMutation.mutate(Array.from(selectedIds));
              }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Archive {selectedIds.size} To-Do{selectedIds.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create To-Do dialog — projectId is optional; standalone To-Dos have no Project */}
      <TaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={null}
        defaultStatus={createStatus}
        onSuccess={() => setCreateOpen(false)}
      />
    </div>
  );
}

// ─── Announcement Banner ──────────────────────────────────────────────────────
function AnnouncementBanner() {
  const [, setLocation] = useLocation();
  const { data: announcements } = trpc.announcements.list.useQuery();
  const [dismissed, setDismissed] = useState<Set<number>>(() => {
    try {
      const saved = sessionStorage.getItem("dismissed-announcements");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const pinned = (announcements ?? []).filter((a) => a.isPinned && !dismissed.has(a.id));
  if (pinned.length === 0) return null;

  const latest = pinned[0];

  const dismiss = () => {
    const next = new Set(dismissed);
    next.add(latest.id);
    setDismissed(next);
    try { sessionStorage.setItem("dismissed-announcements", JSON.stringify(Array.from(next))); } catch {}
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/8 border border-primary/20 text-sm">
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        <Pin className="h-3.5 w-3.5 text-primary" />
        <Megaphone className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-foreground">{latest.title}</span>
        {" — "}
        <span className="text-muted-foreground line-clamp-1">{latest.body}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pinned.length > 1 && (
          <span className="text-xs text-muted-foreground">+{pinned.length - 1} more</span>
        )}
        <button
          onClick={() => setLocation("/announcements")}
          className="flex items-center gap-0.5 text-xs text-primary hover:underline font-medium"
        >
          View <ChevronRight className="h-3 w-3" />
        </button>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

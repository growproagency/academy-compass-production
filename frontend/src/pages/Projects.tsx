import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// TaskDialog removed — milestone quick-add is now inline on the Rock card
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flag,
  FolderKanban,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  HelpCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RockStatus = "on_track" | "off_track" | "assist" | "complete";

type Project = {
  id: number;
  name: string;
  description: string | null;
  dueDate?: number | null;
  rockStatus?: RockStatus | null;
  ownerId: number;
  createdAt: Date;
};

const ROCK_STATUS_CONFIG: Record<
  RockStatus,
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

/** Format a UTC ms timestamp as a human-readable date string */
function formatRockDueDate(ts: number | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isRockOverdue(ts: number | null | undefined): boolean {
  if (!ts) return false;
  return ts < Date.now();
}

function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project?: Project;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDateStr, setDueDateStr] = useState(""); // "YYYY-MM-DD" from <input type="date">
  const [rockStatus, setRockStatus] = useState<RockStatus | "">("on_track");
  const utils = trpc.useUtils();

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setRockStatus((project?.rockStatus as RockStatus) ?? "on_track");
      // Convert stored ms timestamp → "YYYY-MM-DD" for the date input
      if (project?.dueDate) {
        const d = new Date(project.dueDate);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        setDueDateStr(`${yyyy}-${mm}-${dd}`);
      } else {
        setDueDateStr("");
      }
    }
  }, [open, project]);

  const create = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success("Rock created");
      utils.projects.list.invalidate();
      utils.projects.listWithStats.invalidate();
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("Rock updated");
      utils.projects.list.invalidate();
      utils.projects.listWithStats.invalidate();
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = create.isPending || update.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    // Convert "YYYY-MM-DD" → UTC midnight ms timestamp (or null)
    const dueDate = dueDateStr
      ? new Date(dueDateStr + "T00:00:00").getTime()
      : null;

    if (project) {
      update.mutate({
        id: project.id,
        name: name.trim(),
        description: description.trim() || undefined,
        dueDate,
        rockStatus: rockStatus || undefined,
      });
    } else {
      create.mutate({
        name: name.trim(),
        description: description.trim() || undefined,
        dueDate,
        rockStatus: rockStatus || undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>{project ? "Edit Rock" : "New Rock"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Rock Name *</Label>
            <Input
              id="proj-name"
              placeholder="e.g. Summer Belt Testing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea
              id="proj-desc"
              placeholder="What is this rock about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-input resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-status">Status</Label>
            <Select
              value={rockStatus || "on_track"}
              onValueChange={(v) => setRockStatus(v as RockStatus)}
            >
              <SelectTrigger id="proj-status" className="bg-input">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="off_track">Off Track</SelectItem>
                <SelectItem value="assist">Assist</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-due">Due Date</Label>
            <Input
              id="proj-due"
              type="date"
              value={dueDateStr}
              onChange={(e) => setDueDateStr(e.target.value)}
              className="bg-input"
            />
            {dueDateStr && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => setDueDateStr("")}
              >
                Clear due date
              </button>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {project ? "Save Changes" : "Create Rock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [quickMilestoneProjectId, setQuickMilestoneProjectId] = useState<number | null>(null);
  const [quickMilestoneTitle, setQuickMilestoneTitle] = useState("");
  const [quickMilestoneDueDate, setQuickMilestoneDueDate] = useState("");
  const [quickMilestonePending, setQuickMilestonePending] = useState(false);
  const [expandedMilestones, setExpandedMilestones] = useState<Record<number, boolean>>({});
  // Inline milestone editing state
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [editingMilestoneTitle, setEditingMilestoneTitle] = useState("");
  const [editingMilestoneDueDate, setEditingMilestoneDueDate] = useState("");
  const utils = trpc.useUtils();

  const createMilestoneMutation = trpc.milestones.create.useMutation({
    onSuccess: () => {
      utils.projects.listWithStats.invalidate();
      setQuickMilestoneProjectId(null);
      setQuickMilestoneTitle("");
      setQuickMilestoneDueDate("");
      setQuickMilestonePending(false);
      toast.success("Milestone added");
    },
    onError: (err) => {
      toast.error(err.message);
      setQuickMilestonePending(false);
    },
  });

  const toggleMilestoneMutation = trpc.milestones.toggle.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const updateMilestoneMutation = trpc.milestones.update.useMutation({
    onSuccess: () => {
      utils.projects.listWithStats.invalidate();
      setEditingMilestoneId(null);
      toast.success("Milestone updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleMilestoneEditSave = (id: number) => {
    const title = editingMilestoneTitle.trim();
    if (!title) { setEditingMilestoneId(null); return; }
    const dueDate = editingMilestoneDueDate
      ? new Date(editingMilestoneDueDate + "T00:00:00").getTime()
      : null;
    updateMilestoneMutation.mutate({ id, title, dueDate });
  };

  const handleQuickMilestoneSubmit = (projectId: number) => {
    const title = quickMilestoneTitle.trim();
    if (!title) return;
    setQuickMilestonePending(true);
    const dueDateTs = quickMilestoneDueDate ? new Date(quickMilestoneDueDate).getTime() : undefined;
    createMilestoneMutation.mutate({ projectId, title, dueDate: dueDateTs });
  };

  const { data: projects, isLoading } = trpc.projects.listWithStats.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Rock deleted");
      utils.projects.listWithStats.invalidate();
      utils.projects.list.invalidate();
      setDeleteProject(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const getOwnerName = (ownerId: number) =>
    users?.find((u) => u.id === ownerId)?.name ?? "Unknown";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rocks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects?.length ?? 0} rock{projects?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Rock
        </Button>
      </div>

      {/* Projects grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold">No rocks yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first rock to get started
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Rock
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => {
            const taskTotal = project.taskTotal ?? 0;
            const taskDone = project.taskDone ?? 0;
            const milestoneTotal = (project as any).milestoneTotal ?? 0;
            const milestoneDone = (project as any).milestoneDone ?? 0;
            const isOwner = project.ownerId === user?.id || user?.role === "admin";
            const progress = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
            const milestoneProgress =
              milestoneTotal > 0 ? Math.round((milestoneDone / milestoneTotal) * 100) : 0;
            const dueDate = (project as any).dueDate as number | null | undefined;
            const overdue = isRockOverdue(dueDate);
            const dueDateLabel = formatRockDueDate(dueDate);
            const rockStatus = (project as any).rockStatus as RockStatus | null | undefined;
            const statusCfg = rockStatus ? ROCK_STATUS_CONFIG[rockStatus] : null;

            return (
              <Card
                key={project.id}
                className={`bg-card border-border/60 hover:border-primary/30 transition-all cursor-pointer group relative ${
                  overdue
                    ? "border-l-[3px] border-l-destructive bg-destructive/[0.02]"
                    : ""
                }`}
                onClick={() => setLocation(`/projects/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          overdue
                            ? "bg-destructive/10 border border-destructive/30"
                            : "bg-primary/10 border border-primary/20"
                        }`}
                      >
                        <FolderKanban
                          className={`h-4 w-4 ${overdue ? "text-destructive" : "text-primary"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3
                          className={`font-semibold truncate transition-colors ${
                            overdue
                              ? "text-destructive group-hover:text-destructive/80"
                              : "group-hover:text-primary"
                          }`}
                        >
                          {project.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          by {getOwnerName(project.ownerId)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick-add milestone button in card header */}
                      <button
                        className="h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20 text-primary"
                        title="Add milestone to this rock"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickMilestoneProjectId(project.id);
                          setQuickMilestoneTitle("");
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      {isOwner && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditProject(project as Project);
                              }}
                              className="cursor-pointer"
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteProject(project as Project);
                              }}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  {/* Status + due date badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {statusCfg && (
                      <div
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.color} ${statusCfg.bg} border ${statusCfg.border}`}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </div>
                    )}
                    {dueDateLabel && (
                      <div
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          overdue
                            ? "bg-destructive/10 text-destructive border border-destructive/20"
                            : "bg-secondary text-muted-foreground border border-border/60"
                        }`}
                      >
                        {overdue ? (
                          <AlertCircle className="h-3 w-3 shrink-0" />
                        ) : (
                          <Calendar className="h-3 w-3 shrink-0" />
                        )}
                        {overdue ? "Overdue · " : "Due "}
                        {dueDateLabel}
                      </div>
                    )}
                  </div>

                  {/* Milestone progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Flag className="h-3 w-3" />
                        Milestones
                      </span>
                      <span className="font-medium text-foreground">
                        {milestoneTotal === 0 ? (
                          <span className="text-muted-foreground italic">none set</span>
                        ) : (
                          <span
                            className={
                              milestoneDone === milestoneTotal ? "text-emerald-500" : ""
                            }
                          >
                            {milestoneDone}/{milestoneTotal}
                            {milestoneDone === milestoneTotal && milestoneTotal > 0 && (
                              <CheckCircle2 className="inline ml-1 h-3 w-3 text-emerald-500" />
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                    {milestoneTotal > 0 && (
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            milestoneProgress === 100 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${milestoneProgress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Milestone preview list (first 3, collapsible) with inline editing */}
                  {(() => {
                    const preview = (project as any).milestonePreview as { id: number; title: string; completedAt: number | null; dueDate: number | null }[] | undefined;
                    if (!preview || preview.length === 0) return null;
                    const isExpanded = expandedMilestones[project.id] ?? false;
                    return (
                      <div className="space-y-1 mt-2" onClick={(e) => e.stopPropagation()}>
                        {preview.map((m) => (
                          <div key={m.id} className="group flex items-center gap-2 text-xs">
                            <button
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors hover:scale-110 ${
                                m.completedAt ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40 hover:border-emerald-400"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMilestoneMutation.mutate({ id: m.id, completed: !m.completedAt, projectId: project.id });
                              }}
                              title={m.completedAt ? "Mark incomplete" : "Mark complete"}
                            >
                              {m.completedAt && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                            </button>
                            {editingMilestoneId === m.id ? (
                              <div className="flex flex-col gap-1 flex-1">
                                <Input
                                  autoFocus
                                  className="h-6 text-xs px-1.5 py-0"
                                  value={editingMilestoneTitle}
                                  onChange={(e) => setEditingMilestoneTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleMilestoneEditSave(m.id);
                                    if (e.key === "Escape") setEditingMilestoneId(null);
                                  }}
                                  onBlur={() => handleMilestoneEditSave(m.id)}
                                />
                                <input
                                  type="date"
                                  className="h-6 text-xs px-1.5 py-0 rounded border border-input bg-background w-full"
                                  value={editingMilestoneDueDate}
                                  onChange={(e) => setEditingMilestoneDueDate(e.target.value)}
                                />
                              </div>
                            ) : (
                              <div
                                className="flex-1 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
                                onClick={() => {
                                  setEditingMilestoneId(m.id);
                                  setEditingMilestoneTitle(m.title);
                                  if (m.dueDate) {
                                    const d = new Date(m.dueDate);
                                    const yyyy = d.getFullYear();
                                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                                    const dd = String(d.getDate()).padStart(2, "0");
                                    setEditingMilestoneDueDate(`${yyyy}-${mm}-${dd}`);
                                  } else {
                                    setEditingMilestoneDueDate("");
                                  }
                                }}
                              >
                                <span className={`truncate text-muted-foreground ${m.completedAt ? "line-through opacity-50" : ""}`}>
                                  {m.title}
                                </span>
                                {m.dueDate && (
                                  <span className={`shrink-0 flex items-center gap-0.5 text-[10px] font-medium ${
                                    !m.completedAt && m.dueDate < Date.now() ? "text-destructive" : "text-muted-foreground/70"
                                  }`}>
                                    <Calendar className="h-2.5 w-2.5" />
                                    {new Date(m.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                  </span>
                                )}
                                <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                              </div>
                            )}
                          </div>
                        ))}
                        {milestoneTotal > 3 && (
                          <button
                            className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary mt-0.5 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMilestones((prev) => ({ ...prev, [project.id]: !isExpanded }));
                            }}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {isExpanded ? "Show less" : `+${milestoneTotal - 3} more`}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Quick-add milestone — inline input with optional date picker */}
                  {quickMilestoneProjectId === project.id ? (
                    <div
                      className="space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        autoFocus
                        placeholder="Milestone title…"
                        value={quickMilestoneTitle}
                        onChange={(e) => setQuickMilestoneTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleQuickMilestoneSubmit(project.id);
                          if (e.key === "Escape") {
                            setQuickMilestoneProjectId(null);
                            setQuickMilestoneTitle("");
                            setQuickMilestoneDueDate("");
                          }
                        }}
                        className="h-7 text-xs bg-input"
                        disabled={quickMilestonePending}
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                          <input
                            type="date"
                            value={quickMilestoneDueDate}
                            onChange={(e) => setQuickMilestoneDueDate(e.target.value)}
                            className="h-6 text-xs bg-input border border-input rounded px-1.5 text-foreground flex-1 min-w-0"
                          />
                        </div>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-3 shrink-0"
                          onClick={(e) => { e.stopPropagation(); handleQuickMilestoneSubmit(project.id); }}
                          disabled={quickMilestonePending || !quickMilestoneTitle.trim()}
                        >
                          {quickMilestonePending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickMilestoneProjectId(null);
                            setQuickMilestoneTitle("");
                            setQuickMilestoneDueDate("");
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-primary/30 text-xs text-primary/70 hover:text-primary hover:border-primary/60 hover:bg-primary/5 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickMilestoneProjectId(project.id);
                          setQuickMilestoneTitle("");
                          setQuickMilestoneDueDate("");
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Add milestone to this rock
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />
      <ProjectFormDialog
        open={!!editProject}
        onOpenChange={(v) => !v && setEditProject(null)}
        project={editProject ?? undefined}
        onSuccess={() => setEditProject(null)}
      />

      {/* Milestone quick-add is now inline on each Rock card */}

      <AlertDialog
        open={!!deleteProject}
        onOpenChange={(v) => !v && setDeleteProject(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rock</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>"{deleteProject?.name}"</strong>? This will also delete
              all tasks in this rock. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteProject && deleteMutation.mutate(deleteProject.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

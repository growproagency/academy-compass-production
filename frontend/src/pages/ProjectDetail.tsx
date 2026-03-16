import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import TaskCard from "@/components/TaskCard";
import TaskDialog from "@/components/TaskDialog";
import {
  getUserInitials,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/taskHelpers";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Flag,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Activity,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, PartyPopper } from "lucide-react";
import confetti from "canvas-confetti";

// ─── Milestone form dialog ────────────────────────────────────────────────────
function MilestoneDialog({
  open,
  onOpenChange,
  projectId,
  milestone,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: number;
  milestone?: { id: number; title: string; description: string | null; dueDate: number | null };
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [dueDate, setDueDate] = useState(
    milestone?.dueDate ? new Date(milestone.dueDate).toISOString().split("T")[0] : ""
  );
  const utils = trpc.useUtils();

  const create = trpc.milestones.create.useMutation({
    onSuccess: () => {
      toast.success("Milestone created");
      utils.milestones.list.invalidate({ projectId });
      onSuccess();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.milestones.update.useMutation({
    onSuccess: () => {
      toast.success("Milestone updated");
      utils.milestones.list.invalidate({ projectId });
      onSuccess();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    const dueDateMs = dueDate ? new Date(dueDate).getTime() : undefined;
    if (milestone) {
      update.mutate({ id: milestone.id, title: title.trim(), description: description.trim() || undefined, dueDate: dueDateMs ?? null });
    } else {
      create.mutate({ projectId, title: title.trim(), description: description.trim() || undefined, dueDate: dueDateMs });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>{milestone ? "Edit Milestone" : "Add Milestone"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Milestone title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-input"
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="bg-input resize-none"
          />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Due Date (optional)</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || isPending} onClick={handleSubmit}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {milestone ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [removeMemberId, setRemoveMemberId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<{
    id: number; title: string; description: string | null; dueDate: number | null;
  } | undefined>(undefined);
  const [deleteMilestoneId, setDeleteMilestoneId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  // Rock status config
  const ROCK_STATUS_CONFIG = {
    on_track:  { label: "On Track",  color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" },
    off_track: { label: "Off Track", color: "text-destructive",  bg: "bg-destructive/10 border-destructive/30" },
    assist:    { label: "Assist",    color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/30" },
    complete:  { label: "Complete",  color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  } as const;
  type RockStatus = keyof typeof ROCK_STATUS_CONFIG;

  const { data: project, isLoading: projectLoading } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.listByProject.useQuery({ projectId });
  const { data: members } = trpc.projects.members.list.useQuery({ projectId });
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: milestones, isLoading: milestonesLoading } = trpc.milestones.list.useQuery({ projectId });

  const addMember = trpc.projects.members.add.useMutation({
    onSuccess: () => {
      toast.success("Member added");
      utils.projects.members.list.invalidate({ projectId });
      setAddMemberOpen(false);
      setSelectedUserId("");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMember = trpc.projects.members.remove.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      utils.projects.members.list.invalidate({ projectId });
      setRemoveMemberId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMilestone = trpc.milestones.toggle.useMutation({
    onSuccess: (_, vars) => {
      utils.milestones.list.invalidate({ projectId }).then(() => {
        // Check if all milestones are now complete after this toggle
        const updated = (milestones ?? []).map((m) =>
          m.id === vars.id ? { ...m, completedAt: vars.completed ? new Date().toISOString() : null } : m
        );
        const allDone = updated.length > 0 && updated.every((m) => m.completedAt !== null);
        if (allDone && vars.completed) {
          fireConfetti();
          setCelebrateOpen(true);
        }
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRockStatus = trpc.projects.update.useMutation({
    onMutate: async ({ rockStatus }) => {
      // Optimistic update
      await utils.projects.getById.cancel({ id: projectId });
      const prev = utils.projects.getById.getData({ id: projectId });
      if (prev && rockStatus !== undefined) {
        utils.projects.getById.setData({ id: projectId }, { ...prev, rockStatus: rockStatus ?? null });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.projects.getById.setData({ id: projectId }, ctx.prev);
      toast.error("Failed to update status");
    },
    onSuccess: () => {
      utils.projects.getById.invalidate({ id: projectId });
      utils.projects.listWithStats.invalidate();
      toast.success("Rock status updated");
    },
  });

  const deleteMilestone = trpc.milestones.delete.useMutation({
    onSuccess: () => {
      toast.success("Milestone deleted");
      utils.milestones.list.invalidate({ projectId });
      setDeleteMilestoneId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMilestoneDueDate = trpc.milestones.update.useMutation({
    onSuccess: () => utils.milestones.list.invalidate({ projectId }),
    onError: (e) => toast.error(e.message),
  });

  // ── Milestone celebration ─────────────────────────────────────────────────
  const [celebrateOpen, setCelebrateOpen] = useState(false);

  const fireConfetti = useCallback(() => {
    const end = Date.now() + 2000;
    const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  // ── Comments ──────────────────────────────────────────────────────────────
  const [commentText, setCommentText] = useState("");
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState(0); // cursor position of '@'

  const memberNames: string[] = (members ?? []).map((m) => m.user?.name ?? "").filter(Boolean);
  const filteredMentions = mentionQuery !== null
    ? memberNames.filter((n) => n.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);
    const cursor = e.target.selectionStart ?? val.length;
    // Find the last '@' before cursor with no space after it
    const textBeforeCursor = val.slice(0, cursor);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    if (atIdx !== -1 && !textBeforeCursor.slice(atIdx).includes(" ")) {
      setMentionQuery(textBeforeCursor.slice(atIdx + 1));
      setMentionAnchor(atIdx);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (name: string) => {
    const before = commentText.slice(0, mentionAnchor);
    const after = commentText.slice(mentionAnchor + 1 + (mentionQuery?.length ?? 0));
    const newText = `${before}@${name} ${after}`;
    setCommentText(newText);
    setMentionQuery(null);
    commentInputRef.current?.focus();
  };

  const renderCommentWithMentions = (content: string) => {
    const parts = content.split(/(@\w[\w\s]*)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-primary font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };
  const { data: comments, isLoading: commentsLoading } = trpc.rockComments.list.useQuery({ projectId });

  const addComment = trpc.rockComments.create.useMutation({
    onSuccess: () => {
      utils.rockComments.list.invalidate({ projectId });
      setCommentText("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteComment = trpc.rockComments.delete.useMutation({
    onSuccess: () => utils.rockComments.list.invalidate({ projectId }),
    onError: (e) => toast.error(e.message),
  });

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate({ projectId, content: commentText.trim() });
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Rock not found</p>
        <Button onClick={() => setLocation("/projects")}>Back to Rocks</Button>
      </div>
    );
  }

  const isOwner = project.ownerId === user?.id || user?.role === "admin";
  const memberUserIds = new Set(members?.map((m) => m.userId) ?? []);
  const nonMembers = allUsers?.filter((u) => !memberUserIds.has(u.id)) ?? [];
  const userMap = new Map(allUsers?.map((u) => [u.id, u.name]) ?? []);

  const filteredTasks = (tasks ?? []).filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const taskStats = {
    total: tasks?.length ?? 0,
    todo: tasks?.filter((t) => t.status === "todo").length ?? 0,
    inProgress: tasks?.filter((t) => t.status === "in_progress").length ?? 0,
    done: tasks?.filter((t) => t.status === "done").length ?? 0,
  };
  const progress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

  const milestoneStats = {
    total: milestones?.length ?? 0,
    done: milestones?.filter((m) => m.completedAt !== null).length ?? 0,
  };
  const milestoneProgress = milestoneStats.total > 0
    ? Math.round((milestoneStats.done / milestoneStats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/projects")}
          className="h-8 w-8 mt-0.5 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold truncate">{project.name}</h1>
            <Badge variant="outline" className="text-xs border-primary/40 text-primary shrink-0">Rock</Badge>
            {/* Status quick-update */}
            {isOwner ? (
              <Select
                value={project.rockStatus ?? ""}
                onValueChange={(val) =>
                  updateRockStatus.mutate({ id: projectId, rockStatus: val as RockStatus })
                }
              >
                <SelectTrigger
                  className={`h-6 text-xs px-2 py-0 border rounded-full w-auto gap-1 shrink-0 ${
                    project.rockStatus
                      ? ROCK_STATUS_CONFIG[project.rockStatus as RockStatus]?.bg ?? "border-border/60"
                      : "border-border/60 text-muted-foreground"
                  }`}
                >
                  <Activity className="h-3 w-3" />
                  <SelectValue placeholder="Set status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_track">✅ On Track</SelectItem>
                  <SelectItem value="off_track">🔴 Off Track</SelectItem>
                  <SelectItem value="assist">🟡 Assist</SelectItem>
                  <SelectItem value="complete">🏁 Complete</SelectItem>
                </SelectContent>
              </Select>
            ) : project.rockStatus ? (
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${
                  ROCK_STATUS_CONFIG[project.rockStatus as RockStatus]?.bg ?? ""
                } ${
                  ROCK_STATUS_CONFIG[project.rockStatus as RockStatus]?.color ?? ""
                }`}
              >
                {ROCK_STATUS_CONFIG[project.rockStatus as RockStatus]?.label}
              </Badge>
            ) : null}
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          {/* ── Milestones ── */}
          <Card className="bg-card border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Flag className="h-4 w-4 text-amber-500" />
                  Milestones
                  <Badge variant="secondary" className="text-xs">
                    {milestoneStats.done}/{milestoneStats.total}
                  </Badge>
                </CardTitle>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setEditingMilestone(undefined); setMilestoneDialogOpen(true); }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                )}
              </div>
              {milestoneStats.total > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Milestone Progress</span>
                    <span>{milestoneProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${milestoneProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {milestonesLoading ? (
                <div className="flex items-center justify-center h-12">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : milestones?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Flag className="h-6 w-6 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No milestones yet</p>
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs mt-1"
                      onClick={() => { setEditingMilestone(undefined); setMilestoneDialogOpen(true); }}
                    >
                      <Plus className="h-3 w-3" />
                      Add first milestone
                    </Button>
                  )}
                </div>
              ) : (
                milestones?.map((m) => {
                  const isComplete = m.completedAt !== null;
                  const isOverdue = !isComplete && m.dueDate !== null && m.dueDate < Date.now();
                  return (
                    <div
                      key={m.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        isComplete
                          ? "bg-green-500/5 border-green-500/20"
                          : isOverdue
                          ? "bg-destructive/5 border-destructive/20"
                          : "bg-secondary/30 border-border/40"
                      }`}
                    >
                      <button
                        onClick={() => toggleMilestone.mutate({ id: m.id, completed: !isComplete, projectId })}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                          {m.title}
                        </p>
                        {m.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.description}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {isOwner ? (
                            <label className={`flex items-center gap-1 text-xs cursor-pointer group ${isOverdue ? "text-destructive" : "text-muted-foreground"} hover:text-foreground transition-colors`}>
                              <CalendarDays className="h-3 w-3 shrink-0" />
                              <input
                                type="date"
                                value={m.dueDate ? new Date(m.dueDate).toISOString().split("T")[0] : ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const ms = val ? new Date(val).getTime() : null;
                                  updateMilestoneDueDate.mutate({ id: m.id, dueDate: ms, projectId });
                                }}
                                className="bg-transparent border-none outline-none text-xs cursor-pointer"
                              />
                              {isOverdue && <span className="font-medium text-destructive">· Overdue</span>}
                            </label>
                          ) : m.dueDate ? (
                            <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                              <CalendarDays className="h-3 w-3" />
                              {new Date(m.dueDate).toLocaleDateString()}
                              {isOverdue && <span className="font-medium">· Overdue</span>}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {isOwner && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingMilestone(m); setMilestoneDialogOpen(true); }}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setDeleteMilestoneId(m.id)}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>


        </div>

        {/* ── Sidebar: Members ── */}
        <div className="space-y-4">
          <Card className="bg-card border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Team Members
                  <Badge variant="secondary" className="text-xs">{members?.length ?? 0}</Badge>
                </CardTitle>
                {isOwner && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setAddMemberOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {members?.map((member) => (
                <div key={member.userId} className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-7 w-7 border border-border shrink-0">
                      <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                        {getUserInitials(member.user?.name ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{member.user?.name ?? "Unknown"}</p>
                      {project.ownerId === member.userId && (
                        <p className="text-[10px] text-primary">Owner</p>
                      )}
                    </div>
                  </div>
                  {isOwner && project.ownerId !== member.userId && (
                    <button
                      onClick={() => setRemoveMemberId(member.userId)}
                      className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {members?.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No members yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Comments Section ── */}
      <Card className="bg-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Comments
            <Badge variant="secondary" className="text-xs">
              {comments?.length ?? 0}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {commentsLoading ? (
            <div className="flex items-center justify-center h-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 group">
                  <Avatar className="h-7 w-7 border border-border shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                      {getUserInitials(c.author?.name ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold">{c.author?.name ?? "Unknown"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        {" "}
                        {new Date(c.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">
                      {renderCommentWithMentions(c.content)}
                    </p>
                  </div>
                  {(c.authorId === user?.id || user?.role === "admin") && (
                    <button
                      onClick={() => deleteComment.mutate({ id: c.id, projectId })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              No comments yet. Be the first to add one.
            </p>
          )}

          <Separator className="my-2" />

          {/* Comment input with @mention autocomplete */}
          <div className="flex gap-2 items-start">
            <Avatar className="h-7 w-7 border border-border shrink-0 mt-1">
              <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                {getUserInitials(user?.name ?? "")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="relative">
                <Textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={handleCommentChange}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setMentionQuery(null); return; }
                    if (mentionQuery !== null && filteredMentions.length > 0 && e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                      insertMention(filteredMentions[0]);
                      return;
                    }
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  placeholder="Write a comment… type @ to mention someone"
                  rows={2}
                  className="bg-input border-border/60 resize-none text-sm"
                />
                {/* @mention dropdown */}
                {mentionQuery !== null && filteredMentions.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-b border-border/60">Members</p>
                    {filteredMentions.slice(0, 6).map((name) => (
                      <button
                        key={name}
                        onMouseDown={(e) => { e.preventDefault(); insertMention(name); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {getUserInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={!commentText.trim() || addComment.isPending}
                  onClick={handleAddComment}
                >
                  {addComment.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* ── Milestone create/edit dialog ── */}
      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        projectId={projectId}
        milestone={editingMilestone}
        onSuccess={() => setEditingMilestone(undefined)}
      />

      {/* ── Milestone delete confirm ── */}
      <AlertDialog open={deleteMilestoneId !== null} onOpenChange={(v) => !v && setDeleteMilestoneId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              This milestone will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMilestoneId !== null && deleteMilestone.mutate({ id: deleteMilestoneId, projectId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add member dialog ── */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedUserId || "none"} onValueChange={(v) => setSelectedUserId(v === "none" ? "" : v)}>
              <SelectTrigger className="bg-input">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select a user...</SelectItem>
                {nonMembers.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.name || u.email || `User #${u.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button
              disabled={!selectedUserId || selectedUserId === "none" || addMember.isPending}
              onClick={() => selectedUserId && addMember.mutate({ projectId, userId: parseInt(selectedUserId) })}
            >
              {addMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Milestone celebration dialog ── */}
      <Dialog open={celebrateOpen} onOpenChange={setCelebrateOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border text-center">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <PartyPopper className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-xl">All Milestones Complete!</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Every milestone for <strong>{project?.name}</strong> has been completed.
              Would you like to mark this Rock as <strong>Complete</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCelebrateOpen(false)}>
              Not yet
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                updateRockStatus.mutate({ id: projectId, rockStatus: "complete" });
                setCelebrateOpen(false);
              }}
            >
              Mark as Complete 🏁
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove member confirm ── */}
      <AlertDialog open={removeMemberId !== null} onOpenChange={(v) => !v && setRemoveMemberId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{userMap.get(removeMemberId ?? 0)}</strong> from this Rock?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMemberId !== null && removeMember.mutate({ projectId, userId: removeMemberId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

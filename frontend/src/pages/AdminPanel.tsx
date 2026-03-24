import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { getUserInitials } from "@/lib/taskHelpers";
import {
  useUsers,
  useProjects,
  useTasks,
  useOverdueCount,
  useDueSoonCount,
  useNotificationSchedule,
  useReminderWindow,
  useWeeklyReportSchedule,
  usePreviewDigest,
  useUpdateUserRole,
  useInvites,
  useCreateInvite,
  useDeleteInvite,
  QK,
} from "@/hooks/useApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FolderKanban,
  Loader2,
  Mail,
  Save,
  Shield,
  ShieldOff,
  Timer,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

/** Format hour/minute as a readable 12-hour time string */
function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = String(minute).padStart(2, "0");
  return `${h}:${m} ${period}`;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-600 bg-red-50 border-red-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low: "text-green-600 bg-green-50 border-green-200",
};

export default function AdminPanel() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [roleChange, setRoleChange] = useState<{ id: number; name: string; newRole: "admin" | "user" } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const qc = useQueryClient();

  // Schedule picker local state
  const [scheduleHour, setScheduleHour] = useState<number>(8);
  const [scheduleMinute, setScheduleMinute] = useState<number>(0);
  const [scheduleDirty, setScheduleDirty] = useState(false);

  // Reminder window local state
  const [reminderWindowHours, setReminderWindowHours] = useState<number>(24);
  const [reminderWindowDirty, setReminderWindowDirty] = useState(false);

  // Weekly report local state
  const [weeklyHour, setWeeklyHour] = useState<number>(8);
  const [weeklyMinute, setWeeklyMinute] = useState<number>(0);
  const [weeklyDirty, setWeeklyDirty] = useState(false);

  const { data: users, isLoading } = useUsers();
  const { data: projects } = useProjects();
  const { data: allTasks } = useTasks();

  const { data: overdueData } = useOverdueCount();
  const { data: dueSoonData } = useDueSoonCount();
  const { data: scheduleData } = useNotificationSchedule();
  const { data: reminderWindowData } = useReminderWindow();
  const { data: weeklyScheduleData } = useWeeklyReportSchedule();
  const { data: previewData, isLoading: previewLoading } = usePreviewDigest();

  // Sync schedule from server on first load
  useEffect(() => {
    if (scheduleData) {
      setScheduleHour(scheduleData.hour);
      setScheduleMinute(scheduleData.minute);
      setScheduleDirty(false);
    }
  }, [scheduleData]);

  // Sync reminder window from server on first load
  useEffect(() => {
    if (reminderWindowData) {
      setReminderWindowHours(reminderWindowData.hours);
      setReminderWindowDirty(false);
    }
  }, [reminderWindowData]);

  // Sync weekly report schedule from server on first load
  useEffect(() => {
    if (weeklyScheduleData) {
      setWeeklyHour(weeklyScheduleData.hour);
      setWeeklyMinute(weeklyScheduleData.minute);
      setWeeklyDirty(false);
    }
  }, [weeklyScheduleData]);

  const sendDigest = useMutation({
    mutationFn: () => api.notifications.sendDailyDigest(),
  });

  const sendDueRemindersNow = useMutation({
    mutationFn: () => api.notifications.sendDueRemindersNow(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.dueSoonCount }),
  });

  const setReminderWindow = useMutation({
    mutationFn: ({ hours }: { hours: number }) => api.notifications.setReminderWindow(hours),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.reminderWindow });
      qc.invalidateQueries({ queryKey: QK.dueSoonCount });
    },
  });

  const setSchedule = useMutation({
    mutationFn: ({ hour, minute }: { hour: number; minute: number }) => api.notifications.setSchedule(hour, minute),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.schedule }),
  });

  const setWeeklySchedule = useMutation({
    mutationFn: ({ hour, minute }: { hour: number; minute: number }) => api.notifications.setWeeklyReportSchedule(hour, minute),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.weeklySchedule }),
  });

  const sendWeeklyReportNow = useMutation({
    mutationFn: () => api.notifications.sendWeeklyReportNow(),
  });

  const updateRole = useUpdateUserRole();

  // ── Invites ────────────────────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");
  const { data: pendingInvites } = useInvites();
  const createInvite = useCreateInvite();
  const deleteInvite = useDeleteInvite();

  // Redirect non-admins
  if (user && user.role !== "admin" && user.role !== "superadmin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Shield className="h-12 w-12 text-muted-foreground/40" />
        <div className="text-center">
          <p className="font-semibold">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">Admin access required</p>
        </div>
        <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  const stats = {
    users: users?.length ?? 0,
    admins: users?.filter((u) => u.role === "admin").length ?? 0,
    projects: projects?.length ?? 0,
    tasks: allTasks?.length ?? 0,
  };

  // Build hour options (0–23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  // Build minute options in 15-minute increments
  const minuteOptions = [
    { value: 0, label: ":00" },
    { value: 15, label: ":15" },
    { value: 30, label: ":30" },
    { value: 45, label: ":45" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage users, roles, and system overview</p>
        </div>
      </div>

      {/* System stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: stats.users, icon: <Users className="h-5 w-5" />, color: "text-primary" },
          { label: "Admins", value: stats.admins, icon: <Shield className="h-5 w-5" />, color: "text-accent" },
          { label: "Projects", value: stats.projects, icon: <FolderKanban className="h-5 w-5" />, color: "text-blue-400" },
          { label: "Total Tasks", value: stats.tasks, icon: <CheckCircle2 className="h-5 w-5" />, color: "text-green-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border/60">
            <CardContent className="p-4">
              <div className={`mb-2 ${s.color}`}>{s.icon}</div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invite Users */}
      <Card className="bg-card border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Invite Users
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Send an invite link by email. Users can only join via invite.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Invite form */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="Email address"
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && inviteEmail && createInvite.mutate(
                { email: inviteEmail, role: inviteRole },
                {
                  onSuccess: () => { toast.success(`Invite sent to ${inviteEmail}`); setInviteEmail(""); setInviteRole("user"); },
                  onError: (e: any) => toast.error(e.message),
                }
              )}
            />
            <Select value={inviteRole} onValueChange={v => setInviteRole(v as "user" | "admin")}>
              <SelectTrigger className="w-32 h-9 text-sm bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="gap-1.5 h-9"
              disabled={!inviteEmail || createInvite.isPending}
              onClick={() => createInvite.mutate(
                { email: inviteEmail, role: inviteRole },
                {
                  onSuccess: () => { toast.success(`Invite sent to ${inviteEmail}`); setInviteEmail(""); setInviteRole("user"); },
                  onError: (e: any) => toast.error(e.message),
                }
              )}
            >
              {createInvite.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Send Invite
            </Button>
          </div>

          {/* Pending invites */}
          {pendingInvites && pendingInvites.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Invites</p>
              {(pendingInvites as any[]).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary/40 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{inv.email}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                      {inv.role === "admin" ? "Admin" : "Member"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteInvite.mutate(inv.id, {
                      onSuccess: () => toast.success("Invite revoked"),
                      onError: (e: any) => toast.error(e.message),
                    })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User management */}
      <Card className="bg-card border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {users?.map((u) => {
                const isSelf = u.id === user?.id;
                const userTasks = allTasks?.filter((t) => t.assigneeId === u.id || t.creatorId === u.id) ?? [];
                const userProjects = projects?.filter((p) => p.ownerId === u.id) ?? [];

                return (
                  <div
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 transition-colors"
                  >
                    <Avatar className="h-9 w-9 border border-border shrink-0 hidden sm:flex">
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                        {getUserInitials(u.name ?? "")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{u.name || "Unnamed User"}</span>
                        {isSelf && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border text-muted-foreground">
                            You
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 h-4 ${
                            u.role === "admin"
                              ? "border-primary/40 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {u.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {u.email && <span className="truncate max-w-48">{u.email}</span>}
                        <span>{userProjects.length} projects</span>
                        <span>{userTasks.length} tasks</span>
                      </div>
                    </div>

                    {/* Scorecard link */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 shrink-0 text-xs h-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setLocation(`/scorecard/${u.id}`)}
                    >
                      <UserCheck className="h-3 w-3" />
                      Scorecard
                    </Button>

                    {/* Role toggle */}
                    {!isSelf && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 shrink-0 text-xs h-7"
                        onClick={() =>
                          setRoleChange({
                            id: u.id,
                            name: u.name ?? "User",
                            newRole: u.role === "admin" ? "user" : "admin",
                          })
                        }
                      >
                        {u.role === "admin" ? (
                          <>
                            <ShieldOff className="h-3 w-3" />
                            Demote
                          </>
                        ) : (
                          <>
                            <Shield className="h-3 w-3" />
                            Make Admin
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Digest Notifications */}
      <Card className="bg-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Daily Digest Notifications
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            A digest of all overdue tasks is automatically sent to you once per day.
            Configure the send time below or trigger it manually at any time.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overdue count + action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-muted/40 border border-border">
            <div>
              <p className="text-sm font-medium">Overdue tasks right now</p>
              <p className="text-2xl font-bold text-destructive mt-0.5">
                {overdueData?.count ?? 0}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">
                  task{(overdueData?.count ?? 0) !== 1 ? "s" : ""} overdue
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <Button
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                className="gap-2 flex-1 sm:flex-none"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button
                onClick={() => sendDigest.mutate(undefined, {
                  onSuccess: (res: any) => {
                    if (res.sent) {
                      toast.success(`Daily digest sent — ${res.count} overdue task${res.count !== 1 ? "s" : ""} reported.`);
                    } else {
                      toast.info(res.reason ?? "Digest not sent.");
                    }
                  },
                  onError: (e: any) => toast.error(e.message),
                })}
                disabled={sendDigest.isPending}
                className="gap-2 flex-1 sm:flex-none"
              >
                {sendDigest.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Send Now
              </Button>
            </div>
          </div>

          {/* Schedule time picker */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Automatic Send Time</p>
              {scheduleData && !scheduleDirty && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary ml-auto">
                  {formatTime(scheduleData.hour, scheduleData.minute)} daily
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Hour picker */}
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1.5">Hour</p>
                <Select
                  value={String(scheduleHour)}
                  onValueChange={(v) => {
                    setScheduleHour(Number(v));
                    setScheduleDirty(true);
                  }}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatTime(h, 0).replace(":00 ", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Minute picker */}
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1.5">Minute</p>
                <Select
                  value={String(scheduleMinute)}
                  onValueChange={(v) => {
                    setScheduleMinute(Number(v));
                    setScheduleDirty(true);
                  }}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Save button */}
              <div className="pt-5">
                <Button
                  size="sm"
                  className="gap-1.5 h-9"
                  disabled={!scheduleDirty || setSchedule.isPending}
                  onClick={() => setSchedule.mutate(
                { hour: scheduleHour, minute: scheduleMinute },
                {
                  onSuccess: (res: any) => {
                    toast.success(`Digest schedule updated to ${formatTime(res.hour, res.minute)} daily.`);
                    setScheduleDirty(false);
                  },
                  onError: (e: any) => toast.error(e.message),
                }
              )}
                >
                  {setSchedule.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              The digest will be sent at{" "}
              <span className="font-medium text-foreground">
                {formatTime(scheduleHour, scheduleMinute)}
              </span>{" "}
              each day. Changes take effect on the next scheduled run.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Notifications are delivered via the Manus notification system to the account owner.
            If there are no overdue tasks, no notification will be sent.
          </p>
        </CardContent>
      </Card>

      {/* Due-Date Reminders */}
      <Card className="bg-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Due-Date Reminders
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Targeted notifications are sent automatically when a task is approaching its due date.
            Each task is notified only once per day to avoid duplicate alerts.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Due soon count + manual trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-muted/40 border border-border">
            <div>
              <p className="text-sm font-medium">
                Tasks due within {dueSoonData?.windowHours ?? reminderWindowHours}h
              </p>
              <p className="text-2xl font-bold text-amber-500 mt-0.5">
                {dueSoonData?.count ?? 0}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">
                  task{(dueSoonData?.count ?? 0) !== 1 ? "s" : ""} due soon
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Reminders are checked hourly and sent automatically.
              </p>
            </div>
            <Button
              onClick={() => sendDueRemindersNow.mutate(undefined, {
                onSuccess: (res: any) => {
                  if (res.sent > 0) {
                    toast.success(`Sent ${res.sent} due-date reminder${res.sent !== 1 ? "s" : ""}. ${res.skipped > 0 ? `${res.skipped} already notified today.` : ""}`);
                  } else if (res.skipped > 0) {
                    toast.info(`All ${res.skipped} due-soon task${res.skipped !== 1 ? "s" : ""} already notified today.`);
                  } else {
                    toast.info(`No tasks due within ${reminderWindowHours}h.`);
                  }
                },
                onError: (e: any) => toast.error(e.message),
              })}
              disabled={sendDueRemindersNow.isPending}
              variant="outline"
              className="gap-2 sm:shrink-0"
            >
              {sendDueRemindersNow.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Timer className="h-4 w-4" />
              )}
              Send Now
            </Button>
          </div>

          {/* Reminder window picker */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Reminder Window</p>
              {reminderWindowData && !reminderWindowDirty && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary ml-auto">
                  {reminderWindowData.hours}h before due
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              How far in advance to send a reminder. Tasks entering this window will be notified on the next hourly check.
            </p>
            <div className="flex items-center gap-3">
              <Select
                value={String(reminderWindowHours)}
                onValueChange={(v) => {
                  setReminderWindowHours(Number(v));
                  setReminderWindowDirty(true);
                }}
              >
                <SelectTrigger className="h-9 text-sm bg-background flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 hours before due</SelectItem>
                  <SelectItem value="12">12 hours before due</SelectItem>
                  <SelectItem value="24">24 hours before due</SelectItem>
                  <SelectItem value="48">48 hours before due</SelectItem>
                  <SelectItem value="72">72 hours before due</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="gap-1.5 h-9 shrink-0"
                disabled={!reminderWindowDirty || setReminderWindow.isPending}
                onClick={() => setReminderWindow.mutate(
                  { hours: reminderWindowHours },
                  {
                    onSuccess: (res: any) => {
                      toast.success(`Reminder window updated to ${res.hours} hour${res.hours !== 1 ? "s" : ""}.`);
                      setReminderWindowDirty(false);
                    },
                    onError: (e: any) => toast.error(e.message),
                  }
                )}
              >
                {setReminderWindow.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary Report */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Weekly Summary Report
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            A Monday-morning digest covering Project health (status breakdown + overdue milestones per Project),
            To-Dos completed last week, still overdue, and newly created.
            Sent automatically every Monday at the configured time.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Send now */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-muted/40 border border-border">
            <div>
              <p className="text-sm font-medium">Manual trigger</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send the weekly summary right now, regardless of schedule.
              </p>
            </div>
            <Button
              onClick={() => sendWeeklyReportNow.mutate(undefined, {
                onSuccess: () => toast.success("Weekly summary report sent!"),
                onError: (e: any) => toast.error(e.message),
              })}
              disabled={sendWeeklyReportNow.isPending}
              variant="outline"
              className="gap-2 sm:shrink-0"
            >
              {sendWeeklyReportNow.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              Send Weekly Digest Now
            </Button>
          </div>
          {/* Schedule picker */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Monday Send Time</p>
              {weeklyScheduleData && !weeklyDirty && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary ml-auto">
                  Mondays at {formatTime(weeklyScheduleData.hour, weeklyScheduleData.minute)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={String(weeklyHour)}
                onValueChange={(v) => { setWeeklyHour(Number(v)); setWeeklyDirty(true); }}
              >
                <SelectTrigger className="h-9 text-sm bg-background flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(weeklyMinute)}
                onValueChange={(v) => { setWeeklyMinute(Number(v)); setWeeklyDirty(true); }}
              >
                <SelectTrigger className="h-9 text-sm bg-background w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 15, 30, 45].map((m) => (
                    <SelectItem key={m} value={String(m)}>:{String(m).padStart(2, "0")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="gap-1.5 h-9 shrink-0"
                disabled={!weeklyDirty || setWeeklySchedule.isPending}
                onClick={() => setWeeklySchedule.mutate(
                  { hour: weeklyHour, minute: weeklyMinute },
                  {
                    onSuccess: (res: any) => {
                      toast.success(`Weekly report schedule updated to ${formatTime(res.hour, res.minute)} on Mondays.`);
                      setWeeklyDirty(false);
                    },
                    onError: (e: any) => toast.error(e.message),
                  }
                )}
              >
                {setWeeklySchedule.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm role change */}
      <AlertDialog open={!!roleChange} onOpenChange={(v) => !v && setRoleChange(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {roleChange?.newRole === "admin" ? "Promote to Admin" : "Demote to User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleChange?.newRole === "admin"
                ? `Grant admin privileges to ${roleChange?.name}? They will have full access to all projects, tasks, and user management.`
                : `Remove admin privileges from ${roleChange?.name}? They will only have regular user access.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                roleChange && updateRole.mutate(
                  { id: roleChange.id, role: roleChange.newRole },
                  {
                    onSuccess: () => { toast.success("Role updated"); setRoleChange(null); },
                    onError: (e: any) => toast.error(e.message),
                  }
                )
              }
              className={roleChange?.newRole === "admin" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {updateRole.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : roleChange?.newRole === "admin" ? (
                "Promote"
              ) : (
                "Demote"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Digest Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-card border-border max-w-lg w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-primary" />
              Digest Preview
            </DialogTitle>
          </DialogHeader>

          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !previewData || previewData.count === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-medium">No overdue tasks</p>
              <p className="text-sm text-muted-foreground">
                There are currently no overdue tasks. No digest would be sent if triggered now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary header */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm font-medium text-destructive">
                  {previewData.count} overdue task{previewData.count !== 1 ? "s" : ""} would be reported
                </p>
              </div>

              {/* Grouped by Project */}
              <ScrollArea className="max-h-80">
                <div className="space-y-3 pr-1">
                  {previewData.projects.map((project) => (
                    <div key={project.projectName} className="rounded-lg border border-border overflow-hidden">
                      <div className="px-3 py-2 bg-muted/40 border-b border-border">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          📁 {project.projectName}
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 ml-auto">
                            {project.tasks.length}
                          </Badge>
                        </p>
                      </div>
                      <div className="divide-y divide-border/50">
                        {project.tasks.map((t) => {
                          const dueStr = t.dueDate
                            ? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : null;
                          const priorityClass = PRIORITY_COLORS[t.priority ?? "medium"] ?? PRIORITY_COLORS.medium;
                          return (
                            <div key={t.id} className="px-3 py-2 flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{t.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {dueStr && (
                                    <span className="text-[11px] text-destructive font-medium">Due {dueStr}</span>
                                  )}
                                  {t.assigneeName && (
                                    <span className="text-[11px] text-muted-foreground">→ {t.assigneeName}</span>
                                  )}
                                </div>
                              </div>
                              {t.priority && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${priorityClass}`}>
                                  {t.priority.toUpperCase()}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={sendDigest.isPending}
                  onClick={() => {
                    sendDigest.mutate(undefined, {
                      onSuccess: (res: any) => {
                        if (res.sent) {
                          toast.success(`Daily digest sent — ${res.count} overdue task${res.count !== 1 ? "s" : ""} reported.`);
                        } else {
                          toast.info(res.reason ?? "Digest not sent.");
                        }
                      },
                      onError: (e: any) => toast.error(e.message),
                    });
                    setPreviewOpen(false);
                  }}
                >
                  {sendDigest.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Bell className="h-3.5 w-3.5" />
                  )}
                  Send Now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

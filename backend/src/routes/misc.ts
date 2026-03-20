import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requireOrg } from "../middleware/org";
import {
  getSubtaskById, toggleSubtask, deleteSubtask,
  getCommentById, deleteComment,
  getMilestoneById, updateMilestone, toggleMilestone, deleteMilestone, getMilestonesForCalendar,
  isProjectMember,
  getDashboardStats,
  getStrategicOrganizer, upsertStrategicOrganizer, saveStrategicOrganizerVersion,
  listStrategicOrganizerVersions, getStrategicOrganizerVersion, deleteStrategicOrganizerVersion,
  listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  deleteRockComment, getRockCommentById,
  getOverdueTasks, getTasksDueSoon, getSystemSetting, setSystemSetting,
} from "../db";

export const subtasksRouter = Router();

// PATCH /api/subtasks/:id
subtasksRouter.patch("/:id", requireAuth, async (req, res) => {
  const { completed } = req.body;
  try {
    await toggleSubtask(Number(req.params.id), completed);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/subtasks/:id
subtasksRouter.delete("/:id", requireAuth, async (req, res) => {
  try {
    await deleteSubtask(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
export const commentsRouter = Router();

// DELETE /api/comments/:id
commentsRouter.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const comment = await getCommentById(Number(req.params.id));
    if (!comment) return res.status(404).json({ message: "Not found" });
    if ((comment as any).authorId !== user.id && user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await deleteComment(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
export const milestonesRouter = Router();

// GET /api/milestones
milestonesRouter.get("/", requireAuth, requireOrg, async (req, res) => {
  const user = (req as any).user;
  const org = (req as any).org;
  if (req.query.calendar === "true") {
    return res.json(await getMilestonesForCalendar(user.id, user.role === "admin", org.id));
  }
  res.json([]);
});

// PATCH /api/milestones/:id
milestonesRouter.patch("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = Number(req.params.id);
  try {
    const milestone = await getMilestoneById(id);
    if (!milestone) return res.status(404).json({ message: "Not found" });
    const isMember = await isProjectMember((milestone as any).projectId, user.id);
    if (!isMember && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    await updateMilestone(id, req.body);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// PATCH /api/milestones/:id/toggle
milestonesRouter.patch("/:id/toggle", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = Number(req.params.id);
  const { completed } = req.body;
  try {
    const milestone = await getMilestoneById(id);
    if (!milestone) return res.status(404).json({ message: "Not found" });
    const isMember = await isProjectMember((milestone as any).projectId, user.id);
    if (!isMember && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    await toggleMilestone(id, completed);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/milestones/:id
milestonesRouter.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = Number(req.params.id);
  try {
    const milestone = await getMilestoneById(id);
    if (!milestone) return res.status(404).json({ message: "Not found" });
    const isMember = await isProjectMember((milestone as any).projectId, user.id);
    if (!isMember && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    await deleteMilestone(id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
export const dashboardRouter = Router();

dashboardRouter.get("/stats", requireAuth, requireOrg, async (req, res) => {
  const user = (req as any).user;
  const org = (req as any).org;
  try {
    res.json(await getDashboardStats(user.id, user.role === "admin", org.id));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
export const strategicOrganizerRouter = Router();

strategicOrganizerRouter.get("/versions", requireAuth, requireOrg, async (req, res) => {
  const org = (req as any).org;
  res.json(await listStrategicOrganizerVersions(org.id));
});

strategicOrganizerRouter.post("/versions/:id/restore", requireAuth, requireOrg, async (req, res) => {
  const user = (req as any).user;
  const org = (req as any).org;
  const version = await getStrategicOrganizerVersion(Number(req.params.id));
  if (!version) return res.status(404).json({ message: "Not found" });
  if ((version as any).organizationId !== org.id) return res.status(403).json({ message: "Forbidden" });
  const data = JSON.parse((version as any).snapshotJson);
  await upsertStrategicOrganizer({ ...data, organizationId: org.id, ownerId: user.id });
  res.json({ success: true });
});

strategicOrganizerRouter.delete("/versions/:id", requireAuth, requireOrg, async (req, res) => {
  const org = (req as any).org;
  const version = await getStrategicOrganizerVersion(Number(req.params.id));
  if (!version) return res.status(404).json({ message: "Not found" });
  if ((version as any).organizationId !== org.id) return res.status(403).json({ message: "Forbidden" });
  await deleteStrategicOrganizerVersion(Number(req.params.id));
  res.json({ success: true });
});

strategicOrganizerRouter.get("/", requireAuth, requireOrg, async (req, res) => {
  const org = (req as any).org;
  res.json(await getStrategicOrganizer(org.id));
});

strategicOrganizerRouter.post("/", requireAuth, requireOrg, async (req, res) => {
  const user = (req as any).user;
  const org = (req as any).org;
  const { saveVersion, versionLabel, ...data } = req.body;
  await upsertStrategicOrganizer({ ...data, organizationId: org.id, ownerId: user.id });
  if (saveVersion) {
    await saveStrategicOrganizerVersion({ organizationId: org.id, ownerId: user.id, snapshotJson: JSON.stringify(data), label: versionLabel });
  }
  res.json({ success: true });
});

// ────────────────────────────────────────────────────────────────────────────
export const announcementsRouter = Router();

announcementsRouter.get("/", requireOrg, async (req, res) => {
  const org = (req as any).org;
  res.json(await listAnnouncements(org.id));
});

announcementsRouter.post("/", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const user = (req as any).user;
  const org = (req as any).org;
  const { title, body, isPinned, expiresAt } = req.body;
  res.status(201).json(await createAnnouncement({ organizationId: org.id, title, body, isPinned: isPinned ?? false, authorId: user.id, expiresAt: expiresAt ?? null }));
});

announcementsRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  await updateAnnouncement(Number(req.params.id), req.body);
  res.json({ success: true });
});

announcementsRouter.patch("/:id/pin", requireAuth, requireAdmin, async (req, res) => {
  const { isPinned } = req.body;
  await updateAnnouncement(Number(req.params.id), { isPinned });
  res.json({ success: true });
});

announcementsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await deleteAnnouncement(Number(req.params.id));
  res.json({ success: true });
});

// ────────────────────────────────────────────────────────────────────────────
export const rockCommentsRouter = Router();

rockCommentsRouter.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const comment = await getRockCommentById(Number(req.params.id));
  if (!comment) return res.status(404).json({ message: "Not found" });
  if ((comment as any).authorId !== user.id && user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  await deleteRockComment(Number(req.params.id));
  res.json({ success: true });
});

// ────────────────────────────────────────────────────────────────────────────
export const notificationsRouter = Router();

notificationsRouter.get("/overdue-count", requireAuth, requireOrg, async (req, res) => {
  const org = (req as any).org;
  const overdue = await getOverdueTasks(org.id);
  res.json({ count: (overdue as any[]).length });
});

notificationsRouter.get("/schedule", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  const raw = await getSystemSetting("digest_schedule", org.id);
  if (!raw) return res.json({ hour: 8, minute: 0 });
  try { res.json(JSON.parse(raw)); } catch { res.json({ hour: 8, minute: 0 }); }
});

notificationsRouter.post("/schedule", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  const { hour, minute } = req.body;
  await setSystemSetting("digest_schedule", JSON.stringify({ hour, minute }), org.id);
  res.json({ success: true, hour, minute });
});

notificationsRouter.get("/reminder-window", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  const raw = await getSystemSetting("reminder_window_hours", org.id);
  const hours = raw ? parseInt(raw, 10) : 24;
  res.json({ hours: isNaN(hours) ? 24 : hours });
});

notificationsRouter.post("/reminder-window", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  await setSystemSetting("reminder_window_hours", String(req.body.hours), org.id);
  res.json({ success: true, hours: req.body.hours });
});

notificationsRouter.get("/due-soon-count", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  const raw = await getSystemSetting("reminder_window_hours", org.id);
  const windowHours = raw ? parseInt(raw, 10) : 24;
  const windowMs = (isNaN(windowHours) ? 24 : windowHours) * 60 * 60 * 1000;
  const tasks = await getTasksDueSoon(windowMs, org.id);
  res.json({ count: (tasks as any[]).length, windowHours: isNaN(windowHours) ? 24 : windowHours });
});

notificationsRouter.get("/preview-digest", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  const overdue = await getOverdueTasks(org.id);
  if ((overdue as any[]).length === 0) return res.json({ count: 0, rocks: [] });
  const byProject: Record<string, any[]> = {};
  for (const row of overdue as any[]) {
    const rockName = row.project?.name ?? "No Rock";
    if (!byProject[rockName]) byProject[rockName] = [];
    byProject[rockName].push(row);
  }
  const rocks = Object.entries(byProject).map(([rockName, rows]) => ({
    rockName,
    tasks: rows.map(({ task, assignee }: any) => ({ id: task.id, title: task.title, priority: task.priority, dueDate: task.dueDate, assigneeName: assignee?.name ?? null })),
  }));
  res.json({ count: (overdue as any[]).length, rocks });
});

notificationsRouter.post("/send-digest", requireAuth, requireAdmin, async (_req, res) => {
  res.json({ sent: false, reason: "Notification service not configured", count: 0 });
});

notificationsRouter.post("/send-reminders", requireAuth, requireAdmin, async (_req, res) => {
  res.json({ sent: 0, failed: 0 });
});

notificationsRouter.get("/weekly-report-schedule", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  const raw = await getSystemSetting("weekly_report_schedule", org.id);
  if (!raw) return res.json({ hour: 8, minute: 0 });
  try { res.json(JSON.parse(raw)); } catch { res.json({ hour: 8, minute: 0 }); }
});

notificationsRouter.post("/weekly-report-schedule", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  const { hour, minute } = req.body;
  await setSystemSetting("weekly_report_schedule", JSON.stringify({ hour, minute }), org.id);
  res.json({ success: true, hour, minute });
});

notificationsRouter.post("/send-weekly-report", requireAuth, requireAdmin, async (_req, res) => {
  res.json({ success: true });
});

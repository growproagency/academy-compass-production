import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getTaskById, getTasksByProject, listAllTasks, getTasksForCalendar, listArchivedTasks,
  createTask, updateTask, deleteTask, archiveTask, restoreTask, reorderTask, searchTasks,
  getSubtasksByTask, getSubtaskById, createSubtask, toggleSubtask, deleteSubtask,
  getCommentsByTask, createComment, deleteComment, getCommentById,
  getSubtaskCountsByTasks, getProjectById, isProjectMember, spawnNextRecurrence,
  createActivityEntry, getAllUsers, getUserById,
} from "../db";

const router = Router();

// Helper
async function canAccessTask(task: any, userId: number, role: string) {
  if (role === "admin") return true;
  if (task.creatorId === userId || task.assigneeId === userId) return true;
  if (task.projectId) {
    return isProjectMember(task.projectId, userId);
  }
  return false;
}

// GET /api/tasks
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    if (req.query.archived === "true") {
      return res.json(await listArchivedTasks(user.id, user.role === "admin"));
    }
    if (req.query.calendar === "true") {
      return res.json(await getTasksForCalendar(user.id, user.role === "admin"));
    }
    if (req.query.projectId) {
      const projectId = Number(req.query.projectId);
      const isMember = await isProjectMember(projectId, user.id);
      if (!isMember && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      return res.json(await getTasksByProject(projectId));
    }
    const taskList = await listAllTasks(user.id, user.role === "admin");
    if (taskList.length === 0) return res.json([]);
    const taskIds = taskList.map((t: any) => t.id);
    const subtaskCounts = await getSubtaskCountsByTasks(taskIds);
    return res.json(taskList.map((t: any) => ({
      ...t,
      subtaskTotal: (subtaskCounts as Map<number, any>).get(t.id)?.total ?? 0,
      subtaskDone: (subtaskCounts as Map<number, any>).get(t.id)?.done ?? 0,
    })));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/tasks/search
router.get("/search", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const query = String(req.query.q || "").trim();
  if (query.length < 2) return res.json([]);
  try {
    res.json(await searchTasks(query, user.id, user.role === "admin"));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/tasks/:id
router.get("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const task = await getTaskById(Number(req.params.id));
    if (!task) return res.status(404).json({ message: "Not found" });
    const ok = await canAccessTask(task, user.id, user.role);
    if (!ok) return res.status(403).json({ message: "Forbidden" });
    res.json(task);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/tasks
router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { title, description, notes, projectId, assigneeId, status, priority, dueDate,
    recurrenceType, recurrenceInterval, recurrenceEndsAt, subtasks } = req.body;
  if (!title) return res.status(400).json({ message: "Title required" });
  try {
    const task = await createTask({
      title, description: description ?? null, notes: notes ?? null,
      projectId: projectId ?? null, assigneeId: assigneeId ?? null, creatorId: user.id,
      status: status ?? "todo", priority: priority ?? "medium", dueDate: dueDate ?? null,
      recurrenceType: recurrenceType ?? "none", recurrenceInterval: recurrenceInterval ?? 1,
      recurrenceEndsAt: recurrenceEndsAt ?? null,
    } as any);
    if (subtasks?.length && task) {
      for (let i = 0; i < subtasks.length; i++) {
        await createSubtask({ taskId: (task as any).id, title: subtasks[i], completed: false, position: i });
      }
    }
    res.status(201).json(task);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /api/tasks/:id
router.patch("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = Number(req.params.id);
  try {
    const task = await getTaskById(id);
    if (!task) return res.status(404).json({ message: "Not found" });
    const ok = await canAccessTask(task, user.id, user.role);
    if (!ok) return res.status(403).json({ message: "Forbidden" });

    await updateTask(id, req.body as any);

    // Activity log: status change
    const { status } = req.body;
    if (status && status !== (task as any).status) {
      const labels: Record<string, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };
      await createActivityEntry(id, user.id, `moved this task from **${labels[(task as any).status] ?? (task as any).status}** to **${labels[status] ?? status}**`);
    }
    // Activity log: assignee change
    const { assigneeId } = req.body;
    if (assigneeId !== undefined && assigneeId !== (task as any).assigneeId) {
      if (assigneeId === null) {
        await createActivityEntry(id, user.id, `removed the assignee`);
      } else {
        const newAssignee = await getUserById(assigneeId);
        await createActivityEntry(id, user.id, `assigned this task to **${newAssignee?.name ?? `User #${assigneeId}`}**`);
      }
    }
    // Spawn recurrence
    if (status === "done" && (task as any).recurrenceType !== "none") {
      const updated = await getTaskById(id);
      if (updated) await spawnNextRecurrence(updated as any);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /api/tasks/:id/reorder
router.patch("/:id/reorder", requireAuth, async (req, res) => {
  const { sortOrder } = req.body;
  try {
    await reorderTask(Number(req.params.id), sortOrder);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/tasks/:id/archive
router.post("/:id/archive", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = Number(req.params.id);
  try {
    const task = await getTaskById(id);
    if (!task) return res.status(404).json({ message: "Not found" });
    const project = (task as any).projectId ? await getProjectById((task as any).projectId) : null;
    const ok = (task as any).creatorId === user.id || (project as any)?.ownerId === user.id || user.role === "admin";
    if (!ok) return res.status(403).json({ message: "Forbidden" });
    await archiveTask(id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/tasks/:id/restore
router.post("/:id/restore", requireAuth, async (req, res) => {
  if ((req as any).user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  try {
    await restoreTask(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = Number(req.params.id);
  try {
    const task = await getTaskById(id);
    if (!task) return res.status(404).json({ message: "Not found" });
    const project = (task as any).projectId ? await getProjectById((task as any).projectId) : null;
    const ok = (task as any).creatorId === user.id || (project as any)?.ownerId === user.id || user.role === "admin";
    if (!ok) return res.status(403).json({ message: "Forbidden" });
    await deleteTask(id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/tasks/:id/permanent
router.delete("/:id/permanent", requireAuth, async (req, res) => {
  if ((req as any).user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  try {
    await deleteTask(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/tasks/bulk-delete
router.post("/bulk-delete", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ message: "ids must be an array" });
  let deleted = 0, forbidden = 0;
  for (const id of ids) {
    const task = await getTaskById(id);
    if (!task) continue;
    const project = (task as any).projectId ? await getProjectById((task as any).projectId) : null;
    const ok = (task as any).creatorId === user.id || (project as any)?.ownerId === user.id || user.role === "admin";
    if (!ok) { forbidden++; continue; }
    await archiveTask(id);
    deleted++;
  }
  if (forbidden > 0 && deleted === 0) return res.status(403).json({ message: "No permission" });
  res.json({ deleted, forbidden });
});

// ── Subtasks ──────────────────────────────────────────────────────────────────

// GET /api/tasks/:id/subtasks
router.get("/:id/subtasks", requireAuth, async (req, res) => {
  try {
    res.json(await getSubtasksByTask(Number(req.params.id)));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/tasks/:id/subtasks
router.post("/:id/subtasks", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  const { title } = req.body;
  try {
    const existing = await getSubtasksByTask(taskId);
    const sub = await createSubtask({ taskId, title, completed: false, position: (existing as any[]).length });
    res.status(201).json(sub);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Comments ──────────────────────────────────────────────────────────────────

// GET /api/tasks/:id/comments
router.get("/:id/comments", requireAuth, async (req, res) => {
  try {
    res.json(await getCommentsByTask(Number(req.params.id)));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/tasks/:id/comments
router.post("/:id/comments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const taskId = Number(req.params.id);
  const { content } = req.body;
  try {
    const comment = await createComment({ taskId, authorId: user.id, content } as any);
    res.status(201).json(comment);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;

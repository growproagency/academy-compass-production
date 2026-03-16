import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { getAllUsers, getUserById, updateUserRole, getUserScorecard, listAllTasks } from "../db";

const router = Router();

// GET /api/users
router.get("/", requireAuth, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/users/me/tasks
router.get("/me/tasks", requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const tasks = await listAllTasks(user.id, false);
    res.json(tasks);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/users/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /api/users/:id/role
router.patch("/:id/role", requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }
  try {
    await updateUserRole(Number(req.params.id), role);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/users/:id/scorecard
router.get("/:id/scorecard", requireAuth, async (req, res) => {
  const requestingUser = (req as any).user;
  const targetId = Number(req.params.id);
  if (requestingUser.role !== "admin" && requestingUser.id !== targetId) {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    const scorecard = await getUserScorecard(targetId);
    if (!scorecard) return res.status(404).json({ message: "Not found" });
    res.json(scorecard);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;

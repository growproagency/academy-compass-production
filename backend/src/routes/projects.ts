import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/org";
import {
  getAllProjects, getAllProjectsWithOwner, getProjectById, createProject, updateProject,
  deleteProject, getProjectsForUser, getProjectsForUserWithOwner, getProjectMembers,
  addProjectMember, removeProjectMember, isProjectMember, getProjectTaskCounts,
  getProjectHealthTrend, getMilestonesByProject, createMilestone, getMilestoneById,
  updateMilestone, toggleMilestone, deleteMilestone, getProjectComments, createProjectComment,
  deleteProjectComment, getProjectCommentById,
} from "../db";

const router = Router();

// GET /api/projects
router.get("/", requireAuth, requireOrg, async (req, res) => {
  const user = (req as any).user;
  const org = (req as any).org;
  try {
    if (req.query.stats === "true") {
      const projectList = user.role === "admin"
        ? await getAllProjectsWithOwner(org.id)
        : await getProjectsForUserWithOwner(user.id, org.id);
      const ids = projectList.map((p: any) => p.id);
      const counts = await getProjectTaskCounts(ids);
      return res.json(projectList.map((p: any) => ({
        ...p,
        taskTotal: counts[p.id]?.total ?? 0,
        taskDone: counts[p.id]?.done ?? 0,
      })));
    }
    const projects = user.role === "admin"
      ? await getAllProjects(org.id)
      : await getProjectsForUser(user.id, org.id);
    res.json(projects);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/projects/health-trend
router.get("/health-trend", requireAuth, requireOrg, async (req, res) => {
  const org = (req as any).org;
  try {
    res.json(await getProjectHealthTrend(8, org.id));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/projects/:id
router.get("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = Number(req.params.id);
  try {
    if (user.role !== "admin") {
      const member = await isProjectMember(id, user.id);
      const project = await getProjectById(id);
      if (project?.ownerId !== user.id && !member) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }
    const project = await getProjectById(id);
    if (!project) return res.status(404).json({ message: "Not found" });
    res.json(project);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/projects
router.post("/", requireAuth, requireOrg, async (req, res) => {
  const user = (req as any).user;
  const org = (req as any).org;
  const { name, description, dueDate, projectStatus } = req.body;
  if (!name) return res.status(400).json({ message: "Name is required" });
  try {
    const project = await createProject({
      name,
      description: description ?? null,
      dueDate: dueDate ?? null,
      projectStatus: projectStatus ?? "on_track",
      ownerId: user.id,
      organizationId: org.id,
    });
    res.status(201).json(project);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /api/projects/:id
router.patch("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = Number(req.params.id);
  try {
    const project = await getProjectById(id);
    if (!project) return res.status(404).json({ message: "Not found" });
    if (project.ownerId !== user.id && user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await updateProject(id, req.body);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/projects/:id
router.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = Number(req.params.id);
  try {
    const project = await getProjectById(id);
    if (!project) return res.status(404).json({ message: "Not found" });
    if (project.ownerId !== user.id && user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await deleteProject(id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Members ──────────────────────────────────────────────────────────────────

// GET /api/projects/:id/members
router.get("/:id/members", requireAuth, async (req, res) => {
  try {
    res.json(await getProjectMembers(Number(req.params.id)));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/projects/:id/members
router.post("/:id/members", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const projectId = Number(req.params.id);
  const { userId } = req.body;
  try {
    const project = await getProjectById(projectId);
    if (!project) return res.status(404).json({ message: "Not found" });
    if (project.ownerId !== user.id && user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await addProjectMember({ projectId, userId });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/projects/:id/members/:userId
router.delete("/:id/members/:userId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const projectId = Number(req.params.id);
  const userId = Number(req.params.userId);
  try {
    const project = await getProjectById(projectId);
    if (!project) return res.status(404).json({ message: "Not found" });
    if (project.ownerId !== user.id && user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await removeProjectMember(projectId, userId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Milestones ────────────────────────────────────────────────────────────────

// GET /api/projects/:id/milestones
router.get("/:id/milestones", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const projectId = Number(req.params.id);
  try {
    const isMember = await isProjectMember(projectId, user.id);
    if (!isMember && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    res.json(await getMilestonesByProject(projectId));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/projects/:id/milestones
router.post("/:id/milestones", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const projectId = Number(req.params.id);
  const { title, description, dueDate } = req.body;
  try {
    const isMember = await isProjectMember(projectId, user.id);
    if (!isMember && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const milestone = await createMilestone({ projectId, title, description: description ?? null, dueDate: dueDate ?? null });
    res.status(201).json({ id: (milestone as any)?.id });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Project Comments ──────────────────────────────────────────────────────────

// GET /api/projects/:id/project-comments
router.get("/:id/project-comments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const projectId = Number(req.params.id);
  try {
    const isMember = await isProjectMember(projectId, user.id);
    if (!isMember && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    res.json(await getProjectComments(projectId));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/projects/:id/project-comments
router.post("/:id/project-comments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const projectId = Number(req.params.id);
  const { content } = req.body;
  try {
    const isMember = await isProjectMember(projectId, user.id);
    if (!isMember && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const comment = await createProjectComment({ projectId, authorId: user.id, content });
    res.status(201).json({ id: (comment as any)?.id });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;

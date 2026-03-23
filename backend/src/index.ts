import "dotenv/config";

import express from "express";
import { orgMiddleware } from "./middleware/org";
import { authMiddleware } from "./middleware/auth";

import cors from "cors";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import projectsRouter from "./routes/projects";
import tasksRouter from "./routes/tasks";
import orgsRouter from "./routes/orgs";
import invitesRouter from "./routes/invites";
import {
  subtasksRouter,
  commentsRouter,
  milestonesRouter,
  dashboardRouter,
  strategicOrganizerRouter,
  announcementsRouter,
  projectCommentsRouter,
  notificationsRouter,
} from "./routes/misc";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

// Org middleware runs first — resolves req.org from subdomain / X-Org-Slug header
app.use(orgMiddleware);
// Auth middleware runs second — resolves req.user and assigns org on first login
app.use(authMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/orgs", orgsRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/subtasks", subtasksRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/milestones", milestonesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/strategic-organizer", strategicOrganizerRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/project-comments", projectCommentsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/invites", invitesRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});

export default app;

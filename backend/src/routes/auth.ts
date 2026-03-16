import { Router } from "express";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json(null);
  res.json(user);
});

// POST /api/auth/logout — nothing to do server-side; JWT is stateless
// Client handles sign-out with Supabase SDK
router.post("/logout", (_req, res) => {
  res.json({ success: true });
});

export default router;

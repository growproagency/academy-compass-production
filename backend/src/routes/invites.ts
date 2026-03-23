import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requireOrg } from "../middleware/org";
import { createInvite, listInvites, deleteInvite } from "../db";
import { supabase } from "../supabase";

const router = Router();

// GET /api/invites — list pending invites for the org (admin only)
router.get("/", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  try {
    const invites = await listInvites(org.id);
    res.json(invites);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/invites — send an invite (admin only)
router.post("/", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const user = (req as any).user;
  const org = (req as any).org;
  const { email, role = "user" } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });
  if (!["user", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role" });

  try {
    // Send invite via Supabase Auth — this emails the user a magic signup link.
    // We embed organizationId and role in user_metadata so auth middleware can
    // pick them up and assign the org/role when the user first logs in.
    const redirectTo = `${process.env.FRONTEND_URL}/auth/callback`;
    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { organizationId: org.id, role },
    });

    if (error) {
      // "User already registered" just means they have an account — still record the invite
      if (!error.message.includes("already")) {
        return res.status(400).json({ message: error.message });
      }
    }

    // Record the invite in our DB for display in the admin panel
    const invite = await createInvite({
      organizationId: org.id,
      email,
      role: role as "user" | "admin",
      invitedBy: user.id,
    });

    res.status(201).json(invite);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/invites/:id — revoke a pending invite (admin only)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await deleteInvite(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;

import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requireOrg } from "../middleware/org";
import {
  createInvite, listInvites, deleteInvite,
  createInviteLink, listInviteLinks, deleteInviteLink,
  getInviteLink, markInviteLinkUsed,
} from "../db";
import { supabase } from "../supabase";

const router = Router();

// ── Email invites (legacy, kept for backward compat) ──────────────────────────

// GET /api/invites — list pending email invites (admin only)
router.get("/", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  try {
    const invites = await listInvites(org.id);
    res.json(invites);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/invites/:id — revoke a pending email invite (admin only)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await deleteInvite(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Invite Links ──────────────────────────────────────────────────────────────

// GET /api/invites/links — list active invite links (admin only)
router.get("/links", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const org = (req as any).org;
  try {
    res.json(await listInviteLinks(org.id));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/invites/links — generate a new invite link (admin only)
router.post("/links", requireAuth, requireAdmin, requireOrg, async (req, res) => {
  const user = (req as any).user;
  const org = (req as any).org;
  const { role = "user", expiresInDays } = req.body;

  if (!["user", "admin"].includes(role))
    return res.status(400).json({ message: "Invalid role" });

  const expiresAt = expiresInDays
    ? Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000
    : null;

  try {
    const link = await createInviteLink({ organizationId: org.id, role, invitedBy: user.id, expiresAt });
    res.status(201).json(link);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/invites/links/:id — revoke an invite link (admin only)
router.delete("/links/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await deleteInviteLink(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Public invite endpoints (no auth required) ────────────────────────────────

// GET /api/invites/join/:token — validate token, return org name + role
router.get("/join/:token", async (req, res) => {
  try {
    const link = await getInviteLink(req.params.token);
    if (!link) return res.status(404).json({ message: "Invite link not found or already used" });
    if (link.usedAt) return res.status(410).json({ message: "This invite link has already been used" });
    if (link.expiresAt && link.expiresAt < Date.now())
      return res.status(410).json({ message: "This invite link has expired" });

    res.json({
      role: link.role,
      orgName: link.organizations?.name ?? "your organization",
      orgSlug: link.organizations?.slug ?? "",
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/invites/join/:token — sign up using an invite link
router.post("/join/:token", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "Name, email, and password are required" });
  if (password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters" });

  try {
    const link = await getInviteLink(req.params.token);
    if (!link) return res.status(404).json({ message: "Invite link not found" });
    if (link.usedAt) return res.status(410).json({ message: "This invite link has already been used" });
    if (link.expiresAt && link.expiresAt < Date.now())
      return res.status(410).json({ message: "This invite link has expired" });

    // Create Supabase auth user — email_confirm: true skips the confirmation email entirely
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        organizationId: link.organizationId,
        role: link.role,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      return res.status(400).json({ message: error.message });
    }

    // Mark the link as used
    await markInviteLinkUsed(req.params.token, email);

    res.status(201).json({ success: true, userId: data.user?.id });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;

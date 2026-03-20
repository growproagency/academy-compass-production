import { Router } from "express";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { listOrgs, createOrg, updateOrg, deleteOrg, getOrgById, getOrgBySlug } from "../db";

const router = Router();

// GET /api/orgs/current — public, resolves org from req.org (set by org middleware)
// Used by the frontend on load to get brand colors etc.
router.get("/current", async (req, res) => {
  const org = (req as any).org;
  if (!org) return res.status(404).json({ message: "Organization not found" });
  res.json(org);
});

// All routes below require superadmin

// GET /api/orgs
router.get("/", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    res.json(await listOrgs());
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/orgs
router.post("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const { name, slug, brandPrimaryColor, brandAccentColor, logoUrl } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ message: "name and slug are required" });
  }
  // Validate slug format: lowercase letters, numbers, hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ message: "slug must contain only lowercase letters, numbers, and hyphens" });
  }
  try {
    const existing = await getOrgBySlug(slug);
    if (existing) return res.status(409).json({ message: "An organization with this slug already exists" });
    const org = await createOrg({
      name,
      slug,
      brandPrimaryColor: brandPrimaryColor ?? null,
      brandAccentColor: brandAccentColor ?? null,
      logoUrl: logoUrl ?? null,
    });
    res.status(201).json(org);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /api/orgs/:id
router.patch("/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, slug, brandPrimaryColor, brandAccentColor, logoUrl } = req.body;
  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ message: "slug must contain only lowercase letters, numbers, and hyphens" });
  }
  try {
    const existing = await getOrgById(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (slug && slug !== existing.slug) {
      const conflict = await getOrgBySlug(slug);
      if (conflict) return res.status(409).json({ message: "An organization with this slug already exists" });
    }
    const updated = await updateOrg(id, {
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(brandPrimaryColor !== undefined && { brandPrimaryColor }),
      ...(brandAccentColor !== undefined && { brandAccentColor }),
      ...(logoUrl !== undefined && { logoUrl }),
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/orgs/:id
router.delete("/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await getOrgById(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    await deleteOrg(id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;

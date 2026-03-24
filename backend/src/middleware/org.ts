import type { Request, Response, NextFunction } from "express";
import { getOrgBySlug } from "../db";

/**
 * Resolves the organization from the request.
 *
 * Strategy:
 *  1. Read the `X-Org-Slug` header (sent by the frontend in all environments)
 *  2. Fall back to subdomain from the `Host` header (e.g. "school" from "school.app.com")
 *  3. Look up the org in the DB and attach it to `req.org`
 *
 * This middleware is non-blocking — if no org is found, `req.org` is null.
 * Routes that require an org should call `requireOrg` after this.
 */
export async function orgMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    let slug: string | null = null;

    // 1. Prefer X-Org-Slug header (sent by frontend in all environments)
    const headerSlug = req.headers["x-org-slug"];
    if (typeof headerSlug === "string" && headerSlug.trim()) {
      slug = headerSlug.trim();
    }

    // 2. Fall back to subdomain from Host header (e.g. "school" from "school.app.com")
    if (!slug) {
      const host = req.headers.host ?? "";
      const hostWithoutPort = host.split(":")[0];
      const parts = hostWithoutPort.split(".");
      if (parts.length >= 3) {
        slug = parts[0];
      }
    }

    if (slug) {
      const org = await getOrgBySlug(slug);
      (req as any).org = org ?? null;
    } else {
      (req as any).org = null;
    }

    next();
  } catch (err) {
    console.error("[org middleware]", err);
    (req as any).org = null;
    next();
  }
}

export function requireOrg(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).org) {
    return res.status(400).json({ message: "Organization not found. Check the subdomain." });
  }
  next();
}

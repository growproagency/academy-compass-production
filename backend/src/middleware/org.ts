import type { Request, Response, NextFunction } from "express";
import { getOrgBySlug } from "../db";

/**
 * Resolves the organization from the request.
 *
 * Strategy:
 *  1. Read the `Host` header and extract the subdomain (e.g. "school" from "school.app.com")
 *  2. Fall back to the `X-Org-Slug` header (used for local dev / testing)
 *  3. Look up the org in the DB and attach it to `req.org`
 *
 * This middleware is non-blocking — if no org is found, `req.org` is null.
 * Routes that require an org should call `requireOrg` after this.
 */
export async function orgMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    let slug: string | null = null;

    // 1. Try to extract subdomain from Host header
    const host = req.headers.host ?? "";
    const hostWithoutPort = host.split(":")[0];
    const parts = hostWithoutPort.split(".");
    // Only treat as subdomain if there are 3+ parts (e.g. school.app.com)
    if (parts.length >= 3) {
      slug = parts[0];
    }

    // 2. Fall back to X-Org-Slug header (for local dev / API testing)
    if (!slug) {
      const headerSlug = req.headers["x-org-slug"];
      if (typeof headerSlug === "string" && headerSlug.trim()) {
        slug = headerSlug.trim();
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

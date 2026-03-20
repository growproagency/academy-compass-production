import type { Request, Response, NextFunction } from "express";
import { supabase } from "../supabase";
import { getUserByOpenId, upsertUser } from "../db";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      (req as any).user = null;
      return next();
    }

    const token = authHeader.slice(7);
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      (req as any).user = null;
      return next();
    }

    // Resolve org from request (set by orgMiddleware which runs before authMiddleware)
    const org = (req as any).org ?? null;

    // Upsert user into our DB.
    // Only pass `name` on first creation — do NOT overwrite a user-set name on
    // subsequent logins (Supabase metadata is null for email/password accounts).
    // Assign organizationId from the org resolved by the subdomain on first login.
    const existingUser = await getUserByOpenId(supabaseUser.id);
    await upsertUser({
      openId: supabaseUser.id,
      email: supabaseUser.email ?? null,
      name: existingUser
        ? undefined  // preserve the existing name in the DB
        : (supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? null),
      loginMethod: supabaseUser.app_metadata?.provider ?? null,
      lastSignedIn: new Date(),
      // Assign org on first login; don't overwrite if already set
      organizationId: existingUser?.organizationId !== undefined
        ? undefined
        : (org?.id ?? null),
    } as any);

    const dbUser = await getUserByOpenId(supabaseUser.id);
    (req as any).user = dbUser;
    next();
  } catch (err) {
    console.error("[auth middleware]", err);
    (req as any).user = null;
    next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "superadmin") return res.status(403).json({ message: "Superadmin access required" });
  next();
}

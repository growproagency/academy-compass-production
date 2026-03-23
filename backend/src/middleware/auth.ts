import type { Request, Response, NextFunction } from "express";
import { supabase } from "../supabase";
import { getUserByOpenId, upsertUser, markInviteAccepted } from "../db";

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

    const existingUser = await getUserByOpenId(supabaseUser.id);
    const isFirstLogin = !existingUser;

    // For invited users, org + role are embedded in user_metadata by the invite route.
    // Fall back to subdomain-resolved org for non-invited sign-ups.
    const metaOrgId = supabaseUser.user_metadata?.organizationId as number | undefined;
    const metaRole = supabaseUser.user_metadata?.role as string | undefined;
    const resolvedOrgId = metaOrgId ?? org?.id ?? null;
    const resolvedRole = (metaRole === "admin" || metaRole === "user") ? metaRole : undefined;

    await upsertUser({
      openId: supabaseUser.id,
      email: supabaseUser.email ?? null,
      name: existingUser
        ? undefined  // preserve the existing name in the DB
        : (supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? null),
      loginMethod: supabaseUser.app_metadata?.provider ?? null,
      lastSignedIn: new Date(),
      // Assign org + role on first login only; never overwrite after that
      organizationId: existingUser?.organizationId !== undefined ? undefined : resolvedOrgId,
      role: existingUser ? undefined : (resolvedRole as any),
    } as any);

    // Mark invite as accepted on first login so it no longer shows as pending
    if (isFirstLogin && supabaseUser.email && resolvedOrgId) {
      await markInviteAccepted(supabaseUser.email, resolvedOrgId).catch(() => {/* no-op if no invite */});
    }

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
  if (user.role !== "admin" && user.role !== "superadmin") return res.status(403).json({ message: "Admin access required" });
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "superadmin") return res.status(403).json({ message: "Superadmin access required" });
  next();
}

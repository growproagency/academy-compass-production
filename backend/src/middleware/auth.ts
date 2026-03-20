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

    const existingUser = await getUserByOpenId(supabaseUser.id);
    await upsertUser({
      openId: supabaseUser.id,
      email: supabaseUser.email ?? null,
      name: existingUser
        ? undefined
        : (supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? null),
      loginMethod: supabaseUser.app_metadata?.provider ?? null,
      lastSignedIn: new Date(),
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

export function requireActive(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.status !== "active") {
    return res.status(403).json({
      message: "Account pending approval",
      code: "PENDING",
    });
  }
  next();
}
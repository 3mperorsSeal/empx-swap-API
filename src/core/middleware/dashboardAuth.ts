import { NextFunction, Request, Response } from "express";

// Simple dashboard auth: expects `Authorization: Bearer <secret>`
// The secret is provided via DASHBOARD_SECRET env var. This keeps the
// implementation minimal and avoids adding new deps (JWT libs).
export function dashboardAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.header("authorization") || req.header("Authorization") || "";
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ error: "missing_authorization" });
  const token = auth.slice(7).trim();
  const secret = process.env.DASHBOARD_SECRET || "";
  if (!secret || token !== secret)
    return res.status(403).json({ error: "forbidden" });
  // Minimal: attach a dashboardUser marker for downstream
  (req as any).dashboardUser = { admin: true };
  next();
}

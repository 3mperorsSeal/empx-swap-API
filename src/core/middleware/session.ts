import { NextFunction, Request, Response } from "express";
const jwt = require("jsonwebtoken");

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";

export function signToken(payload: object, opts: any = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: opts.expiresIn || "1h" });
}

export function sessionAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.header("authorization") || req.header("Authorization") || "";
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ error: "missing_authorization" });
  const token = auth.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "unauthenticated" });
    if (user.role !== role && user.role !== "admin")
      return res.status(403).json({ error: "forbidden" });
    next();
  };
}

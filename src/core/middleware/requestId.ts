import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

// Middleware: ensure every request has a requestId and it is sent on responses
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Prefer existing headers if client set one
  const headerId =
    (req.headers["x-request-id"] as string) ||
    (req.headers["x-requestid"] as string) ||
    null;

  const rid = headerId || uuidv4();
  req.requestId = rid;
  // Expose to downstream services via response header for correlation
  res.setHeader("X-Request-Id", rid);
  next();
}

export default requestIdMiddleware;

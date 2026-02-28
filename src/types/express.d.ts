import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      apiKey?: {
        id: number;
        key_prefix: string;
        tier: string;
        user_id: number | null;
      };
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

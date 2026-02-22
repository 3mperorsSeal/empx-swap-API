import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      apiKey?: {
        id: string;
        key_prefix: string;
        tier: string;
        user_id: string;
      };
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

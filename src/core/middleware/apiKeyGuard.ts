import { NextFunction, Request, Response } from "express";
import { ApiKeyService } from "../../services/apiKeyService";
import { AppError } from "../errors";
import { isDomainAllowed, isIpAllowed, originToHost } from "./ipWhitelist";

// --------------------
// Middleware
// --------------------

export async function apiKeyGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const apiKey = req.header("x-api-key");
  if (!apiKey) {
    return next(AppError.Unauthorized("missing_api_key", "Missing API key"));
  }

  // --------------------
  // Fetch API key policy from Service
  // --------------------

  const policy = await ApiKeyService.getPolicy(apiKey.slice(0, 8));

  if (!policy || policy.revoked) {
    return next(
      AppError.Unauthorized("invalid_api_key", "Invalid or revoked API key"),
    );
  }

  const allowedIps = policy.whitelisted_ips;
  const allowedDomains = policy.whitelisted_domains;

  // --------------------
  // Resolve Client IP
  // --------------------

  const rawIp =
    (req.headers["cf-connecting-ip"] as string | undefined) ||
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ||
    req.ip;

  if (!rawIp) {
    return next(
      AppError.BadRequest(
        "unable_to_resolve_ip",
        "Unable to determine client IP",
      ),
    );
  }

  if (allowedIps.length && !isIpAllowed(rawIp, allowedIps)) {
    return next(AppError.Forbidden("ip_not_allowed", "IP not allowed"));
  }

  // --------------------
  // Domain check (Browser only)
  // --------------------

  const origin = req.headers.origin;
  if (origin && allowedDomains.length) {
    const host = originToHost(origin);
    if (!host) {
      return next(
        AppError.BadRequest("invalid_origin", "Invalid origin header"),
      );
    }
    if (!isDomainAllowed(host, allowedDomains)) {
      return next(
        AppError.Forbidden("domain_not_allowed", "Domain not allowed"),
      );
    }
  }

  // Attach API key context (strict typing via src/types/express.d.ts)
  req.apiKey = {
    id: policy.id,
    key_prefix: policy.key_prefix,
    tier: policy.tier,
    user_id: policy.user_id,
  };

  next();
}

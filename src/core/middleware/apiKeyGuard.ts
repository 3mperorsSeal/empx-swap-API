import { NextFunction, Request, Response } from "express";
import ipaddr, { IPv4, IPv6 } from "ipaddr.js";
import { ApiKeyService } from "../../services/apiKeyService";
import { AppError } from "../errors";

// --------------------
// Helpers
// --------------------

function normalizeIp(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isIPv4(addr: ipaddr.IPv4 | ipaddr.IPv6): addr is IPv4 {
  return addr.kind() === "ipv4";
}

function isIPv6(addr: ipaddr.IPv4 | ipaddr.IPv6): addr is IPv6 {
  return addr.kind() === "ipv6";
}

function isIpAllowed(ip: string, allowed: string[]): boolean {
  try {
    const clientIp = ipaddr.parse(ip);

    return allowed.some((entry) => {
      if (entry.includes("/")) {
        const [rangeIp, bits] = ipaddr.parseCIDR(entry);

        if (isIPv4(clientIp) && isIPv4(rangeIp)) {
          return clientIp.match(rangeIp, bits);
        }

        if (isIPv6(clientIp) && isIPv6(rangeIp)) {
          return clientIp.match(rangeIp, bits);
        }

        return false;
      }

      return clientIp.toString() === entry;
    });
  } catch {
    return false;
  }
}

function isDomainAllowed(host: string, allowed: string[]): boolean {
  return allowed.some((rule) => {
    if (rule.startsWith("*.")) {
      return host.endsWith(rule.slice(1));
    }
    return host === rule;
  });
}

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

  const ip = normalizeIp(rawIp);

  if (allowedIps.length && !isIpAllowed(ip, allowedIps)) {
    return next(AppError.Forbidden("ip_not_allowed", "IP not allowed"));
  }

  // --------------------
  // Domain check (Browser only)
  // --------------------

  const origin = req.headers.origin;
  if (origin && allowedDomains.length) {
    try {
      const host = new URL(origin).hostname;
      if (!isDomainAllowed(host, allowedDomains)) {
        return next(
          AppError.Forbidden("domain_not_allowed", "Domain not allowed"),
        );
      }
    } catch {
      return next(
        AppError.BadRequest("invalid_origin", "Invalid origin header"),
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

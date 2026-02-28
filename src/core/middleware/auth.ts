import { NextFunction, Request, Response } from "express";
import { getApiKeyByPrefix, verifyApiKey } from "../../modules/auth/service";
import logger from "../logger";
import { isDomainAllowed, isIpAllowed, originToHost } from "./ipWhitelist";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = (req.header("x-api-key") ||
    req.header("X-API-KEY") ||
    "") as string;
  const rid = req.requestId || null;

  if (!header) {
    logger.warn("auth.missing_key", { requestId: rid, ip: req.ip });
    return res.status(401).json({ requestId: rid, error: "missing_api_key" });
  }

  // Dev convenience: accept TEST_KEY
  const testKey = process.env.TEST_KEY;
  if (testKey && header === testKey) {
    req.apiKey = { id: 0, key_prefix: "TEST", tier: "pro", user_id: null };
    return next();
  }

  const prefix = header.slice(0, 8);
  const record = await getApiKeyByPrefix(prefix);
  if (!record) {
    logger.warn("auth.invalid_prefix", { requestId: rid, ip: req.ip, prefix });
    return res.status(401).json({ requestId: rid, error: "invalid_api_key" });
  }
  if (record.revoked) {
    logger.warn("auth.revoked_key", {
      requestId: rid,
      ip: req.ip,
      prefix,
      apiKeyId: record.id,
    });
    return res.status(403).json({ requestId: rid, error: "api_key_revoked" });
  }

  const ok = await verifyApiKey(header, record.key_hash);
  if (!ok) {
    logger.warn("auth.invalid_signature", {
      requestId: rid,
      ip: req.ip,
      prefix,
      apiKeyId: record.id,
    });
    return res.status(401).json({ requestId: rid, error: "invalid_api_key" });
  }

  // attach key record for downstream middleware
  req.apiKey = record;
  // Whitelist checks (if configured on the API key record)
  try {
    const whitelistedIps = (record.whitelisted_ips as string[]) || [];
    if (Array.isArray(whitelistedIps) && whitelistedIps.length > 0) {
      const ip = req.ip || "";
      if (!isIpAllowed(ip, whitelistedIps)) {
        logger.warn("auth.whitelist.ip_block", {
          requestId: rid,
          ip,
          prefix: record.key_prefix,
          apiKeyId: record.id,
        });
        return res
          .status(403)
          .json({ requestId: rid, error: "ip_not_whitelisted" });
      }
    }
    const whitelistedDomains = (record.whitelisted_domains as string[]) || [];
    if (Array.isArray(whitelistedDomains) && whitelistedDomains.length > 0) {
      const originHeader = (req.header("origin") ||
        req.header("referer") ||
        req.hostname ||
        "") as string;
      const host =
        originToHost(originHeader) ||
        originHeader.replace(/^https?:\/\//, "").split(/[/?#]/)[0];
      if (!isDomainAllowed(host, whitelistedDomains)) {
        logger.warn("auth.whitelist.domain_block", {
          requestId: rid,
          host,
          prefix: record.key_prefix,
          apiKeyId: record.id,
        });
        return res
          .status(403)
          .json({ requestId: rid, error: "domain_not_whitelisted" });
      }
    }
  } catch (e) {
    logger.error("auth.whitelist.check_error", {
      requestId: rid,
      err: e && (e as any).message ? (e as any).message : e,
    });
  }

  next();
}

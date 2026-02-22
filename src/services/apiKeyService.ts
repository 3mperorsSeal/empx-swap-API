import crypto from "crypto";
import prisma from "../lib/prisma";

export interface ApiKeyPolicy {
  id: number;
  key_prefix: string;
  tier: string;
  user_id: number | null;
  revoked: boolean;
  whitelisted_ips: string[];
  whitelisted_domains: string[];
}

/**
 * Service to handle API key verification, retrieval, and management.
 */
export class ApiKeyService {
  /**
   * Fetches the policy for a given API key prefix.
   */
  static async getPolicy(prefix: string): Promise<ApiKeyPolicy | null> {
    const policy = await prisma.api_keys.findFirst({
      where: { key_prefix: prefix, revoked: false },
      select: {
        id: true,
        key_prefix: true,
        tier: true,
        user_id: true,
        revoked: true,
        whitelisted_ips: true,
        whitelisted_domains: true,
      },
    });

    if (!policy) return null;

    return {
      ...policy,
      revoked: policy.revoked ?? false,
      whitelisted_ips: this.parseJsonArray(policy.whitelisted_ips),
      whitelisted_domains: this.parseJsonArray(policy.whitelisted_domains),
    };
  }

  /**
   * Generates a new random API key.
   */
  static async generateApiKey(): Promise<{
    key: string;
    prefix: string;
    hash: string;
  }> {
    const key = `ak_${crypto.randomBytes(24).toString("hex")}`;
    const prefix = key.substring(0, 8);
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    return { key, prefix, hash };
  }

  /**
   * Stores a new API key in the database.
   */
  static async storeApiKey(
    prefix: string,
    hash: string,
    userId: number | null,
    tier: string = "free",
  ) {
    return prisma.api_keys.create({
      data: {
        key_prefix: prefix,
        key_hash: hash,
        user_id: userId,
        tier: tier,
        revoked: false,
      },
    });
  }

  /**
   * Revokes an API key.
   */
  static async revokeApiKey(prefix: string): Promise<void> {
    await prisma.api_keys.updateMany({
      where: { key_prefix: prefix },
      data: { revoked: true },
    });
  }

  /**
   * Verifies a plain text key against a hash.
   */
  static async verifyApiKey(plainKey: string, hash: string): Promise<boolean> {
    const currentHash = crypto
      .createHash("sha256")
      .update(plainKey)
      .digest("hex");
    return currentHash === hash;
  }

  /**
   * Retrieves an API key record by its prefix.
   */
  static async getApiKeyByPrefix(prefix: string) {
    return prisma.api_keys.findFirst({
      where: { key_prefix: prefix },
    });
  }

  private static parseJsonArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      if (typeof value === "string") {
        return JSON.parse(value);
      }
    } catch {
      return [];
    }
    return [];
  }
}

// Named exports for backward compatibility/conciseness in auth service
export const generateApiKey = ApiKeyService.generateApiKey.bind(ApiKeyService);
export const storeApiKey = ApiKeyService.storeApiKey.bind(ApiKeyService);
export const revokeApiKey = ApiKeyService.revokeApiKey.bind(ApiKeyService);
export const getApiKeyByPrefix =
  ApiKeyService.getApiKeyByPrefix.bind(ApiKeyService);
export const verifyApiKey = ApiKeyService.verifyApiKey.bind(ApiKeyService);
export const getPolicy = ApiKeyService.getPolicy.bind(ApiKeyService);

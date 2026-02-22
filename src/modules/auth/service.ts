import {
  generateApiKey as svcGenerateApiKey,
  storeApiKey as svcStoreApiKey,
  revokeApiKey as svcRevokeApiKey,
  getApiKeyByPrefix as svcGetApiKeyByPrefix,
  verifyApiKey as svcVerifyApiKey,
} from "../../services/apiKeyService";

export async function createApiKey(opts?: {
  userId?: number | null;
  tier?: string;
  persist?: boolean;
}) {
  const userId = opts?.userId ?? null;
  const tier = opts?.tier ?? "free";
  const persist = opts?.persist ?? false;
  const { key, prefix, hash } = await svcGenerateApiKey();
  if (persist) {
    await svcStoreApiKey(prefix, hash, userId, tier);
  }
  return { key, prefix, persisted: persist };
}

export async function revokeKey(prefix: string) {
  await svcRevokeApiKey(prefix);
  return { revoked: true, prefix };
}

// Expose lower-level API key operations for other parts of the app
export async function generateApiKey() {
  return svcGenerateApiKey();
}

export async function storeApiKey(
  prefix: string,
  hash: string,
  userId: number | null = null,
  tier = "free",
) {
  return svcStoreApiKey(prefix, hash, userId, tier);
}

export async function getApiKeyByPrefix(prefix: string) {
  return svcGetApiKeyByPrefix(prefix);
}

export async function verifyApiKey(plainKey: string, hash: string) {
  return svcVerifyApiKey(plainKey, hash);
}

import bcrypt from "bcrypt";
import "dotenv/config";
import logger from "../core/logger";
import prisma from "../lib/prisma";
import { generateApiKey, storeApiKey } from "../modules/auth/service";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL || "test@example.com";
  const name = "Test User";

  const user = await prisma.users.upsert({
    where: { email },
    update: { name },
    create: { email, name },
    select: { id: true, email: true },
  });

  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminPass) {
    const hash = await bcrypt.hash(adminPass, BCRYPT_ROUNDS);
    await prisma.users.update({
      where: { id: user.id },
      data: { password_hash: hash, role: "admin" },
    });
    logger.info("seed.admin_password_set", { email });
  }

  logger.info("seed.user_ready", { email, userId: user.id });
  return user.id;
}

async function ensureTiers() {
  const tiers = [
    {
      name: "free",
      description: "Free tier with limited access",
      features: { demo: true },
    },
    {
      name: "pro",
      description: "Paid tier with higher limits",
      features: { demo: false },
    },
  ];

  const created = [] as { id: number; name: string }[];
  for (const t of tiers) {
    const tier = await prisma.tiers.upsert({
      where: { name: t.name },
      update: { description: t.description, features: t.features },
      create: t,
      select: { id: true, name: true },
    });
    created.push(tier);
  }
  return created;
}

async function ensureEndpoints() {
  const endpoints = [
    {
      path: "/v1/quotes/{chainId}/fast",
      method: "get",
      description: "Fast quote",
    },
    {
      path: "/v1/quotes/{chainId}/best",
      method: "get",
      description: "Best quote with strategy",
    },
    {
      path: "/v1/quotes/{chainId}/batch",
      method: "post",
      description: "Batch quotes",
    },
    {
      path: "/v1/swap/{chainId}/build",
      method: "post",
      description: "Build swap transaction",
    },
    {
      path: "/v1/chains",
      method: "get",
      description: "List supported chains",
    },
    {
      path: "/v1/chains/{chainId}/tokens",
      method: "get",
      description: "List tokens for chain",
    },
  ];

  const created = [] as { id: number; path: string; method: string }[];
  for (const e of endpoints) {
    const ep = await prisma.endpoints.upsert({
      where: { path_method: { path: e.path, method: e.method } },
      update: { description: e.description },
      create: e,
      select: { id: true, path: true, method: true },
    });
    created.push(ep);
  }
  return created;
}

async function linkTierEndpointConfigs(
  tiers: { id: number; name: string }[],
  endpoints: { id: number; path: string; method: string }[],
) {
  for (const tier of tiers) {
    for (const ep of endpoints) {
      const rate_limit = tier.name === "free" ? 20 : 1000;
      const quota = tier.name === "free" ? 1000 : 100000;
      const price = tier.name === "free" ? 0 : 0.0001;
      await prisma.tier_endpoint_configs.upsert({
        where: {
          tier_id_endpoint_id: { tier_id: tier.id, endpoint_id: ep.id },
        },
        update: {
          rate_limit,
          quota,
          price_per_request: price,
          metadata: { seeded: true },
        },
        create: {
          tier_id: tier.id,
          endpoint_id: ep.id,
          rate_limit,
          quota,
          price_per_request: price,
          metadata: { seeded: true },
        },
      });
    }
  }
}

async function ensureChains() {
  const list = [
    {
      chain_id: "1",
      name: "Ethereum",
      rpc_urls: ["https://mainnet.infura.io/v3/"],
      native_currency: { symbol: "ETH", decimals: 18 },
      metadata: { explorer: "https://etherscan.io" },
    },
    {
      chain_id: "137",
      name: "Polygon",
      rpc_urls: ["https://polygon-rpc.com/"],
      native_currency: { symbol: "MATIC", decimals: 18 },
      metadata: { explorer: "https://polygonscan.com" },
    },
  ];

  const created: { id: number; chain_id: string }[] = [];
  for (const c of list) {
    const up = await prisma.chains.upsert({
      where: { chain_id: c.chain_id },
      update: {
        name: c.name,
        rpc_urls: c.rpc_urls,
        native_currency: c.native_currency,
        metadata: c.metadata,
      },
      create: c as any,
      select: { id: true, chain_id: true },
    });
    created.push(up);
  }
  return created;
}

async function ensureTokens() {
  const list = [
    { symbol: "ETH", name: "Ether", decimals: 18, coingecko_id: "ethereum" },
    { symbol: "USDC", name: "USD Coin", decimals: 6, coingecko_id: "usd-coin" },
    { symbol: "USDT", name: "Tether", decimals: 6, coingecko_id: "tether" },
  ];

  const created: { id: number; symbol: string; coingecko_id?: string }[] = [];
  for (const t of list) {
    // Try find by coingecko id first, then by symbol
    let tok = null as any;
    if (t.coingecko_id) {
      tok = await prisma.tokens.findFirst({
        where: { coingecko_id: t.coingecko_id } as any,
      });
    }
    if (!tok)
      tok = await prisma.tokens.findFirst({ where: { symbol: t.symbol } });

    if (tok) {
      const updated = await prisma.tokens.update({
        where: { id: tok.id },
        data: t as any,
        select: { id: true, symbol: true, coingecko_id: true },
      });
      created.push(updated as any);
    } else {
      const createdTok = await prisma.tokens.create({
        data: t as any,
        select: { id: true, symbol: true, coingecko_id: true },
      });
      created.push(createdTok as any);
    }
  }
  return created;
}

async function ensureChainTokens(
  chains: { id: number; chain_id: string }[],
  tokens: { id: number; symbol: string }[],
) {
  // Map tokens to chains with example addresses (dummy)
  const mappings = [
    {
      chain_id: "1",
      token_symbol: "ETH",
      address: "0x0000000000000000000000000000000000000000",
    },
    {
      chain_id: "1",
      token_symbol: "USDC",
      address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    {
      chain_id: "137",
      token_symbol: "MATIC",
      address: "0x0000000000000000000000000000000000001010",
    },
    {
      chain_id: "137",
      token_symbol: "USDC",
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    },
  ];

  for (const m of mappings) {
    const chain = chains.find((c) => c.chain_id === m.chain_id);
    if (!chain) continue;
    const token = await prisma.tokens.findFirst({
      where: { symbol: m.token_symbol },
    });

    const where = {
      chain_id_token_address: { chain_id: chain.id, token_address: m.address },
    } as any;
    const data: any = {
      chain_id: chain.id,
      token_address: m.address,
      metadata: { seeded: true },
    };
    if (token) data.token_id = token.id;

    await prisma.chain_tokens.upsert({ where, update: data, create: data });
  }
}

async function ensureChainAdapters(chains: { id: number; chain_id: string }[]) {
  const adapters = [
    {
      chain_id: "1",
      adapter_name: "infura",
      max_rpc_per_min: 1000,
      priority: 1,
      fee_per_call: "0",
      metadata: { url: "https://mainnet.infura.io/v3/" },
    },
    {
      chain_id: "137",
      adapter_name: "polygon-rpc",
      max_rpc_per_min: 500,
      priority: 1,
      fee_per_call: "0",
      metadata: { url: "https://polygon-rpc.com/" },
    },
  ];

  for (const a of adapters) {
    const chain = chains.find((c) => c.chain_id === a.chain_id);
    if (!chain) continue;
    const where = {
      chain_id_adapter_name: {
        chain_id: chain.id,
        adapter_name: a.adapter_name,
      },
    } as any;
    const createData = {
      chain_id: chain.id,
      adapter_name: a.adapter_name,
      max_rpc_per_min: a.max_rpc_per_min,
      priority: a.priority,
      fee_per_call: a.fee_per_call,
      metadata: a.metadata,
    } as any;
    await prisma.chain_adapters.upsert({
      where,
      update: createData,
      create: createData,
    });
  }
}

async function ensurePartners() {
  const list = [
    {
      company_name: "Example Corp",
      website: "https://example.com",
      wallet_address: "0x0000000000000000000000000000000000EX1",
    },
    {
      company_name: "Partner LLC",
      website: "https://partner.example",
      wallet_address: "0x0000000000000000000000000000000000PR1",
    },
  ];

  const created: { id: string; company_name: string }[] = [];
  for (const p of list) {
    const up = await prisma.partners.upsert({
      where: { wallet_address: p.wallet_address },
      update: { company_name: p.company_name, website: p.website },
      create: p as any,
    });
    created.push(up as any);
  }
  logger.info("seed.partners_done", { count: created.length });
  return created;
}

async function main() {
  try {
    const userId = await ensureAdminUser();

    const { key, prefix, hash } = await generateApiKey();
    const r = await storeApiKey(prefix, hash, userId, "pro");
    if (!r) {
      logger.error("seed.api_store_failed", { prefix });
    } else {
      logger.info("seed.api_created", { prefix, id: r.id });
      console.log("RAW KEY (store securely, shown only once):", key);
    }

    const tiers = await ensureTiers();
    const endpoints = await ensureEndpoints();
    await linkTierEndpointConfigs(tiers, endpoints);

    const chains = await ensureChains();
    const toks = await ensureTokens();
    await ensureChainTokens(chains, toks);
    await ensureChainAdapters(chains);
    await ensurePartners();

    logger.info("seed.chain_data_done", {
      chains: chains.length,
      tokens: toks.length,
    });
    logger.info("seed.tier_endpoint_configs_done", {
      tiers: tiers.length,
      endpoints: endpoints.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const stack = err instanceof Error ? err.stack : err;
    logger.error("seed.failed", { message, stack });
    console.error("Seed failed", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

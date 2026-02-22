import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import config from ".././core/config";

// Reuse a single PrismaClient in dev to avoid exhausting connections during hot reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const connectionString = config.DATABASE_URL;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: config.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (config.NODE_ENV === "development") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
export { prisma };

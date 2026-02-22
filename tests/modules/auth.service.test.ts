import * as service from "../../src/modules/auth/service";
import prisma from "../../src/lib/prisma";

jest.mock("../../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    api_keys: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

describe("Auth module service", () => {
  afterEach(() => jest.resetAllMocks());

  test("createApiKey returns key and prefix (not persisted)", async () => {
    const res = await service.createApiKey({ persist: false });
    expect(res).toHaveProperty("key");
    expect(res).toHaveProperty("prefix");
    expect(res.persisted).toBe(false);
    expect(prisma.api_keys.create).not.toHaveBeenCalled();
  });

  test("createApiKey returns key and prefix (persisted)", async () => {
    (prisma.api_keys.create as jest.Mock).mockResolvedValue({ id: 1 });
    const res = await service.createApiKey({ persist: true });
    expect(res).toHaveProperty("key");
    expect(res).toHaveProperty("prefix");
    expect(res.persisted).toBe(true);
    expect(prisma.api_keys.create).toHaveBeenCalled();
  });

  test("revokeKey returns revoked true", async () => {
    (prisma.api_keys.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    const res = await service.revokeKey("NONEXIST");
    expect(res).toHaveProperty("revoked", true);
    expect(prisma.api_keys.updateMany).toHaveBeenCalled();
  });
});

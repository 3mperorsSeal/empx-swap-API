import * as service from "../../src/modules/chains/service";

describe("Chains module service", () => {
  test("listChains returns an array", async () => {
    const res = await service.listChains();
    expect(Array.isArray(res)).toBe(true);
  });

  test("getChain returns null for unknown", async () => {
    const c = await service.getChain("9999");
    expect(c).toBeNull();
  });
});

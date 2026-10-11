import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApiClient } from "../src/shared/api/http";
import { layoutReceiptSchema } from "../src/features/portfolio/layout/contracts";
import {
  readPortfolioLayout,
  resolvesLayoutSave,
  savePortfolioLayout,
} from "../src/features/portfolio/layout/api";
import {
  moveClient,
  orderedClientIds,
} from "../src/features/portfolio/layout/ordering";
const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
const actor = {
  tenantId: "20000000-0000-4000-8000-000000000001",
  userId: "30000000-0000-4000-8000-000000000001",
};
const receipt = {
  ...actor,
  contractVersion: 1 as const,
  version: 1,
  updatedAt: "2026-10-11T00:00:00.000Z",
  order: [`client:${b}`, `client:${a}`],
};
const input = {
  contractVersion: 1 as const,
  expectedVersion: 0,
  order: receipt.order,
};
function apiFor(value: unknown, status = 200) {
  const calls: { url: string; body: unknown; method: string | undefined }[] =
    [];
  const fetcher = (async (url, options) => {
    calls.push({
      url: String(url),
      body: options?.body ? JSON.parse(String(options.body)) : undefined,
      method: options?.method,
    });
    return new Response(JSON.stringify(value), { status });
  }) as typeof fetch;
  return { api: createApiClient(fetcher), calls };
}
describe("saved Portfolio ordering", () => {
  it("redacts removed cards and appends unseen current cards in default order", () =>
    expect(
      orderedClientIds(
        [`client:${b}`, "client:foreign", `client:${b}`],
        [a, b],
      ),
    ).toEqual([b, a]));
  it("moves a card without losing another and refuses out-of-range positions", () => {
    expect(moveClient([a, b], b, 0)).toEqual([b, a]);
    expect(moveClient([a, b], a, -1)).toEqual([a, b]);
  });
  it.each([
    { ...receipt, order: [receipt.order[0], receipt.order[0]] },
    { ...receipt, version: 0 },
    { ...receipt, updatedAt: null },
    { ...receipt, order: [a] },
    { ...receipt, visibility: true },
  ])("rejects malformed receipts %#", (value) =>
    expect(layoutReceiptSchema.safeParse(value).success).toBe(false),
  );
  it("accepts the unpersisted default contract", () =>
    expect(
      layoutReceiptSchema.parse({ ...receipt, version: 0, updatedAt: null })
        .version,
    ).toBe(0));
  it("uses the canonical core route and verifies tenant and actor", async () => {
    const { api, calls } = apiFor(receipt);
    expect(await readPortfolioLayout(api, actor, [a, b])).toEqual(receipt);
    expect(calls[0]?.url).toBe("/api/backend/core/me/portfolio-layout");
  });
  it.each(["tenantId", "userId"] as const)(
    "rejects a wrong %s receipt",
    async (field) => {
      const { api } = apiFor({ ...receipt, [field]: a });
      await expect(readPortfolioLayout(api, actor, [a, b])).rejects.toThrow(
        "does not match",
      );
    },
  );
  it("sends only the versioned order and confirms its exact new version", async () => {
    const { api, calls } = apiFor(receipt);
    expect(await savePortfolioLayout(api, actor, input, [a, b])).toEqual(
      receipt,
    );
    expect(calls[0]).toEqual({
      url: "/api/backend/core/me/portfolio-layout",
      method: "PUT",
      body: input,
    });
  });
  it.each([
    { ...receipt, version: 2 },
    { ...receipt, order: [`client:${a}`, `client:${b}`] },
  ])("rejects a successful-looking wrong version/order %#", async (value) => {
    const { api } = apiFor(value);
    await expect(
      savePortfolioLayout(api, actor, input, [a, b]),
    ).rejects.toThrow("did not confirm");
  });
  it("does not resolve an ambiguous save from a later writer's version", () =>
    expect(resolvesLayoutSave({ ...receipt, version: 2 }, input, [a, b])).toBe(
      false,
    ));
  it("resolves only matching version and exact requested order", () =>
    expect(resolvesLayoutSave(receipt, input, [a, b])).toBe(true));
  it.each([
    { order: [`client:${a}`] },
    {
      order: [
        `client:${b}`,
        `client:${a}`,
        "client:40000000-0000-4000-8000-000000000001",
      ],
    },
    { order: [`client:${a}`, "client:40000000-0000-4000-8000-000000000001"] },
  ])(
    "rejects an incomplete or foreign catalog receipt %# before read publication",
    async ({ order }) => {
      const { api } = apiFor({ ...receipt, order });
      await expect(readPortfolioLayout(api, actor, [a, b])).rejects.toThrow(
        "current profile catalog",
      );
    },
  );
  it("does not confirm a projected partial or extra success order", () => {
    expect(
      resolvesLayoutSave({ ...receipt, order: [`client:${b}`] }, input, [a, b]),
    ).toBe(false);
    expect(
      resolvesLayoutSave(
        {
          ...receipt,
          order: [
            ...receipt.order,
            "client:40000000-0000-4000-8000-000000000001",
          ],
        },
        input,
        [a, b],
      ),
    ).toBe(false);
  });
  it("rejects invalid input before transport", async () => {
    const { api, calls } = apiFor(receipt);
    await expect(
      savePortfolioLayout(api, actor, { ...input, expectedVersion: -1 }, [
        a,
        b,
      ]),
    ).rejects.toThrow("invalid");
    expect(calls).toHaveLength(0);
  });
  it.each([404, 503, 409, 401, 403])(
    "preserves canonical error status %i",
    async (status) => {
      const { api } = apiFor({ message: "Unavailable" }, status);
      await expect(
        readPortfolioLayout(api, actor, [a, b]),
      ).rejects.toMatchObject({
        status,
      });
    },
  );
  it("rejects the canonical transport's malformed response", async () => {
    const { api } = apiFor({ ok: true });
    await expect(
      api.request(
        "core",
        "me/portfolio-layout",
        z.object({ order: z.array(z.string()) }),
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
});

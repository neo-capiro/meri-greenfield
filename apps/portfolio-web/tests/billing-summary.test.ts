import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import { identitySchema } from "../src/shared/auth/identity";
import { billingSummarySchema } from "../src/features/billing/summary-contracts";
import { currentBillingReader } from "../src/features/billing/summary-authority";
import {
  billingSummaryKey,
  readBillingSummary,
} from "../src/features/billing/summary-api";

const identity = {
  user: { id: "reader", email: null },
  tenant: { id: "tenant", name: "Synthetic tenant" },
  role: "user_admin",
  billingAdmin: true,
};
const summary = {
  billingEnabled: true,
  status: "active",
  slots: 14,
  usedSlots: 12,
  pricePerSlotUsd: 217,
  llmAllowanceUsd: 11.25,
  llmUsedUsd: 9.34,
  llmOverageUsd: 1.19,
  llmWarn: false,
  llmHardCapUsd: null,
  currentPeriodEnd: "2026-11-01T00:00:00Z",
  hasSubscription: true,
};
const actor = { userId: "reader", tenantId: "tenant" };
function cacheFor(value: unknown = identity) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["identity"], value);
  return cache;
}
describe("canonical billing visibility", () => {
  it("preserves optional capability without aliasing the admin role", () => {
    expect(identitySchema.parse(identity).billingAdmin).toBe(true);
    const legacy = {
      user: identity.user,
      tenant: identity.tenant,
      role: identity.role,
    };
    expect(identitySchema.parse(legacy).billingAdmin).toBeUndefined();
    expect(currentBillingReader(cacheFor(legacy))).toBeNull();
  });
  it.each([
    { role: "user_admin", billingAdmin: true, allowed: true },
    { role: "user_admin", billingAdmin: false, allowed: false },
    { role: "user_admin", billingAdmin: undefined, allowed: false },
    { role: "standard_user", billingAdmin: true, allowed: false },
    { role: "client_portal_user", billingAdmin: true, allowed: false },
    { role: "capiro_admin", billingAdmin: false, allowed: true },
    { role: "capiro_admin", billingAdmin: undefined, allowed: true },
  ])(
    "matches canonical guard for $role / $billingAdmin",
    ({ allowed, ...patch }) => {
      expect(
        Boolean(currentBillingReader(cacheFor({ ...identity, ...patch }))),
      ).toBe(allowed);
    },
  );
  it.each([
    { tenant: null },
    { tenant: { id: " ", name: "Empty" } },
    { user: { id: "", email: null } },
    { billingAdmin: "true" },
  ])("refuses unavailable or malformed authority %j", (patch) => {
    expect(
      currentBillingReader(cacheFor({ ...identity, ...patch })),
    ).toBeNull();
  });
  it("refuses invalidated, fetching and failed identity snapshots", async () => {
    const cache = cacheFor();
    await cache.invalidateQueries({
      queryKey: ["identity"],
      refetchType: "none",
    });
    expect(currentBillingReader(cache)).toBeNull();
    cache.setQueryData(["identity"], identity);
    let release!: () => void;
    const pending = cache.fetchQuery({
      queryKey: ["identity"],
      queryFn: () =>
        new Promise((resolve) => {
          release = () => resolve(identity);
        }),
    });
    expect(currentBillingReader(cache)).toBeNull();
    release();
    await pending;
    expect(currentBillingReader(cache)).toEqual(actor);
    await cache
      .fetchQuery({
        queryKey: ["identity"],
        queryFn: () => {
          throw new Error("Expired");
        },
      })
      .catch(() => {});
    expect(cache.getQueryData(["identity"])).toEqual(identity);
    expect(currentBillingReader(cache)).toBeNull();
  });
});
describe("summary read and scope boundaries", () => {
  it("uses the existing Core endpoint, GET only, and preserves exact server amounts", async () => {
    const calls: unknown[] = [];
    const api = createApiClient(async (url, options) => {
      calls.push([url, options?.method, options?.body]);
      return Response.json(summary);
    });
    await expect(
      readBillingSummary(api, cacheFor(), actor, new AbortController().signal),
    ).resolves.toEqual(summary);
    expect(calls).toEqual([
      ["/api/backend/core/billing/summary", "GET", undefined],
    ]);
    expect(billingSummaryKey(actor)).not.toEqual(
      billingSummaryKey({ ...actor, tenantId: "other" }),
    );
    expect(billingSummaryKey(actor)).not.toEqual(
      billingSummaryKey({ ...actor, userId: "other" }),
    );
  });
  it("never reads payment data without fresh billing authority", async () => {
    let reads = 0;
    const api = createApiClient(async () => {
      reads++;
      return Response.json(summary);
    });
    await expect(
      readBillingSummary(
        api,
        cacheFor({ ...identity, billingAdmin: false }),
        actor,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(reads).toBe(0);
  });
  it.each(["actor", "tenant", "permission", "invalidated", "aborted"])(
    "rejects a held response after %s changes",
    async (change) => {
      const cache = cacheFor();
      const controller = new AbortController();
      const api = createApiClient(async () => {
        if (change === "actor")
          cache.setQueryData(["identity"], {
            ...identity,
            user: { id: "other", email: null },
          });
        if (change === "tenant")
          cache.setQueryData(["identity"], {
            ...identity,
            tenant: { id: "other", name: "Other" },
          });
        if (change === "permission")
          cache.setQueryData(["identity"], {
            ...identity,
            billingAdmin: false,
          });
        if (change === "invalidated")
          await cache.invalidateQueries({
            queryKey: ["identity"],
            refetchType: "none",
          });
        if (change === "aborted") controller.abort();
        return Response.json(summary);
      });
      await expect(
        readBillingSummary(api, cache, actor, controller.signal),
      ).rejects.toThrow();
    },
  );
  it("keeps server403 and malformed responses as failures, without automatic retries", async () => {
    for (const status of [403, 503, 200]) {
      let reads = 0;
      const api = createApiClient(async () => {
        reads++;
        return Response.json({ message: "Unavailable" }, { status });
      });
      await expect(
        readBillingSummary(
          api,
          cacheFor(),
          actor,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ status: status === 200 ? 502 : status });
      expect(reads).toBe(1);
    }
  });
  it.each([
    { slots: -1 },
    { slots: 0.5 },
    { slots: Number.MAX_SAFE_INTEGER + 1 },
    { llmUsedUsd: -0.1 },
    { llmAllowanceUsd: Infinity },
    { currentPeriodEnd: "2026-02-30" },
    { status: "paid" },
    { hasSubscription: "yes" },
  ])("rejects malformed summary facts %j", (patch) => {
    expect(
      billingSummarySchema.safeParse({ ...summary, ...patch }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  billingStateSchema,
  type BillingState,
} from "../src/features/billing/contracts";
import {
  capacityIssue,
  profileCapacity,
} from "../src/features/billing/capacity";
import { verifyProfileCapacity } from "../src/features/billing/api";
import {
  ClientProfileAttemptError,
  saveClientProfile,
} from "../src/features/client-intake/profile-api";
import { clientToIntake } from "../src/features/client-intake/form";
import { importClients } from "../src/features/intake/registrant/api";

const state: BillingState = {
  billingEnabled: true,
  status: "active",
  slots: 12,
  usedSlots: 11,
  trialEndsAt: null,
  onboardingFlowVersion: 1,
  locked: false,
};
describe("verified Core capacity contract", () => {
  it.each([
    { slots: -1 },
    { usedSlots: 0.5 },
    { usedSlots: Number.MAX_SAFE_INTEGER + 1 },
    { status: "paid" },
    { locked: null },
    { trialEndsAt: "2026-02-30" },
  ])("rejects malformed authority fields %j", (patch) => {
    expect(billingStateSchema.safeParse({ ...state, ...patch }).success).toBe(
      false,
    );
  });
  it("uses tenant counts, preserves over-capacity and does not manufacture a catalog count", () => {
    expect(profileCapacity(state)).toEqual({
      kind: "limited",
      used: 11,
      limit: 12,
      remaining: 1,
    });
    expect(profileCapacity({ ...state, usedSlots: 14 })).toEqual({
      kind: "limited",
      used: 14,
      limit: 12,
      remaining: 0,
    });
    expect(capacityIssue(state, 2)).toContain("Only 1 client slot");
  });
  it("uses the canonical ten-profile trial allowance and retains larger purchased trials", () => {
    expect(
      profileCapacity({ ...state, status: "trialing", slots: 0, usedSlots: 9 }),
    ).toMatchObject({ limit: 10, remaining: 1 });
    expect(
      profileCapacity({ ...state, status: "trialing", slots: 15 }),
    ).toMatchObject({ limit: 15, remaining: 4 });
  });
  it("bypasses disabled billing and comped slots but preserves payment locks", () => {
    expect(
      capacityIssue({
        ...state,
        billingEnabled: false,
        locked: true,
        slots: 0,
      }),
    ).toBeNull();
    expect(capacityIssue({ ...state, status: "comped", slots: 0 })).toBeNull();
    expect(
      capacityIssue({ ...state, status: "comped", locked: true }),
    ).toContain("locked");
  });
  it("requires none/canceled subscriptions while past_due keeps slots until locked", () => {
    expect(capacityIssue({ ...state, status: "none" })).toContain(
      "subscription",
    );
    expect(capacityIssue({ ...state, status: "canceled" })).toContain(
      "subscription",
    );
    expect(capacityIssue({ ...state, status: "past_due" })).toBeNull();
    expect(
      capacityIssue({ ...state, status: "past_due", locked: true }),
    ).toContain("locked");
  });
  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects invalid requested quantity %s",
    (quantity) => {
      expect(
        capacityIssue({ ...state, billingEnabled: false }, quantity),
      ).toContain("valid number");
    },
  );
});
describe("fresh capacity and dispatch boundaries", () => {
  it("reads only the configured Core state projection and validates before returning", async () => {
    const calls: string[] = [];
    const api = createApiClient(async (url) => {
      calls.push(String(url));
      return Response.json(state);
    });
    let guards = 0;
    await expect(
      verifyProfileCapacity(api, 1, () => {
        guards++;
      }),
    ).resolves.toEqual(state);
    expect(guards).toBe(2);
    expect(calls).toEqual(["/api/backend/core/billing/state"]);
  });
  it("stops before reading without authority and rechecks after a held read", async () => {
    let reads = 0;
    let permitted = false;
    const guard = () => {
      if (!permitted) throw new Error("Actor changed");
    };
    const api = createApiClient(async () => {
      reads++;
      permitted = false;
      return Response.json(state);
    });
    await expect(verifyProfileCapacity(api, 1, guard)).rejects.toThrow(
      "Actor changed",
    );
    expect(reads).toBe(0);
    permitted = true;
    await expect(verifyProfileCapacity(api, 1, guard)).rejects.toThrow(
      "Actor changed",
    );
    expect(reads).toBe(1);
  });
  it("does not turn malformed or exhausted state into successful capacity", async () => {
    for (const result of [{}, { ...state, usedSlots: 12 }]) {
      const api = createApiClient(async () => Response.json(result));
      await expect(verifyProfileCapacity(api, 1, () => {})).rejects.toThrow();
    }
  });
  it("keeps a server402 distinct from unknown create delivery and does not retry", async () => {
    const values = {
      ...clientToIntake(),
      name: "Synthetic",
      website: "test.example",
      description: "Test",
    };
    for (const status of [402, 500]) {
      let writes = 0;
      const api = createApiClient(async () => {
        writes++;
        return Response.json({ message: "Slot response" }, { status });
      });
      const result = await saveClientProfile(api, values).catch(
        (error: unknown) => error,
      );
      expect(result).toBeInstanceOf(ClientProfileAttemptError);
      expect(result).toMatchObject({ uncertain: status === 500 });
      expect(writes).toBe(1);
    }
  });
  it("rechecks authority after an existing profile read and before PUT", async () => {
    const methods: string[] = [];
    const client = {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Test",
      profileStatus: "ACTIVE",
      status: "active",
    };
    const api = createApiClient(async (_url, options) => {
      methods.push(options?.method ?? "GET");
      return Response.json(client);
    });
    const initial = clientToIntake(client);
    await expect(
      saveClientProfile(
        api,
        { ...initial, name: "Edited" },
        initial,
        client,
        () => {
          throw new Error("Invalidated");
        },
      ),
    ).rejects.toThrow("Invalidated");
    expect(methods).toEqual(["GET"]);
  });
  it("awaits asynchronous LDA capacity preflight before dispatch and preserves a preflight refusal", async () => {
    const methods: string[] = [];
    const api = createApiClient(async (url, options) => {
      methods.push(options?.method ?? "GET");
      return Response.json(
        String(url).endsWith("firm/registrant")
          ? { ldaRegistrantId: 12, ldaRegistrantName: "Test firm" }
          : {
              registrantId: 12,
              registrantName: "Test firm",
              candidates: [
                {
                  ldaClientId: 8,
                  name: "Test client",
                  filings: 1,
                  totalSpend: 0,
                  latestFilingYear: 2026,
                  onboardedAs: null,
                },
              ],
            },
      );
    });
    await expect(
      importClients(api, 12, [8], async () => {
        await Promise.resolve();
        throw new Error("No slots");
      }),
    ).rejects.toMatchObject({ uncertain: false, message: "No slots" });
    expect(methods).toEqual(["GET", "GET"]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createApiClient, ApiError } from "../src/shared/api/http";
import {
  createQuickLog,
  undoQuickLog,
} from "../src/features/client-profile/quick-log/actions";
import {
  currentClientWriter,
  assertClientWriter,
  ambiguousClientWrite,
} from "../src/features/client-profile/quick-log/authority";
import { quickLogReceiptSchema } from "../src/features/client-profile/quick-log/contracts";
import { removeSubmission } from "../src/features/client-profile/past-performance/actions";
import {
  loadSubmissions,
  submissionKey,
} from "../src/features/client-profile/past-performance/queries";
import { submissionSchema } from "../src/features/client-profile/past-performance/contracts";
const clientId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";
const tenantId = "10000000-0000-4000-8000-000000000003";
const id = "10000000-0000-4000-8000-000000000004";
const actor = { userId, tenantId };
it("only explicit known rejection permits a reviewed retry; ambiguous failures freeze", () => {
  expect(ambiguousClientWrite(new ApiError(400, "Rejected"))).toBe(false);
  expect(ambiguousClientWrite(new ApiError(502, "Wrong receipt"))).toBe(true);
  expect(ambiguousClientWrite(new Error("Lost response"))).toBe(true);
});
const input = { kind: "note" as const, title: "Saved note", body: "Details" };
const receipt = quickLogReceiptSchema.parse({
  id,
  clientId,
  tenantId,
  actorUserId: userId,
  createdByUserId: userId,
  kind: "note",
  title: "Saved note",
  body: "Details",
  personId: null,
  occurredAt: "2026-10-11T08:00:00Z",
  pinned: false,
  dueAt: null,
  settledAt: null,
  sourceType: null,
  sourceId: null,
});
const timeline = { ...receipt, origin: "recorded" };
const submission = submissionSchema.parse({
  id,
  clientId,
  tenantId,
  capabilityId: null,
  fiscalYear: "FY26",
  title: "Saved submission",
  meta: "Saved meta",
  outcome: "Saved outcome",
  outcomeType: "in_progress",
  notes: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
});
function harness(reply: (method: string, url: string) => unknown) {
  const calls: string[] = [];
  const fetcher = vi.fn(async (url, options) => {
    const method = options?.method ?? "GET";
    calls.push(`${method} ${url}`);
    return new Response(JSON.stringify(reply(method, String(url))), {
      status: 200,
    });
  }) as unknown as typeof fetch;
  return { api: createApiClient(fetcher), calls };
}
describe("owned Quick log inverse", () => {
  it("retains only the exact validated created row for Undo", async () => {
    const h = harness(() => receipt);
    expect(
      await createQuickLog(
        h.api,
        clientId,
        actor,
        input,
        () => {},
        new AbortController().signal,
        () => {},
      ),
    ).toEqual(receipt);
    expect(h.calls).toEqual([
      `POST /api/backend/core/clients/${clientId}/activity`,
    ]);
  });
  it.each(["clientId", "tenantId", "createdByUserId", "actorUserId"] as const)(
    "refuses mismatched %s receipt",
    async (field) => {
      const h = harness(() => ({ ...receipt, [field]: id }));
      await expect(
        createQuickLog(
          h.api,
          clientId,
          actor,
          input,
          () => {},
          new AbortController().signal,
          () => {},
        ),
      ).rejects.toThrow("receipt does not match");
    },
  );
  it("deletes the retained ID rather than the first/latest unrelated timeline item", async () => {
    const h = harness((method) =>
      method === "GET"
        ? [{ ...timeline, id: userId, title: "Unrelated newer note" }, timeline]
        : { ok: true },
    );
    await undoQuickLog(
      h.api,
      receipt,
      actor,
      () => {},
      new AbortController().signal,
      () => {},
    );
    expect(h.calls.at(-1)).toBe(
      `DELETE /api/backend/core/clients/${clientId}/activity/${id}`,
    );
  });
  it("refuses a changed pinned entry without dispatching deletion", async () => {
    const h = harness(() => [{ ...timeline, pinned: true }]);
    await expect(
      undoQuickLog(
        h.api,
        receipt,
        actor,
        () => {},
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow("entry changed");
    expect(h.calls).toHaveLength(1);
  });
  it("refuses derived entries and bounded feed absence", async () => {
    for (const rows of [[], [{ ...timeline, origin: "derived" }]]) {
      const h = harness(() => rows);
      await expect(
        undoQuickLog(
          h.api,
          receipt,
          actor,
          () => {},
          new AbortController().signal,
          () => {},
        ),
      ).rejects.toThrow("not visible");
      expect(h.calls).toHaveLength(1);
    }
  });
  it("rechecks lifetime after the read before deleting", async () => {
    const controller = new AbortController();
    const h = harness(() => {
      controller.abort();
      return [timeline];
    });
    await expect(
      undoQuickLog(
        h.api,
        receipt,
        actor,
        () => controller.signal.throwIfAborted(),
        controller.signal,
        () => {},
      ),
    ).rejects.toThrow();
    expect(h.calls).toHaveLength(1);
  });
  it("requires actual canonical acknowledgement", async () => {
    const h = harness((method) =>
      method === "GET" ? [timeline] : { ok: false },
    );
    await expect(
      undoQuickLog(
        h.api,
        receipt,
        actor,
        () => {},
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow("unexpected response");
  });
});
describe("saved submission removal", () => {
  it("validates tenant/client rows and uses exact history inverse with deleted receipt", async () => {
    const h = harness((method) =>
      method === "GET" ? [submission] : { deleted: true },
    );
    await removeSubmission(
      h.api,
      submission,
      () => {},
      new AbortController().signal,
      () => {},
    );
    expect(h.calls.at(-1)).toBe(
      `DELETE /api/backend/core/clients/${clientId}/history/${id}`,
    );
  });
  it("rejects cross-client or tenant history before presentation", async () => {
    for (const field of ["clientId", "tenantId"]) {
      const h = harness(() => [{ ...submission, [field]: id }]);
      await expect(loadSubmissions(h.api, clientId, tenantId)).rejects.toThrow(
        "unexpected response",
      );
    }
  });
  it("preserves a changed submission and never sends delete", async () => {
    const h = harness(() => [{ ...submission, outcome: "Changed outcome" }]);
    await expect(
      removeSubmission(
        h.api,
        submission,
        () => {},
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow("changed");
    expect(h.calls).toHaveLength(1);
  });
  it("rejects a successful-looking incompatible delete response", async () => {
    const h = harness((method) =>
      method === "GET" ? [submission] : { ok: true },
    );
    await expect(
      removeSubmission(
        h.api,
        submission,
        () => {},
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow("unexpected response");
  });
});
it("actor cache invalidation/error/switch fails closed and scopes saved history", () => {
  const cache = new QueryClient();
  const identity = {
    user: { id: userId, email: null },
    tenant: { id: tenantId, name: "Test" },
    role: "standard_user",
  };
  cache.setQueryData(["identity"], identity);
  expect(currentClientWriter(cache)).toEqual(actor);
  expect(submissionKey(clientId, actor)).not.toEqual(
    submissionKey(clientId, { ...actor, userId: id }),
  );
  void cache.invalidateQueries({ queryKey: ["identity"] });
  expect(() => assertClientWriter(cache, actor)).toThrow();
  cache.setQueryData(["identity"], { ...identity, user: { id, email: null } });
  expect(() => assertClientWriter(cache, actor)).toThrow();
  cache
    .getQueryCache()
    .find({ queryKey: ["identity"] })
    ?.setState({ error: new Error("Expired") });
  expect(currentClientWriter(cache)).toBeUndefined();
});

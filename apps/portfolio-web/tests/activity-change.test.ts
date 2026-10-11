import { describe, expect, it, vi } from "vitest";
import { createApiClient, ApiError } from "@/shared/api/http";
import {
  changeActivity,
  type ActivityChange,
} from "@/features/client-profile/activity-change";
import type { Activity } from "@/features/client-profile/contracts";

const clientId = "client-a";
const actor = { userId: "user-a", tenantId: "tenant-a" };
const note: Activity = {
  id: "note-a",
  kind: "note",
  title: "Original",
  body: "Details",
  occurredAt: "2026-10-10T12:00:00Z",
  sourceType: null,
  sourceId: null,
  origin: "recorded",
  dueAt: null,
  settledAt: null,
  pinned: false,
};
function setup(
  rows: unknown = [note],
  receipt: unknown = {
    ...note,
    clientId,
    tenantId: actor.tenantId,
    pinned: true,
  },
) {
  const calls: { path: string; options?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    calls.push({ path: String(input), options });
    return new Response(
      JSON.stringify(options?.method === "GET" ? rows : receipt),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const dispatched = vi.fn();
  const guard = vi.fn();
  const controller = new AbortController();
  const run = (
    change: ActivityChange = { action: "pin", pinned: true },
    expected = note,
  ) =>
    changeActivity(
      createApiClient(fetcher),
      clientId,
      actor,
      expected,
      change,
      guard,
      controller.signal,
      dispatched,
    );
  return { calls, dispatched, guard, controller, run };
}
describe("recorded activity changes", () => {
  it("preflights the scoped bounded feed and sends only the pin field", async () => {
    const test = setup();
    await test.run();
    expect(test.calls.map((call) => call.path)).toEqual([
      "/api/backend/core/clients/client-a/activity?limit=500",
      "/api/backend/core/clients/client-a/activity/note-a",
    ]);
    expect(test.calls[1]?.options?.body).toBe('{"pinned":true}');
    expect(
      test.calls.every(
        (call) => call.options?.signal === test.controller.signal,
      ),
    ).toBe(true);
    expect(test.dispatched).toHaveBeenCalledTimes(1);
  });
  it("unpins a pinned note and confirms the persisted false value", async () => {
    const pinned = { ...note, pinned: true };
    await setup([pinned], {
      ...pinned,
      pinned: false,
      clientId,
      tenantId: actor.tenantId,
    }).run({ action: "pin", pinned: false }, pinned);
  });
  it.each([
    ["missing", []],
    ["derived replacement", [{ ...note, origin: "derived" }]],
    ["changed pin", [{ ...note, pinned: true }]],
    ["changed source", [{ ...note, sourceId: "another" }]],
    ["changed kind", [{ ...note, kind: "request" }]],
    ["duplicate", [note, note]],
  ])("rejects %s before a write", async (_, rows) => {
    const test = setup(rows);
    await expect(test.run()).rejects.toBeInstanceOf(Error);
    expect(test.calls).toHaveLength(1);
    expect(test.dispatched).not.toHaveBeenCalled();
  });
  it.each([
    ["wrong id", { id: "other" }],
    ["wrong client", { clientId: "other" }],
    ["wrong tenant", { tenantId: "other" }],
    ["false pin success", { pinned: false }],
    ["changed identity", { kind: "request" }],
    ["malformed", { pinned: null }],
  ])("rejects a %s receipt after dispatch", async (_, override) => {
    const test = setup([note], {
      ...note,
      clientId,
      tenantId: actor.tenantId,
      pinned: true,
      ...override,
    });
    await expect(test.run()).rejects.toMatchObject({ status: 502 });
    expect(test.dispatched).toHaveBeenCalledTimes(1);
  });
  it("preserves concurrent sibling changes when pinning", async () => {
    const current = { ...note, title: "Changed remotely", body: "New details" };
    const test = setup([current], {
      ...current,
      pinned: true,
      clientId,
      tenantId: actor.tenantId,
    });
    await test.run();
    expect(test.calls[1]?.options?.body).toBe('{"pinned":true}');
  });
  it("rejects a concurrent edit without overwriting or dispatching", async () => {
    const test = setup([{ ...note, body: "Remote change" }]);
    await expect(
      test.run({ action: "edit", fields: { title: "My edit", body: "Mine" } }),
    ).rejects.toMatchObject({ status: 409 });
    expect(test.dispatched).not.toHaveBeenCalled();
  });
  it("trims edits and validates the actual empty-body receipt", async () => {
    const test = setup([note], {
      ...note,
      title: "Edited",
      body: null,
      clientId,
      tenantId: actor.tenantId,
    });
    await test.run({
      action: "edit",
      fields: { title: " Edited ", body: "   " },
    });
    expect(test.calls[1]?.options?.body).toBe('{"title":"Edited","body":""}');
  });
  it.each([null, "not-a-date"])(
    "rejects a false settled receipt %s",
    async (settledAt) => {
      const request = { ...note, dueAt: "2026-10-11T12:00:00Z" };
      const test = setup([request], {
        ...request,
        settledAt,
        clientId,
        tenantId: actor.tenantId,
      });
      await expect(
        test.run({ action: "settle", settled: true }, request),
      ).rejects.toMatchObject({ status: 502 });
    },
  );
  it("preserves settle and reopen semantics", async () => {
    const open = { ...note, dueAt: "2026-10-11T12:00:00Z" };
    const settled = { ...open, settledAt: "2026-10-11T13:00:00Z" };
    await setup([open], { ...settled, clientId, tenantId: actor.tenantId }).run(
      { action: "settle", settled: true },
      open,
    );
    await setup([settled], { ...open, clientId, tenantId: actor.tenantId }).run(
      { action: "settle", settled: false },
      settled,
    );
  });
  it("rejects a settled receipt for a different due date", async () => {
    const request = { ...note, dueAt: "2026-10-11T12:00:00Z" };
    const test = setup([request], {
      ...request,
      dueAt: "2026-10-12T12:00:00Z",
      settledAt: "2026-10-11T13:00:00Z",
      clientId,
      tenantId: actor.tenantId,
    });
    await expect(
      test.run({ action: "settle", settled: true }, request),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("rejects delete if any visible field changed", async () => {
    const test = setup([{ ...note, pinned: true }], { ok: true });
    await expect(test.run({ action: "remove" })).rejects.toMatchObject({
      status: 409,
    });
    expect(test.dispatched).not.toHaveBeenCalled();
  });
  it("accepts only an actual deletion acknowledgement", async () => {
    await setup([note], { ok: true }).run({ action: "remove" });
    await expect(
      setup([note], { ok: false }).run({ action: "remove" }),
    ).rejects.toMatchObject({ status: 502 });
  });
  it.each([
    [
      { action: "pin", pinned: true },
      { ...note, kind: "request" },
    ],
    [{ action: "settle", settled: true }, note],
    [{ action: "remove" }, { ...note, origin: "derived" }],
    [{ action: "edit", fields: { title: " ", body: "" } }, note],
  ] as const)(
    "validates before reading or writing %#",
    async (change, expected) => {
      const test = setup();
      await expect(test.run(change, expected)).rejects.toBeInstanceOf(Error);
      expect(test.calls).toHaveLength(0);
    },
  );
  it.each([1, 3, 5])(
    "rejects authority loss at guard %i, including before dispatch and after the receipt",
    async (guardCall) => {
      const test = setup();
      test.guard.mockImplementation(() => {
        if (test.guard.mock.calls.length === guardCall)
          throw new ApiError(403, "Scope changed");
      });
      await expect(test.run()).rejects.toMatchObject({ status: 403 });
      expect(test.calls).toHaveLength(
        guardCall === 1 ? 0 : guardCall === 3 ? 1 : 2,
      );
      expect(test.dispatched).toHaveBeenCalledTimes(guardCall === 5 ? 1 : 0);
    },
  );
});

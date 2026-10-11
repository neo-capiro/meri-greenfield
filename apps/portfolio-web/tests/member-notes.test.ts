import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createApiClient, ApiError } from "../src/shared/api/http";
import {
  assertClientWriter,
  ambiguousClientWrite,
} from "../src/features/client-profile/quick-log/public";
import { createMemberNote } from "../src/features/relationships/member-notes/api";
import {
  memberReferenceSchema,
  memberNoteInputSchema,
  memberNotesKey,
} from "../src/features/relationships/member-notes/contracts";

const actor = { userId: "user-test", tenantId: "tenant-test" };
const member = { id: "member-42", name: "Sen. Synthetic Member" };
const detail = {
  id: member.id,
  kind: "member",
  socialContacts: [],
  offices: [],
};
const receipt = {
  id: "70000000-0000-4000-8000-000000000001",
  directoryContactId: member.id,
  directoryContactName: member.name,
  body: "Reviewed the public briefing.",
  createdAt: "2026-10-11T12:00:00Z",
  createdBy: { id: actor.userId, email: null, firstName: null, lastName: null },
};
function transport(
  options: {
    detail?: unknown;
    receipt?: unknown;
    status?: number;
    lost?: boolean;
  } = {},
) {
  const calls: { path: string; method: string; body?: unknown }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const method = init?.method ?? "GET";
    calls.push({
      path: String(url),
      method,
      ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
    });
    if (method === "POST" && options.lost) throw new TypeError("Lost reply");
    const status = method === "POST" ? (options.status ?? 200) : 200;
    return new Response(
      JSON.stringify(
        method === "POST"
          ? (options.receipt ?? receipt)
          : (options.detail ?? detail),
      ),
      { status, headers: { "Content-Type": "application/json" } },
    );
  };
  return { calls, api: createApiClient(fetcher) };
}
function save(
  options: Parameters<typeof transport>[0] = {},
  guard = () => {},
  signal = new AbortController().signal,
) {
  const value = transport(options);
  const dispatched = vi.fn();
  const result = createMemberNote(
    value.api,
    member,
    actor,
    `  ${receipt.body}\n`,
    guard,
    signal,
    dispatched,
  );
  return { ...value, result, dispatched };
}

describe("member Directory note boundary", () => {
  it("uses opaque Directory identity, trims only input and sends supported fields to core", async () => {
    const { calls, result, dispatched } = save();
    expect(await result).toEqual(receipt);
    expect(calls).toEqual([
      { path: "/api/backend/core/directory/members/member-42", method: "GET" },
      {
        path: "/api/backend/core/directory/contacts/member-42/notes",
        method: "POST",
        body: { body: receipt.body, directoryContactName: member.name },
      },
    ]);
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(memberNotesKey(actor.tenantId, actor.userId, member.id)).toEqual([
      "directory-member-notes",
      "tenant-test",
      "user-test",
      "member-42",
    ]);
  });
  it("accepts the 4000 character boundary and rejects blank/oversized notes", () => {
    expect(
      memberNoteInputSchema.parse({
        body: ` ${"x".repeat(4000)} `,
        directoryContactName: member.name,
      }).body,
    ).toHaveLength(4000);
    for (const body of [" \n ", "x".repeat(4001)])
      expect(
        memberNoteInputSchema.safeParse({
          body,
          directoryContactName: member.name,
        }).success,
      ).toBe(false);
  });
  it("validates Directory identifiers and names without requiring a UUID", () => {
    expect(
      memberReferenceSchema.parse({ id: " member-42 ", name: " Member " }),
    ).toEqual({ id: member.id, name: "Member" });
    for (const value of [
      { id: "", name: "Member" },
      { id: "x".repeat(121), name: "Member" },
      { id: member.id, name: " " },
      { id: member.id, name: "x".repeat(241) },
    ])
      expect(memberReferenceSchema.safeParse(value).success).toBe(false);
  });
  it.each([
    { ...detail, id: "member-other" },
    { ...detail, kind: "staff" },
    { ...detail, offices: undefined },
  ])("refuses unverified member detail before POST", async (wrongDetail) => {
    const { result, calls, dispatched } = save({ detail: wrongDetail });
    await expect(result).rejects.toMatchObject({ status: 502 });
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it.each([
    { ...receipt, directoryContactId: "member-other" },
    { ...receipt, directoryContactName: "Other member" },
    { ...receipt, body: ` ${receipt.body}` },
    { ...receipt, createdBy: { ...receipt.createdBy, id: "other-author" } },
    { ...receipt, createdBy: null },
    { ...receipt, createdAt: "yesterday" },
    { ...receipt, id: "invalid-id" },
  ])(
    "rejects mismatched or malformed success without retry",
    async (wrongReceipt) => {
      const { result, calls, dispatched } = save({ receipt: wrongReceipt });
      await expect(result).rejects.toMatchObject({ status: 502 });
      expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
      expect(dispatched).toHaveBeenCalledTimes(1);
    },
  );
  it("does not read or write when the initiating guard refuses", async () => {
    const { result, calls, dispatched } = save({}, () => {
      throw new ApiError(403, "Revoked");
    });
    await expect(result).rejects.toMatchObject({ status: 403 });
    expect(calls).toEqual([]);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it("rechecks actual cache invalidation after detail and sends zero POSTs", async () => {
    const cache = new QueryClient();
    cache.setQueryData(["identity"], {
      user: { id: actor.userId, email: null },
      tenant: { id: actor.tenantId, name: "Synthetic" },
      role: "standard_user",
    });
    let checks = 0;
    const { result, calls, dispatched } = save({}, () => {
      if (++checks === 2)
        void cache.invalidateQueries({
          queryKey: ["identity"],
          refetchType: "none",
        });
      assertClientWriter(cache, actor);
    });
    await expect(result).rejects.toMatchObject({ status: 403 });
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
    expect(dispatched).not.toHaveBeenCalled();
    cache.clear();
  });
  it("refuses local authority changes after dispatch rather than publishing a receipt", async () => {
    let checks = 0;
    const { result, calls, dispatched } = save({}, () => {
      if (++checks === 3) throw new ApiError(403, "Local authority changed");
    });
    await expect(result).rejects.toMatchObject({ status: 403 });
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
    expect(dispatched).toHaveBeenCalledTimes(1);
    // Hook separately tracks this local refusal as unknown after dispatch.
  });
  it("an aborted lifetime cannot start a request", async () => {
    const controller = new AbortController();
    controller.abort();
    const { result, calls } = save({}, () => {}, controller.signal);
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toEqual([]);
  });
  it("an aborted lifetime after preflight cannot dispatch POST", async () => {
    const controller = new AbortController();
    let checks = 0;
    const { result, calls } = save(
      {},
      () => {
        if (++checks === 2) controller.abort();
      },
      controller.signal,
    );
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });
  it.each([400, 401, 403, 404, 409, 422])(
    "propagates known HTTP %i refusal without retry",
    async (status) => {
      const { result, calls } = save({
        status,
        receipt: { message: "Refused" },
      });
      await expect(result).rejects.toMatchObject({ status });
      expect(ambiguousClientWrite(new ApiError(status, "Refused"))).toBe(false);
      expect(calls).toHaveLength(2);
    },
  );
  it("lost response is ambiguous and is not automatically resent", async () => {
    const { result, calls } = save({ lost: true });
    await expect(result).rejects.toThrow("Lost reply");
    expect(ambiguousClientWrite(new TypeError("Lost reply"))).toBe(true);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "../src/shared/api/http";
import {
  fetchCandidates,
  fetchRegistrant,
  importClients,
  ImportAttemptError,
  linkRegistrant,
  searchRegistrants,
} from "../src/features/intake/registrant/api";
import {
  groupCandidates,
  observedSelection,
  receiptMatches,
  validateSelection,
  canReadRegistrant,
} from "../src/features/intake/registrant/domain";
import { importReceiptSchema } from "../src/features/intake/registrant/contracts";

const candidate = {
  ldaClientId: 8,
  name: "Synthetic Co",
  filings: 4,
  latestFilingYear: 2026,
  totalSpend: 120000,
  onboardedAs: null,
};
const feed = {
  registrantId: 12,
  registrantName: "Synthetic Firm",
  candidates: [candidate],
};
const anchor = { ldaRegistrantId: 12, ldaRegistrantName: "Synthetic Firm" };
const receipt = {
  created: 1,
  items: [{ id: "client-a", name: "Synthetic Co", ldaClientId: 8 }],
  skipped: [],
};
describe("retained firm LDA intake contract", () => {
  it("uses Core canonical search and current-link reads", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json(anchor));
    const api = createApiClient(fetcher);
    await searchRegistrants(api, "  A & B  ");
    await fetchRegistrant(api);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/api/backend/core/firm/lda-registrants?q=A+%26+B",
    );
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "/api/backend/core/firm/registrant",
    );
  });
  it("rejects short and oversized searches before dispatch", () => {
    const fetcher = vi.fn();
    const api = createApiClient(fetcher);
    expect(() => searchRegistrants(api, "a")).toThrow("2–200");
    expect(() => searchRegistrants(api, "a".repeat(201))).toThrow("2–200");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("links only a valid integer and validates the exact linked ID", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(anchor));
    expect(() => linkRegistrant(createApiClient(fetcher), 0)).toThrow(
      "valid firm",
    );
    await linkRegistrant(createApiClient(fetcher), 12);
    expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({
      registrantId: 12,
    });
    expect(fetcher.mock.calls[0]?.[1].method).toBe("PUT");
    await expect(linkRegistrant(createApiClient(fetcher), 13)).rejects.toThrow(
      "unexpected response",
    );
  });
  it("refuses a mismatched candidate anchor", async () => {
    await expect(
      fetchCandidates(
        createApiClient(vi.fn().mockResolvedValue(Response.json(feed))),
        99,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
  it("groups aliases by canonical ID without recomputing disclosed figures", () => {
    const alias = { ...candidate, name: "Earlier filing name", totalSpend: 99 };
    expect(groupCandidates([candidate, alias])).toEqual([
      { ldaClientId: 8, aliases: [candidate, alias], onboardedAs: null },
    ]);
    expect(
      groupCandidates([candidate, { ...alias, onboardedAs: "Existing" }])[0]
        ?.onboardedAs,
    ).toBe("Existing");
  });
  it.each([
    { ids: [] },
    { ids: Array.from({ length: 101 }, (_, i) => i + 1) },
    { ids: [8, 8] },
    { ids: [0] },
    { ids: [1.5] },
  ])("refuses invalid/beyond-limit distinct selection $ids", ({ ids }) => {
    expect(() => validateSelection(ids)).toThrow("1 and 100");
  });
  it("refuses removed or already imported clients before POST", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(anchor))
      .mockResolvedValueOnce(
        Response.json({
          ...feed,
          candidates: [{ ...candidate, onboardedAs: "Existing" }],
        }),
      );
    await expect(
      importClients(createApiClient(fetcher), 12, [8]),
    ).rejects.toThrow("selection changed");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rereads the anchor and refuses observed drift without a POST", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ...anchor, ldaRegistrantId: 99 }));
    await expect(
      importClients(createApiClient(fetcher), 12, [8]),
    ).rejects.toMatchObject({ uncertain: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("classifies failed preflight reads as unambiguously not dispatched", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new TypeError("Read disconnected"));
    await expect(
      importClients(createApiClient(fetcher), 12, [8]),
    ).rejects.toMatchObject({ uncertain: false, message: "Read disconnected" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("runs the actor gate after read preflight and refuses a changed actor before POST", async () => {
    const original = { tenantId: "tenant-a", userId: "user-a" };
    let current = original;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(anchor))
      .mockImplementationOnce(async () => {
        current = { tenantId: "tenant-b", userId: "user-a" };
        return Response.json(feed);
      });
    const guard = vi.fn(() => {
      if (
        current.tenantId !== original.tenantId ||
        current.userId !== original.userId
      )
        throw new ApiError(409, "Session changed before dispatch");
    });
    await expect(
      importClients(createApiClient(fetcher), 12, [8], guard),
    ).rejects.toMatchObject({
      uncertain: false,
      message: "Session changed before dispatch",
    });
    expect(guard).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every((call) => call[1]?.method !== "POST")).toBe(
      true,
    );
  });
  it("sends bounded exact IDs and returns the verified receipt", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(anchor))
      .mockResolvedValueOnce(Response.json(feed))
      .mockResolvedValueOnce(Response.json(receipt));
    expect(await importClients(createApiClient(fetcher), 12, [8])).toEqual(
      receipt,
    );
    expect(fetcher.mock.calls[2]?.[0]).toBe("/api/backend/core/firm/import");
    expect(JSON.parse(fetcher.mock.calls[2]?.[1].body)).toEqual({
      ldaClientIds: [8],
    });
  });
  it("preserves documented per-row skips and checks the complete ID partition", () => {
    const partial = {
      ...receipt,
      skipped: [{ ldaClientId: 9, reason: "client slot limit reached" }],
    };
    expect(receiptMatches(partial, [8, 9])).toBe(true);
    expect(receiptMatches({ ...partial, created: 2 }, [8, 9])).toBe(false);
    expect(
      receiptMatches(
        { ...partial, skipped: [{ ldaClientId: 8, reason: "duplicate" }] },
        [8, 9],
      ),
    ).toBe(false);
    expect(receiptMatches(receipt, [8, 9])).toBe(false);
    expect(
      importReceiptSchema.safeParse({ created: 1, imported: 1, skipped: 0 })
        .success,
    ).toBe(false);
  });
  it.each(["transport", "server", "foreign receipt"])(
    "freezes uncertain %s completion without retry",
    async (kind) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(Response.json(anchor))
        .mockResolvedValueOnce(Response.json(feed));
      if (kind === "transport")
        fetcher.mockRejectedValueOnce(new TypeError("Disconnected"));
      else if (kind === "server")
        fetcher.mockResolvedValueOnce(
          Response.json({ message: "Unavailable" }, { status: 503 }),
        );
      else
        fetcher.mockResolvedValueOnce(
          Response.json({
            ...receipt,
            items: [{ ...receipt.items[0], ldaClientId: 99 }],
          }),
        );
      await expect(
        importClients(createApiClient(fetcher), 12, [8]),
      ).rejects.toMatchObject({ name: "ImportAttemptError", uncertain: true });
      expect(fetcher).toHaveBeenCalledTimes(3);
    },
  );
  it("preserves an explicit pre-batch slot refusal as rejected", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(anchor))
      .mockResolvedValueOnce(Response.json(feed))
      .mockResolvedValueOnce(
        Response.json({ message: "No slots" }, { status: 402 }),
      );
    await expect(
      importClients(createApiClient(fetcher), 12, [8]),
    ).rejects.toEqual(new ImportAttemptError("No slots", false));
  });
  it("readback describes observed linkage without manufacturing a receipt", () => {
    expect(
      observedSelection([8, 9], {
        ...feed,
        candidates: [{ ...candidate, onboardedAs: "Existing" }],
      }),
    ).toEqual([
      { ldaClientId: 8, onboardedAs: "Existing" },
      { ldaClientId: 9, onboardedAs: null },
    ]);
    expect(canReadRegistrant("standard_user")).toBe(true);
    expect(canReadRegistrant("unknown")).toBe(false);
  });
});

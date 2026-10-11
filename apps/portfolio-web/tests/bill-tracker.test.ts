import { describe, it, expect, vi } from "vitest";
import { readConfig } from "../src/shared/config/config";
import { createApiClient, ApiError } from "../src/shared/api/http";
import {
  fetchBoard,
  setTracked,
  searchBills,
} from "../src/features/bill-tracker/api";
describe("Bill Tracker owner contract", () => {
  it("requires an explicit known owner without selecting one from hostnames", () => {
    expect(readConfig({}).trackerBackend).toBeUndefined();
    expect(readConfig({ TRACKER_BACKEND: "core" }).trackerBackend).toBe("core");
    expect(readConfig({ TRACKER_BACKEND: "intelligence" }).trackerBackend).toBe(
      "intelligence",
    );
    expect(readConfig({ TRACKER_BACKEND: "auto" }).issues).toContain(
      "TRACKER_BACKEND must be core or intelligence.",
    );
  });
  it("keeps core writes on the core client contract and validates the distinct success shapes", async () => {
    const network = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ tracked: true }))
      .mockResolvedValueOnce(Response.json({ untracked: true }));
    const api = createApiClient(network);
    await setTracked(api, "client-a", "core", "hr-1-119", true);
    await setTracked(api, "client-a", "core", "hr-1-119", false);
    expect(network.mock.calls[0]?.[0]).toBe(
      "/api/backend/core/intelligence/clients/client-a/tracker/track",
    );
    expect(JSON.parse(network.mock.calls[0]?.[1].body)).toEqual({
      billId: "hr-1-119",
      source: "manual_search",
    });
    expect(network.mock.calls[1]?.[0]).toBe(
      "/api/backend/core/intelligence/clients/client-a/tracker/track/hr-1-119",
    );
    expect(network.mock.calls[1]?.[1].method).toBe("DELETE");
  });
  it("keeps intel writes on its POST untrack contract and rejects a wrong client association", async () => {
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ billId: "tx-2025-hb1", clientId: "client-b" }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true, removed: 1 }));
    const api = createApiClient(network);
    await expect(
      setTracked(api, "client-a", "intelligence", "tx-2025-hb1", true),
    ).rejects.toThrow("unexpected response");
    await setTracked(api, "client-a", "intelligence", "tx-2025-hb1", false);
    expect(JSON.parse(network.mock.calls[0]?.[1].body)).toEqual({
      billId: "tx-2025-hb1",
      source: "manual_search",
      isManual: true,
    });
    expect(network.mock.calls[1]?.[0]).toBe(
      "/api/backend/intelligence/clients/client-a/tracker/untrack",
    );
    expect(network.mock.calls[1]?.[1].method).toBe("POST");
  });
  it("does not fail over to another data owner after a disabled-owner 404", async () => {
    const network = vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: "Disabled" }, { status: 404 }),
      );
    await expect(
      fetchBoard(createApiClient(network), "client-a", "intelligence", null),
    ).rejects.toBeInstanceOf(ApiError);
    expect(network).toHaveBeenCalledTimes(1);
    expect(network.mock.calls[0]?.[0]).toContain(
      "/intelligence/clients/client-a/tracker/board",
    );
  });
  it("retains paging, terminal risk and service probability without recomputing them", async () => {
    const row = {
      billId: "tx-2025-hb1",
      displayNum: "HB 1",
      title: "Synthetic",
      stage: "committee",
      passageProbability: 0.17,
      matchedTags: [],
      changeChip: null,
      terminalRisk: true,
      unread: false,
      hearingCount: 0,
      lastHearingSessionId: null,
      canonicalStatus: "Failed",
    };
    const network = vi.fn().mockResolvedValue(
      Response.json({
        columns: [{ id: "committee", label: "In committee", cards: [row] }],
        total: 205,
        nextCursor: "next",
        hasMore: true,
        withheld: 204,
      }),
    );
    const page = await fetchBoard(
      createApiClient(network),
      "client-a",
      "intelligence",
      "cursor with space",
    );
    expect(page.total).toBe(205);
    expect(page.nextCursor).toBe("next");
    expect(page.columns[0]?.bills[0]).toMatchObject({
      probability: 0.17,
      terminalRisk: true,
      canonicalStatus: "Failed",
    });
    expect(network.mock.calls[0]?.[0]).toContain("cursor=cursor+with+space");
  });
  it("uses jurisdiction facets only on the contract that supports them", async () => {
    const network = vi.fn().mockImplementation(async () => Response.json([]));
    const api = createApiClient(network);
    await searchBills(api, "client-a", "core", "H.R. 1", ["TX"]);
    await searchBills(api, "client-a", "intelligence", "H.R. 1", ["US", "TX"]);
    expect(network.mock.calls[0]?.[0]).not.toContain("jurisdictions");
    expect(network.mock.calls[1]?.[0]).toContain(
      "jurisdictions=US&jurisdictions=TX",
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "../src/shared/api/http";
import {
  billHearingsSchema,
  fetchBillHearings,
  hearingHref,
  fullBoardHref,
  billDate,
  mentionTime,
} from "../src/features/bill-tracker/hearings";
import {
  coreBoardSchema,
  coreBoard,
  intelBoardSchema,
  intelBoard,
} from "../src/features/bill-tracker/contracts";
const hearing = {
  sessionId: "capture-a",
  hearingId: "canonical-b",
  title: "Synthetic hearing",
  occurredAt: "2026-10-10T12:00:00Z",
  committeeId: null,
  mentions: [
    {
      segmentId: null,
      timestampMs: 761000,
      speakerName: "Speaker",
      quote: "Synthetic quote",
      quoteSource: "transcript",
      issueTags: ["Test"],
    },
  ],
};
describe("bill hearing contract", () => {
  it("requests only the configured Intel client/bill scope, with cancellation", async () => {
    const network = vi
      .fn()
      .mockResolvedValue(Response.json({ count: 1, hearings: [hearing] }));
    const signal = new AbortController().signal;
    expect(
      await fetchBillHearings(
        createApiClient(network),
        "client/a",
        "tx-2025-hb1",
        "intelligence",
        signal,
      ),
    ).toEqual({ count: 1, hearings: [hearing] });
    expect(network).toHaveBeenCalledTimes(1);
    expect(network.mock.calls[0]?.[0]).toBe(
      "/api/backend/intelligence/clients/client%2Fa/bills/tx-2025-hb1/hearings",
    );
    expect(network.mock.calls[0]?.[1].signal).toBe(signal);
  });
  it("refuses Core owner before network instead of falling over", () => {
    const network = vi.fn();
    expect(() =>
      fetchBillHearings(createApiClient(network), "client", "bill", "core"),
    ).toThrow(ApiError);
    expect(network).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 409, 503])(
    "preserves HTTP %s refusal without another owner request",
    async (status) => {
      const network = vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: "Unavailable" }, { status }),
        );
      await expect(
        fetchBillHearings(
          createApiClient(network),
          "client",
          "bill",
          "intelligence",
        ),
      ).rejects.toMatchObject({ status });
      expect(network).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { count: 2, hearings: [hearing] },
    { count: 2, hearings: [hearing, hearing] },
    { count: 1, hearings: [{ ...hearing, sessionId: "" }] },
    {
      count: 1,
      hearings: [
        { ...hearing, mentions: [{ ...hearing.mentions[0], timestampMs: -1 }] },
      ],
    },
  ])("rejects inconsistent or invalid hearing evidence", (response) => {
    expect(billHearingsSchema.safeParse(response).success).toBe(false);
  });
  it("keeps old responses without a canonical ID readable but never links a session", () => {
    const old = { ...hearing, hearingId: undefined };
    expect(
      billHearingsSchema.parse({ count: 1, hearings: [old] }).hearings[0]
        ?.sessionId,
    ).toBe("capture-a");
    expect(hearingHref("https://example.test", old.hearingId)).toBeUndefined();
    expect(hearingHref("https://example.test", null)).toBeUndefined();
    expect(hearingHref(undefined, "canonical-b")).toBeUndefined();
    expect(hearingHref("https://example.test/", "canonical/b")).toBe(
      "https://example.test/legiwatch/hearings/canonical%2Fb",
    );
  });
  it("refuses encrypted quote contents instead of displaying a stored pointer as plaintext", () => {
    expect(
      billHearingsSchema.safeParse({
        count: 1,
        hearings: [
          {
            ...hearing,
            mentions: [
              {
                ...hearing.mentions[0],
                quoteSource: "encrypted",
                quote: "opaque stored content",
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      billHearingsSchema.safeParse({
        count: 1,
        hearings: [
          {
            ...hearing,
            mentions: [
              { ...hearing.mentions[0], quoteSource: "encrypted", quote: null },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });
  it("opens the Bills board with the selected client preserved", () => {
    expect(fullBoardHref("https://example.test/", "client/a?scope")).toBe(
      "https://example.test/legiwatch?tab=bills&client=client%2Fa%3Fscope",
    );
    expect(fullBoardHref(undefined, "client")).toBeUndefined();
  });
  it("formats transcript offsets without treating them as clock dates", () => {
    expect(mentionTime(761000)).toBe("12:41");
    expect(mentionTime(3600000)).toBe("60:00");
    expect(mentionTime(999)).toBe("0:00");
  });
  it("preserves calendar dates and refuses invalid dates", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(billDate("2026-09-29")).toContain("29");
      expect(billDate("2026-09-29")).not.toContain("28");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
    expect(billDate("2026-02-30")).toBeUndefined();
    expect(billDate("invalid")).toBeUndefined();
    expect(billDate(null)).toBeUndefined();
  });
  it("retains verified board tracked date and source latest-change fields for both owners", () => {
    const common = {
      billId: "hr-1-119",
      displayNum: "H.R. 1",
      title: "Synthetic",
      stage: "committee",
      unread: false,
      trackedAt: "2026-08-03T12:00:00Z",
      latestActionText: "Official action",
      latestActionDate: "2026-09-29",
      canonicalStatus: "Referred",
    };
    const core = coreBoard(
      coreBoardSchema.parse({
        columns: [
          {
            id: "committee",
            label: "Committee",
            bills: [
              {
                ...common,
                probability: 0.62,
                tags: [],
                change: { label: "Service change", tone: "notable" },
              },
            ],
          },
        ],
        total: 1,
      }),
    );
    const intel = intelBoard(
      intelBoardSchema.parse({
        columns: [
          {
            id: "committee",
            label: "Committee",
            cards: [
              {
                ...common,
                passageProbability: 0.62,
                matchedTags: [],
                changeChip: { label: "Service change", tone: "notable" },
                terminalRisk: false,
                hearingCount: 1,
                lastHearingSessionId: "capture-a",
              },
            ],
          },
        ],
        total: 1,
        nextCursor: null,
        hasMore: false,
        withheld: 0,
      }),
    );
    for (const page of [core, intel])
      expect(page.columns[0]?.bills[0]).toMatchObject({
        trackedAt: common.trackedAt,
        latestActionText: common.latestActionText,
        changeLabel: "Service change",
        changeTone: "notable",
        probability: 0.62,
      });
  });
});

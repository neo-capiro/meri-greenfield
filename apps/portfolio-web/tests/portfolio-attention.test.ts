import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import { portfolioAlertsSchema } from "../src/features/portfolio/attention/contracts";
import {
  accessibleAlerts,
  alertCategory,
  alertClientHref,
  alertTiming,
} from "../src/features/portfolio/attention/model";
import { loadPortfolioAlerts } from "../src/features/portfolio/attention/query";

const clientId = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";
const alert = {
  id: `${clientId}:bill:119-hr-22`,
  clientId,
  clientName: "Stale source name",
  type: "bill_movement",
  severity: "critical",
  title: "Synthetic bill action",
  subtitle: "Synthetic source detail",
  when: "2026-10-10T14:00:00Z",
  countdownDays: null,
  countdownLabel: "1d ago",
  href: "javascript:alert(1)",
  canonicalComplete: false,
  canonicalMissingFields: ["issueId", "whoActs"],
};
const response = {
  alerts: [alert],
  total: 12,
  clientCount: 40,
  generatedAt: "2026-10-11T14:00:00Z",
};

describe("Portfolio Needs attention", () => {
  it("retains incomplete records and source recency without fabricating deadlines", () => {
    const saved = portfolioAlertsSchema.parse(response).alerts[0];
    if (!saved) throw new Error("Synthetic alert fixture missing");
    expect(saved.canonicalMissingFields).toEqual(["issueId", "whoActs"]);
    expect(alertTiming(saved)).toBe("1d ago");
    expect(alertTiming({ ...saved, countdownLabel: null })).toBeUndefined();
    expect(saved.countdownDays).toBeNull();
  });
  it("preserves a known server countdown label exactly, including overdue text", () => {
    expect(
      alertTiming({
        ...alert,
        countdownDays: -3,
        countdownLabel: "3d overdue",
      }),
    ).toBe("3d overdue");
  });
  it("filters inaccessible clients before presenting names or counts and preserves server order", () => {
    const rows = accessibleAlerts(
      [
        { ...alert, id: `${otherId}:one`, clientId: otherId, title: "Hidden" },
        { ...alert, id: `${clientId}:later`, severity: "info" },
        alert,
      ],
      [{ id: clientId, name: "Current authorized name" }],
    );
    expect(rows.map((row) => row.id)).toEqual([`${clientId}:later`, alert.id]);
    expect(
      rows.every((row) => row.clientName === "Current authorized name"),
    ).toBe(true);
    expect(accessibleAlerts([alert], [])).toEqual([]);
  });
  it("uses a canonical client route instead of the raw source href", () => {
    expect(alertClientHref(clientId)).toBe(`/portfolio/${clientId}`);
    expect(alertCategory("hearing")).toBe("Hearing");
    expect(alertCategory("new_source_type")).toBe("new_source_type");
  });
  it.each([
    { alerts: [{ ...alert, id: `${otherId}:one` }] },
    { alerts: [alert, alert] },
    { alerts: [{ ...alert, clientId: "not-a-client-id" }] },
    { total: 0 },
    { alerts: [{ ...alert, when: "not-a-date" }] },
    { generatedAt: "not-a-date" },
    { alerts: [{ ...alert, countdownDays: Number.POSITIVE_INFINITY }] },
  ])(
    "rejects invalid association, identity, count or provenance %j",
    (change) => {
      expect(
        portfolioAlertsSchema.safeParse({ ...response, ...change }).success,
      ).toBe(false);
    },
  );
  it("accepts the server's ambiguous empty fallback without interpreting it as complete", () => {
    expect(
      portfolioAlertsSchema.parse({
        ...response,
        alerts: [],
        total: 0,
        clientCount: 0,
      }).alerts,
    ).toEqual([]);
  });
  it("reads only the verified core route with bounded limit and abort support", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(response)));
    const signal = new AbortController().signal;
    await expect(
      loadPortfolioAlerts(createApiClient(fetcher), signal),
    ).resolves.toEqual(response);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/backend/core/intelligence/portfolio-alerts?limit=50",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        signal,
      }),
    );
  });
  it("uses canonical session expiry handling and refuses malformed successful receipts", async () => {
    const expired = vi.fn();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...response, total: -1 })),
      );
    const api = createApiClient(fetcher, expired);
    await expect(loadPortfolioAlerts(api)).rejects.toMatchObject({
      status: 401,
    });
    expect(expired).toHaveBeenCalledOnce();
    await expect(loadPortfolioAlerts(api)).rejects.toMatchObject({
      status: 502,
    });
  });
});

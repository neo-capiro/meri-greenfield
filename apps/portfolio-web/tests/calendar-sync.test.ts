import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  fetchOwnedCalendarConnections,
  runCalendarSync,
} from "../src/features/calendar/sync/api";
import {
  syncAttemptKey,
  syncIntentSchema,
  syncRangeSchema,
} from "../src/features/calendar/sync/contracts";
const id = "80000000-0000-4000-8000-000000000001";
const account = {
  id,
  provider: "microsoft_365",
  accountEmail: "synthetic@example.test",
  displayName: null,
  status: "connected",
  createdByUserId: "user",
  lastSyncAt: null,
};
const stats = {
  scanned: 2,
  matched: 1,
  skipped: 1,
  removed: 0,
  failed: 0,
  pages: 1,
  hasMore: false,
};
function fixture(
  provider = "microsoft_365",
  result: unknown = { connectionId: id, calendar: stats },
) {
  const calls: { url: string; options?: RequestInit }[] = [];
  const api = createApiClient(async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(
      JSON.stringify(
        String(url).includes("/integrations/")
          ? result
          : [{ ...account, provider }],
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  return { api, calls };
}
describe("calendar-only sync contracts", () => {
  it.each(["microsoft_365", "google_workspace"] as const)(
    "%s sends only calendar=1/mail=0 with no body/reset/client",
    async (provider) => {
      const { api, calls } = fixture(provider);
      let recorded = false;
      const receipt = await runCalendarSync(
        api,
        { connectionId: id, provider },
        "user",
        () => {},
        () => {
          recorded = true;
        },
      );
      expect(recorded).toBe(true);
      expect(receipt).toEqual({
        kind: "connection",
        connectionId: id,
        calendar: stats,
      });
      expect(calls).toHaveLength(2);
      const request = calls[1]!;
      expect(request.url).toBe(
        `/api/backend/core/engagement/integrations/${provider === "microsoft_365" ? "microsoft" : "google"}/${id}/sync?calendar=1&mail=0`,
      );
      expect(request.options?.method).toBe("POST");
      expect(request.options?.body).toBeUndefined();
      expect(request.url).not.toMatch(/reset|clientId/);
    },
  );
  it("window receipt stays bare statistics, without fabricated account/range confirmation", async () => {
    const { api, calls } = fixture("microsoft_365", stats);
    const range = { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" };
    expect(
      await runCalendarSync(
        api,
        { connectionId: id, provider: "microsoft_365", range },
        "user",
        () => {},
        () => {},
      ),
    ).toEqual({ kind: "window", calendar: stats });
    const url = new URL(calls[1]!.url, "http://localhost");
    expect(url.pathname).toContain("/calendar-window");
    expect(Object.fromEntries(url.searchParams)).toEqual(range);
    expect(calls[1]?.options?.body).toBeUndefined();
  });
  it("changed actor after account preflight refuses POST safely", async () => {
    const { api, calls } = fixture();
    let guards = 0;
    await expect(
      runCalendarSync(
        api,
        { connectionId: id, provider: "microsoft_365" },
        "user",
        () => {
          if (++guards === 2) throw new Error("Actor changed");
        },
        () => {},
      ),
    ).rejects.toMatchObject({ uncertain: false, message: "Actor changed" });
    expect(calls).toHaveLength(1);
  });
  it("caller-owned list does not accept another creator", async () => {
    const { api } = fixture();
    await expect(
      fetchOwnedCalendarConnections(api, "other-user"),
    ).rejects.toThrow("outside the current caller");
  });
  it("provider mismatch and disconnected accounts cannot dispatch", async () => {
    const { api, calls } = fixture("google_workspace");
    await expect(
      runCalendarSync(
        api,
        { connectionId: id, provider: "microsoft_365" },
        "user",
        () => {},
        () => {},
      ),
    ).rejects.toMatchObject({ uncertain: false });
    expect(calls).toHaveLength(1);
  });
  it("wrong connection response is uncertain after POST", async () => {
    const { api, calls } = fixture("microsoft_365", {
      connectionId: "80000000-0000-4000-8000-000000000002",
      calendar: stats,
    });
    await expect(
      runCalendarSync(
        api,
        { connectionId: id, provider: "microsoft_365" },
        "user",
        () => {},
        () => {},
      ),
    ).rejects.toMatchObject({ uncertain: true });
    expect(
      calls.filter((call) => call.options?.method === "POST"),
    ).toHaveLength(1);
  });
  it("authority loss after a successful response remains uncertain", async () => {
    const { api } = fixture();
    let guards = 0;
    await expect(
      runCalendarSync(
        api,
        { connectionId: id, provider: "microsoft_365" },
        "user",
        () => {
          if (++guards === 4) throw new Error("Session invalidated");
        },
        () => {},
      ),
    ).rejects.toMatchObject({ uncertain: true });
  });
  it("provider HTTP400 may follow writes and is never an automatic retry", async () => {
    let posts = 0;
    const api = createApiClient(async (url, options) => {
      if (options?.method === "POST") {
        posts++;
        return new Response(
          JSON.stringify({ message: "Provider refused a later page" }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify([account]), { status: 200 });
    });
    await expect(
      runCalendarSync(
        api,
        { connectionId: id, provider: "microsoft_365" },
        "user",
        () => {},
        () => {},
      ),
    ).rejects.toMatchObject({ uncertain: true });
    expect(posts).toBe(1);
  });
  it("valid ISO bounds have no invented maximum span; Google range is rejected", () => {
    const range = {
      from: "2020-01-01T00:00:00Z",
      to: "2030-01-01T00:00:00+00:00",
    };
    expect(syncRangeSchema.safeParse(range).success).toBe(true);
    expect(
      syncRangeSchema.safeParse({ ...range, to: range.from }).success,
    ).toBe(false);
    expect(
      syncRangeSchema.safeParse({ ...range, from: "2026-10-01" }).success,
    ).toBe(false);
    expect(
      syncIntentSchema.safeParse({
        connectionId: id,
        provider: "google_workspace",
        range,
      }).success,
    ).toBe(false);
  });
  it("transient fences are actor and tenant scoped", () => {
    expect(syncAttemptKey("tenant-a", "user-a")).not.toEqual(
      syncAttemptKey("tenant-a", "user-b"),
    );
    expect(syncAttemptKey("tenant-a", "user-a")).not.toEqual(
      syncAttemptKey("tenant-b", "user-a"),
    );
  });
});

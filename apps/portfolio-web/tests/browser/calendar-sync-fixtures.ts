import type { Page } from "@playwright/test";
export const syncMicrosoftId = "80000000-0000-4000-8000-000000000001";
export const syncGoogleId = "80000000-0000-4000-8000-000000000002";
export const syncStats = {
  scanned: 3,
  matched: 2,
  skipped: 1,
  removed: 0,
  failed: 0,
  pages: 1,
  hasMore: false,
};
export async function installCalendarSyncFixtures(
  page: Page,
  options: {
    enabled?: boolean;
    status?: string;
    delay?: number;
    responseStatus?: number;
    hasMore?: boolean;
    preflightDelay?: number;
    fallback?: boolean;
  } = {},
) {
  const state = {
    reads: 0,
    writes: [] as { url: string; method: string; body: string | null }[],
    unexpected: [] as string[],
  };
  await page.route("**/api/backend/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const reply = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (request.method() === "GET" && url.pathname.endsWith("/core/me"))
      return reply({
        user: { id: "sync-user", email: "synthetic@example.test" },
        tenant: { id: "sync-tenant", name: "Synthetic tenant" },
        role: "standard_user",
      });
    if (
      request.method() === "GET" &&
      url.pathname.endsWith("/engagement/capabilities")
    )
      return reply({
        runtime: { externalActionsEnabled: options.enabled !== false },
      });
    if (
      request.method() === "GET" &&
      url.pathname.endsWith("/engagement/integrations")
    ) {
      state.reads++;
      if (state.reads > 1 && options.preflightDelay)
        await new Promise((resolve) =>
          setTimeout(resolve, options.preflightDelay),
        );
      return reply(
        [
          [syncMicrosoftId, "microsoft_365", "microsoft@example.test"],
          [syncGoogleId, "google_workspace", "google@example.test"],
        ].map(([id, provider, accountEmail]) => ({
          id,
          provider,
          accountEmail,
          displayName: null,
          createdByUserId: "sync-user",
          status: options.status ?? "connected",
          lastSyncAt: null,
        })),
      );
    }
    if (
      request.method() === "POST" &&
      /\/integrations\/(microsoft|google)\/[^/]+\/(sync|calendar-window)$/.test(
        url.pathname,
      )
    ) {
      state.writes.push({
        url: url.pathname + url.search,
        method: request.method(),
        body: request.postData(),
      });
      if (options.delay)
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      if (options.responseStatus)
        return reply(
          { message: "Synthetic provider refused a later page" },
          options.responseStatus,
        );
      const calendar = {
        ...syncStats,
        hasMore: options.hasMore ?? false,
        ...(options.hasMore ? { pages: 12 } : {}),
      };
      return reply(
        url.pathname.endsWith("calendar-window")
          ? calendar
          : { connectionId: url.pathname.split("/").at(-2), calendar },
      );
    }
    if (options.fallback) return route.fallback();
    state.unexpected.push(`${request.method()} ${url.pathname}`);
    return reply({ message: "Unexpected synthetic request" }, 500);
  });
  return state;
}

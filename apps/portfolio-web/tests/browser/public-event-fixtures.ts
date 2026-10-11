import type { Page } from "@playwright/test";
import { installFixtures, json } from "./fixtures";
import { publicEventFixture, publicEventId } from "./public-event-data";
export {
  publicEventFixture,
  publicEventId,
  publicEventClientId,
} from "./public-event-data";
export async function installPublicEventFixtures(page: Page) {
  const unexpected = await installFixtures(page);
  const state = {
    reads: [] as string[],
    writes: [] as string[],
    body: structuredClone(publicEventFixture) as unknown,
    status: 200,
    wait: undefined as Promise<void> | undefined,
  };
  await page.route(
    "**/core/legiwatch/live-hearings/events/**/detail-v2*",
    async (route) => {
      const request = route.request();
      if (request.method() !== "GET") {
        state.writes.push(request.method());
        return json(
          route,
          { message: "Read-only fixture refuses writes" },
          405,
        );
      }
      state.reads.push(request.url());
      const body = structuredClone(state.body),
        status = state.status,
        wait = state.wait;
      if (wait) await wait;
      return json(
        route,
        status === 200
          ? body
          : { message: "Synthetic proceeding read unavailable" },
        status,
      );
    },
  );
  return { state, unexpected };
}
export async function installPublicEventCalendarFixtures(page: Page) {
  const fixtures = await installPublicEventFixtures(page);
  await page.route("**/core/legiwatch/live-hearings/calendar?**", (route) => {
    if (route.request().method() !== "GET") {
      fixtures.state.writes.push(route.request().method());
      return json(route, { message: "Read-only calendar fixture" }, 405);
    }
    return json(route, {
      rows: [
        {
          id: publicEventId,
          canonicalEventId: "different-dedupe-event-id",
          title: publicEventFixture.hearing.title,
          date: "2026-10-08",
          startsAt: "2026-10-08T14:00:00Z",
          timezone: "America/New_York",
          eventStatus: "scheduled",
          officialPageUrl: "https://committee.example.test/events/one",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 200,
    });
  });
  return fixtures;
}

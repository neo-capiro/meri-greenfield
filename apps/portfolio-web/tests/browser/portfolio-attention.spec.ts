import { test, expect, type Page } from "@playwright/test";
import { client, clientId, installFixtures, json } from "./fixtures";

const secondId = "10000000-0000-4000-8000-000000000002";
const hiddenId = "10000000-0000-4000-8000-000000000099";
const endpoint = "**/api/backend/core/intelligence/portfolio-alerts**";
const first = {
  id: `${clientId}:bill:synthetic`,
  clientId,
  clientName: "Stale source client name",
  type: "bill_movement",
  severity: "critical",
  title: "Synthetic tracked bill has a recorded action",
  subtitle: "Synthetic action detail retained from source",
  when: "2026-10-10T14:00:00Z",
  countdownDays: null,
  countdownLabel: "1d ago",
  href: "javascript:alert(1)",
  state: "acknowledged",
  canonicalComplete: false,
  canonicalMissingFields: ["issueId", "whoActs"],
};
const second = {
  ...first,
  id: `${secondId}:hearing:synthetic`,
  clientId: secondId,
  clientName: "Stale second client",
  type: "hearing",
  severity: "notable",
  title: "Synthetic linked hearing",
  subtitle: "Synthetic committee source",
  countdownDays: 3,
  countdownLabel: "3d left",
  state: null,
};
const response = {
  alerts: [
    first,
    {
      ...first,
      id: `${hiddenId}:private`,
      clientId: hiddenId,
      title: "Hidden source alert",
      clientName: "Hidden source client",
    },
    second,
  ],
  total: 87,
  clientCount: 40,
  generatedAt: "2026-10-11T06:00:00Z",
};
async function fixtures(page: Page) {
  const unexpected = await installFixtures(page);
  await page.route("**/api/backend/core/clients", (route) =>
    json(route, [
      client,
      { ...client, id: secondId, name: "Test Energy", sectorTag: "Energy" },
    ]),
  );
  await page.route(endpoint, (route) => json(route, response));
  return unexpected;
}
const card = (page: Page) =>
  page.getByRole("complementary", { name: "Needs attention" });

test("source alerts preserve server order and provenance, accessible identity and actual profile links", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  await page.goto("/portfolio");
  const attention = card(page);
  await expect(attention.getByLabel("2 shown alerts")).toBeVisible();
  const links = attention.getByRole("link");
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toContainText(first.title);
  await expect(links.nth(1)).toContainText(second.title);
  await expect(links.first()).toHaveAttribute("href", `/portfolio/${clientId}`);
  await expect(links.first()).toContainText("1d ago");
  await expect(links.first()).toContainText(
    "Source details incomplete · Acknowledged",
  );
  await expect(attention).not.toContainText("Hidden source");
  await expect(attention).not.toContainText("Stale source");
  await expect(attention).not.toContainText("87");
  await expect(attention).toContainText("Limited feed");
  await page.getByLabel("Search profiles").fill(client.name);
  await expect(attention.getByRole("link")).toHaveCount(2);
  await expect(attention).toContainText("Test Energy");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await attention.evaluate((element) => getComputedStyle(element).fontFamily),
  ).toContain("Geist");
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (font) => font.family.includes("Geist") && font.status === "loaded",
      ),
    ),
  ).toBe(true);
  await page.screenshot({
    path: "work/attention-evidence/desktop-light.png",
    fullPage: true,
  });
  await links.first().click();
  await expect(page).toHaveURL(`/portfolio/${clientId}`);
  expect(unexpected).toEqual([]);
});

test("pending feed does not render empty or successful counts", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await gate;
    return json(route, response);
  });
  await page.goto("/portfolio");
  await expect(card(page).getByRole("status")).toContainText("Loading");
  await expect(card(page).getByLabel("2 shown alerts")).toHaveCount(0);
  await expect(card(page)).not.toContainText("No alerts were returned");
  if (!release) throw new Error("Pending fixture release missing");
  release();
  await expect(card(page).getByLabel("2 shown alerts")).toBeVisible();
  expect(unexpected).toEqual([]);
});

test("failure requires explicit retry and recovers without a successful empty claim", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  let failure = true;
  let calls = 0;
  await page.route(endpoint, (route) => {
    calls++;
    return failure
      ? json(route, { message: "Synthetic feed unavailable" }, 503)
      : json(route, response);
  });
  await page.goto("/portfolio");
  await expect(card(page).getByRole("alert")).toContainText(
    "Synthetic feed unavailable",
  );
  expect(calls).toBe(1);
  await expect(card(page)).not.toContainText("No alerts were returned");
  failure = false;
  await card(page).getByRole("button", { name: "Retry" }).click();
  await expect(card(page).getByRole("link")).toHaveCount(2);
  expect(calls).toBe(2);
  expect(unexpected).toEqual([]);
});

test("refresh failure suppresses cached source records until retry succeeds", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  await page.goto("/portfolio");
  await expect(card(page).getByRole("link")).toHaveCount(2);
  await page.route(endpoint, (route) =>
    json(route, { message: "Synthetic refresh failed" }, 503),
  );
  await card(page).getByRole("button", { name: "Refresh alerts" }).click();
  await expect(card(page).getByRole("alert")).toContainText(
    "Synthetic refresh failed",
  );
  await expect(card(page).getByRole("link")).toHaveCount(0);
  await expect(card(page).getByLabel("2 shown alerts")).toHaveCount(0);
  await page.route(endpoint, (route) => json(route, response));
  await card(page).getByRole("button", { name: "Retry" }).click();
  await expect(card(page).getByRole("link")).toHaveCount(2);
  expect(unexpected).toEqual([]);
});

test("wrong client receipt is refused rather than linked to a different client", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  await page.route(endpoint, (route) =>
    json(route, {
      ...response,
      alerts: [{ ...first, id: `${secondId}:wrong-binding` }],
    }),
  );
  await page.goto("/portfolio");
  await expect(card(page).getByRole("alert")).toContainText(
    "unexpected response",
  );
  await expect(card(page).getByRole("link")).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("ambiguous HTTP200 empty fallback describes incomplete coverage and allows refresh", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  await page.route(endpoint, (route) =>
    json(route, { ...response, alerts: [], total: 0, clientCount: 0 }),
  );
  await page.goto("/portfolio");
  await expect(card(page)).toContainText(
    "does not confirm there is nothing to review",
  );
  await expect(card(page).getByLabel("0 shown alerts")).toBeVisible();
  await page.route(endpoint, (route) => json(route, response));
  await card(page).getByRole("button", { name: "Refresh alerts" }).click();
  await expect(card(page).getByRole("link")).toHaveCount(2);
  expect(unexpected).toEqual([]);
});

test("portal role fails closed and never requests the restricted feed", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  let feedCalls = 0;
  await page.route(endpoint, (route) => {
    feedCalls++;
    return json(route, response);
  });
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      tenant: { id: "tenant-test", name: "Synthetic tenant" },
      role: "portal_user",
    }),
  );
  await page.goto("/portfolio");
  await expect(card(page)).toContainText("cannot access portfolio alerts");
  expect(feedCalls).toBe(0);
  await expect(card(page).getByRole("link")).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("identity lookup failure blocks the feed before explicit identity recovery", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  let feedCalls = 0;
  await page.route(endpoint, (route) => {
    feedCalls++;
    return json(route, response);
  });
  await page.route("**/api/backend/core/me", (route) =>
    json(route, { message: "Synthetic identity lookup failed" }, 503),
  );
  await page.goto("/portfolio");
  await expect(card(page).getByRole("alert")).toContainText(
    "Synthetic identity lookup failed",
  );
  expect(feedCalls).toBe(0);
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      tenant: { id: "tenant-test", name: "Synthetic tenant" },
      role: "standard_user",
    }),
  );
  await card(page).getByRole("button", { name: "Retry" }).click();
  await expect(card(page).getByRole("link")).toHaveCount(2);
  expect(feedCalls).toBe(1);
  expect(unexpected).toEqual([]);
});

test("server authorization refusal overrides the allowed frontend role", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  await page.route(endpoint, (route) =>
    json(route, { message: "Forbidden" }, 403),
  );
  await page.goto("/portfolio");
  await expect(card(page).getByRole("alert")).toContainText(
    "You do not have permission for this operation.",
  );
  await expect(card(page).getByRole("link")).toHaveCount(0);
  await expect(card(page)).not.toContainText("No alerts were returned");
  expect(unexpected).toEqual([]);
});

test("expired alert session uses the shared sign-in recovery", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  await page.route(endpoint, (route) =>
    json(route, { message: "Expired" }, 401),
  );
  await page.goto("/portfolio");
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/sign-in");
  expect(unexpected).toEqual([]);
});

test("mobile dark card remains scrollable, keyboard accessible and within the viewport", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route(endpoint, (route) =>
    json(route, {
      ...response,
      total: 20,
      alerts: Array.from({ length: 20 }, (_, index) => ({
        ...first,
        id: `${clientId}:synthetic-${index}`,
        title: `Synthetic source alert ${index + 1}`,
      })),
    }),
  );
  await page.goto("/portfolio");
  await expect(card(page).getByLabel("20 shown alerts")).toBeVisible();
  await card(page).scrollIntoViewIfNeeded();
  const list = card(page).getByRole("list");
  expect(
    await list.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  const last = list.getByRole("link").last();
  await last.focus();
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await page.screenshot({
    path: "work/attention-evidence/mobile-dark.png",
    fullPage: true,
  });
  await last.blur();
  await list.evaluate((element) => {
    element.scrollTop = 0;
  });
  await card(page).scrollIntoViewIfNeeded();
  await card(page).screenshot({
    path: "work/attention-evidence/mobile-dark-card.png",
  });
  expect(unexpected).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { clientId, installFixtures, json } from "./fixtures";
test.use({ timezoneId: "America/Los_Angeles" });
const record = (
  id: string,
  occurredAt: string,
  kind = "note",
  body: string | null = null,
) => ({
  id,
  title: id,
  occurredAt,
  kind,
  body,
  origin: "recorded",
  sourceType: null,
  sourceId: null,
  dueAt: null,
  settledAt: null,
  pinned: false,
});
const rows = [
  record("Before local day", "2026-11-01T06:59:59Z"),
  record("Pilot start", "2026-11-01T07:00:00Z", "meeting"),
  record("Local late note", "2026-11-02T07:59:59Z", "note", "Pilot funding"),
  record("After local day", "2026-11-02T08:00:00Z"),
];
test("history search, kind, inclusive local dates, invalid range and clear use the existing feed", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let reads = 0;
  await page.route(
    `**/api/backend/core/clients/${clientId}/activity*`,
    (route) => {
      reads++;
      expect(new URL(route.request().url()).searchParams.get("limit")).toBe(
        "500",
      );
      return json(route, rows);
    },
  );
  await page.goto(`/portfolio/${clientId}`);
  const timeline = page.getByRole("region", {
    name: "Activity timeline",
    exact: true,
  });
  await expect(
    timeline.getByText("Before local day", { exact: true }),
  ).toBeVisible();
  await timeline
    .getByRole("button", { name: "Activity dates: All dates", exact: true })
    .click();
  const dates = page.getByRole("dialog", { name: "Activity date range" });
  await dates.getByLabel("From", { exact: true }).fill("2026-11-01");
  await dates.getByLabel("Through", { exact: true }).fill("2026-11-01");
  await dates.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    timeline.getByText("Before local day", { exact: true }),
  ).not.toBeVisible();
  await expect(
    timeline.getByText("After local day", { exact: true }),
  ).not.toBeVisible();
  await expect(
    timeline.getByText("Local late note", { exact: true }),
  ).toBeVisible();
  await timeline
    .getByRole("searchbox", { name: "Search activity", exact: true })
    .fill("PILOT");
  await timeline
    .getByRole("button", { name: "Activity type", exact: true })
    .click();
  await page.getByRole("menuitemradio", { name: "note", exact: true }).click();
  await expect(
    timeline.getByText("Pilot start", { exact: true }),
  ).not.toBeVisible();
  await expect(
    timeline.getByText("Local late note", { exact: true }),
  ).toBeVisible();
  await timeline
    .getByRole("button", { name: "Activity dates: Date range", exact: true })
    .click();
  await dates.getByLabel("From", { exact: true }).fill("2026-11-02");
  await dates.getByRole("button", { name: "Done", exact: true }).click();
  await expect(timeline.getByRole("alert")).toContainText("start date");
  await timeline
    .getByRole("button", { name: "Activity dates: Date range", exact: true })
    .click();
  await dates
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    timeline.getByRole("searchbox", { name: "Search activity", exact: true }),
  ).toHaveValue("");
  await expect(
    timeline.getByText("Pilot start", { exact: true }),
  ).toBeVisible();
  await expect(
    timeline.getByText("Before local day", { exact: true }),
  ).toBeVisible();
  await expect(timeline.getByRole("alert")).not.toBeVisible();
  const geometry = await timeline
    .locator('[aria-label="Activity filters"] img')
    .evaluateAll((images) =>
      images.map((img) => ({
        width: img.getBoundingClientRect().width,
        height: img.getBoundingClientRect().height,
        loaded:
          img instanceof HTMLImageElement &&
          img.complete &&
          img.naturalWidth > 0,
      })),
    );
  expect(geometry).toEqual(
    [16, 16, 14, 16, 14].map((size) => ({
      width: size,
      height: size,
      loaded: true,
    })),
  );
  await timeline.screenshot({
    path: "test-results/activity-history-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await timeline.screenshot({
    path: "test-results/activity-history-mobile-dark.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(reads).toBe(1);
  expect(unexpected).toEqual([]);
});
test("history failure and retry retain entered filters", async ({ page }) => {
  const unexpected = await installFixtures(page);
  let failing = true;
  await page.route(
    `**/api/backend/core/clients/${clientId}/activity*`,
    (route) =>
      failing
        ? json(route, { message: "Synthetic history unavailable" }, 503)
        : json(route, rows),
  );
  await page.goto(`/portfolio/${clientId}`);
  const timeline = page.getByRole("region", {
    name: "Activity timeline",
    exact: true,
  });
  await expect(timeline.getByRole("alert")).toContainText(
    "Synthetic history unavailable",
  );
  await timeline
    .getByRole("searchbox", { name: "Search activity", exact: true })
    .fill("funding");
  failing = false;
  await timeline.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    timeline.getByText("Local late note", { exact: true }),
  ).toBeVisible();
  await expect(
    timeline.getByText("Pilot start", { exact: true }),
  ).not.toBeVisible();
  await expect(
    timeline.getByRole("searchbox", { name: "Search activity", exact: true }),
  ).toHaveValue("funding");
  expect(unexpected).toEqual([]);
});

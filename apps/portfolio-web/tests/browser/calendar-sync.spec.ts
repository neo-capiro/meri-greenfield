import { test, expect } from "@playwright/test";
import {
  installCalendarSyncFixtures,
  syncMicrosoftId,
} from "./calendar-sync-fixtures";
async function open(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: "Open calendar sync", exact: true })
    .click();
  return page.getByRole("dialog");
}
test("explicit Microsoft calendar-only completion with truthful processing receipt", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page);
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  expect(state.writes).toHaveLength(0);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect(dialog.getByLabel("Calendar sync result")).toContainText(
    "3 scanned · 2 matched",
  );
  await expect(dialog).toContainText("not newly created meetings");
  expect(state.writes).toEqual([
    {
      url: `/api/backend/core/engagement/integrations/microsoft/${syncMicrosoftId}/sync?calendar=1&mail=0`,
      method: "POST",
      body: null,
    },
  ]);
  expect(state.unexpected).toEqual([]);
});
test("reviewed window is explicit and twelve-page partial results cannot claim resume", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page, { hasMore: true });
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  await dialog.getByRole("checkbox").check();
  await expect(dialog).toContainText(
    "2026-10-01T00:00:00Z → 2026-11-01T00:00:00Z",
  );
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect(dialog).toContainText("cannot resume from the next page");
  await expect(dialog).toContainText(
    "without an operation, account or range-bound receipt",
  );
  const url = new URL(state.writes[0]!.url, "http://localhost");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    from: "2026-10-01T00:00:00Z",
    to: "2026-11-01T00:00:00Z",
  });
  expect(state.writes).toHaveLength(1);
});
test("Google does not offer the Microsoft range and excludes mail", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page);
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption({ label: "Google · google@example.test" });
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await expect(dialog).toContainText(
    "does not select the displayed date range",
  );
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect(dialog.getByLabel("Calendar sync result")).toBeVisible();
  expect(state.writes[0]?.url).toContain("/google/");
  expect(state.writes[0]?.url).toContain("calendar=1&mail=0");
});
test("unknown result survives close, route remount and returning to the initiating actor", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page, {
    responseStatus: 400,
  });
  await page.goto("/__test/calendar-sync");
  let dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Sync outcome unknown");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Unmount sync" }).click();
  dialog = await open(page);
  await expect(dialog).toContainText("request is frozen");
  await expect(
    dialog.getByRole("button", { name: "Import calendar meetings" }),
  ).toHaveCount(0);
  await page.evaluate(() => window.__syncActor?.(true));
  await expect(dialog).not.toContainText("request is frozen");
  await page.evaluate(() => window.__syncActor?.(false));
  await expect(dialog).toContainText("request is frozen");
  expect(state.writes).toHaveLength(1);
});
test("Cancel stops waiting and cannot erase the dispatched fence", async ({
  page,
}, testInfo) => {
  const state = await installCalendarSyncFixtures(page, { delay: 1200 });
  await page.goto("/__test/calendar-sync");
  let dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect(dialog).toHaveAccessibleName("Syncing calendar");
  await expect(dialog).toContainText("does not cancel the calendar import");
  await page.screenshot({
    path: testInfo.outputPath("calendar-sync-desktop-light.png"),
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  dialog = await open(page);
  await expect(dialog).toContainText("request is frozen");
  expect(state.writes).toHaveLength(1);
});
test("identity invalidation during preflight prevents POST", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page, {
    preflightDelay: 350,
  });
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect.poll(() => state.reads).toBeGreaterThan(1);
  await page.evaluate(() => window.__syncInvalidate?.());
  await expect(dialog.getByRole("alert")).toContainText(
    "session or permissions changed",
  );
  expect(state.writes).toEqual([]);
});
test("identity invalidation after dispatch freezes rather than accepting late success", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page, { delay: 400 });
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() => window.__syncInvalidate?.());
  await expect(dialog).toContainText("Sync outcome unknown");
  await expect(dialog.getByLabel("Calendar sync result")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
test("disabled runtime and unavailable connection cannot start sync", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page, { enabled: false });
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await expect(
    dialog.getByRole("button", { name: "Import calendar meetings" }),
  ).toBeDisabled();
  await expect(dialog).toContainText("enabled external actions");
  expect(state.writes).toEqual([]);
});
test("mobile dark pending matches dialog geometry and keyboard closure", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const state = await installCalendarSyncFixtures(page, { delay: 2000 });
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect(dialog).toHaveAccessibleName("Syncing calendar");
  await expect(dialog).toHaveCSS("padding", "16px");
  await expect(dialog).toHaveCSS("background-color", "rgb(27, 27, 27)");
  expect((await dialog.boundingBox())?.width).toBe(358);
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await document.fonts.load('14px "Geist Test"')).length,
      ),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("calendar-sync-mobile-dark.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test("actual actor change while dispatched hides late receipt and preserves original actor fence", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page, { delay: 500 });
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() => window.__syncActor?.(true));
  await expect(dialog.getByLabel("Calendar sync result")).toHaveCount(0);
  await page.evaluate(() => window.__syncActor?.(false));
  await expect(dialog).toContainText("Sync outcome unknown");
  expect(state.writes).toHaveLength(1);
});

test("rapid duplicate consent does not dispatch a second provider request", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page, {
    preflightDelay: 300,
  });
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .dblclick();
  await expect(dialog.getByLabel("Calendar sync result")).toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test("disconnected accounts are honestly unavailable without reconnect controls", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page, {
    status: "needs_configuration",
  });
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await expect(dialog).toContainText(
    "No connected Microsoft or Google calendar is available",
  );
  await expect(
    dialog.getByRole("button", { name: "Import calendar meetings" }),
  ).toBeDisabled();
  await expect(dialog.getByRole("link")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("identity invalidation while idle immediately disables consent with no request", async ({
  page,
}) => {
  const state = await installCalendarSyncFixtures(page);
  await page.goto("/__test/calendar-sync");
  const dialog = await open(page);
  await dialog
    .getByRole("combobox", { name: "Connected account", exact: true })
    .selectOption(syncMicrosoftId);
  await expect(
    dialog.getByRole("button", { name: "Import calendar meetings" }),
  ).toBeEnabled();
  await page.evaluate(() => window.__syncInvalidate?.());
  await expect(
    dialog.getByRole("button", { name: "Import calendar meetings" }),
  ).toBeDisabled();
  expect(state.writes).toEqual([]);
});

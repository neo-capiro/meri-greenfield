import { test, expect } from "@playwright/test";
import { clientId, installFixtures } from "./fixtures";
import {
  installCalendarSyncFixtures,
  syncMicrosoftId,
} from "./calendar-sync-fixtures";

test("actual Master Calendar imports only the reviewed DST window and retains client/view/date/zone", async ({
  page,
}, testInfo) => {
  const unexpected = await installFixtures(page);
  const state = await installCalendarSyncFixtures(page, { fallback: true });
  const path = `/calendar?clientId=${clientId}&view=week&date=2026-11-01&zone=America%2FNew_York`;
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Master Calendar" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sync calendar", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Test Aerospace’s calendar");
  await dialog
    .getByRole("combobox", { name: "Connected account" })
    .selectOption(syncMicrosoftId);
  await dialog.getByRole("checkbox").check();
  await expect(dialog).toContainText(
    "2026-11-01T04:00:00Z → 2026-11-08T05:00:00Z",
  );
  expect(state.writes).toHaveLength(0);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect(
    dialog.getByRole("region", { name: "Calendar sync result" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  const url = new URL(state.writes[0]!.url, "http://localhost");
  expect(url.pathname).toBe(
    `/api/backend/core/engagement/integrations/microsoft/${syncMicrosoftId}/calendar-window`,
  );
  expect(Object.fromEntries(url.searchParams)).toEqual({
    from: "2026-11-01T04:00:00Z",
    to: "2026-11-08T05:00:00Z",
  });
  expect(state.writes[0]!.body).toBeNull();
  await dialog
    .locator("footer")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp("clientId=" + clientId));
  expect(new URL(page.url()).search).toBe(
    new URL(path, "http://localhost").search,
  );
  expect(unexpected).toEqual([]);
  expect(state.unexpected).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("master-calendar-window.png"),
    fullPage: true,
  });
});

test("actual client Calendar retains uncertain import across view changes without replay", async ({
  page,
}, testInfo) => {
  const unexpected = await installFixtures(page);
  const state = await installCalendarSyncFixtures(page, {
    fallback: true,
    responseStatus: 400,
  });
  await page.goto(
    `/portfolio/${clientId}/calendar?view=agenda&date=2026-10-20&zone=UTC`,
  );
  await page
    .getByRole("button", { name: "Sync calendar", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Connected account" })
    .selectOption(syncMicrosoftId);
  await dialog
    .getByRole("button", { name: "Import calendar meetings" })
    .click();
  await expect(dialog).toContainText("Sync outcome unknown");
  await dialog
    .locator("footer")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Calendar view", exact: true })
    .selectOption("week");
  await page
    .getByRole("button", { name: "Sync calendar", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("request is frozen");
  await expect(
    dialog.getByRole("button", { name: "Import calendar meetings" }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.url).toContain("calendar=1&mail=0");
  expect(new URL(page.url()).searchParams.get("zone")).toBe("UTC");
  expect(new URL(page.url()).searchParams.get("date")).toBe("2026-10-20");
  expect(unexpected).toEqual([]);
  expect(state.unexpected).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(dialog).toHaveCSS("background-color", "rgb(27, 27, 27)");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("client-calendar-unknown-mobile-dark.png"),
    fullPage: true,
  });
});

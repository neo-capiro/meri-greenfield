import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { clientId } from "./fixtures";
import {
  installProfileTools,
  toolsClient,
  toolsIntelligence,
} from "./profile-tools-fixtures";

const overview = `/portfolio/${clientId}`;

test("Overview composes saved focus tags and updates the real profile cache", async ({
  page,
}, info) => {
  const fixture = await installProfileTools(page);
  await page.goto(overview);
  await expect(page.getByLabel("Client focus tags")).toContainText(
    "Saved focus",
  );
  const focus = await page.getByLabel("Client focus tags").boundingBox();
  const owner = await page
    .getByRole("button", { name: "Account team" })
    .boundingBox();
  if (!focus || !owner)
    throw new Error("The profile focus or ownership row is not visible");
  expect(focus.y + focus.height).toBeLessThan(owner.y);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await page.getByRole("textbox", { name: "Focus tag" }).fill("Overview focus");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Client focus tags")).toContainText(
    "Overview focus",
  );
  expect(fixture.current().intakeData).toEqual({
    ...toolsClient.intakeData,
    tags: ["Saved focus", "Overview focus"],
  });
  expect(fixture.calls.puts).toBe(1);
  expect(fixture.unexpected).toEqual([]);
  const pulse = page.getByRole("region", {
    name: "Engagement pulse",
    exact: true,
  });
  await expect(pulse).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(pulse).toHaveCSS("background-image", "none");
  await expect(
    pulse.getByRole("link", { name: "Open timeline →" }),
  ).toHaveAttribute("href", "#activity-timeline");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath("overview-focus-desktop.png"),
  });
});

test("profile menu prepares and explicitly downloads exact source JSON, then restores focus", async ({
  page,
}, info) => {
  const fixture = await installProfileTools(page);
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.goto(overview);
  const trigger = page.getByRole("button", {
    name: `More actions for ${toolsClient.name}`,
  });
  await trigger.click();
  await page
    .getByRole("menuitem", { name: "Export client profile JSON" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Export client profile" });
  await dialog.getByRole("button", { name: "Prepare JSON" }).click();
  await expect(
    dialog.getByText("Profile ready to download", { exact: true }),
  ).toBeVisible();
  expect(downloads).toBe(0);
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download JSON", exact: true })
    .click();
  const receipt = await download;
  const path = info.outputPath("overview-profile.json");
  await receipt.saveAs(path);
  const payload = JSON.parse(await readFile(path, "utf8"));
  expect(payload.client).toEqual(toolsClient);
  expect(payload.intelligence).toEqual(toolsIntelligence);
  expect(payload.complete).toBe(true);
  expect(fixture.calls.intel).toBe(1);
  expect(downloads).toBe(1);
  await page.screenshot({
    path: info.outputPath("overview-export-desktop.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(fixture.unexpected).toEqual([]);
});

test("mobile dark Overview retains focus editing and the token-based pulse surface", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const fixture = await installProfileTools(page);
  await page.goto(overview);
  await expect(page.getByLabel("Client focus tags")).toContainText(
    "Saved focus",
  );
  await expect(
    page.getByRole("region", { name: "Engagement pulse", exact: true }),
  ).toHaveCSS("background-color", "rgb(27, 27, 27)");
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  const dialog = page.getByRole("dialog", { name: "Add focus tag" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  if (!box) throw new Error("The focus tag dialog is not visible");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(fixture.calls.puts).toBe(0);
  expect(fixture.unexpected).toEqual([]);
  await page.screenshot({
    path: info.outputPath("overview-focus-mobile-dark.png"),
  });
});

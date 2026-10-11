import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { json } from "./fixtures";
import {
  installProfileTools,
  toolsClient,
  toolsIntelligence,
} from "./profile-tools-fixtures";
const route = "/__test/profile-tools";
test("a local authority failure after a dispatched CSV receipt cannot permit resend", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fixture = await installProfileTools(page, { heldWrite: () => held });
  await page.goto(route);
  await page.getByRole("button", { name: "Review client CSV" }).click();
  await page.getByLabel("Client CSV", { exact: true }).setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name\nAlpha\nBeta"),
  });
  await page.getByRole("button", { name: "Import 2 clients" }).click();
  await expect.poll(() => fixture.calls.imports).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("profile-tools-authority-invalidate")),
  );
  release();
  await expect(
    page.getByText("The import outcome is unknown.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import 2 clients" }),
  ).toBeDisabled();
  expect(fixture.calls.imports).toBe(1);
});
test("a local authority failure after a dispatched tag receipt remains uncertain", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fixture = await installProfileTools(page, { heldWrite: () => held });
  await page.goto(route);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await page
    .getByRole("textbox", { name: "Focus tag" })
    .fill("Dispatched draft");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await expect.poll(() => fixture.calls.puts).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("profile-tools-authority-invalidate")),
  );
  release();
  await expect(
    page.getByText("The save outcome is unknown.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add tag", exact: true }),
  ).toBeDisabled();
  expect(fixture.calls.puts).toBe(1);
});
test("client prop change discards an open old draft and prevents held-preflight late save", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fixture = await installProfileTools(page, { heldRead: () => held });
  const secondId = "10000000-0000-4000-8000-000000000003";
  let secondWrites = 0;
  await page.route(`**/api/backend/core/clients/${secondId}`, (request) => {
    if (request.request().method() !== "GET") secondWrites++;
    return json(request, {
      ...toolsClient,
      id: secondId,
      name: "Second synthetic client",
      intakeData: { tags: ["Other client focus"] },
    });
  });
  await page.goto(route);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await page
    .getByRole("textbox", { name: "Focus tag" })
    .fill("Old client draft");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await expect.poll(() => fixture.calls.gets).toBe(2);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("profile-tools-client-change")),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Client focus tags")).toContainText(
    "Other client focus",
  );
  release();
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await expect(page.getByRole("textbox", { name: "Focus tag" })).toHaveValue(
    "",
  );
  await expect(
    page.getByRole("button", { name: "Add tag", exact: true }),
  ).toBeDisabled();
  expect(fixture.calls.puts).toBe(0);
  expect(secondWrites).toBe(0);
});
test("actor and tenant change discards an open old tag draft", async ({
  page,
}) => {
  const fixture = await installProfileTools(page);
  await page.goto(route);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await page
    .getByRole("textbox", { name: "Focus tag" })
    .fill("Old actor draft");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("profile-tools-actor-change")),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await expect(page.getByRole("textbox", { name: "Focus tag" })).toHaveValue(
    "",
  );
  await expect(
    page.getByRole("button", { name: "Add tag", exact: true }),
  ).toBeDisabled();
  expect(fixture.calls.puts).toBe(0);
});
test("same-actor identity refresh cannot erase an unknown tag-write freeze", async ({
  page,
}) => {
  const fixture = await installProfileTools(page, { tagStatus: 503 });
  await page.goto(route);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await page
    .getByRole("textbox", { name: "Focus tag" })
    .fill("Uncertain draft");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await expect(
    page.getByText("The save outcome is unknown.", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("profile-tools-authority-invalidate")),
  );
  await expect(page.getByRole("textbox", { name: "Focus tag" })).toHaveValue(
    "Uncertain draft",
  );
  await expect(
    page.getByRole("button", { name: "Add tag", exact: true }),
  ).toBeDisabled();
  expect(fixture.calls.puts).toBe(1);
});
test("focus tag uses fresh intake, retains unrelated values and refreshes saved chips", async ({
  page,
}, info) => {
  const fixture = await installProfileTools(page);
  await page.goto(route);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await page.getByRole("textbox", { name: "Focus tag" }).fill("New focus");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Client focus tags")).toContainText("New focus");
  expect(fixture.current().intakeData).toEqual({
    ...toolsClient.intakeData,
    tags: ["Saved focus", "New focus"],
  });
  expect(fixture.calls.puts).toBe(1);
  expect(fixture.unexpected).toEqual([]);
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() =>
    [...document.fonts].map((font) => ({
      family: font.family,
      status: font.status,
    })),
  );
  expect(
    fonts.some(
      (font) => font.family === "Geist Test" && font.status === "loaded",
    ),
  ).toBe(true);
  await expect(page.getByLabel("Client focus tags")).toHaveCSS("gap", "6px");
  await page.screenshot({ path: info.outputPath("focus-tags-desktop.png") });
});
test("focus tag unknown PUT stays frozen across close and reopen", async ({
  page,
}) => {
  const fixture = await installProfileTools(page, { tagStatus: 503 });
  await page.goto(route);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await page.getByRole("textbox", { name: "Focus tag" }).fill("New focus");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await expect(
    page.getByText("The save outcome is unknown.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await expect(
    page.getByRole("button", { name: "Add tag", exact: true }),
  ).toBeDisabled();
  expect(fixture.calls.puts).toBe(1);
});
test("closing a held tag preflight prevents PUT", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fixture = await installProfileTools(page, { heldRead: () => held });
  await page.goto(route);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await page.getByRole("textbox", { name: "Focus tag" }).fill("New focus");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await expect.poll(() => fixture.calls.gets).toBe(2);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fixture.calls.puts).toBe(0);
});
test("tag save refuses invalidated authority after preflight", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fixture = await installProfileTools(page, { heldRead: () => held });
  await page.goto(route);
  await page.getByRole("button", { name: "+ Add focus tag" }).click();
  await page.getByRole("textbox", { name: "Focus tag" }).fill("New focus");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await expect.poll(() => fixture.calls.gets).toBe(2);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("profile-tools-authority-invalidate")),
  );
  release();
  await expect(page.getByRole("alert")).toContainText("current session");
  expect(fixture.calls.puts).toBe(0);
});
test("standard users can read focus but cannot add tags", async ({ page }) => {
  const fixture = await installProfileTools(page, { role: "standard_user" });
  await page.goto(route);
  await expect(page.getByLabel("Client focus tags")).toContainText(
    "Saved focus",
  );
  await expect(
    page.getByRole("button", { name: "+ Add focus tag" }),
  ).toBeDisabled();
  expect(fixture.calls.puts).toBe(0);
});
test("profile export downloads reviewed exact sources and attribution", async ({
  page,
}, info) => {
  const fixture = await installProfileTools(page);
  await page.goto(route);
  await page.getByRole("button", { name: "Review profile JSON" }).click();
  await page.getByRole("button", { name: "Prepare JSON" }).click();
  await expect(
    page.getByText("Profile ready to download", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download JSON", exact: true })
    .click();
  const file = await download;
  const path = info.outputPath("synthetic-profile.json");
  await file.saveAs(path);
  const payload = JSON.parse(await readFile(path, "utf8"));
  expect(payload.client).toEqual(toolsClient);
  expect(payload.intelligence).toEqual(toolsIntelligence);
  expect(payload.complete).toBe(true);
  expect(fixture.calls.intel).toBe(1);
  await page.screenshot({ path: info.outputPath("export-desktop.png") });
});
test("unavailable intelligence requires explicit partial download", async ({
  page,
}) => {
  await installProfileTools(page, { intelStatus: 503 });
  await page.goto(route);
  await page.getByRole("button", { name: "Review profile JSON" }).click();
  await page.getByRole("button", { name: "Prepare JSON" }).click();
  await expect(
    page.getByText("Partial profile ready to download", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download partial JSON" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Download JSON", exact: true }),
  ).toHaveCount(0);
});
for (const status of [403, 401])
  test(`source auth failure ${status} never permits partial download`, async ({
    page,
  }) => {
    await installProfileTools(page, { intelStatus: status });
    await page.goto(route);
    await page.getByRole("button", { name: "Review profile JSON" }).click();
    await page.getByRole("button", { name: "Prepare JSON" }).click();
    await expect(page.getByRole("button", { name: /Download/ })).toHaveCount(0);
    if (status === 401) {
      await expect(
        page.getByRole("heading", { name: "Your session expired" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Sign in", exact: true }),
      ).toHaveAttribute("href", "/sign-in");
    } else await expect(page.getByRole("alert")).toBeVisible();
  });
test("wrong-profile source receipt never produces a download", async ({
  page,
}) => {
  await installProfileTools(page, { wrongIntel: true });
  await page.goto(route);
  await page.getByRole("button", { name: "Review profile JSON" }).click();
  await page.getByRole("button", { name: "Prepare JSON" }).click();
  await expect(page.getByRole("alert")).toContainText("different profile");
  await expect(page.getByRole("button", { name: /Download/ })).toHaveCount(0);
});
test("CSV review shows exact source row rejection and created client receipt", async ({
  page,
}, info) => {
  const fixture = await installProfileTools(page);
  await page.goto(route);
  await page.getByRole("button", { name: "Review client CSV" }).click();
  await page.getByLabel("Client CSV", { exact: true }).setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,description\nAlpha,First\nBeta,Second"),
  });
  await page.getByRole("button", { name: "Import 2 clients" }).click();
  await expect(
    page.getByRole("heading", { name: "1 of 2 profiles created" }),
  ).toBeVisible();
  await expect(
    page.getByText("CSV line 3: Synthetic client slot limit"),
  ).toBeVisible();
  expect(fixture.calls.imports).toBe(1);
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Alpha", exact: true }),
  ).toHaveAttribute("href", "/portfolio/10000000-0000-4000-8000-000000000001");
  await page.screenshot({ path: info.outputPath("csv-partial-desktop.png") });
});
test("malformed CSV stays local with no import mutation", async ({ page }) => {
  const fixture = await installProfileTools(page);
  await page.goto(route);
  await page.getByRole("button", { name: "Review client CSV" }).click();
  await page.getByLabel("Client CSV", { exact: true }).setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('name\n"Unclosed'),
  });
  await expect(page.getByRole("alert")).toContainText("Unclosed");
  expect(fixture.calls.imports).toBe(0);
});
test("unknown CSV import freezes across close and reopen", async ({ page }) => {
  const fixture = await installProfileTools(page, { csvUnknown: true });
  await page.goto(route);
  await page.getByRole("button", { name: "Review client CSV" }).click();
  await page.getByLabel("Client CSV", { exact: true }).setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name\nAlpha\nBeta"),
  });
  await page.getByRole("button", { name: "Import 2 clients" }).click();
  await expect(
    page.getByText("The import outcome is unknown.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Review client CSV" }).click();
  await expect(
    page.getByRole("button", { name: "Import 2 clients" }),
  ).toBeDisabled();
  expect(fixture.calls.imports).toBe(1);
});
test("mobile dark review dialogs remain within viewport", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await installProfileTools(page);
  await page.goto(route);
  await page.getByRole("button", { name: "Review profile JSON" }).click();
  await page.getByRole("button", { name: "Prepare JSON" }).click();
  await expect(
    page.getByText("Profile ready to download", { exact: true }),
  ).toBeVisible();
  const box = await page.getByRole("dialog").boundingBox();
  if (!box) throw new Error("Export dialog is not visible");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath("export-mobile-dark.png") });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await expect(page.getByLabel("Client focus tags")).toContainText(
    "Saved focus",
  );
  await page.getByRole("button", { name: "Review client CSV" }).click();
  await page.getByLabel("Client CSV", { exact: true }).setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,description\nAlpha,First\nBeta,Second"),
  });
  await expect(
    page.getByRole("button", { name: "Import 2 clients" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath("csv-mobile-dark.png") });
});

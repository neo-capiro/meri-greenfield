import { test, expect, type Page, type Locator } from "@playwright/test";
import { clientId, json } from "./fixtures";
import {
  installAdvocacy,
  sourceId,
  targetId,
  recordId,
  sourceTitle,
  targetTitle,
  recordTitle,
} from "./advocacy-correction-fixtures";
const route = `/portfolio/${clientId}/objectives`;
async function assertDesktopDialog(
  dialog: Locator,
  kind: string,
  width: number,
  top: number,
) {
  const bounds = await dialog.boundingBox();
  const header = await dialog.getByRole("banner").boundingBox();
  const close = await dialog
    .getByRole("banner")
    .getByRole("button", { name: "Close", exact: true })
    .boundingBox();
  if (!bounds || !header || !close)
    throw new Error("Correction geometry unavailable");
  expect(bounds.x).toBe((1440 - width) / 2);
  expect(bounds.y).toBe(top);
  expect(bounds.width).toBe(width);
  // Figma's ~56px header includes its inside stroke. CSS layout adds a 1px divider.
  expect(header.height).toBeGreaterThanOrEqual(56);
  expect(header.height).toBeLessThanOrEqual(57);
  expect(close.width).toBe(20);
  expect(close.height).toBe(20);
  await test.info().attach(`${kind}-desktop-bounds`, {
    body: JSON.stringify({ kind, bounds, header, close }),
    contentType: "application/json",
  });
}
async function openMatter(page: Page, id = sourceId) {
  await page.goto(`${route}?matter=${id}`);
  const drawer = page.getByRole("dialog", {
    name: id === sourceId ? sourceTitle : targetTitle,
    exact: true,
  });
  await expect(drawer).toBeVisible();
  return drawer;
}
async function correct(
  page: Page,
  action: "Reassign" | "Detach" | "Not advocacy",
) {
  const matter = await openMatter(page);
  await matter
    .getByRole("navigation", { name: `Correct ${recordTitle}` })
    .getByRole("button", { name: action, exact: true })
    .click();
  return page.getByRole("dialog", {
    name: action === "Not advocacy" ? "Mark not advocacy" : `${action} record`,
    exact: true,
  });
}

test("Objectives preserves history left/current objectives right and New matter; saved source identity stays explicit", async ({
  page,
}) => {
  const { unexpected } = await installAdvocacy(page);
  await page.goto(route);
  const history = page.getByRole("region", { name: "Advocacy history" });
  await expect(
    history.getByRole("button", { name: "New matter" }),
  ).toBeEnabled();
  const historyBox = await history.boundingBox();
  const objectivesBox = await page
    .getByRole("heading", { name: "Current objectives" })
    .boundingBox();
  if (!historyBox || !objectivesBox)
    throw new Error("Objective columns missing");
  expect(historyBox.x).toBeLessThan(objectivesBox.x);
  await page.screenshot({
    path: "work/advocacy-evidence/objectives-desktop-light.png",
    fullPage: true,
  });
  await history.getByRole("button", { name: new RegExp(sourceTitle) }).click();
  const detail = page.getByRole("dialog", { name: sourceTitle, exact: true });
  await expect(detail).toContainText("synthetic-source-id");
  await expect(detail).toContainText("Original synthetic source title");
  await expect(detail).toContainText("74% confidence");
  await expect(detail).toContainText("Original source status: source-observed");
  await expect(
    detail.getByRole("link", { name: "View source" }),
  ).toHaveAttribute("href", "https://example.test/verified-source");
  await expect(
    detail.getByRole("link", { name: "View source" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (font) => font.family.includes("Geist") && font.status === "loaded",
      ),
    ),
  ).toBe(true);
  await page.screenshot({
    path: "work/advocacy-evidence/matter-source-desktop-light.png",
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});

test("merge explicitly reviews source into kept destination, guards pending and verifies transferred evidence", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  const matter = await openMatter(page, targetId);
  await matter.getByRole("button", { name: "Merge another matter" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Merge another matter into this one",
  });
  await expect(
    dialog.getByRole("button", { name: "Merge source into destination" }),
  ).toBeDisabled();
  await expect(dialog.getByRole("option", { name: targetTitle })).toHaveCount(
    0,
  );
  await dialog.getByLabel("Source matter").selectOption(sourceId);
  await expect(dialog).toContainText("permanently removed");
  await assertDesktopDialog(dialog, "merge", 560, 160);
  expect(state.posts).toEqual([]);
  await page.screenshot({
    path: "work/advocacy-evidence/merge-review-desktop-light.png",
    fullPage: true,
  });
  let release: (() => void) | undefined;
  state.postGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await dialog
    .getByRole("button", { name: "Merge source into destination" })
    .click();
  await expect.poll(() => state.posts.length).toBe(1);
  await expect(
    dialog
      .getByRole("contentinfo")
      .getByRole("button", { name: "Close", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("banner")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  if (!release) throw new Error("Merge release missing");
  release();
  await expect(dialog).not.toBeVisible();
  expect(state.posts).toEqual([
    { path: `/${targetId}/merge`, body: { sourceMatterId: sourceId } },
  ]);
  await expect(matter).toContainText(recordTitle);
  await expect(matter).toContainText("Assignment locked");
  await matter.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Advocacy history" })
      .getByRole("button", { name: new RegExp(sourceTitle) }),
  ).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("reassign moves exact reviewed record and refreshes both matter views", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  const dialog = await correct(page, "Reassign");
  await dialog.getByLabel("Matter", { exact: true }).selectOption(targetId);
  await assertDesktopDialog(dialog, "reassign", 520, 160);
  await page.screenshot({
    path: "work/advocacy-evidence/reassign-review-desktop-light.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Reassign", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.posts).toEqual([
    {
      path: `/records/${recordId}/reassign`,
      body: { targetMatterId: targetId },
    },
  ]);
  await expect(
    page.getByRole("dialog", { name: sourceTitle, exact: true }),
  ).not.toContainText(recordTitle);
  const target = await openMatter(page, targetId);
  await expect(target).toContainText(recordTitle);
  await expect(target).toContainText("Assignment locked");
  expect(unexpected).toEqual([]);
});

test("detach preserves a scoped unassigned record that can be reassigned later", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  const dialog = await correct(page, "Detach");
  expect(state.posts).toHaveLength(0);
  await expect(dialog).toContainText("left unassigned");
  await assertDesktopDialog(dialog, "detach", 520, 200);
  await page.screenshot({
    path: "work/advocacy-evidence/detach-review-desktop-light.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Detach", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("dialog", { name: sourceTitle, exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const history = page.getByRole("region", { name: "Advocacy history" });
  await history.getByRole("button", { name: "Unassigned records" }).click();
  await expect(history).toContainText("latest 500 history entries");
  await expect(history).toContainText(recordTitle);
  await history
    .getByRole("button", { name: "Reassign record", exact: true })
    .click();
  const reassign = page.getByRole("dialog", {
    name: "Reassign record",
    exact: true,
  });
  await reassign.getByLabel("Matter", { exact: true }).selectOption(targetId);
  await reassign.getByRole("button", { name: "Reassign", exact: true }).click();
  await expect(reassign).not.toBeVisible();
  await expect(history).toContainText("No unassigned records returned");
  expect(state.posts).toHaveLength(2);
  expect(state.recordMatterId).toBe(targetId);
  expect(unexpected).toEqual([]);
});

test("not advocacy reviews optional bounded reason and refreshes the visible history", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  const dialog = await correct(page, "Not advocacy");
  await dialog
    .getByLabel("Reason (optional)")
    .fill("  Synthetic reviewed attribution mismatch  ");
  await expect(dialog.getByLabel("Reason (optional)")).toHaveAttribute(
    "maxlength",
    "1000",
  );
  expect(state.posts).toHaveLength(0);
  await assertDesktopDialog(dialog, "not-advocacy", 520, 160);
  await page.screenshot({
    path: "work/advocacy-evidence/not-advocacy-review-desktop-light.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Mark not advocacy", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(state.posts).toEqual([
    {
      path: `/records/${recordId}/not-advocacy`,
      body: { reason: "Synthetic reviewed attribution mismatch" },
    },
  ]);
  await expect(
    page.getByRole("dialog", { name: sourceTitle, exact: true }),
  ).not.toContainText(recordTitle);
  expect(unexpected).toEqual([]);
});

test("lost response preserves submitted state and uses read-only reconciliation without repost", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  state.mode = "apply-fail";
  const dialog = await correct(page, "Reassign");
  await dialog.getByLabel("Matter", { exact: true }).selectOption(targetId);
  await dialog.getByRole("button", { name: "Reassign", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Synthetic response lost",
  );
  await expect(dialog).toContainText("this form will not repeat the request");
  await expect(
    dialog.getByRole("button", { name: "Reassign", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Check current result" }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(unexpected).toEqual([]);
});

test("unapplied failed request remains unconfirmed and cannot silently repeat", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  state.mode = "fail";
  const dialog = await correct(page, "Detach");
  await dialog.getByRole("button", { name: "Detach", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Synthetic response lost",
  );
  await dialog.getByRole("button", { name: "Check current result" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "not confirmed by current records",
  );
  await expect(dialog).toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(unexpected).toEqual([]);
});

test("leaving the feature during preflight aborts the review and prevents a late POST", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  const dialog = await correct(page, "Detach");
  let release: (() => void) | undefined;
  state.getGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await dialog.getByRole("button", { name: "Detach", exact: true }).click();
  await expect.poll(() => state.gatedGets).toBe(1);
  expect(state.posts).toHaveLength(0);
  await page.evaluate(() => {
    history.pushState({}, "", "/portfolio");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: /^Portfolio \d+$/, level: 1 }),
  ).toBeVisible();
  if (!release) throw new Error("Preflight release missing");
  release();
  await expect.poll(() => state.completedGatedGets).toBe(1);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(state.posts).toHaveLength(0);
  expect(unexpected).toEqual([]);
});

test("lost not-advocacy acknowledgement remains unconfirmed even when the bounded history is empty", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  state.mode = "apply-fail";
  const dialog = await correct(page, "Not advocacy");
  await dialog
    .getByRole("button", { name: "Mark not advocacy", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Synthetic response lost",
  );
  expect(state.rejected).toBe(true);
  await dialog.getByRole("button", { name: "Check current result" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Absence from the latest 500 entries cannot confirm it",
  );
  await expect(dialog).toBeVisible();
  await expect(
    page.getByText("Updated history reflects this correction.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Check current result" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "authoritative rejected-record or audit receipt is required",
  );
  expect(state.posts).toHaveLength(1);
  expect(unexpected).toEqual([]);
});

test("concurrent matter changes require reload/review while preserving reason before any write", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  const dialog = await correct(page, "Not advocacy");
  await dialog
    .getByLabel("Reason (optional)")
    .fill("Synthetic retained review reason");
  state.sourceSummary = "Synthetic change made elsewhere";
  await dialog
    .getByRole("button", { name: "Mark not advocacy", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "selected matter changed",
  );
  expect(state.posts).toHaveLength(0);
  await expect(
    dialog.getByRole("button", { name: "Mark not advocacy", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Reload current records" }).click();
  await expect(dialog.getByLabel("Reason (optional)")).toHaveValue(
    "Synthetic retained review reason",
  );
  await dialog
    .getByRole("button", { name: "Mark not advocacy", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(unexpected).toEqual([]);
});

test("standard user retains source reads and New matter label but correction writes are unavailable", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      tenant: { id: "tenant-test", name: "Synthetic tenant" },
      role: "standard_user",
    }),
  );
  const matter = await openMatter(page);
  await expect(matter.getByRole("link", { name: "View source" })).toBeVisible();
  await expect(
    matter.getByRole("button", { name: "Merge another matter" }),
  ).toHaveCount(0);
  await expect(
    matter.getByRole("navigation", { name: `Correct ${recordTitle}` }),
  ).toHaveCount(0);
  await matter.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Advocacy history" })
      .getByRole("button", { name: "New matter" }),
  ).toBeDisabled();
  expect(state.posts).toHaveLength(0);
  expect(unexpected).toEqual([]);
});

test("unsafe or missing source does not become guessed source navigation", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  state.sourceUrl = "javascript:alert(1)";
  const matter = await openMatter(page);
  await expect(matter).toContainText("Source link unavailable");
  await expect(matter.getByRole("link", { name: "View source" })).toHaveCount(
    0,
  );
  await expect(matter).toContainText("synthetic-source-id");
  expect(unexpected).toEqual([]);
});

for (const missing of ["user", "tenant"] as const) {
  test(`empty ${missing} identity fails closed before history writes`, async ({
    page,
  }) => {
    const { state, unexpected } = await installAdvocacy(page);
    await page.route("**/api/backend/core/me", (route) =>
      json(route, {
        user: {
          id: missing === "user" ? "  " : "user-test",
          email: "test@example.test",
        },
        tenant: {
          id: missing === "tenant" ? "  " : "tenant-test",
          name: "Synthetic tenant",
        },
        role: "user_admin",
      }),
    );
    await page.goto(route);
    const history = page.getByRole("region", { name: "Advocacy history" });
    await expect(history).toContainText(
      "This account cannot access advocacy history",
    );
    await expect(
      history.getByRole("button", { name: "New matter" }),
    ).toBeDisabled();
    expect(state.posts).toHaveLength(0);
    expect(state.gets).toHaveLength(0);
    expect(unexpected).toEqual([]);
  });
}

test("mobile dark correction keeps draft, readable review and keyboard cancel within viewport", async ({
  page,
}) => {
  const { state, unexpected } = await installAdvocacy(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const dialog = await correct(page, "Not advocacy");
  await dialog.getByLabel("Reason (optional)").fill("Synthetic review reason");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "work/advocacy-evidence/not-advocacy-mobile-dark.png",
    fullPage: false,
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  expect(state.posts).toHaveLength(0);
  await page.setViewportSize({ width: 1440, height: 480 });
  const shortDialog = await correct(page, "Detach");
  const shortBounds = await shortDialog.boundingBox();
  if (!shortBounds)
    throw new Error("Short viewport correction geometry missing");
  expect(shortBounds.y).toBeGreaterThanOrEqual(16);
  expect(shortBounds.y + shortBounds.height).toBeLessThanOrEqual(464);
  expect(shortBounds.y + shortBounds.height / 2).toBeCloseTo(240, 0);
  await page.screenshot({
    path: "work/advocacy-evidence/detach-short-viewport-dark.png",
    fullPage: false,
  });
  await shortDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(shortDialog).not.toBeVisible();
  expect(state.posts).toHaveLength(0);
  expect(unexpected).toEqual([]);
});

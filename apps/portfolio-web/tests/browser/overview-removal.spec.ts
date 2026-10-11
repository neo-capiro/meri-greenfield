import { test, expect, type Page } from "@playwright/test";
import { clientId } from "./fixtures";
import {
  installRemoval,
  activityId,
  historyId,
} from "./overview-removal-fixtures";
async function openRemove(page: Page) {
  await page
    .getByRole("button", {
      name: "Remove submission: Synthetic saved submission",
      exact: true,
    })
    .click();
  return page.getByRole("dialog", { name: "Remove submission?", exact: true });
}
async function saveNote(page: Page) {
  await page.goto(`/portfolio/${clientId}?log=1`);
  const dialog = page.getByRole("dialog", { name: "Quick log", exact: true });
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Synthetic quick note");
  await dialog
    .getByLabel("Details", { exact: true })
    .fill("Only this entry can be undone");
  await dialog
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  return page.getByRole("complementary", { name: "Quick log result" });
}
test("submission explicit confirmation, rejected request retry, exact removal and retained data", async ({
  page,
}) => {
  const { state, unexpected } = await installRemoval(page);
  state.mode = "rejected";
  await page.goto(`/__test/past-performance`);
  const dialog = await openRemove(page);
  expect(state.deletes).toHaveLength(0);
  await expect(dialog).toContainText(
    "capability and its documents will remain",
  );
  await dialog
    .getByRole("button", { name: "Remove submission", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Could not remove");
  await page.screenshot({
    path: "work/removal-evidence/remove-desktop-error.png",
  });
  const box = await dialog.boundingBox();
  expect(box?.width).toBe(520);
  expect(box?.y).toBe(200);
  state.mode = "ok";
  await dialog
    .getByRole("button", { name: "Remove submission", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved submission removed" }),
  ).toBeVisible();
  expect(
    state.deletes.every((url) => url.endsWith(`/history/${historyId}`)),
  ).toBe(true);
  expect(unexpected).toEqual([]);
});
test("wrong deletion receipt freezes across close/reopen and GET-only refresh", async ({
  page,
}) => {
  const { state } = await installRemoval(page);
  state.mode = "wrongAck";
  await page.goto(`/__test/past-performance`);
  let dialog = await openRemove(page);
  await dialog
    .getByRole("button", { name: "Remove submission", exact: true })
    .click();
  await expect(dialog).toContainText("result is uncertain");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Refresh history", exact: true })
    .click();
  dialog = await openRemove(page);
  await expect(
    dialog.getByRole("button", { name: "Remove submission", exact: true }),
  ).toBeDisabled();
  expect(state.deletes).toHaveLength(1);
  await expect(
    page.getByText("Saved submission removed.", { exact: false }),
  ).toHaveCount(0);
});
test("fresh submission changes prevent DELETE", async ({ page }) => {
  const { state } = await installRemoval(page);
  await page.goto(`/__test/past-performance`);
  const dialog = await openRemove(page);
  state.history[0]!.outcome = "Changed by another user";
  await dialog
    .getByRole("button", { name: "Remove submission", exact: true })
    .click();
  await expect(dialog).toContainText("submission changed");
  expect(state.deletes).toHaveLength(0);
});
test("closing held submission preflight aborts before DELETE", async ({
  page,
}) => {
  const { state } = await installRemoval(page);
  await page.goto(`/__test/past-performance`);
  const dialog = await openRemove(page);
  state.holdHistory = true;
  await dialog
    .getByRole("button", { name: "Remove submission", exact: true })
    .click();
  await expect.poll(() => state.historyGets).toBeGreaterThan(1);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  state.release();
  await expect(dialog).not.toBeVisible();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(state.deletes).toHaveLength(0);
});
test("Quick log Undo uses exact newly-created record rather than latest unrelated entry", async ({
  page,
}) => {
  const { state, unexpected } = await installRemoval(page);
  const toast = await saveNote(page);
  await expect(toast).toContainText("Logged to Test Aerospace");
  await page.screenshot({
    path: "work/removal-evidence/quick-log-desktop.png",
  });
  await expect(
    toast.getByRole("link", { name: "View", exact: true }),
  ).toHaveAttribute("href", `/portfolio/${clientId}#activity-timeline`);
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(toast).toContainText("Quick log removed");
  expect(state.deletes).toHaveLength(1);
  expect(state.deletes[0]).toContain(`/activity/${activityId}`);
  expect(state.activities[0]?.title).toBe("Unrelated newer note");
  expect(unexpected).toEqual([]);
});
test("wrong creator create receipt offers no Undo and blocks duplicate create", async ({
  page,
}) => {
  const { state } = await installRemoval(page);
  state.mode = "wrongCreate";
  await saveNote(page);
  const dialog = page.getByRole("dialog", { name: "Quick log", exact: true });
  await expect(dialog).toContainText("receipt does not match");
  await expect(
    dialog.getByRole("button", { name: "Save activity", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0);
  expect(state.posts).toBe(1);
});
test("lost Undo response stays uncertain and never replays deletion", async ({
  page,
}) => {
  const { state } = await installRemoval(page);
  const toast = await saveNote(page);
  state.mode = "lostDelete";
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(toast).toContainText("result is uncertain");
  await expect(
    toast.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  expect(state.deletes).toHaveLength(1);
  await expect(toast).not.toContainText("Quick log removed");
});

test("an unknown second create cannot leave the prior entry Undo visible", async ({
  page,
}) => {
  const { state } = await installRemoval(page);
  const toast = await saveNote(page);
  await expect(toast).toBeVisible();
  state.mode = "wrongCreate";
  await page.evaluate(() => window.scrollTo(0, 0));
  const quickAdd = page.getByRole("button", { name: "Quick add", exact: true });
  const actionBox = await quickAdd.boundingBox();
  const toastBox = await toast.boundingBox();
  expect(actionBox).not.toBeNull();
  expect(toastBox?.y).toBe(200);
  expect(toastBox!.y).toBeGreaterThanOrEqual(actionBox!.y + actionBox!.height);
  const notesBox = await page
    .getByRole("button", { name: "Notes", exact: true })
    .boundingBox();
  expect(notesBox).not.toBeNull();
  expect(toastBox!.y).toBeGreaterThanOrEqual(notesBox!.y + notesBox!.height);
  await quickAdd.click();
  await page
    .getByRole("menuitem", { name: "Log activity", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Quick log", exact: true });
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Synthetic second note");
  await dialog
    .getByLabel("Details", { exact: true })
    .fill("Second note details");
  await dialog
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(dialog).toContainText("receipt does not match");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0);
  expect(state.posts).toBe(2);
});
test("mobile dark removal is responsive and retains confirmation", async ({
  page,
}) => {
  await installRemoval(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`/__test/past-performance`);
  const dialog = await openRemove(page);
  await expect(dialog).toContainText("cannot be undone");
  const box = await dialog.boundingBox();
  expect(box?.width).toBe(358);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "work/removal-evidence/remove-mobile-dark.png",
  });
});

test("unsupported role does not fetch history or offer mutation controls", async ({
  page,
}) => {
  const { state } = await installRemoval(page);
  state.role = "viewer";
  await page.goto("/__test/past-performance");
  await expect(
    page.getByText(
      "A current authorized session is required to inspect saved submission history.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.historyGets).toBe(0);
  await expect(
    page.getByRole("button", { name: "Refresh history", exact: true }),
  ).toBeDisabled();
  await page.goto(`/portfolio/${clientId}?log=1`);
  await expect(
    page.getByRole("button", { name: "Save activity", exact: true }),
  ).toBeDisabled();
  expect(state.posts).toBe(0);
});

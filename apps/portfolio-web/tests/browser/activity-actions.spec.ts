import { test, expect } from "@playwright/test";
import { clientId, installFixtures, json } from "./fixtures";
const id = "90000000-0000-4000-8000-000000000001";
const note = {
  id,
  title: "Staff call recap",
  occurredAt: "2026-10-10T12:00:00Z",
  kind: "note",
  body: "Recorded details",
  origin: "recorded",
  sourceType: null,
  sourceId: null,
  dueAt: null,
  settledAt: null,
  pinned: false,
};
const derived = {
  ...note,
  id: "meeting:example",
  title: "Source-owned meeting",
  kind: "meeting",
  origin: "derived",
  sourceType: "meeting",
  sourceId: "meeting-example",
};
const region = { name: "Activity timeline", exact: true };
test("recorded edits retain failed input, reject blank titles and refresh the scoped feed", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let current = { ...note };
  let fail = true;
  const writes: unknown[] = [];
  let reads = 0;
  await page.route(
    `**/api/backend/core/clients/${clientId}/activity**`,
    (route) => {
      if (route.request().method() === "GET") {
        reads++;
        return json(route, [current, derived]);
      }
      expect(new URL(route.request().url()).pathname).toBe(
        `/api/backend/core/clients/${clientId}/activity/${id}`,
      );
      expect(route.request().method()).toBe("PATCH");
      const fields = route.request().postDataJSON();
      writes.push(fields);
      if (fail)
        return json(route, { message: "Synthetic edit unavailable" }, 503);
      current = { ...current, ...fields, body: fields.body || null };
      return json(route, { ...current, clientId, tenantId: "tenant-test" });
    },
  );
  await page.goto(`/portfolio/${clientId}`);
  const timeline = page.getByRole("region", region);
  await expect(
    timeline.getByRole("button", {
      name: "Activity actions: Source-owned meeting",
    }),
  ).toHaveCount(0);
  await expect(
    timeline.getByRole("link", { name: "Open meeting" }),
  ).toHaveAttribute(
    "href",
    `/portfolio/${clientId}/calendar?meeting=meeting-example`,
  );
  await timeline
    .getByRole("button", { name: "Activity actions: Staff call recap" })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("menuitem", { name: "Edit activity", exact: true })
    .press("Enter");
  const edit = page.getByRole("dialog", { name: "Edit activity", exact: true });
  await expect(edit.getByLabel("Title", { exact: true })).toBeFocused();
  await edit.getByLabel("Title", { exact: true }).fill("   ");
  await edit
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(edit.getByRole("alert")).toContainText(
    "Enter an activity title",
  );
  expect(writes).toEqual([]);
  await edit.getByLabel("Title", { exact: true }).fill("Updated staff recap");
  await edit.getByLabel("Details", { exact: true }).fill("   ");
  await edit
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(edit.getByRole("alert")).toContainText(
    "Synthetic edit unavailable",
  );
  await expect(edit.getByLabel("Title", { exact: true })).toHaveValue(
    "Updated staff recap",
  );
  fail = false;
  await expect(
    edit.getByRole("button", { name: "Save activity", exact: true }),
  ).toBeDisabled();
  await edit
    .getByRole("button", { name: "Review latest activity", exact: true })
    .click();
  await expect(
    edit.getByText("Latest saved activity", { exact: true }),
  ).toBeVisible();
  await edit
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(edit).not.toBeVisible();
  await expect(
    timeline.getByRole("button", {
      name: "Activity actions: Updated staff recap",
    }),
  ).toBeFocused();
  await expect(
    timeline.getByText("Updated staff recap", { exact: true }),
  ).toBeVisible();
  await expect(
    timeline
      .getByRole("listitem")
      .filter({ hasText: "Updated staff recap" })
      .getByText("Recorded details", { exact: true }),
  ).not.toBeVisible();
  await expect(
    timeline.getByText("Recorded details", { exact: true }),
  ).toHaveCount(1);
  expect(writes).toEqual(
    Array(2).fill({ title: "Updated staff recap", body: "" }),
  );
  expect(reads).toBe(6);
  expect(unexpected).toEqual([]);
});

test("settlement requires a due date, retains permission errors, prevents duplicate writes and reopens", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let current = {
    ...note,
    kind: "request",
    dueAt: "2026-10-11T12:00:00Z",
    settledAt: null as string | null,
  };
  let denied = true;
  let release: (() => void) | undefined;
  const writes: unknown[] = [];
  await page.route(
    `**/api/backend/core/clients/${clientId}/activity**`,
    async (route) => {
      if (route.request().method() === "GET")
        return json(route, [
          current,
          { ...note, id: "undated", title: "Undated note" },
          derived,
        ]);
      expect(route.request().method()).toBe("PATCH");
      const fields = route.request().postDataJSON();
      writes.push(fields);
      if (denied) return json(route, { message: "Forbidden" }, 403);
      if (fields.settled)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      current = {
        ...current,
        settledAt: fields.settled ? "2026-10-11T15:00:00Z" : null,
      };
      return json(route, { ...current, clientId, tenantId: "tenant-test" });
    },
  );
  await page.goto(`/portfolio/${clientId}`);
  const timeline = page.getByRole("region", region);
  await expect(
    timeline.getByRole("button", { name: "Settle", exact: true }),
  ).toHaveCount(1);
  await timeline.getByRole("button", { name: "Settle", exact: true }).click();
  await expect(timeline.getByRole("alert")).toContainText(
    "You do not have permission",
  );
  denied = false;
  await timeline.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    timeline.getByRole("button", { name: "Updating…", exact: true }),
  ).toBeDisabled();
  await expect(
    timeline.getByRole("button", {
      name: "Activity actions: Staff call recap",
    }),
  ).toBeDisabled();
  await expect
    .poll(() => writes)
    .toEqual([{ settled: true }, { settled: true }]);
  await expect.poll(() => Boolean(release)).toBe(true);
  release?.();
  await expect(
    timeline.getByRole("button", { name: "Reopen", exact: true }),
  ).toBeVisible();
  await expect(timeline.getByRole("alert")).not.toBeVisible();
  await timeline.screenshot({ path: "test-results/activity-settled.png" });
  await timeline.getByRole("button", { name: "Reopen", exact: true }).click();
  await expect(
    timeline.getByRole("button", { name: "Settle", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => writes)
    .toEqual([{ settled: true }, { settled: true }, { settled: false }]);
  expect(unexpected).toEqual([]);
});

test("removal is confirmed, retains service errors and rejects a false success response", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let removed = false;
  let attempts = 0;
  await page.route(
    `**/api/backend/core/clients/${clientId}/activity**`,
    (route) => {
      if (route.request().method() === "GET")
        return json(route, removed ? [derived] : [note, derived]);
      expect(route.request().method()).toBe("DELETE");
      expect(new URL(route.request().url()).pathname).toBe(
        `/api/backend/core/clients/${clientId}/activity/${id}`,
      );
      expect(route.request().postData()).toBe(null);
      attempts++;
      if (attempts === 1)
        return json(route, { message: "Synthetic removal unavailable" }, 503);
      if (attempts === 2) return json(route, { ok: false });
      removed = true;
      return json(route, { ok: true });
    },
  );
  await page.goto(`/portfolio/${clientId}`);
  const timeline = page.getByRole("region", region);
  const open = async () => {
    await timeline
      .getByRole("button", { name: "Activity actions: Staff call recap" })
      .click();
    await page
      .getByRole("menuitem", { name: "Remove activity…", exact: true })
      .click();
  };
  await open();
  const dialog = page.getByRole("dialog", {
    name: "Remove activity?",
    exact: true,
  });
  await expect(dialog).toContainText("Permanently remove “Staff call recap”");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    timeline.getByRole("button", {
      name: "Activity actions: Staff call recap",
    }),
  ).toBeFocused();
  expect(attempts).toBe(0);
  await open();
  await dialog
    .getByRole("button", { name: "Remove activity", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Synthetic removal unavailable",
  );
  await dialog.screenshot({ path: "test-results/activity-remove-error.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await dialog.screenshot({
    path: "test-results/activity-remove-mobile-dark.png",
  });
  await expect(
    dialog.getByRole("button", { name: "Remove activity", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Review latest activity", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Remove activity", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("unexpected response");
  await expect(
    page
      .getByRole("region", { ...region, includeHidden: true })
      .getByText("Staff call recap", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Review latest activity", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Remove activity", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    timeline.getByText("Staff call recap", { exact: true }),
  ).not.toBeVisible();
  await expect(
    timeline.getByText("Source-owned meeting", { exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(3);
  expect(unexpected).toEqual([]);
});

test("expired authentication during removal uses the shared session boundary", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let attempts = 0;
  await page.route(
    `**/api/backend/core/clients/${clientId}/activity**`,
    (route) => {
      if (route.request().method() === "GET") return json(route, [note]);
      expect(route.request().method()).toBe("DELETE");
      attempts++;
      return json(route, {}, 401);
    },
  );
  await page.goto(`/portfolio/${clientId}`);
  await page
    .getByRole("button", { name: "Activity actions: Staff call recap" })
    .click();
  await page
    .getByRole("menuitem", { name: "Remove activity…", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Remove activity?", exact: true })
    .getByRole("button", { name: "Remove activity", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your session expired", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/sign-in");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(attempts).toBe(1);
  expect(unexpected).toEqual([]);
});

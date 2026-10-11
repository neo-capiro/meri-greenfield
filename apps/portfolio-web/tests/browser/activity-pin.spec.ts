import { test, expect, type Page } from "@playwright/test";
import { clientId, installFixtures, json } from "./fixtures";
const note = {
  id: "90000000-0000-4000-8000-000000000001",
  kind: "note",
  title: "Recorded policy note",
  body: "Details",
  occurredAt: "2026-10-10T12:00:00Z",
  origin: "recorded",
  sourceType: null,
  sourceId: null,
  dueAt: null,
  settledAt: null,
  pinned: false,
};
const path = `**/api/backend/core/clients/${clientId}/activity**`;
const timeline = (page: Page) =>
  page.getByRole("region", { name: "Activity timeline", exact: true });
async function menu(page: Page, label = "Pin note") {
  await timeline(page)
    .getByRole("button", { name: `Activity actions: ${note.title}` })
    .click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
}
test("pin/unpin persists only the note field, displays inline state and returns keyboard focus", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let current = { ...note };
  const writes: unknown[] = [];
  await page.route(path, (route) => {
    if (route.request().method() === "GET")
      return json(route, [
        current,
        { ...note, id: "request", kind: "request", title: "Request" },
      ]);
    writes.push(route.request().postDataJSON());
    current = { ...current, ...route.request().postDataJSON() };
    return json(route, { ...current, clientId, tenantId: "tenant-test" });
  });
  await page.goto(`/portfolio/${clientId}`);
  const trigger = timeline(page).getByRole("button", {
    name: `Activity actions: ${note.title}`,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("menuitem", { name: "Pin note", exact: true })
    .press("Enter");
  await expect(
    timeline(page).getByText("★ Pinned", { exact: true }),
  ).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS("width", "28px");
  await expect(trigger).toHaveCSS("height", "28px");
  await timeline(page).screenshot({
    path: "test-results/activity-pinned-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await timeline(page).screenshot({
    path: "test-results/activity-pinned-mobile-dark.png",
  });
  await menu(page, "Unpin note");
  await expect(
    timeline(page).getByText("★ Pinned", { exact: true }),
  ).not.toBeVisible();
  await timeline(page)
    .getByRole("button", { name: "Activity actions: Request" })
    .click();
  await expect(
    page.getByRole("menuitem", { name: /Pin note|Unpin note/ }),
  ).toHaveCount(0);
  expect(writes).toEqual([{ pinned: true }, { pinned: false }]);
  expect(unexpected).toEqual([]);
});
for (const [description, override] of [
  ["wrong client", { clientId: "other" }],
  ["wrong tenant", { tenantId: "other" }],
  ["wrong record", { id: "other" }],
  ["false pinned result", { pinned: false }],
] as const)
  test(`pin refuses ${description} receipt and requires review before retry`, async ({
    page,
  }) => {
    const unexpected = await installFixtures(page);
    let writes = 0;
    await page.route(path, (route) => {
      if (route.request().method() === "GET") return json(route, [note]);
      writes++;
      return json(
        route,
        Object.assign(
          {
            ...note,
            pinned: true,
            clientId,
            tenantId: "tenant-test",
          },
          override,
        ),
      );
    });
    await page.goto(`/portfolio/${clientId}`);
    await menu(page);
    await expect(timeline(page).getByRole("alert")).toContainText(
      "did not confirm",
    );
    await expect(
      timeline(page).getByText("★ Pinned", { exact: true }),
    ).not.toBeVisible();
    await expect(
      timeline(page).getByRole("button", { name: "Retry", exact: true }),
    ).toHaveCount(0);
    await timeline(page)
      .getByRole("button", { name: `Activity actions: ${note.title}` })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Pin note", exact: true }),
    ).toHaveAttribute("data-disabled", "");
    await page.keyboard.press("Escape");
    await timeline(page)
      .getByRole("button", { name: "Review latest activity", exact: true })
      .click();
    await expect(
      timeline(page).getByText("Latest saved activity", { exact: true }),
    ).toBeVisible();
    expect(writes).toBe(1);
    expect(unexpected).toEqual([]);
  });
test("readonly identity cannot open activity mutations", async ({ page }) => {
  const unexpected = await installFixtures(page);
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      tenant: { id: "tenant-test", name: "UI tests" },
      role: "basic_user",
    }),
  );
  await page.route(path, (route) => {
    expect(route.request().method()).toBe("GET");
    return json(route, [note]);
  });
  await page.goto(`/portfolio/${clientId}`);
  await expect(
    timeline(page).getByRole("button", {
      name: `Activity actions: ${note.title}`,
    }),
  ).toBeDisabled();
  expect(unexpected).toEqual([]);
});
test("a changed note at preflight stops before PATCH and preserves edit input", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let reads = 0;
  let writes = 0;
  let current = { ...note };
  await page.route(path, (route) => {
    if (route.request().method() !== "GET") {
      writes++;
      current = { ...current, ...route.request().postDataJSON() };
      return json(route, { ...current, clientId, tenantId: "tenant-test" });
    }
    reads++;
    if (reads === 2) current = { ...current, body: "Remote update" };
    return json(route, [current]);
  });
  await page.goto(`/portfolio/${clientId}`);
  await menu(page, "Edit activity");
  const dialog = page.getByRole("dialog", {
    name: "Edit activity",
    exact: true,
  });
  await dialog.getByLabel("Title", { exact: true }).fill("Unsaved work");
  await dialog
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "changed or is no longer available",
  );
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue(
    "Unsaved work",
  );
  expect(writes).toBe(0);
  await expect(
    dialog.getByRole("button", { name: "Save activity", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Review latest activity", exact: true })
    .click();
  await expect(
    dialog.getByText("Remote update", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue(
    "Unsaved work",
  );
  await dialog
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(1);
  expect(unexpected).toEqual([]);
});
test("unmount during held preflight prevents PATCH after the read returns", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let reads = 0;
  let writes = 0;
  let release: (() => void) | undefined;
  await page.route(path, async (route) => {
    if (route.request().method() !== "GET") {
      writes++;
      return json(route, {});
    }
    reads++;
    if (reads === 2)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return json(route, [note]);
  });
  await page.goto(`/portfolio/${clientId}`);
  await menu(page);
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByRole("link", { name: "Objectives", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/portfolio/${clientId}/objectives`));
  release?.();
  // A second read after navigation is our observation boundary; no timer-based success assumption.
  await page.goto(`/portfolio/${clientId}`);
  await expect(
    timeline(page).getByRole("button", {
      name: `Activity actions: ${note.title}`,
    }),
  ).toBeVisible();
  expect(writes).toBe(0);
  expect(unexpected).toEqual([]);
});

test("a lost pin response is reconciled by an explicit read without replaying the write", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let current = { ...note };
  const writes: unknown[] = [];
  await page.route(path, (route) => {
    if (route.request().method() === "GET") return json(route, [current]);
    const fields = route.request().postDataJSON();
    writes.push(fields);
    current = { ...current, ...fields };
    if (writes.length === 1)
      return json(route, { message: "Reply lost after save" }, 503);
    return json(route, { ...current, clientId, tenantId: "tenant-test" });
  });
  await page.goto(`/portfolio/${clientId}`);
  await menu(page);
  await expect(timeline(page).getByRole("alert")).toContainText(
    "Reply lost after save",
  );
  await expect(
    timeline(page).getByText("★ Pinned", { exact: true }),
  ).toBeVisible();
  await timeline(page)
    .getByRole("button", { name: "Review latest activity", exact: true })
    .click();
  await expect(
    timeline(page).getByText("Pinned", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([{ pinned: true }]);
  await menu(page, "Unpin note");
  await expect(
    timeline(page).getByText("★ Pinned", { exact: true }),
  ).not.toBeVisible();
  expect(writes).toEqual([{ pinned: true }, { pinned: false }]);
  expect(unexpected).toEqual([]);
});

test("session expiry at preflight dispatches no activity write", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let reads = 0;
  let writes = 0;
  await page.route(path, (route) => {
    if (route.request().method() !== "GET") {
      writes++;
      return json(route, {});
    }
    reads++;
    return reads === 1 ? json(route, [note]) : json(route, {}, 401);
  });
  await page.goto(`/portfolio/${clientId}`);
  await menu(page);
  await expect(
    page.getByRole("heading", { name: "Your session expired", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
  expect(unexpected).toEqual([]);
});

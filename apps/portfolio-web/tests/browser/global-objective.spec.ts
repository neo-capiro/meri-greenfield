import { test, expect, type Page } from "@playwright/test";
import { client, clientId, installFixtures } from "./fixtures";

const path = "/__test/global-objective";
const secondId = "10000000-0000-4000-8000-000000000002";
const catalog = [
  client,
  { ...client, id: secondId, name: "Civic Two", sectorTag: "Government" },
];
const endpoint = "**/api/backend/core/clients";
const identity = {
  user: { id: "user-test", email: "test@example.test" },
  tenant: { id: "tenant-test", name: "Synthetic tenant" },
  role: "standard_user",
};
async function setup(page: Page) {
  const unexpected = await installFixtures(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/backend/") && request.method() !== "GET")
      writes.push(`${request.method()} ${request.url()}`);
  });
  await page.route("**/api/backend/core/me", (route) =>
    route.fulfill({ json: identity }),
  );
  await page.route(endpoint, (route) => route.fulfill({ json: catalog }));
  return { unexpected, writes };
}
const continueButton = (page: Page) =>
  page.getByRole("button", { name: "Continue", exact: true });
const selectClient = (page: Page) =>
  page.getByRole("radio", { name: /Test Aerospace/ }).check();
async function event(page: Page, name: string) {
  await page.evaluate(
    (eventName) => window.dispatchEvent(new Event(eventName)),
    name,
  );
}

test("keyboard search chooses the real client and opens the existing empty four-field editor", async ({
  page,
}) => {
  const { unexpected, writes } = await setup(page);
  await page.goto(path);
  await expect(continueButton(page)).toBeDisabled();
  await expect(
    page.getByText("Choose the client for this objective."),
  ).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "New objective" });
  await expect(dialog).toHaveCSS("width", "560px");
  await page.getByPlaceholder("Search clients").fill("aerospace");
  await expect(page.getByRole("radio")).toHaveCount(1);
  await page.getByRole("radio").focus();
  await page.keyboard.press("Space");
  await expect(continueButton(page)).toBeEnabled();
  await page.screenshot({
    path: "work/global-objective-desktop.png",
    fullPage: true,
  });
  await continueButton(page).click();
  await expect(page).toHaveURL(`/portfolio/${clientId}/objectives?new=1`);
  const editor = page.getByRole("dialog", { name: "New objective" });
  await expect(editor.getByLabel("Outcome", { exact: false })).toHaveValue("");
  await expect(
    editor.getByLabel("Government problem", { exact: false }),
  ).toHaveValue("");
  await expect(editor.getByLabel("Ask type")).toHaveValue("");
  await expect(editor.getByLabel("Minimum win", { exact: false })).toHaveValue(
    "",
  );
  await editor
    .getByRole("button", { name: "Confirm ready", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toBeVisible();
  expect(writes).toEqual([]);
  expect(unexpected).toEqual([]);
});

test("Cancel and Escape are local and reopening discards previous selection", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto(path);
  await selectClient(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const open = page.getByRole("button", { name: "Open client picker" });
  await open.click();
  await expect(continueButton(page)).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  expect(writes).toEqual([]);
});

test("loading catalog cannot continue and an empty result is explicit", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await held;
    await route.fulfill({ json: [] });
  });
  await page.goto(path);
  await expect(page.getByText("Loading clients…")).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();
  release();
  await expect(
    page.getByText("No clients are available for this objective."),
  ).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();
  expect(writes).toEqual([]);
});

test("failed catalog has explicit retry and search has an empty state", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let failed = true;
  await page.route(endpoint, (route) =>
    route.fulfill({
      status: failed ? 503 : 200,
      json: failed ? { message: "Synthetic catalog unavailable" } : catalog,
    }),
  );
  await page.goto(path);
  await expect(page.getByText("Synthetic catalog unavailable")).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();
  failed = false;
  await page.getByRole("button", { name: "Retry client list" }).click();
  await page
    .getByPlaceholder("Search clients")
    .fill("no matching organization");
  await expect(page.getByText("No clients match your search.")).toBeVisible();
  await page.getByPlaceholder("Search clients").fill("government");
  await expect(page.getByRole("radio", { name: /Civic Two/ })).toBeVisible();
  expect(writes).toEqual([]);
});

test("portal role never requests the client catalog or offers continuation", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let reads = 0;
  await page.route("**/api/backend/core/me", (route) =>
    route.fulfill({ json: { ...identity, role: "client_portal_user" } }),
  );
  await page.route(endpoint, (route) => {
    reads++;
    return route.fulfill({ json: catalog });
  });
  await page.goto(path);
  await expect(
    page.getByText("Your current session cannot create objectives."),
  ).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();
  expect(reads).toBe(0);
  expect(writes).toEqual([]);
});

test("malformed catalog cannot masquerade as a selectable client", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.route(endpoint, (route) =>
    route.fulfill({ json: [{ ...client, id: "not-a-client-id" }] }),
  );
  await page.goto(path);
  await expect(
    page.getByText("The service returned an unexpected response.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(continueButton(page)).toBeDisabled();
  expect(writes).toEqual([]);
});

for (const name of [
  "objective-authority-invalidate",
  "objective-role-change",
  "objective-catalog-invalidate",
])
  test(`${name} immediately refuses a previously valid selection`, async ({
    page,
  }) => {
    const { writes } = await setup(page);
    await page.goto(path);
    await selectClient(page);
    await expect(continueButton(page)).toBeEnabled();
    await event(page, name);
    await expect(continueButton(page)).toBeDisabled();
    await expect(page).toHaveURL(path);
    expect(writes).toEqual([]);
  });

test("actor change cannot publish late rows or retain the prior actor's selection", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto(path);
  await selectClient(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await held;
    await route.fulfill({ json: [catalog[1]] });
  });
  await event(page, "objective-actor-change");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(continueButton(page)).toBeDisabled();
  release();
  await expect(page.getByRole("radio", { name: /Civic Two/ })).toBeVisible();
  await expect(page.getByRole("radio")).not.toBeChecked();
  await expect(continueButton(page)).toBeDisabled();
  expect(writes).toEqual([]);
});

test("held catalog refresh blocks navigation and removes a vanished selected client", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto(path);
  await selectClient(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await held;
    await route.fulfill({ json: [catalog[1]] });
  });
  await event(page, "objective-catalog-refresh");
  await expect(continueButton(page)).toBeDisabled();
  await expect(page.getByRole("radio")).toHaveCount(0);
  release();
  await expect(page.getByRole("radio", { name: /Civic Two/ })).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();
  expect(writes).toEqual([]);
});

test("unmount during a held read cannot navigate or reopen the picker", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await held;
    await route.fulfill({ json: catalog });
  });
  await page.goto(path);
  await expect(page.getByText("Loading clients…")).toBeVisible();
  await event(page, "objective-unmount");
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(path);
  expect(writes).toEqual([]);
});

test("session expiry refuses the catalog rather than showing cached success", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.route(endpoint, (route) =>
    route.fulfill({ status: 401, json: { message: "Expired" } }),
  );
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("mobile dark dialog keeps real options and actions within the viewport", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(path);
  await selectClient(page);
  const dialog = page.getByRole("dialog", { name: "New objective" });
  await expect(dialog).toHaveCSS("width", "358px");
  await expect(dialog).toHaveCSS("background-color", "rgb(27, 27, 27)");
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  await expect(continueButton(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "work/global-objective-mobile-dark.png",
    fullPage: true,
  });
  expect(writes).toEqual([]);
});

test("actual Portfolio deep link preserves filters on close and continues through the canonical editor", async ({
  page,
}) => {
  const { unexpected, writes } = await setup(page);
  const deepLink =
    "/portfolio?new=objective&q=Civic&status=ACTIVE&view=list&sort=name";
  await page.goto(deepLink);
  await expect(page.getByRole("radio")).toHaveCount(2);
  await page.screenshot({
    path: "work/global-objective-index-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const closed = new URL(page.url());
  expect(closed.searchParams.has("new")).toBe(false);
  expect(Object.fromEntries(closed.searchParams)).toEqual({
    q: "Civic",
    status: "ACTIVE",
    view: "list",
    sort: "name",
  });
  await page.goto(deepLink);
  await selectClient(page);
  await continueButton(page).click();
  await expect(page).toHaveURL(`/portfolio/${clientId}/objectives?new=1`);
  await expect(
    page
      .getByRole("dialog", { name: "New objective" })
      .getByRole("button", { name: "Save draft", exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  expect(unexpected).toEqual([]);
});

import { test, expect, type Page } from "@playwright/test";
import { client, clientId, installFixtures, json } from "./fixtures";
const secondId = "10000000-0000-4000-8000-000000000002";
const rows = [
  { ...client, name: "Zephyr Aerospace" },
  {
    ...client,
    id: secondId,
    name: "Alpha Energy",
    sectorTag: "ENERGY",
    profileStatus: "ONBOARDING",
    intakeData: {
      city: "New York",
      state: "NY",
      sectors: ["ENERGY", "Manufacturing", "HOMELAND_SECURITY"],
    },
  },
];
const assignments = {
  [clientId]: {
    accountOwnerUserId: "owner-1",
    accountOwner: {
      id: "owner-1",
      firstName: "Sam",
      lastName: "Owner",
      email: "sam@example.test",
    },
  },
  [secondId]: { accountOwnerUserId: null, accountOwner: null },
};
async function indexFixtures(page: Page) {
  const unexpected = await installFixtures(page);
  await page.route("**/api/backend/core/clients", (route) => json(route, rows));
  await page.route("**/api/backend/core/client-account-owners", (route) =>
    json(route, assignments),
  );
  return unexpected;
}

test("wordmark opens the configured Dashboard while Portfolio stays in its workspace", async ({
  page,
}) => {
  const unexpected = await indexFixtures(page);
  await page.goto("/portfolio");
  await expect(
    page.getByRole("link", { name: "Capiro dashboard" }),
  ).toHaveAttribute("href", "http://127.0.0.1:5191/existing/");
  await expect(
    page.getByRole("navigation", { name: "Workspace" }).getByRole("link", {
      name: "Portfolio",
    }),
  ).toHaveAttribute("href", "/portfolio");
  expect(unexpected).toEqual([]);
});

test("deep links restore combined filters and legacy layout; clearing preserves chosen presentation", async ({
  page,
}) => {
  const unexpected = await indexFixtures(page);
  await page.goto(
    "/portfolio?layout=list&q=sam%20owner&status=ACTIVE&sector=Aerospace&owner=owner-1&type=CLIENT&sort=name",
  );
  const table = page.getByRole("table", { name: "Portfolio profiles" });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Zephyr Aerospace");
  await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Account owner", { exact: true })).toHaveValue(
    "owner-1",
  );
  await expect(
    page.getByRole("region", { name: "Portfolio profiles" }),
  ).toContainText("1 profile of 2");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page).toHaveURL(/layout=list&sort=name$/);
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row").nth(1)).toContainText("Alpha Energy");
  await page.screenshot({
    path: "work/index/list-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await expect(table.getByRole("row").nth(1)).toContainText("Alpha Energy");
  await page.getByRole("button", { name: "Card view" }).click();
  await expect(page).toHaveURL(/sort=name&view=cards$/);
  await expect(page.getByRole("article").first()).toContainText("Alpha Energy");
  await page.getByLabel("Sort profiles").selectOption("recent");
  await expect(page.getByRole("article").first()).toContainText(
    "Zephyr Aerospace",
  );
  await expect(page.locator(".page")).toHaveCSS("padding-top", "36px");
  await page.screenshot({
    path: "work/index/cards-desktop.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("link", { name: "Open Zephyr Aerospace" }),
  ).toHaveAttribute("href", `/portfolio/${clientId}`);
  await expect(
    page
      .getByRole("navigation", { name: "Profile type" })
      .getByRole("link", { name: "Pipeline", exact: true }),
  ).toHaveAttribute("href", "/portfolio/prospects?pipeline=1");
  expect(unexpected).toEqual([]);
});

test("real fields drive search/status/sector/known unassigned; no matching results has a clear recovery", async ({
  page,
}) => {
  const unexpected = await indexFixtures(page);
  await page.goto("/portfolio");
  await page.getByLabel("Search profiles").fill("Energy");
  await page.getByLabel("Sector", { exact: true }).selectOption("ENERGY");
  await page
    .getByLabel("Profile status", { exact: true })
    .selectOption("ONBOARDING");
  await page
    .getByLabel("Account owner", { exact: true })
    .selectOption("unassigned");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Alpha Energy");
  await expect(page.getByRole("article")).toContainText(
    "Energy · New York, NY",
  );
  await page
    .getByLabel("Sector", { exact: true })
    .selectOption("Manufacturing");
  await page.getByLabel("Search profiles").fill("Manufacturing");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Alpha Energy");
  await page
    .getByLabel("Sector", { exact: true })
    .selectOption("HOMELAND_SECURITY");
  await expect(page.getByLabel("Sector", { exact: true })).toContainText(
    "Homeland Security",
  );
  await page.getByLabel("Search profiles").fill("Homeland Security");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByLabel("Search profiles").fill("New York, NY");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Alpha Energy");
  await page.getByLabel("Search profiles").fill("Not a real organization");
  await expect(
    page.getByRole("heading", { name: "No profiles found" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL("/portfolio");
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(unexpected).toEqual([]);
});

test("loading and list failure expose retry without rendering a successful empty list", async ({
  page,
}) => {
  const unexpected = await indexFixtures(page);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/api/backend/core/clients", async (route) => {
    await gate;
    return fail
      ? json(route, { message: "Synthetic list temporarily unavailable" }, 503)
      : json(route, rows);
  });
  await page.goto("/portfolio");
  await expect(
    page.getByRole("status").filter({ hasText: "Loading" }),
  ).toBeVisible();
  expect(await page.getByRole("heading", { name: /No profiles/ }).count()).toBe(
    0,
  );
  release!();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Synthetic list temporarily unavailable");
  fail = false;
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(unexpected).toEqual([]);
});

test("owner filter waits for unavailable assignments and retries instead of reporting no profiles", async ({
  page,
}) => {
  const unexpected = await indexFixtures(page);
  let fail = true;
  await page.route("**/api/backend/core/client-account-owners", (route) =>
    fail
      ? json(route, { message: "Synthetic owner lookup unavailable" }, 503)
      : json(route, assignments),
  );
  await page.goto("/portfolio?owner=owner-1");
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic owner lookup unavailable",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "cannot be applied" }),
  ).toBeVisible();
  expect(
    await page.getByRole("heading", { name: "No profiles found" }).count(),
  ).toBe(0);
  fail = false;
  await page.getByRole("alert").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Zephyr Aerospace");
  expect(unexpected).toEqual([]);
});

test("chooser uses native asset geometry and canonical manual intake, restoring trigger focus", async ({
  page,
}) => {
  const unexpected = await indexFixtures(page);
  await page.goto("/portfolio");
  const trigger = page
    .getByRole("button", { name: "Add profile", exact: true })
    .first();
  await trigger.click();
  const chooser = page.getByRole("dialog", {
    name: "Add profile",
    exact: true,
  });
  await expect(
    chooser.getByRole("button", { name: /Search LDA/ }),
  ).toBeEnabled();
  await expect(
    chooser.getByRole("button", { name: /Create with Meri/ }),
  ).toBeDisabled();
  for (const icon of ["pencil", "search", "sparkle", "target"]) {
    const response = await page.request.get(`/design/411-44629-${icon}.svg`);
    expect(response.ok()).toBe(true);
    const source = await response.text();
    expect(source).toMatch(/width="16" height="16" viewBox="0 0 16 16"/);
    expect(source).toContain("<path");
  }
  const masks = chooser.locator('[style*="mask-image"]');
  await expect(masks).toHaveCount(4);
  for (const mask of await masks.all()) {
    await expect(mask).toHaveCSS("width", "16px");
    await expect(mask).toHaveCSS("height", "16px");
    await expect(mask).toHaveCSS("background-color", "rgb(10, 10, 10)");
  }
  await chooser.screenshot({ path: "work/index/chooser-desktop.png" });
  await chooser.getByRole("button", { name: /Manual entry/ }).click();
  const intake = page.getByRole("dialog", { name: "Add profile", exact: true });
  await expect(
    intake.getByLabel("Legal name *", { exact: true }),
  ).toBeVisible();
  await intake.getByRole("button", { name: "Next", exact: true }).click();
  await expect(intake.getByRole("alert")).toContainText("highlighted fields");
  await expect(
    intake.getByLabel("Legal name *", { exact: true }),
  ).toBeFocused();
  await intake.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /Manual entry/ }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /Add prospect/ })
    .click();
  await expect(page).toHaveURL("/portfolio/prospects?new=1");
  await expect(
    page.getByRole("dialog", { name: "Add prospect", exact: true }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});

test("permission and expired-session errors remain explicit and disable profile creation", async ({
  page,
}) => {
  const unexpected = await indexFixtures(page);
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "user-read", email: "reader@example.test" },
      role: "read_only",
    }),
  );
  await page.route("**/api/backend/core/clients", (route) =>
    json(route, { message: "Forbidden" }, 403),
  );
  await page.goto("/portfolio");
  await expect(page.getByRole("alert")).toContainText("do not have permission");
  await expect(
    page.getByRole("button", { name: "Add profile", exact: true }),
  ).toBeDisabled();
  await page.route("**/api/backend/core/clients", (route) =>
    json(route, { message: "Session expired" }, 401),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/sign-in");
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("mobile dark cards and chooser fit viewport; empty portfolio and unsupported sort stay truthful", async ({
  page,
}) => {
  const unexpected = await indexFixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/portfolio?sort=attention");
  await expect(
    page.getByRole("status").filter({ hasText: "This sort is unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "work/index/cards-mobile-dark.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Add profile", exact: true })
    .first()
    .click();
  const chooser = page.getByRole("dialog", {
    name: "Add profile",
    exact: true,
  });
  expect((await chooser.boundingBox())!.width).toBeLessThanOrEqual(358);
  await expect(chooser.locator('[style*="mask-image"]').first()).toHaveCSS(
    "background-color",
    "rgb(250, 250, 249)",
  );
  await chooser.screenshot({ path: "work/index/chooser-mobile-dark.png" });
  await page.keyboard.press("Escape");
  await page.route("**/api/backend/core/clients", (route) => json(route, []));
  await page.goto("/portfolio");
  await expect(
    page.getByRole("heading", { name: "No profiles yet" }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});

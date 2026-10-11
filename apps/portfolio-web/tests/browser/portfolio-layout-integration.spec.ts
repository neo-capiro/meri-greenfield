import { test, expect } from "@playwright/test";
import { client, clientId, installFixtures, json } from "./fixtures";
import { layoutActor } from "./portfolio-layout-fixtures";

const secondId = "10000000-0000-4000-8000-000000000002";
const clients = [
  client,
  { ...client, id: secondId, name: "Alpha Energy", sectorTag: "Energy" },
];
const endpoint = "**/api/backend/core/me/portfolio-layout";
const positions = (page: import("@playwright/test").Page) =>
  page
    .locator("[data-client-id]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-client-id")),
    );

async function fixtures(page: import("@playwright/test").Page) {
  const unexpected = await installFixtures(page);
  await page.route("**/core/me", (route) =>
    json(route, {
      user: { id: layoutActor.userId, email: "layout@example.test" },
      tenant: { id: layoutActor.tenantId, name: "Synthetic tenant" },
      role: "standard_user",
    }),
  );
  await page.route("**/core/clients", (route) => json(route, clients));
  return unexpected;
}

test("actual index saves the complete canonical catalog and restores it after reload", async ({
  page,
}, testInfo) => {
  const unexpected = await fixtures(page);
  let order = [secondId, clientId].map((id) => `client:${id}`),
    version = 1;
  const writes: unknown[] = [];
  await page.route(endpoint, async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      writes.push(body);
      expect(body).toEqual({
        contractVersion: 1,
        expectedVersion: 1,
        order: [clientId, secondId].map((id) => `client:${id}`),
      });
      order = body.order;
      version++;
    }
    return json(route, {
      ...layoutActor,
      contractVersion: 1,
      version,
      updatedAt: "2026-10-11T00:00:00.000Z",
      order,
    });
  });
  await page.goto("/portfolio");
  await expect(page.getByLabel("Sort profiles")).toHaveValue("saved");
  await expect.poll(() => positions(page)).toEqual([secondId, clientId]);
  await page
    .getByRole("button", { name: "Move Test Aerospace earlier", exact: true })
    .click();
  await page.getByRole("button", { name: "Save order", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save order", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect.poll(() => positions(page)).toEqual([clientId, secondId]);
  await page.screenshot({
    path: testInfo.outputPath("portfolio-saved-order-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(18, 18, 18)",
  );
  await expect(page.getByRole("article").first()).toHaveCSS(
    "background-color",
    "rgb(27, 27, 27)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("portfolio-saved-order-mobile-dark.png"),
    fullPage: true,
  });
  expect(writes).toHaveLength(1);
  expect(unexpected).toEqual([]);
});

test("name, recent, filters and list presentation never persist a subset or overwrite saved order", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  let writes = 0;
  await page.route(endpoint, (route) => {
    if (route.request().method() !== "GET") writes++;
    return json(route, {
      ...layoutActor,
      contractVersion: 1,
      version: 1,
      updatedAt: "2026-10-11T00:00:00.000Z",
      order: [secondId, clientId].map((id) => `client:${id}`),
    });
  });
  await page.goto("/portfolio?sort=name");
  await expect(page.getByRole("article").first()).toContainText("Alpha Energy");
  await expect(
    page.getByRole("button", { name: /Move .* earlier/ }),
  ).toHaveCount(0);
  await page.getByLabel("Sort profiles").selectOption("recent");
  await expect(page.getByRole("article").first()).toContainText(
    "Test Aerospace",
  );
  await page.getByLabel("Sort profiles").selectOption("saved");
  await page.getByLabel("Search profiles").fill("Aerospace");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Save order", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Move .* earlier/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect.poll(() => positions(page)).toEqual([secondId, clientId]);
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(
    page
      .getByRole("table", { name: "Portfolio profiles" })
      .getByRole("row")
      .nth(1),
  ).toContainText("Alpha Energy");
  expect(writes).toBe(0);
  expect(unexpected).toEqual([]);
});

test("saved order is not requested against an unloaded catalog", async ({
  page,
}) => {
  const unexpected = await fixtures(page);
  let release!: () => void,
    reads = 0;
  const waiting = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/core/clients", async (route) => {
    await waiting;
    await json(route, clients);
  });
  await page.route(endpoint, (route) => {
    reads++;
    return json(route, {
      ...layoutActor,
      contractVersion: 1,
      version: 0,
      updatedAt: null,
      order: clients.map(({ id }) => `client:${id}`),
    });
  });
  await page.goto("/portfolio");
  await expect(
    page.getByRole("heading", { name: "Portfolio —", exact: true }),
  ).toBeVisible();
  expect(reads).toBe(0);
  release();
  await expect(
    page.getByRole("button", {
      name: "Move Test Aerospace later",
      exact: true,
    }),
  ).toBeEnabled();
  expect(reads).toBe(1);
  expect(unexpected).toEqual([]);
});

import { test, expect } from "@playwright/test";
import {
  installFixtures,
  json,
  client,
  clientId,
  personId,
  objective,
  capability,
} from "./fixtures";
test("four-field readiness persists once, transitions, and refreshes the list", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let writes = 0;
  let ready = false;
  let savedObjective = objective;
  await page.route(`**/clients/${clientId}/objectives**`, async (route) => {
    if (route.request().method() === "GET")
      return json(
        route,
        ready ? [{ ...savedObjective, status: "ready", version: 2 }] : [],
      );
    const body = route.request().postDataJSON();
    writes++;
    if (new URL(route.request().url()).pathname.endsWith("transition")) {
      expect(body).toEqual({ action: "confirm_ready", expectedVersion: 1 });
      ready = true;
      return json(route, { ...savedObjective, status: "ready", version: 2 });
    }
    expect(body.outcome).toBe("Test outcome");
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    savedObjective = { ...objective, ...body };
    return json(route, savedObjective);
  });
  await page.goto(`/portfolio/${clientId}/objectives?new=1`);
  const editor = page.getByRole("dialog", { name: "New objective" });
  await editor.getByRole("button", { name: "Confirm ready" }).click();
  await expect(editor.getByRole("alert")).toContainText("Complete outcome");
  await editor.getByLabel(/^Outcome/).fill("Test outcome");
  await editor.getByLabel(/^Government problem/).fill("Test problem");
  await editor.getByLabel("Ask type").selectOption("funding");
  await editor.getByLabel(/^Minimum win/).fill("Test minimum win");
  await editor.getByRole("button", { name: "Confirm ready" }).click();
  await page
    .getByRole("dialog", { name: "Confirm objective ready" })
    .getByRole("button", { name: "Confirm ready" })
    .click();
  await expect(editor).not.toBeVisible();
  await expect(
    page.locator("span.chip").filter({ hasText: /^Ready$/ }),
  ).toBeVisible();
  expect(writes).toBe(2);
  expect(unexpected).toEqual([]);
});
test("facility creation uses the selected client's endpoint and refreshes the map list", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let saved = false;
  const facility = {
    id: "facility-test",
    clientId,
    name: "Test lab",
    addressLine: null,
    city: "Austin",
    state: "TX",
    zip: null,
    congressionalDistrict: null,
    employeeCount: null,
    notes: null,
    geocodeStatus: "unresolved",
  };
  await page.route(`**/clients/${clientId}/facilities`, async (route) => {
    if (route.request().method() === "GET")
      return json(route, saved ? [facility] : []);
    expect(route.request().postDataJSON()).toMatchObject({
      name: "Test lab",
      city: "Austin",
      state: "TX",
    });
    saved = true;
    return json(route, facility);
  });
  await page.goto(`/portfolio/${clientId}`);
  await page.getByRole("button", { name: "Add facility" }).click();
  const dialog = page.getByRole("dialog", { name: "Add facility" });
  await dialog.getByLabel("Facility name").fill("Test lab");
  await dialog.getByLabel("City", { exact: true }).fill("Austin");
  await dialog.getByLabel("State / territory").fill("tx");
  await dialog.getByRole("button", { name: "Add facility" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Test lab")).toBeVisible();
  expect(unexpected).toEqual([]);
});
test("mail is reviewed and a provider error remains visible without automatic retry", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let attempts = 0;
  await page.route("**/engagement/mail/send", async (route) => {
    attempts++;
    expect(route.request().postDataJSON()).toMatchObject({
      clientId,
      personIds: [personId],
      to: [{ email: "taylor@example.test", name: "Taylor Test" }],
    });
    await json(route, { message: "Test provider unavailable" }, 503);
  });
  await page.goto(`/portfolio/${clientId}/relationships?person=${personId}`);
  await page.getByRole("button", { name: "Mail", exact: true }).click();
  const compose = page.getByRole("dialog", { name: "New email" });
  await compose.getByLabel("Subject", { exact: true }).fill("Test subject");
  await compose
    .getByLabel("Message", { exact: true })
    .fill("Synthetic message <unsafe>");
  await compose.getByRole("button", { name: "Review email" }).click();
  expect(attempts).toBe(0);
  const review = page.getByRole("dialog", { name: "Send email" });
  await review.getByRole("button", { name: "Send email" }).click();
  await expect(review).toContainText("Test provider unavailable");
  await expect(
    review.getByRole("button", { name: "Send email" }),
  ).toBeDisabled();
  await expect(review.getByText(/Sending may have completed/)).toBeVisible();
  expect(attempts).toBe(1);
  expect(unexpected).toEqual([]);
});
test("capability edits invalidate the list and retain unrelated registration codes", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let updated = false;
  await page.route(`**/clients/${clientId}/capabilities**`, async (route) => {
    if (route.request().method() === "GET")
      return json(route, [
        { ...capability, name: updated ? "Updated sensor" : capability.name },
      ]);
    expect(route.request().method()).toBe("PATCH");
    updated = true;
    return json(route, { ...capability, ...route.request().postDataJSON() });
  });
  await page.goto(
    `/portfolio/${clientId}/capabilities?capability=${capability.id}`,
  );
  const editor = page.getByRole("dialog", {
    name: `Capability: ${capability.name}`,
  });
  await editor.getByLabel("Name", { exact: true }).fill("Updated sensor");
  await editor.getByRole("button", { name: "Save capability" }).click();
  await expect(page.getByText("Updated sensor", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Registrations & codes" }).click();
  await page.getByRole("button", { name: "Edit registrations" }).click();
  await page.route(`**/clients/${clientId}`, async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    expect(route.request().postDataJSON().setAsideCertifications).toContain(
      "LEGACY_CODE",
    );
    await json(route, { ...client, ...route.request().postDataJSON() });
  });
  await page.getByRole("button", { name: "Save registrations" }).click();
  await expect(
    page.getByRole("button", { name: "Edit registrations" }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});
test("navigation, permissions, session expiry and mobile layout use real feature components", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.goto("/portfolio");
  await page
    .getByRole("link", { name: "Open Test Aerospace", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(clientId));
  await page.getByRole("link", { name: "Work", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Client work" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Relationships", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Relationships" }),
  ).toBeVisible();
  await page.route(`**/clients/${clientId}/people`, (route) =>
    json(route, { message: "Forbidden" }, 403),
  );
  await page.reload();
  await expect(page.getByText(/permission/i).first()).toBeVisible();
  await page.route(`**/clients/${clientId}/people`, (route) =>
    json(route, { message: "Expired" }, 401),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});

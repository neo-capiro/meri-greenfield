import { test, expect, type Page } from "@playwright/test";
import {
  installFixtures,
  json,
  prospect,
  prospectId,
  clientId,
} from "./fixtures";
const choice = {
  id: clientId,
  name: "Existing test client",
  canonicalEntityId: null,
};
async function openLink(page: Page) {
  await page.goto(`/portfolio/prospects/${prospectId}`);
  await page.getByRole("button", { name: "Link existing client" }).click();
  const dialog = page.getByRole("dialog", { name: /Link Test Prospect/ });
  await expect(
    dialog.getByRole("button", { name: "Confirm link" }),
  ).toBeDisabled();
  await dialog.getByRole("radio", { name: choice.name }).check();
  await dialog.getByRole("checkbox", { name: /Link this prospect/ }).check();
  return dialog;
}
test("explicit existing-client link preserves failures and confirms a scoped no-charge result", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let record = { ...prospect };
  let writes = 0;
  await page.route(
    "**/business-development/search/clients?**",
    async (route) => {
      expect(new URL(route.request().url()).searchParams.get("limit")).toBe(
        "30",
      );
      return json(route, { results: [choice] });
    },
  );
  await page.route(`**/business-development/prospects/${prospectId}`, (route) =>
    json(route, record),
  );
  await page.route(
    `**/business-development/prospects/${prospectId}/convert`,
    async (route) => {
      writes++;
      expect(route.request().postDataJSON()).toEqual({
        existingClientId: clientId,
      });
      if (writes === 1)
        return json(route, { message: "Synthetic link unavailable" }, 503);
      record = {
        ...record,
        linkedClientId: clientId,
        convertedAt: "2026-10-11T05:00:00Z",
      };
      return json(route, {
        prospect: record,
        client: { id: clientId, name: choice.name },
        created: false,
      });
    },
  );
  const dialog = await openLink(page);
  await dialog.getByRole("button", { name: "Confirm link" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Synthetic link unavailable",
  );
  await expect(dialog.getByRole("radio", { name: choice.name })).toBeChecked();
  await expect(dialog.getByRole("checkbox")).toBeChecked();
  expect(writes).toBe(1);
  await page.screenshot({ path: "test-results/prospect-link-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/prospect-link-phone-dark.png" });
  await dialog.getByRole("button", { name: "Confirm link" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open linked client" }),
  ).toHaveAttribute("href", `/portfolio/${clientId}`);
  await expect(
    page.getByRole("link", { name: "Open linked client" }),
  ).toBeFocused();
  expect(writes).toBe(2);
  expect(unexpected).toEqual([]);
});
test("lost link response reads the actual committed association without a second POST", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let record = { ...prospect };
  let writes = 0;
  await page.route("**/business-development/search/clients?**", (route) =>
    json(route, { results: [choice] }),
  );
  await page.route(`**/business-development/prospects/${prospectId}`, (route) =>
    json(route, record),
  );
  await page.route(
    `**/business-development/prospects/${prospectId}/convert`,
    async (route) => {
      writes++;
      record = {
        ...record,
        linkedClientId: clientId,
        convertedAt: "2026-10-11T05:00:00Z",
      };
      await route.abort("connectionreset");
    },
  );
  const dialog = await openLink(page);
  await dialog.getByRole("button", { name: "Confirm link" }).click();
  await expect(
    page.getByRole("link", { name: "Open linked client" }),
  ).toBeVisible();
  expect(writes).toBe(1);
  expect(unexpected).toEqual([]);
});
test("mismatched success is refused and session expiry retains the existing global boundary", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let writes = 0;
  await page.route("**/business-development/search/clients?**", (route) =>
    json(route, { results: [choice] }),
  );
  await page.route(
    `**/business-development/prospects/${prospectId}/convert`,
    async (route) => {
      writes++;
      if (writes === 1)
        return json(route, {
          prospect: {
            ...prospect,
            linkedClientId: clientId,
            convertedAt: "2026-10-11T05:00:00Z",
          },
          client: {
            id: "10000000-0000-4000-8000-000000000002",
            name: "Wrong client",
          },
          created: false,
        });
      return json(route, { message: "Expired" }, 401);
    },
  );
  const dialog = await openLink(page);
  await dialog.getByRole("button", { name: "Confirm link" }).click();
  await expect(dialog.getByRole("alert")).toContainText("unexpected response");
  await expect(
    page.getByRole("link", { name: "Open linked client" }),
  ).toHaveCount(0);
  expect(writes).toBe(1);
  await dialog.getByRole("button", { name: "Confirm link" }).click();
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  expect(writes).toBe(2);
  expect(unexpected).toEqual([]);
});
test("viewers and archived prospects cannot initiate linking", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.route("**/core/me", (route) =>
    json(route, { user: { id: "viewer", email: null }, role: "viewer" }),
  );
  await page.goto(`/portfolio/prospects/${prospectId}`);
  await expect(
    page.getByRole("button", { name: "Link existing client" }),
  ).toBeDisabled();
  await page.route("**/core/me", (route) =>
    json(route, { user: { id: "admin", email: null }, role: "user_admin" }),
  );
  await page.route(`**/business-development/prospects/${prospectId}`, (route) =>
    json(route, { ...prospect, status: "dismissed" }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Link existing client" }),
  ).toBeDisabled();
  expect(unexpected).toEqual([]);
});

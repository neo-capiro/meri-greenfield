import { expect, test } from "@playwright/test";
import { installFixtures, json } from "./fixtures";

const identity = {
  user: { id: "billing-reader", email: "test@example.test" },
  tenant: { id: "billing-tenant", name: "Synthetic billing tenant" },
  role: "user_admin",
  billingAdmin: true,
};
const summary = {
  billingEnabled: true,
  status: "active",
  slots: 14,
  usedSlots: 12,
  pricePerSlotUsd: 217,
  llmAllowanceUsd: 11.25,
  llmUsedUsd: 9.34,
  llmOverageUsd: 1.19,
  llmWarn: false,
  llmHardCapUsd: null,
  currentPeriodEnd: "2026-11-01T00:00:00Z",
  hasSubscription: true,
};

test("actual Add profile keeps creation reachable around an optional billing disclosure", async ({
  page,
}, info) => {
  const unexpected = await installFixtures(page);
  let reads = 0;
  await page.route("**/api/backend/core/me", (route) => json(route, identity));
  await page.route("**/api/backend/core/billing/summary", (route) => {
    reads++;
    return json(route, summary);
  });
  await page.goto("/portfolio");
  await page
    .getByRole("button", { name: "Add profile", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Add profile", exact: true });
  const panel = dialog.getByRole("group", { name: "Current plan and usage" });
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveAttribute("open");
  await expect(
    dialog.getByRole("button", { name: /Manual entry/ }),
  ).toBeInViewport();
  expect(reads).toBe(0);
  await panel.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByText("$217.00", { exact: false })).toBeVisible();
  await expect(
    panel.getByRole("link", { name: "Manage billing" }),
  ).toHaveAttribute("href", "http://127.0.0.1:5191/existing/settings/billing");
  expect(reads).toBe(1);
  await dialog.screenshot({
    path: info.outputPath("billing-chooser-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await dialog.screenshot({
    path: info.outputPath("billing-chooser-mobile-dark.png"),
  });
  const manual = dialog.getByRole("button", { name: /Manual entry/ });
  await manual.scrollIntoViewIfNeeded();
  await expect(manual).toBeInViewport();
  await manual.click();
  await expect(
    dialog.getByLabel("Legal name *", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Current plan and usage" }),
  ).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("actual chooser omits financial summary without billing permission while retaining profile intake", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let reads = 0;
  await page.route("**/api/backend/core/me", (route) =>
    json(route, { ...identity, billingAdmin: false }),
  );
  await page.route("**/api/backend/core/billing/summary", (route) => {
    reads++;
    return json(route, summary);
  });
  await page.goto("/portfolio");
  await page
    .getByRole("button", { name: "Add profile", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Add profile", exact: true });
  await expect(
    dialog.getByRole("button", { name: /Manual entry/ }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole("group", { name: "Current plan and usage" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("link", { name: "Manage billing" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: /Manual entry/ }).click();
  await expect(
    dialog.getByLabel("Legal name *", { exact: true }),
  ).toBeVisible();
  expect(reads).toBe(0);
  expect(unexpected).toEqual([]);
});

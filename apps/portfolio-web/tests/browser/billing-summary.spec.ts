import { expect, test, type Page } from "@playwright/test";
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
const panel = (page: Page) =>
  page.getByRole("group", { name: "Current plan and usage" });
async function setup(page: Page, actor: unknown = identity) {
  const unexpected = await installFixtures(page);
  await page.route("**/api/backend/core/me", (route) => json(route, actor));
  return unexpected;
}
async function open(page: Page) {
  await page.goto("/__test/billing-summary");
  await expect(page.getByLabel("Summary probe identity")).toHaveText(
    "billing-reader",
  );
}
async function expand(page: Page) {
  await panel(page).locator("summary").click();
}
async function changeIdentity(page: Page, next: unknown) {
  await page.evaluate(
    (detail) =>
      window.dispatchEvent(
        new CustomEvent("billing-summary-identity", { detail }),
      ),
    next,
  );
}
test("eligible billing admin sees real supplied rows with responsive light/dark styling", async ({
  page,
}, info) => {
  const unexpected = await setup(page);
  await page.route("**/api/backend/core/billing/summary", (route) =>
    json(route, summary),
  );
  await open(page);
  await expand(page);
  const region = panel(page);
  await expect(region.getByText("$217.00", { exact: false })).toBeVisible();
  await expect(region.getByText("12 active profiles")).toBeVisible();
  await expect(region.getByText("$11.25", { exact: true })).toBeVisible();
  await expect(region.getByText("$9.34", { exact: true })).toBeVisible();
  await expect(region.getByText("$1.19", { exact: true })).toBeVisible();
  await expect(region.getByText("No cap set")).toBeVisible();
  await expect(region.locator("time")).toHaveAttribute(
    "datetime",
    summary.currentPeriodEnd,
  );
  await expect(
    region.getByText(/not a quote or an amount due today/),
  ).toBeVisible();
  await expect(
    region.getByRole("button", { name: /Pay|Continue|Checkout/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(async () => {
      const fonts = await document.fonts.load('13px "Geist Test"');
      return fonts.length > 0 && document.fonts.check('13px "Geist Test"');
    }),
  ).toBe(true);
  await region.screenshot({
    path: info.outputPath("billing-summary-desktop-light.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(18, 18, 18)",
  );
  expect(
    await region.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await region.screenshot({
    path: info.outputPath("billing-summary-mobile-dark.png"),
  });
  expect(unexpected).toEqual([]);
});
for (const denied of [
  { role: "user_admin", billingAdmin: undefined },
  { role: "user_admin", billingAdmin: false },
  { role: "standard_user", billingAdmin: true },
  { role: "client_portal_user", billingAdmin: true },
])
  test(`denied ${denied.role}/${denied.billingAdmin} makes no financial request`, async ({
    page,
  }) => {
    const unexpected = await setup(page, { ...identity, ...denied });
    let reads = 0;
    await page.route("**/api/backend/core/billing/summary", (route) => {
      reads++;
      return json(route, summary);
    });
    await open(page);
    await expect(panel(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Hide summary" }).click();
    await page.getByRole("button", { name: "Show summary" }).click();
    await expect(panel(page)).toHaveCount(0);
    expect(reads).toBe(0);
    expect(unexpected).toEqual([]);
  });
test("collapsed disclosure requests nothing; Enter/Space expand/collapse work", async ({
  page,
}) => {
  const unexpected = await setup(page);
  let reads = 0;
  await page.route("**/api/backend/core/billing/summary", (route) => {
    reads++;
    return json(route, summary);
  });
  await open(page);
  const disclosure = panel(page).locator("summary");
  await disclosure.focus();
  await expect(disclosure).toBeFocused();
  expect(reads).toBe(0);
  await disclosure.press("Enter");
  await expect(
    panel(page).getByText("$217.00", { exact: false }),
  ).toBeVisible();
  expect(reads).toBe(1);
  await disclosure.press("Space");
  await expect(panel(page)).not.toHaveAttribute("open", "");
  await expect(page.getByText("$217.00", { exact: false })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
test("capiro_admin follows direct guard without the optional membership bit", async ({
  page,
}) => {
  const unexpected = await setup(page, {
    ...identity,
    role: "capiro_admin",
    billingAdmin: undefined,
  });
  await page.route("**/api/backend/core/billing/summary", (route) =>
    json(route, summary),
  );
  await open(page);
  await expand(page);
  await expect(
    panel(page).getByText("$217.00", { exact: false }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});
test("failed GET shows no amounts; explicit retry alone restores server values", async ({
  page,
}) => {
  const unexpected = await setup(page);
  let reads = 0;
  await page.route("**/api/backend/core/billing/summary", (route) =>
    ++reads === 1
      ? json(route, { message: "Summary unavailable" }, 503)
      : json(route, summary),
  );
  await open(page);
  await expand(page);
  await expect(panel(page).getByRole("alert")).toContainText(
    "Summary unavailable",
  );
  expect(reads).toBe(1);
  await expect(page.getByText("$217.00", { exact: false })).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    panel(page).getByText("$217.00", { exact: false }),
  ).toBeVisible();
  expect(reads).toBe(2);
  expect(unexpected).toEqual([]);
});
test("canonical403 refuses financial data and shows actual permission failure", async ({
  page,
}) => {
  const unexpected = await setup(page);
  await page.route("**/api/backend/core/billing/summary", (route) =>
    json(route, { message: "Billing is managed by your billing admin." }, 403),
  );
  await open(page);
  await expand(page);
  await expect(panel(page).getByRole("alert")).toContainText(
    "You do not have permission",
  );
  await expect(page.getByText("$217.00", { exact: false })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
test("permission loss and invalidation hide previously cached amounts", async ({
  page,
}) => {
  const unexpected = await setup(page);
  let reads = 0;
  await page.route("**/api/backend/core/billing/summary", (route) => {
    reads++;
    return json(route, summary);
  });
  await open(page);
  await expand(page);
  await expect(
    panel(page).getByText("$217.00", { exact: false }),
  ).toBeVisible();
  await changeIdentity(page, { ...identity, billingAdmin: false });
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByText("$217.00", { exact: false })).toHaveCount(0);
  await changeIdentity(page, identity);
  await expect(
    panel(page).getByText("$217.00", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("billing-summary-invalidate")),
  );
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByText("$217.00", { exact: false })).toHaveCount(0);
  expect(reads).toBeGreaterThanOrEqual(1);
  expect(unexpected).toEqual([]);
});
test("held previous-tenant response cannot appear in new tenant scope", async ({
  page,
}) => {
  const unexpected = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await page.route("**/api/backend/core/billing/summary", async (route) => {
    if (++reads === 1) {
      await held;
      await json(route, summary).catch(() => {});
    } else await json(route, { ...summary, pricePerSlotUsd: 93 });
  });
  await open(page);
  await expand(page);
  await expect.poll(() => reads).toBe(1);
  await changeIdentity(page, {
    ...identity,
    tenant: { id: "other-tenant", name: "Other tenant" },
  });
  await expect(panel(page).getByText("$93.00", { exact: false })).toBeVisible();
  release();
  await expect(page.getByText("$217.00", { exact: false })).toHaveCount(0);
  await expect(panel(page).getByText("$93.00", { exact: false })).toBeVisible();
  expect(unexpected).toEqual([]);
});
test("closed consumer hides a held summary response", async ({ page }) => {
  const unexpected = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await page.route("**/api/backend/core/billing/summary", async (route) => {
    reads++;
    await held;
    await json(route, summary).catch(() => {});
  });
  await open(page);
  await expand(page);
  await expect.poll(() => reads).toBe(1);
  await page.getByRole("button", { name: "Hide summary" }).click();
  release();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByText("$217.00", { exact: false })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
test("no-plan values remain purchased slots and never invent paid or trial capacity", async ({
  page,
}) => {
  const unexpected = await setup(page);
  await page.route("**/api/backend/core/billing/summary", (route) =>
    json(route, {
      ...summary,
      status: "none",
      slots: 0,
      usedSlots: 2,
      llmAllowanceUsd: 0,
      llmUsedUsd: 0,
      llmOverageUsd: 0,
      currentPeriodEnd: null,
      llmWarn: true,
      billingEnabled: false,
    }),
  );
  await open(page);
  await expand(page);
  await expect(panel(page).getByText("No plan", { exact: true })).toBeVisible();
  await expect(panel(page).getByText("2 active profiles")).toBeVisible();
  await expect(
    panel(page).getByText("Not available", { exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByText("Billing enforcement is disabled."),
  ).toBeVisible();
  await expect(panel(page).getByRole("status")).toContainText(
    "AI usage warning",
  );
  await expect(
    panel(page).getByText(/10 slots|Paid|Next charge|Due today/, {
      exact: true,
    }),
  ).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

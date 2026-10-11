import { expect, test, type Page, type Locator } from "@playwright/test";
import { client, installFixtures, json } from "./fixtures";
const state = {
  billingEnabled: true,
  status: "active",
  slots: 12,
  usedSlots: 11,
  locked: false,
  trialEndsAt: null,
  onboardingFlowVersion: 1,
};
const renderErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  renderErrors.set(page, errors);
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Cannot update a component|Maximum update depth|Rendered (more|fewer) hooks/.test(
        message.text(),
      )
    )
      errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(renderErrors.get(page)).toEqual([]);
});
async function chooser(page: Page) {
  await page.goto("/portfolio");
  await page
    .getByRole("button", { name: "Add profile", exact: true })
    .first()
    .click();
  return page.getByRole("dialog", { name: "Add profile", exact: true });
}
async function fillProfile(dialog: Locator) {
  await dialog
    .getByLabel("Legal name *", { exact: true })
    .fill("Capacity Test");
  await dialog
    .getByLabel("Website *", { exact: true })
    .fill("capacity.example.test");
  await dialog
    .getByLabel("Company description *", { exact: true })
    .fill("Synthetic intercepted capacity test");
  await dialog
    .getByRole("button", { name: "3. Sector & Tracks", exact: true })
    .click();
}
test("tenant slot count blocks client creation and leaves prospect and LDA browsing reachable", async ({
  page,
}, info) => {
  const unexpected = await installFixtures(page);
  await page.route("**/api/backend/core/billing/state", (route) =>
    json(route, { ...state, usedSlots: 12 }),
  );
  const dialog = await chooser(page);
  await expect(
    dialog.getByText("12 of 12 client slots in use · 0 available"),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /Manual entry/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Search LDA/ }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole("link", { name: /Add prospect/ }),
  ).toHaveAttribute("href", "/portfolio/prospects?new=1");
  await expect(dialog.getByText(/No charge has been made/)).toBeVisible();
  await dialog.screenshot({
    path: info.outputPath("profile-capacity-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(18, 18, 18)",
  );
  await dialog.screenshot({
    path: info.outputPath("profile-capacity-mobile-dark.png"),
  });
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  expect(unexpected).toEqual([]);
});
test("trial uses ten-profile allowance and does not substitute the one-client visible catalog", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.route("**/api/backend/core/billing/state", (route) =>
    json(route, { ...state, status: "trialing", slots: 0, usedSlots: 9 }),
  );
  const dialog = await chooser(page);
  await expect(
    dialog.getByText("9 of 10 client slots in use · 1 available"),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /Manual entry/ }),
  ).toBeEnabled();
  expect(unexpected).toEqual([]);
});
test("failed state read blocks creation; explicit read retry restores available capacity", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let failed = true;
  await page.route("**/api/backend/core/billing/state", (route) =>
    failed
      ? json(route, { message: "Capacity service unavailable" }, 503)
      : json(route, state),
  );
  const dialog = await chooser(page);
  await expect(
    dialog.getByRole("button", { name: /Manual entry/ }),
  ).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText(
    "Capacity service unavailable",
  );
  failed = false;
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: /Manual entry/ }),
  ).toBeEnabled();
  expect(unexpected).toEqual([]);
});
test("fresh create preflight catches a slot consumed while the form was open and preserves input", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let reads = 0,
    writes = 0;
  await page.route("**/api/backend/core/billing/state", (route) =>
    json(route, { ...state, usedSlots: ++reads >= 3 ? 12 : 11 }),
  );
  await page.route("**/api/backend/core/clients", (route) => {
    if (route.request().method() === "POST") writes++;
    return json(route, [client]);
  });
  const dialog = await chooser(page);
  await dialog.getByRole("button", { name: /Manual entry/ }).click();
  await fillProfile(dialog);
  await dialog
    .getByRole("button", { name: "Create profile", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Create profile", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByText(/All client slots are in use/).first(),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "1. Company Info", exact: true })
    .click();
  await expect(dialog.getByLabel("Legal name *", { exact: true })).toHaveValue(
    "Capacity Test",
  );
  expect(writes).toBe(0);
  expect(reads).toBeGreaterThanOrEqual(3);
  expect(unexpected).toEqual([]);
});
for (const event of ["capacity-invalidate-actor", "capacity-unmount"])
  test(`held capacity preflight cannot write after ${event}`, async ({
    page,
  }) => {
    await installFixtures(page);
    let reads = 0,
      writes = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/backend/core/billing/state", async (route) => {
      if (++reads === 2) await held;
      await json(route, state);
    });
    await page.route("**/api/backend/core/clients", (route) => {
      if (route.request().method() === "POST") writes++;
      return json(route, [client]);
    });
    await page.goto("/__test/profile-capacity");
    await page.getByRole("button", { name: "Start profile test" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Add profile",
      exact: true,
    });
    await fillProfile(dialog);
    await dialog
      .getByRole("button", { name: "Create profile", exact: true })
      .click();
    await expect.poll(() => reads).toBe(2);
    await page.evaluate((name) => window.dispatchEvent(new Event(name)), event);
    release();
    if (event === "capacity-unmount") await expect(dialog).not.toBeVisible();
    else
      await expect(
        dialog.getByRole("button", { name: "Create profile", exact: true }),
      ).toBeDisabled();
    // Wait for the observed mutation to settle, not an arbitrary delay.
    await expect(page.getByText("Saving…", { exact: true })).not.toBeVisible();
    expect(writes).toBe(0);
  });
test("unknown create reply freezes repeat creation and retains the completed form", async ({
  page,
}) => {
  await installFixtures(page);
  let writes = 0;
  let committed = false;
  await page.route("**/api/backend/core/clients", (route) => {
    if (route.request().method() !== "POST")
      return json(
        route,
        committed
          ? [
              client,
              {
                ...client,
                id: "20000000-0000-4000-8000-000000000002",
                name: "Capacity Test",
              },
            ]
          : [client],
      );
    writes++;
    committed = true;
    return json(route, { message: "Reply unavailable after dispatch" }, 502);
  });
  const dialog = await chooser(page);
  await dialog.getByRole("button", { name: /Manual entry/ }).click();
  await fillProfile(dialog);
  await dialog
    .getByRole("button", { name: "Create profile", exact: true })
    .click();
  await expect(
    dialog.getByText(/No automatic retry will be sent/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Create profile", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Capacity Test", { exact: true })).toBeVisible();
});

for (const event of ["capacity-invalidate-actor", "capacity-unmount"])
  for (const heldStage of ["upload-url", "storage", "confirm"])
    test(`logo ${heldStage} cannot continue after ${event}`, async ({
      page,
    }) => {
      await installFixtures(page);
      let transfers = 0,
        confirmations = 0,
        reached = false;
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/backend/core/clients", (route) =>
        route.request().method() === "POST"
          ? json(route, { ...client, ...route.request().postDataJSON() })
          : json(route, [client]),
      );
      await page.route(
        "**/api/backend/core/clients/*/logo/upload-url",
        async (route) => {
          if (heldStage === "upload-url") {
            reached = true;
            await held;
          }
          await json(route, {
            url: "https://storage.example.test/upload",
            s3Key: "stage/key",
            fields: { key: "stage/key" },
          });
        },
      );
      await page.route("https://storage.example.test/upload", async (route) => {
        transfers++;
        if (heldStage === "storage") {
          reached = true;
          await held;
        }
        await route.fulfill({
          status: 204,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      });
      await page.route(
        "**/api/backend/core/clients/*/logo/confirm",
        async (route) => {
          confirmations++;
          if (heldStage === "confirm") {
            reached = true;
            await held;
          }
          await json(route, client);
        },
      );
      await page.goto("/__test/profile-capacity");
      await page.getByRole("button", { name: "Start profile test" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Add profile",
        exact: true,
      });
      await fillProfile(dialog);
      await dialog.getByLabel("Upload logo", { exact: true }).setInputFiles({
        name: "logo.png",
        mimeType: "image/png",
        buffer: Buffer.from("Synthetic intercepted bytes"),
      });
      await dialog
        .getByRole("button", { name: "Create profile", exact: true })
        .click();
      await expect.poll(() => reached).toBe(true);
      await page.evaluate(
        (name) => window.dispatchEvent(new Event(name)),
        event,
      );
      release();
      await expect
        .poll(() => page.evaluate(() => window.__capacityPendingWrites?.()))
        .toBe(0);
      await expect(page.getByTestId("saved-profiles")).toHaveText("0");
      expect(transfers).toBe(heldStage === "upload-url" ? 0 : 1);
      expect(confirmations).toBe(heldStage === "confirm" ? 1 : 0);
    });
test("LDA selection must fit fresh capacity and can be reduced without losing the review", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let writes = 0;
  await page.route("**/api/backend/core/billing/state", (route) =>
    json(route, state),
  );
  await page.route("**/api/backend/core/firm/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/registrant"))
      return json(route, {
        ldaRegistrantId: 12,
        ldaRegistrantName: "Synthetic Firm",
      });
    if (path.endsWith("/import-candidates"))
      return json(route, {
        registrantId: 12,
        registrantName: "Synthetic Firm",
        candidates: [8, 9].map((id) => ({
          ldaClientId: id,
          name: `Client ${id}`,
          filings: 1,
          latestFilingYear: 2026,
          totalSpend: 0,
          onboardedAs: null,
        })),
      });
    if (path.endsWith("/import")) {
      writes++;
      return json(route, {
        created: 1,
        items: [{ id: "client-created", name: "Client 8", ldaClientId: 8 }],
        skipped: [],
      });
    }
    return json(route, { message: "Unexpected firm path" }, 500);
  });
  const chooserDialog = await chooser(page);
  await chooserDialog.getByRole("button", { name: /Search LDA/ }).click();
  const dialog = page.getByRole("dialog", {
    name: "Import with LDA",
  });
  await dialog
    .getByRole("checkbox", { name: "Select Client 8", exact: true })
    .check();
  await dialog
    .getByRole("checkbox", { name: "Select Client 9", exact: true })
    .check();
  await expect(
    dialog.getByRole("button", { name: "Import 2 clients", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByText(/Only 1 client slot is available/),
  ).toBeVisible();
  await dialog
    .getByRole("checkbox", { name: "Select Client 9", exact: true })
    .uncheck();
  await dialog
    .getByRole("button", { name: "Import 1 client", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "LDA import results" })
      .getByRole("status"),
  ).toContainText("1 client profiles created. 0 skipped.");
  expect(writes).toBe(1);
  expect(unexpected).toEqual([]);
});

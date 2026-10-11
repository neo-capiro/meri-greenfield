import { test, expect } from "@playwright/test";
import { client, clientId, installFixtures, json } from "./fixtures";

test("production Add profile chooser opens retained LDA intake, returns and restores focus", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const writes: string[] = [];
  await page.route("**/api/backend/core/firm/**", (route) => {
    if (route.request().method() !== "GET") writes.push(route.request().url());
    return json(route, { ldaRegistrantId: null, ldaRegistrantName: null });
  });
  await page.goto("/portfolio");
  const add = page
    .getByRole("button", { name: "Add profile", exact: true })
    .first();
  await add.click();
  await page.getByRole("button", { name: /Search LDA/ }).click();
  await expect(
    page.getByRole("dialog", {
      name: "Find your firm in LDA filings",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Add profile", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(add).toBeFocused();
  expect(writes).toEqual([]);
  expect(unexpected).toEqual([]);
});
async function openCreate(page: import("@playwright/test").Page) {
  await page.goto("/portfolio");
  await page
    .getByRole("button", { name: "Add profile", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog", { name: "Add profile", exact: true })
    .getByRole("button", { name: /Manual entry/ })
    .click();
  return page.getByRole("dialog", { name: "Add profile", exact: true });
}
async function company(dialog: import("@playwright/test").Locator) {
  await dialog
    .getByLabel("Legal name *", { exact: true })
    .fill("Test Intake Organization");
  await dialog
    .getByLabel("Website *", { exact: true })
    .fill("intake.example.test");
  await dialog
    .getByLabel("Company description *", { exact: true })
    .fill("Synthetic client created only through intercepted requests.");
}
test("three intake steps validate, preserve input, send canonical fields and explicit intake data", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const posts: unknown[] = [];
  await page.route("**/api/backend/core/clients", (route) => {
    if (route.request().method() !== "POST") return json(route, [client]);
    posts.push(route.request().postDataJSON());
    return json(route, {
      ...client,
      ...route.request().postDataJSON(),
      id: clientId,
    });
  });
  const dialog = await openCreate(page);
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("highlighted fields");
  expect(posts).toHaveLength(0);
  await company(dialog);
  await dialog
    .getByLabel("Main company email", { exact: true })
    .fill("test@example.test");
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByLabel("CAGE Code", { exact: true }).fill("1ab2c");
  await dialog.getByLabel("UEI", { exact: true }).fill("abc123def456");
  await dialog.getByLabel("EIN", { exact: true }).fill("12-3456789");
  await dialog.getByLabel("NAICS codes", { exact: true }).fill("541330");
  await dialog.getByLabel("NAICS codes", { exact: true }).press("Enter");
  await dialog.getByLabel("8A", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Organization types", exact: true })
    .click();
  await page.getByLabel("Small business", { exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await expect(dialog.getByLabel("Legal name *", { exact: true })).toHaveValue(
    "Test Intake Organization",
  );
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByLabel("EIN", { exact: true })).toHaveValue(
    "12-3456789",
  );
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Sector tags", exact: true })
    .click();
  await page.getByLabel("Defense", { exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await dialog
    .getByLabel("NDAA Authorization Request", { exact: true })
    .check();
  await dialog
    .getByLabel("Funding priorities", { exact: true })
    .fill("Test priority");
  await dialog.getByLabel("Funding priorities", { exact: true }).press("Enter");
  await dialog
    .getByLabel("Internal notes", { exact: true })
    .fill("Isolated synthetic notes");
  await dialog.screenshot({
    path: "test-results/client-intake-sector-bottom-desktop.png",
  });
  await dialog
    .locator("fieldset")
    .first()
    .evaluate((element) => {
      element.scrollTop = 0;
    });
  await dialog.screenshot({
    path: "test-results/client-intake-sector-desktop.png",
  });
  await dialog
    .getByRole("button", { name: "Create profile", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({
    name: "Test Intake Organization",
    website: "intake.example.test",
    profileType: "CLIENT",
    profileStatus: "ACTIVE",
    cageCode: "1AB2C",
    uei: "ABC123DEF456",
    naicsCodes: ["541330"],
    applicantTypes: ["Small businesses"],
    setAsideCertifications: ["8A"],
    sectorTag: "DEFENSE",
    submissionTracks: ["NDAA"],
    intakeData: {
      ein: "123456789",
      fundingPriorities: ["Test priority"],
      internalNotes: "Isolated synthetic notes",
    },
  });
  expect(unexpected).toEqual([]);
});
test("create failure keeps all entered fields and never shows success", async ({
  page,
}) => {
  await installFixtures(page);
  await page.route("**/api/backend/core/clients", (route) =>
    route.request().method() === "POST"
      ? json(route, { message: "No client slots available" }, 402)
      : json(route, [client]),
  );
  const dialog = await openCreate(page);
  await company(dialog);
  await dialog
    .getByRole("button", { name: "3. Sector & Tracks", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Create profile", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "No client slots available",
  );
  await dialog
    .getByRole("button", { name: "1. Company Info", exact: true })
    .click();
  await expect(dialog.getByLabel("Legal name *", { exact: true })).toHaveValue(
    "Test Intake Organization",
  );
  await expect(
    dialog.getByRole("button", { name: "Continue to profile", exact: true }),
  ).not.toBeVisible();
  await dialog.screenshot({
    path: "test-results/client-intake-company-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await dialog.screenshot({
    path: "test-results/client-intake-company-mobile-dark.png",
  });
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});
test("logo confirmation failure retries without duplicate profile creation or storage upload", async ({
  page,
}) => {
  await installFixtures(page);
  let creates = 0,
    transfers = 0,
    confirmations = 0;
  await page.route("**/api/backend/core/clients", (route) => {
    if (route.request().method() !== "POST") return json(route, [client]);
    creates++;
    return json(route, { ...client, ...route.request().postDataJSON() });
  });
  await page.route(
    `**/api/backend/core/clients/${clientId}/logo/upload-url`,
    (route) =>
      json(route, {
        url: "https://storage.example.test/upload",
        s3Key: "stage/key",
        fields: { key: "stage/key", policy: "synthetic" },
      }),
  );
  await page.route("https://storage.example.test/upload", async (route) => {
    transfers++;
    await route.fulfill({
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.route(
    `**/api/backend/core/clients/${clientId}/logo/confirm`,
    (route) => {
      confirmations++;
      return confirmations === 1
        ? json(route, { message: "Synthetic confirmation unavailable" }, 503)
        : json(route, { ...client, logoUrl: null });
    },
  );
  const dialog = await openCreate(page);
  await company(dialog);
  await dialog.getByLabel("Upload logo", { exact: true }).setInputFiles({
    name: "test-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("Synthetic image bytes; storage is intercepted"),
  });
  await dialog
    .getByRole("button", { name: "3. Sector & Tracks", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Create profile", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("profile was saved");
  await dialog.getByRole("button", { name: "Retry logo", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect({ creates, transfers, confirmations }).toEqual({
    creates: 1,
    transfers: 1,
    confirmations: 2,
  });
});

test("client header edit merges fresh remote siblings, preserves unchanged fields and returns focus", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const original = {
    ...client,
    primaryContactEmail: "original@example.test",
    intakeData: { profileNotes: "Original", oldSibling: "Retain" },
  };
  let reads = 0;
  let saved: Record<string, unknown> | undefined;
  await page.route(`**/api/backend/core/clients/${clientId}`, (route) => {
    if (route.request().method() === "PUT") {
      saved = route.request().postDataJSON();
      return json(route, { ...original, ...saved, name: "Remote rename" });
    }
    reads++;
    return json(
      route,
      reads === 1
        ? original
        : {
            ...original,
            name: "Remote rename",
            primaryContactEmail: "remote@example.test",
            intakeData: {
              ...original.intakeData,
              profileNotes: "Remote update",
              newSibling: "Fresh",
            },
          },
    );
  });
  await page.goto(`/portfolio/${clientId}`);
  const trigger = page.getByRole("button", {
    name: `More actions for ${client.name}`,
    exact: true,
  });
  await trigger.click();
  await page
    .getByRole("menuitem", { name: "Edit client profile", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Edit client details",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "3. Sector & Tracks", exact: true })
    .click();
  await dialog
    .getByLabel("Internal notes", { exact: true })
    .fill("Local wizard note");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(reads).toBe(2);
  expect(saved).toEqual({
    intakeData: {
      profileNotes: "Remote update",
      oldSibling: "Retain",
      newSibling: "Fresh",
      internalNotes: "Local wizard note",
    },
  });
  await expect(
    page.getByRole("button", {
      name: "More actions for Remote rename",
      exact: true,
    }),
  ).toBeFocused();
  expect(unexpected).toEqual([]);
});

test("rejected client edit remains open with entered data and unchanged profile", async ({
  page,
}) => {
  await installFixtures(page);
  await page.route(`**/api/backend/core/clients/${clientId}`, (route) =>
    route.request().method() === "PUT"
      ? json(route, { message: "Denied" }, 403)
      : json(route, client),
  );
  await page.goto(`/portfolio/${clientId}`);
  await page
    .getByRole("button", {
      name: `More actions for ${client.name}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Edit client profile", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Edit client details",
    exact: true,
  });
  await dialog
    .getByLabel("Legal name *", { exact: true })
    .fill("Unsaved rename");
  await dialog
    .getByRole("button", { name: "3. Sector & Tracks", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "do not have permission",
  );
  await dialog
    .getByRole("button", { name: "1. Company Info", exact: true })
    .click();
  await expect(dialog.getByLabel("Legal name *", { exact: true })).toHaveValue(
    "Unsaved rename",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: client.name, exact: true }),
  ).toBeVisible();
});

test("standard member cannot edit but can confirm archive; rejected receipt never navigates", async ({
  page,
}) => {
  await installFixtures(page);
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      role: "standard_user",
    }),
  );
  let archives = 0;
  await page.route(`**/api/backend/core/clients/${clientId}`, (route) => {
    if (route.request().method() !== "DELETE") return json(route, client);
    archives++;
    return json(route, {
      ...client,
      status: archives === 1 ? "active" : "archived",
    });
  });
  await page.goto(`/portfolio/${clientId}`);
  await page
    .getByRole("button", {
      name: `More actions for ${client.name}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Edit client profile", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("menuitem", { name: "Archive client", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Archive client",
    exact: true,
  });
  expect(archives).toBe(0);
  await dialog
    .getByRole("button", { name: "Archive client", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("unexpected response");
  await expect(page).toHaveURL(new RegExp(`/portfolio/${clientId}$`));
  await dialog
    .getByRole("button", { name: "Archive client", exact: true })
    .click();
  await expect(page).toHaveURL(/\/portfolio$/);
  expect(archives).toBe(2);
});

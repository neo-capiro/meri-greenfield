import { test, expect, type Page } from "@playwright/test";
import { installFixtures, json, prospectId } from "./fixtures";
import type { WorkspaceTemplate } from "../../src/features/prospects/proposals/contracts";

const first: WorkspaceTemplate = {
  id: "79000000-0000-4000-8000-000000000001",
  name: "Synthetic advocacy structure",
  icon: null,
  description: "Synthetic advisory template description",
  product: "Synthetic advocacy",
  style: null,
  fontFamily: null,
  accentColor: null,
  meriPrimary: false,
  meriSecondary: false,
  sections: ["Scope of services", "Team"],
  elements: ["Cover"],
};
const second: WorkspaceTemplate = {
  ...first,
  id: "79000000-0000-4000-8000-000000000002",
  name: "Synthetic research structure",
  product: "Synthetic research",
};
const endpoint = "**/api/backend/workspace/templates";
async function fixture(
  page: Page,
  templates: WorkspaceTemplate[] = [first, second],
) {
  const unexpected = await installFixtures(page);
  const requests: string[] = [];
  await page.route(`${endpoint}/library`, (route) => {
    requests.push(route.request().method());
    return json(route, templates);
  });
  const card = () =>
    page.getByRole("region", { name: "Proposal", exact: true });
  const open = async () => {
    await page.goto(`/portfolio/prospects/${prospectId}`);
    await card()
      .getByRole("button", { name: "Browse templates", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Workspace templates",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    return dialog;
  };
  return { unexpected, requests, card, open };
}

test("real template filters and structure preview never imply a generated or sent proposal", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.route(`${endpoint}/${first.id}`, (route) => json(route, first));
  const dialog = await f.open();
  await expect(dialog).toContainText("2 of 2 templates");
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some(
        (font) => font.family === "Geist Test" && font.status === "loaded",
      );
    }),
  ).toBe(true);
  await dialog.getByLabel("Search templates").fill("  ADVISORY  ");
  await expect(
    dialog
      .getByRole("list", { name: "Available templates" })
      .getByRole("listitem"),
  ).toHaveCount(2);
  await dialog
    .getByLabel("Product", { exact: true })
    .selectOption(first.product);
  await expect(dialog).toContainText("1 of 2 templates");
  await dialog
    .getByRole("button", { name: `Preview ${first.name}`, exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: first.name, exact: true });
  await expect(preview).toContainText("Scope of services");
  await expect(preview).toContainText("Team");
  await expect(preview).toContainText("Cover");
  await expect(preview).toContainText(
    "No proposal content, fees or document has been generated.",
  );
  await expect(
    preview.getByRole("button", { name: /Generate|Send|Save|Publish/ }),
  ).toHaveCount(0);
  await expect(preview.getByLabel(/fee|start date/i)).toHaveCount(0);
  await page.screenshot({
    path: "test-results/prospect-proposals-preview.png",
    fullPage: false,
  });
  await preview.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.getByLabel("Search templates").fill("no matching template");
  await expect(dialog).toContainText("No templates match these filters.");
  await dialog
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(dialog).toContainText("2 of 2 templates");
  await page.screenshot({
    path: "test-results/prospect-proposals-catalog.png",
    fullPage: false,
  });
  expect(f.requests).toEqual(["GET"]);
  expect(f.unexpected).toEqual([]);
});

test("catalog service failure stays visible and only explicit retry fetches again", async ({
  page,
}) => {
  const f = await fixture(page);
  let reads = 0;
  await page.route(`${endpoint}/library`, (route) => {
    reads++;
    return reads === 1
      ? json(route, { message: "Synthetic catalog unavailable" }, 503)
      : json(route, [first]);
  });
  const dialog = await f.open();
  await expect(dialog.getByRole("alert")).toContainText(
    "Synthetic catalog unavailable",
  );
  await expect(dialog).not.toContainText(
    "No Workspace templates are available",
  );
  expect(reads).toBe(1);
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(dialog).toContainText("1 of 1 templates");
  expect(reads).toBe(2);
  expect(f.unexpected).toEqual([]);
});

test("wrong detail receipt is rejected and safe retry displays only the selected template", async ({
  page,
}) => {
  const f = await fixture(page);
  let reads = 0;
  await page.route(`${endpoint}/${first.id}`, (route) =>
    json(route, ++reads === 1 ? second : first),
  );
  const dialog = await f.open();
  await dialog
    .getByRole("button", { name: `Preview ${first.name}`, exact: true })
    .click();
  let preview = page.getByRole("dialog", {
    name: "Template preview",
    exact: true,
  });
  await expect(preview.getByRole("alert")).toContainText(
    "does not match your selection",
  );
  await expect(preview).not.toContainText(second.name);
  await preview.getByRole("button", { name: "Retry", exact: true }).click();
  preview = page.getByRole("dialog", { name: first.name, exact: true });
  await expect(preview).toContainText("Scope of services");
  expect(reads).toBe(2);
  expect(f.unexpected).toEqual([]);
});

test("empty catalog is distinct from a forbidden catalog", async ({ page }) => {
  const f = await fixture(page, []);
  let dialog = await f.open();
  await expect(dialog).toContainText(
    "No Workspace templates are available for this account.",
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.route(`${endpoint}/library`, (route) =>
    json(route, { message: "Synthetic membership rejected" }, 403),
  );
  await page.reload();
  await f
    .card()
    .getByRole("button", { name: "Browse templates", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Workspace templates",
    exact: true,
  });
  await expect(dialog.getByRole("alert")).toContainText(
    "do not have permission",
  );
  await expect(dialog).not.toContainText(
    "No Workspace templates are available",
  );
  expect(f.unexpected).toEqual([]);
});

test("identity failure and missing tenant cannot expose the template browser", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.route("**/api/backend/core/me", (route) =>
    json(route, { message: "Synthetic identity unavailable" }, 503),
  );
  await page.goto(`/portfolio/prospects/${prospectId}`);
  await expect(f.card().getByRole("alert")).toContainText(
    "Synthetic identity unavailable",
  );
  await expect(
    f.card().getByRole("button", { name: "Browse templates" }),
  ).toHaveCount(0);
  expect(f.requests).toEqual([]);
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      tenant: null,
      role: "standard_user",
    }),
  );
  await page.reload();
  await expect(f.card()).toContainText(
    "An active account membership is required",
  );
  await expect(
    f.card().getByRole("button", { name: "Browse templates" }),
  ).toHaveCount(0);
  expect(f.requests).toEqual([]);
  expect(f.unexpected).toEqual([]);
});

test("template text remains plain and mobile dark preview supports Escape with focus return", async ({
  page,
}) => {
  const f = await fixture(page);
  const plain = {
    ...first,
    sections: [
      "<script>synthetic()</script>",
      "Synthetic long section describing the scope without financial estimates",
    ],
  };
  await page.route(`${endpoint}/${first.id}`, (route) => json(route, plain));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const dialog = await f.open();
  const previewButton = dialog.getByRole("button", {
    name: `Preview ${first.name}`,
    exact: true,
  });
  await previewButton.click();
  const preview = page.getByRole("dialog", { name: first.name, exact: true });
  await expect(preview).toContainText("<script>synthetic()</script>");
  await expect(preview.locator("script")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/prospect-proposals-mobile-dark.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(previewButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    f.card().getByRole("button", { name: "Browse templates" }),
  ).toBeFocused();
  expect(f.unexpected).toEqual([]);
});

test("closing a pending preview prevents its late response from replacing another selection", async ({
  page,
}) => {
  const f = await fixture(page);
  let release: () => void = () => {};
  let started = false;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${endpoint}/${first.id}`, async (route) => {
    started = true;
    await held;
    await json(route, first).catch(() => {});
  });
  const different = {
    ...second,
    sections: ["Synthetic research-only outline"],
  };
  await page.route(`${endpoint}/${second.id}`, (route) =>
    json(route, different),
  );
  const dialog = await f.open();
  try {
    await dialog
      .getByRole("button", { name: `Preview ${first.name}`, exact: true })
      .click();
    await expect.poll(() => started).toBe(true);
    const pending = page.getByRole("dialog", {
      name: "Template preview",
      exact: true,
    });
    await pending.getByRole("button", { name: "Close", exact: true }).click();
    await expect(pending).toHaveCount(0);
    await dialog
      .getByRole("button", { name: `Preview ${second.name}`, exact: true })
      .click();
    const preview = page.getByRole("dialog", {
      name: second.name,
      exact: true,
    });
    await expect(preview).toContainText("Synthetic research-only outline");
    release();
    await expect(preview).not.toContainText("Scope of services");
    await expect(preview).toContainText("Synthetic research-only outline");
    expect(f.unexpected).toEqual([]);
  } finally {
    release();
  }
});

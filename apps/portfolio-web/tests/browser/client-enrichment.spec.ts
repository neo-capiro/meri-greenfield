import { test, expect, type Page } from "@playwright/test";
import { clientId } from "./fixtures";
import {
  advocacyId,
  findingId,
  installEnrichment,
  matterId,
} from "./client-enrichment-fixtures";
async function openReview(page: Page) {
  await page.goto(`/portfolio/${clientId}`);
  await page.getByRole("button", { name: "Meri actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Fill with Meri" }).click();
  const drawer = page.getByRole("dialog", {
    name: "Fill with Meri",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  return drawer;
}
test("saved run current/proposed, sources, selection and explicit partial apply", async ({
  page,
}) => {
  const { state, unexpected } = await installEnrichment(page);
  state.mode = "partial";
  const drawer = await openReview(page);
  await expect(drawer).toContainText("Saved company description");
  await expect(drawer).toContainText("Synthetic reviewed company description");
  await drawer
    .getByText("fact · public_web · source evidence (1)", { exact: true })
    .first()
    .click();
  await expect(
    drawer.getByRole("link", { name: "Synthetic company source" }).first(),
  ).toHaveAttribute("href", "https://example.test/source");
  await drawer.getByRole("button", { name: "Select all new" }).click();
  await expect(drawer.getByRole("checkbox").nth(2)).not.toBeChecked();
  await drawer
    .getByRole("button", { name: "Apply 2 selected", exact: true })
    .click();
  expect(state.posts).toHaveLength(0);
  await drawer
    .getByRole("button", { name: "Confirm apply", exact: true })
    .click();
  await expect(drawer).toContainText(
    "1 of 2 selected findings are now accepted",
  );
  expect(state.posts[0]?.body).toEqual({ findingIds: [findingId, advocacyId] });
  expect(unexpected).toEqual([]);
});
test("ignore with reason then restore uses persisted acknowledgments", async ({
  page,
}) => {
  const { state, unexpected } = await installEnrichment(page);
  const drawer = await openReview(page);
  const finding = drawer.getByRole("article", {
    name: "Finding description",
    exact: true,
  });
  await finding.getByRole("button", { name: "Ignore", exact: true }).click();
  await finding
    .getByLabel("Reason (optional)")
    .fill("Wrong source attribution");
  await finding
    .getByRole("button", { name: "Confirm ignore", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Confirm reject", exact: true })
    .click();
  await expect(
    finding.getByRole("button", { name: "Restore", exact: true }),
  ).toBeEnabled();
  expect(state.posts[0]?.body).toEqual({ reason: "Wrong source attribution" });
  await finding.getByRole("button", { name: "Restore", exact: true }).click();
  await drawer
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  await expect(
    finding.getByRole("button", { name: "Ignore", exact: true }),
  ).toBeEnabled();
  expect(state.posts).toHaveLength(2);
  expect(unexpected).toEqual([]);
});
test("matter assignment explicitly applies immediately with exact receipt", async ({
  page,
}) => {
  const { state, unexpected } = await installEnrichment(page);
  const drawer = await openReview(page);
  const finding = drawer.getByRole("article", {
    name: "Finding Synthetic advocacy matter",
  });
  await finding.getByRole("button", { name: "Choose matter" }).click();
  await finding
    .getByRole("combobox", { name: "Matter", exact: true })
    .selectOption(matterId);
  await finding
    .getByRole("button", { name: "Apply finding to matter", exact: true })
    .click();
  expect(state.posts).toHaveLength(0);
  await drawer
    .getByRole("button", { name: "Confirm assign", exact: true })
    .click();
  await expect(drawer).toContainText(
    "Finding applied and matter assignment acknowledged",
  );
  expect(state.posts[0]?.body).toEqual({ matterId });
  expect(unexpected).toEqual([]);
});
test("wrong matter receipt cannot show assignment success", async ({
  page,
}) => {
  const { state } = await installEnrichment(page);
  state.mode = "wrong-assignment";
  const drawer = await openReview(page);
  const finding = drawer.getByRole("article", {
    name: "Finding Synthetic advocacy matter",
  });
  await finding.getByRole("button", { name: "Choose matter" }).click();
  await finding
    .getByRole("combobox", { name: "Matter", exact: true })
    .selectOption(matterId);
  await finding
    .getByRole("button", { name: "Apply finding to matter" })
    .click();
  await drawer
    .getByRole("button", { name: "Confirm assign", exact: true })
    .click();
  await expect(drawer).toContainText("The request may have saved changes");
  await expect(drawer).not.toContainText("assignment acknowledged");
  expect(state.posts).toHaveLength(1);
});
test("lost apply response freezes repeat writes even after closing/reopening", async ({
  page,
}) => {
  const { state } = await installEnrichment(page);
  state.mode = "lost";
  let drawer = await openReview(page);
  await drawer.getByRole("button", { name: "Select all new" }).click();
  await drawer
    .getByRole("button", { name: "Apply 2 selected", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Confirm apply", exact: true })
    .click();
  await expect(drawer).toContainText("The request may have saved changes");
  await drawer.getByRole("button", { name: "Close review" }).click();
  await expect(
    page.getByRole("button", { name: "Meri actions", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Meri actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Fill with Meri" }).click();
  drawer = page.getByRole("dialog", { name: "Fill with Meri", exact: true });
  await expect(drawer).toContainText("The request may have saved changes");
  await drawer.getByRole("button", { name: "Refresh saved review" }).click();
  await expect(
    drawer.getByRole("button", { name: "Select all new" }),
  ).toBeDisabled();
  expect(state.posts).toHaveLength(1);
});
test("changed finding preflight preserves review and prevents POST", async ({
  page,
}) => {
  const { state } = await installEnrichment(page);
  const drawer = await openReview(page);
  await drawer.getByRole("button", { name: "Select all new" }).click();
  await drawer
    .getByRole("button", { name: "Apply 2 selected", exact: true })
    .click();
  state.mode = "drift";
  await drawer
    .getByRole("button", { name: "Confirm apply", exact: true })
    .click();
  await expect(drawer).toContainText("Findings changed");
  expect(state.posts).toHaveLength(0);
});
test("closing during preflight aborts before POST", async ({ page }) => {
  const { state } = await installEnrichment(page);
  const drawer = await openReview(page);
  await drawer.getByRole("button", { name: "Select all new" }).click();
  await drawer
    .getByRole("button", { name: "Apply 2 selected", exact: true })
    .click();
  let release = () => {};
  state.runGate = new Promise<void>((r) => {
    release = r;
  });
  await drawer
    .getByRole("button", { name: "Confirm apply", exact: true })
    .click();
  await expect.poll(() => state.runGets).toBe(1);
  await drawer.getByRole("button", { name: "Close review" }).click();
  release();
  await expect(drawer).toBeHidden();
  expect(state.posts).toHaveLength(0);
});
test("standard user can read but cannot apply or ignore", async ({ page }) => {
  const { state } = await installEnrichment(page);
  state.role = "standard_user";
  const drawer = await openReview(page);
  await expect(drawer).toContainText("Applying needs an admin");
  await expect(
    drawer.getByRole("button", { name: "Select all new" }),
  ).toBeDisabled();
  await expect(
    drawer.getByRole("button", { name: "Ignore", exact: true }).first(),
  ).toBeDisabled();
  expect(state.posts).toHaveLength(0);
});
test("running review polls and cancellation is explicit and scoped", async ({
  page,
}) => {
  const { state } = await installEnrichment(page);
  if (!state.run) throw new Error("Missing test run");
  state.run.status = "running";
  state.run.stage = "research";
  state.run.completedAt = null;
  const drawer = await openReview(page);
  await expect.poll(() => state.latestGets).toBeGreaterThan(1);
  await drawer.getByRole("button", { name: "Cancel run", exact: true }).click();
  expect(state.posts).toHaveLength(0);
  await drawer
    .getByRole("button", { name: "Confirm cancel", exact: true })
    .click();
  await expect(drawer).toContainText(
    "Run is cancelled. Previously accepted changes remain saved",
  );
  expect(state.posts[0]?.path).toMatch(/\/cancel$/);
});
test("empty/setup blocks unsafe new research and task retry", async ({
  page,
}) => {
  const { state, unexpected } = await installEnrichment(page);
  state.run = null;
  const drawer = await openReview(page);
  await expect(drawer).toContainText(
    "current service can save website, identity mappings and facility districts before approval",
  );
  await expect(
    drawer.getByRole("button", { name: "Start research unavailable" }),
  ).toBeDisabled();
  await expect(
    drawer.getByRole("button", { name: "Run again" }),
  ).toBeDisabled();
  expect(state.posts).toHaveLength(0);
  expect(unexpected).toEqual([]);
});
test("wrong-client response hides review; unavailable read can retry", async ({
  page,
}) => {
  const { state } = await installEnrichment(page);
  state.mode = "wrong-client";
  const drawer = await openReview(page);
  await expect(drawer).toContainText("different client");
  await expect(drawer.getByRole("article")).toHaveCount(0);
  state.mode = "normal";
  await drawer.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(drawer.getByRole("article")).toHaveCount(4);
  expect(state.posts).toHaveLength(0);
});
test("drawer follows desktop geometry and mobile dark layout", async ({
  page,
}) => {
  const { unexpected } = await installEnrichment(page);
  const drawer = await openReview(page);
  await page.evaluate(() => document.fonts.ready);
  const bounds = await drawer.boundingBox();
  expect(bounds?.x).toBe(820);
  expect(bounds?.y).toBe(0);
  expect(bounds?.width).toBe(620);
  expect(bounds?.height).toBe(1040);
  await page.screenshot({
    path: "work/enrichment-evidence/review-desktop-light.png",
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(drawer).toHaveCSS("background-color", "rgb(27, 27, 27)");
  await page.screenshot({
    path: "work/enrichment-evidence/review-mobile-dark.png",
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    drawer.getByRole("button", { name: "Close review" }),
  ).toBeInViewport();
  expect(unexpected).toEqual([]);
});
test("canonical upload is explicit, validates empty files and never starts research", async ({
  page,
}) => {
  const { state, unexpected } = await installEnrichment(page);
  const drawer = await openReview(page);
  await expect(drawer).toContainText(
    "Uploading saves a client file immediately",
  );
  await drawer.getByRole("button", { name: "Upload", exact: true }).click();
  const upload = page.getByRole("dialog", {
    name: "Upload files",
    exact: true,
  });
  await expect(upload).toBeVisible();
  await upload.getByLabel("Select files").setInputFiles({
    name: "empty.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(0),
  });
  await expect(upload).toContainText("Empty files cannot be uploaded");
  await expect(
    upload.getByRole("button", { name: "Upload file", exact: true }),
  ).toBeDisabled();
  await upload.getByRole("button", { name: "Done", exact: true }).click();
  await expect(drawer).toBeVisible();
  expect(state.posts).toHaveLength(0);
  expect(unexpected).toEqual([]);
});
test("unmount during upload ticket blocks storage and confirmation", async ({
  page,
}) => {
  const { state, unexpected } = await installEnrichment(page);
  let release = () => {};
  let tickets = 0;
  let storage = 0;
  let confirms = 0;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route(
    "**/api/backend/core/engagement/attachments/upload-url",
    async (route) => {
      tickets++;
      expect(route.request().postDataJSON().clientId).toBe(clientId);
      await gate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://storage.example.test/upload",
          fields: {},
          s3Key: "synthetic-file-key",
        }),
      });
    },
  );
  await page.route("https://storage.example.test/**", (route) => {
    storage++;
    return route.fulfill({ status: 204 });
  });
  await page.route(
    "**/api/backend/core/engagement/attachments/confirm",
    (route) => {
      confirms++;
      return route.fulfill({ status: 500 });
    },
  );
  const drawer = await openReview(page);
  await drawer.getByRole("button", { name: "Upload", exact: true }).click();
  const upload = page.getByRole("dialog", {
    name: "Upload files",
    exact: true,
  });
  await upload.getByLabel("Select files").setInputFiles({
    name: "synthetic.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Synthetic test bytes only"),
  });
  await upload
    .getByRole("button", { name: "Upload file", exact: true })
    .click();
  await expect.poll(() => tickets).toBe(1);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/portfolio");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(upload).toBeHidden();
  const ticketFinished = page.waitForEvent("requestfinished", (request) =>
    request.url().endsWith("/engagement/attachments/upload-url"),
  );
  release();
  await ticketFinished;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  await expect(
    page.getByRole("heading", { name: /^Portfolio \d+$/, level: 1 }),
  ).toBeVisible();
  expect(storage).toBe(0);
  expect(confirms).toBe(0);
  expect(state.posts).toHaveLength(0);
  expect(unexpected).toEqual([]);
});

import { test, expect, type Page } from "@playwright/test";
import { installFixtures } from "./fixtures";
import {
  fullThread,
  threadId,
  threadTenantId,
  threadClientId,
} from "../thread-mail-fixture";
async function setup(
  page: Page,
  options: {
    body?: unknown;
    status?: number;
    role?: string;
    hold?: Promise<void>;
    actual?: boolean;
  } = {},
) {
  await installFixtures(page);
  let reads = 0;
  const writes: string[] = [];
  let failing = Boolean(options.status);
  await page.route("**/api/backend/core/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/api/backend/core/",
    )[1];
    if (route.request().method() !== "GET") {
      writes.push(path ?? "unknown");
      return route.fulfill({
        status: 500,
        json: { message: "No writes authorized" },
      });
    }
    if (path === "me")
      return route.fulfill({
        json: {
          user: { id: "actor", email: "actor@example.test" },
          tenant: { id: threadTenantId, name: "Synthetic" },
          role: options.role ?? "standard_user",
        },
      });
    if (path === `engagement/mail-threads/${threadId}`) {
      reads++;
      await options.hold;
      return route.fulfill({
        status: failing ? options.status : 200,
        json: failing
          ? { message: "Synthetic thread read refused" }
          : (options.body ?? fullThread),
      });
    }
    if (path === "me/email-signature")
      return route.fulfill({ json: { html: null, enabled: false } });
    if (path === `clients/${threadClientId}/activity`)
      return route.fulfill({
        json: [
          {
            id: `email:${threadId}`,
            kind: "email",
            title: "Synthetic policy discussion",
            body: "Stored preview",
            occurredAt: "2026-10-11T14:00:00Z",
            sourceType: "mail_thread",
            sourceId: threadId,
            origin: "derived",
            dueAt: null,
            settledAt: null,
            pinned: false,
          },
          {
            id: "40000000-0000-4000-8000-000000000001",
            kind: "email",
            title: "Recorded email is not a synced thread",
            body: "Manually logged synthetic note",
            occurredAt: "2026-10-11T13:00:00Z",
            sourceType: "mail_thread",
            sourceId: threadId,
            origin: "recorded",
            dueAt: null,
            settledAt: null,
            pinned: false,
          },
          {
            id: "email:invalid",
            kind: "email",
            title: "Invalid synced source is not opened",
            body: null,
            occurredAt: "2026-10-11T12:00:00Z",
            sourceType: "mail_thread",
            sourceId: "provider-message-id-not-thread-uuid",
            origin: "derived",
            dueAt: null,
            settledAt: null,
            pinned: false,
          },
        ],
      });
    return route.fallback();
  });
  await page.goto(
    options.actual ? `/portfolio/${threadClientId}` : "/__test/thread-mail",
  );
  await expect(
    page.getByRole("button", { name: "Expand email thread" }),
  ).toBeVisible();
  return {
    reads: () => reads,
    writes,
    recover: () => {
      failing = false;
    },
  };
}
async function expand(page: Page) {
  await page.getByRole("button", { name: "Expand email thread" }).click();
}
test("expands exact stored messages on demand, orders incoming newest and collapses", async ({
  page,
}, info) => {
  const fixture = await setup(page);
  expect(fixture.reads()).toBe(0);
  await expand(page);
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toBeVisible();
  const messages = page
    .getByRole("region", { name: "Synced email thread" })
    .getByRole("article");
  await expect(messages.first()).toContainText(
    "Latest incoming stored message",
  );
  await expect(messages.first()).toContainText(
    "<script>untrusted email is plain text</script>",
  );
  await page.evaluate(async () => {
    await document.fonts.load('13px "Geist Test"');
  });
  expect(
    await page.evaluate(() => document.fonts.check('13px "Geist Test"')),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("thread-expanded-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Show less" }).click();
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).not.toBeVisible();
  await expand(page);
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toBeVisible();
  expect(fixture.reads()).toBe(1);
  expect(fixture.writes).toEqual([]);
});
test("Reply reviews exact sender only and refuses send/upload/rewrite", async ({
  page,
}, info) => {
  const fixture = await setup(page);
  await expand(page);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reply", exact: true });
  await expect(
    dialog.getByRole("button", {
      name: "Remove recipient taylor@example.test",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Reply sending is unavailable here.", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Rewrite with Meri" }),
  ).toBeDisabled();
  await expect(dialog.locator('input[type="file"]')).toHaveCount(0);
  await dialog
    .getByLabel("Message", { exact: true })
    .fill("Reviewed synthetic reply.");
  await dialog.getByRole("button", { name: "Review email" }).click();
  const review = page.getByRole("dialog", {
    name: "Review reply",
    exact: true,
  });
  await expect(
    review.getByText("To: taylor@example.test", { exact: true }),
  ).toBeVisible();
  await expect(review.getByText(/^Cc:/)).toHaveCount(0);
  await expect(
    review.getByRole("button", { name: "Sending unavailable", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("reply-review-desktop.png"),
    fullPage: true,
  });
  expect(fixture.writes).toEqual([]);
});
test("Reply all exposes actual deduplicated Cc and excludes mailbox plus signed-in account", async ({
  page,
}) => {
  const fixture = await setup(page);
  await expand(page);
  await page.getByRole("button", { name: "Reply all", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reply", exact: true });
  await expect(dialog.getByLabel("Cc", { exact: true })).toHaveValue(
    "colleague@example.test, copied@example.test",
  );
  await expect(
    dialog.getByRole("button", {
      name: "Remove recipient taylor@example.test",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByLabel("Message", { exact: true })
    .fill("Explicit reply all review.");
  await dialog.getByRole("button", { name: "Review email" }).click();
  const review = page.getByRole("dialog", {
    name: "Review reply",
    exact: true,
  });
  await expect(
    review.getByText("Cc: colleague@example.test, copied@example.test", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    review.getByText(
      /mailbox@example.test|actor@example.test|never-use-roster/,
    ),
  ).toHaveCount(0);
  expect(fixture.writes).toEqual([]);
});
test("a failed thread read retries only GET and cannot leak stale message content", async ({
  page,
}) => {
  const fixture = await setup(page, { status: 403 });
  await expand(page);
  await expect(page.getByRole("alert")).toContainText("permission");
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toHaveCount(0);
  fixture.recover();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toBeVisible();
  expect(fixture.reads()).toBe(2);
  expect(fixture.writes).toEqual([]);
});
test("wrong client receipt is refused", async ({ page }) => {
  const fixture = await setup(page, {
    body: { ...fullThread, clientId: threadTenantId },
  });
  await expand(page);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reply", exact: true }),
  ).toHaveCount(0);
  expect(fixture.writes).toEqual([]);
});
test("cross-thread message receipt is refused", async ({ page }) => {
  await setup(page, {
    body: {
      ...fullThread,
      messages: [{ ...fullThread.messages[0], threadId: threadTenantId }],
    },
  });
  await expand(page);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toHaveCount(0);
});
test("missing mailbox identity blocks recipient review without guessing from snippet", async ({
  page,
}) => {
  const fixture = await setup(page, {
    body: { ...fullThread, connectionEmail: null },
  });
  await expand(page);
  await page.getByRole("button", { name: "Reply all", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "mailbox address is unavailable",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fixture.writes).toEqual([]);
});
test("read-only actor can expand but cannot prepare a reply", async ({
  page,
}) => {
  const fixture = await setup(page, { role: "viewer" });
  await expand(page);
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reply all", exact: true }),
  ).toBeDisabled();
  expect(fixture.writes).toEqual([]);
});
test("actor change closes the previous actor's draft and cached thread", async ({
  page,
}) => {
  await setup(page);
  await expand(page);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Previous actor private draft");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("thread-actor-change")),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Expand email thread" }),
  ).toBeVisible();
});
test("client change during held detail read never exposes the previous client message", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fixture = await setup(page, { hold: held });
  await expand(page);
  await expect.poll(() => fixture.reads()).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("thread-client-change")),
  );
  release();
  await expect(
    page.getByRole("button", { name: "Expand email thread" }),
  ).toBeVisible();
  await expand(page);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toHaveCount(0);
});
test("invalidated identity cannot retain an open reviewed draft", async ({
  page,
}) => {
  await setup(page);
  await expand(page);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("thread-identity-invalidate")),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toHaveCount(0);
});
test("empty stored thread has honest empty state and no reply", async ({
  page,
}) => {
  await setup(page, { body: { ...fullThread, messages: [] } });
  await expand(page);
  await expect(
    page.getByText("No active stored messages in this thread."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reply", exact: true }),
  ).toBeDisabled();
});
test("mobile dark expansion wraps without overflow", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await setup(page);
  await expand(page);
  await expect(
    page.getByText("Earlier outgoing message.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("thread-mobile-dark.png"),
    fullPage: true,
  });
});
test("actual Overview expands only a valid derived synced source and reviews Reply all", async ({
  page,
}, info) => {
  const fixture = await setup(page, { actual: true });
  const timeline = page.getByRole("region", {
    name: "Activity timeline",
    exact: true,
  });
  await expect(
    timeline.getByText("Recorded email is not a synced thread", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    timeline.getByText("Invalid synced source is not opened", { exact: true }),
  ).toBeVisible();
  await expect(
    timeline.getByRole("button", { name: "Expand email thread" }),
  ).toHaveCount(1);
  expect(fixture.reads()).toBe(0);
  await expand(page);
  await expect(
    timeline.getByText("Earlier outgoing message.", { exact: true }),
  ).toBeVisible();
  const replyAll = timeline.getByRole("button", {
    name: "Reply all",
    exact: true,
  });
  const less = timeline.getByRole("button", { name: "Show less", exact: true });
  const replyBox = await replyAll.boundingBox();
  const lessBox = await less.boundingBox();
  expect(replyBox && lessBox && Math.abs(replyBox.y - lessBox.y) < 2).toBe(
    true,
  );
  await timeline.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("actual-overview-thread-desktop.png"),
  });
  await replyAll.click();
  const dialog = page.getByRole("dialog", { name: "Reply", exact: true });
  await expect(dialog.getByLabel("Cc", { exact: true })).toHaveValue(
    "colleague@example.test, copied@example.test",
  );
  await dialog
    .getByLabel("Message", { exact: true })
    .fill("Actual Overview recipient review.");
  await dialog.getByRole("button", { name: "Review email" }).click();
  const review = page.getByRole("dialog", {
    name: "Review reply",
    exact: true,
  });
  await expect(
    review.getByText("To: taylor@example.test", { exact: true }),
  ).toBeVisible();
  await expect(
    review.getByRole("button", { name: "Sending unavailable", exact: true }),
  ).toBeDisabled();
  expect(fixture.reads()).toBe(1);
  expect(fixture.writes).toEqual([]);
});
test("actual Overview thread fits mobile dark with inline collapse", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const fixture = await setup(page, { actual: true });
  await expand(page);
  const timeline = page.getByRole("region", {
    name: "Activity timeline",
    exact: true,
  });
  await expect(
    timeline.getByText("Earlier outgoing message.", { exact: true }),
  ).toBeVisible();
  await timeline.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("actual-overview-thread-mobile-dark.png"),
  });
  await timeline.getByRole("button", { name: "Show less" }).click();
  await expect(
    timeline.getByText("Earlier outgoing message.", { exact: true }),
  ).toHaveCount(0);
  expect(fixture.writes).toEqual([]);
});

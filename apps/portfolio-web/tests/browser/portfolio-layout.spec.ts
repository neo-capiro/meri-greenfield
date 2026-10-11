import { test, expect } from "@playwright/test";
import {
  cardIds,
  layoutFixtures,
  layoutReceipt,
} from "./portfolio-layout-fixtures";
const endpoint = "**/api/backend/core/me/portfolio-layout";
const path = "/__test/portfolio-layout";
const positions = (page: import("@playwright/test").Page) =>
  page
    .locator("[data-client-id]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-client-id")),
    );
test("keyboard reorder saves canonical versioned order and reloads", async ({
  page,
}) => {
  await layoutFixtures(page);
  let saved = layoutReceipt();
  const writes: unknown[] = [];
  await page.route(endpoint, (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      writes.push(body);
      saved = layoutReceipt(
        1,
        body.order.map((id: string) => id.slice(7)),
      );
    }
    return route.fulfill({ json: saved });
  });
  await page.goto(path);
  const move = page.getByRole("button", { name: "Move Aerospace One later" });
  await expect(move).toBeEnabled();
  await move.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => positions(page))
    .toEqual([cardIds[1], cardIds[0], cardIds[2]]);
  await page.getByRole("button", { name: "Save order", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save order", exact: true }),
  ).toHaveCount(0);
  expect(writes).toEqual([
    {
      contractVersion: 1,
      expectedVersion: 0,
      order: [cardIds[1], cardIds[0], cardIds[2]].map((id) => `client:${id}`),
    },
  ]);
  await page.reload();
  await expect
    .poll(() => positions(page))
    .toEqual([cardIds[1], cardIds[0], cardIds[2]]);
  await page.screenshot({ path: "work/layout-desktop.png", fullPage: true });
});
test("pointer rearrangement and cancel are local until Save", async ({
  page,
}) => {
  await layoutFixtures(page);
  let writes = 0;
  await page.route(endpoint, (route) => {
    if (route.request().method() === "PUT") writes++;
    return route.fulfill({ json: layoutReceipt() });
  });
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "Move Aerospace One later" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Drag Energy Three to rearrange" })
    .dragTo(page.locator(`[data-client-id="${cardIds[0]}"]`));
  await expect
    .poll(() => positions(page))
    .toEqual([cardIds[2], cardIds[0], cardIds[1]]);
  await page.getByRole("button", { name: "Cancel reorder" }).click();
  await expect.poll(() => positions(page)).toEqual(cardIds);
  expect(writes).toBe(0);
});
for (const status of [404, 503])
  test(`unavailable ${status} keeps default cards and refuses writes`, async ({
    page,
  }) => {
    await layoutFixtures(page);
    let writes = 0;
    await page.route(endpoint, (route) => {
      if (route.request().method() === "PUT") writes++;
      return route.fulfill({ status, json: { message: "Unavailable" } });
    });
    await page.goto(path);
    await expect(
      page.getByText("Saved profile ordering is unavailable", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Move Aerospace One later" }),
    ).toBeDisabled();
    expect(writes).toBe(0);
  });
test("conflict retains draft and requires explicit latest order review", async ({
  page,
}) => {
  await layoutFixtures(page);
  let reads = 0;
  let writes = 0;
  await page.route(endpoint, (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      return route.fulfill({ status: 409, json: { message: "Changed" } });
    }
    return route.fulfill({
      json:
        ++reads === 1
          ? layoutReceipt()
          : layoutReceipt(2, [cardIds[2]!, cardIds[1]!, cardIds[0]!]),
    });
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Move Aerospace One later" }).click();
  await page.getByRole("button", { name: "Save order", exact: true }).click();
  await expect(
    page.getByText("Your unsaved order is retained", { exact: false }),
  ).toBeVisible();
  await expect
    .poll(() => positions(page))
    .toEqual([cardIds[1], cardIds[0], cardIds[2]]);
  await page.getByRole("button", { name: "Use latest saved order" }).click();
  await expect
    .poll(() => positions(page))
    .toEqual([cardIds[2], cardIds[1], cardIds[0]]);
  expect(writes).toBe(1);
});
test("lost successful reply blocks repeat then verifies the exact saved order", async ({
  page,
}) => {
  await layoutFixtures(page);
  let saved = layoutReceipt();
  let writes = 0;
  await page.route(endpoint, (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      saved = layoutReceipt(
        1,
        body.order.map((id: string) => id.slice(7)),
      );
      writes++;
      return route.abort("failed");
    }
    return route.fulfill({ json: saved });
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Move Aerospace One later" }).click();
  await page.getByRole("button", { name: "Save order", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check saved order" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save order", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Check saved order" }).click();
  await expect(page.getByText("Saved order confirmed.")).toHaveCount(1);
  expect(writes).toBe(1);
});
test("wrong actor successful receipt is not published", async ({ page }) => {
  await layoutFixtures(page);
  await page.route(endpoint, (route) =>
    route.fulfill({ json: { ...layoutReceipt(1), userId: cardIds[0] } }),
  );
  await page.goto(path);
  await expect(
    page.getByText("The saved layout response does not match this session."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Move Aerospace One later" }),
  ).toBeDisabled();
});
test("portal role never reads or writes the layout catalog", async ({
  page,
}) => {
  await layoutFixtures(page, "client_portal_user");
  let calls = 0;
  await page.route(endpoint, (route) => {
    calls++;
    return route.fulfill({ json: layoutReceipt() });
  });
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "Move Aerospace One later" }),
  ).toBeDisabled();
  expect(calls).toBe(0);
});
test("failed latest read cannot reuse the stale conflict receipt", async ({
  page,
}) => {
  await layoutFixtures(page);
  let reads = 0;
  await page.route(endpoint, (route) => {
    if (route.request().method() === "PUT")
      return route.fulfill({ status: 409, json: { message: "Changed" } });
    reads++;
    return reads === 2
      ? route.fulfill({ status: 503, json: { message: "Latest unavailable" } })
      : route.fulfill({ json: layoutReceipt(reads > 2 ? 2 : 0, cardIds) });
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Move Aerospace One later" }).click();
  await page.getByRole("button", { name: "Save order", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Use latest saved order" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload latest saved order" }).click();
  await expect(
    page.getByRole("button", { name: "Use latest saved order" }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole("list", { name: "Latest saved profile order" })
      .getByRole("listitem"),
  ).toHaveText(["Aerospace One", "Civic Two", "Energy Three"]);
});
test("expired session uses the existing sign-in boundary without a write", async ({
  page,
}) => {
  await layoutFixtures(page);
  let writes = 0;
  await page.route(endpoint, (route) => {
    if (route.request().method() === "PUT") writes++;
    return route.fulfill({ status: 401, json: { message: "Expired" } });
  });
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  expect(writes).toBe(0);
});
test("invalidated identity blocks a pending local draft write", async ({
  page,
}) => {
  await layoutFixtures(page);
  let writes = 0;
  await page.route(endpoint, (route) => {
    if (route.request().method() === "PUT") writes++;
    return route.fulfill({ json: layoutReceipt() });
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Move Aerospace One later" }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("layout-authority-invalidate")),
  );
  await expect(
    page.getByRole("button", { name: "Save order", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(0);
});
for (const change of [
  "layout-actor-change",
  "layout-catalog-change",
  "layout-unmount",
])
  test(`late PUT cannot publish after ${change}`, async ({ page }) => {
    await layoutFixtures(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writes = 0;
    await page.route(endpoint, async (route) => {
      if (route.request().method() === "PUT") {
        writes++;
        await held;
        return route.fulfill({
          json: layoutReceipt(1, [cardIds[1]!, cardIds[0]!, cardIds[2]!]),
        });
      }
      return route.fulfill({ json: layoutReceipt() });
    });
    await page.goto(path);
    await page
      .getByRole("button", { name: "Move Aerospace One later" })
      .click();
    await page.getByRole("button", { name: "Save order", exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    await page.evaluate(
      (name) => window.dispatchEvent(new Event(name)),
      change,
    );
    release();
    if (change === "layout-unmount")
      await expect(
        page.getByRole("region", { name: "Organization profile order" }),
      ).toHaveCount(0);
    else {
      await expect(
        page.getByRole("button", { name: "Save order", exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText("Profile order saved.")).toHaveCount(0);
    }
  });
test("identity invalidation after dispatch freezes a successful PUT as uncertain", async ({
  page,
}) => {
  await layoutFixtures(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route(endpoint, async (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      await held;
      return route.fulfill({
        json: layoutReceipt(1, [cardIds[1]!, cardIds[0]!, cardIds[2]!]),
      });
    }
    return route.fulfill({ json: layoutReceipt() });
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Move Aerospace One later" }).click();
  await page.getByRole("button", { name: "Save order", exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("layout-authority-invalidate")),
  );
  release();
  await expect(
    page.getByRole("button", { name: "Check saved order" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save order", exact: true }),
  ).toHaveCount(0);
  expect(writes).toBe(1);
});
test("mobile dark layout remains usable without horizontal overflow", async ({
  page,
}) => {
  await layoutFixtures(page);
  await page.route(endpoint, (route) =>
    route.fulfill({ json: layoutReceipt() }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "Move Aerospace One later" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(18, 18, 18)",
  );
  await page.screenshot({
    path: "work/layout-mobile-dark.png",
    fullPage: true,
  });
});

import { test, expect } from "@playwright/test";
import { installFixtures, json, prospectId } from "./fixtures";
const contactId = "80000000-0000-4000-8000-000000000001";
const contact = {
  id: contactId,
  prospectId,
  requestId: "90000000-0000-4000-8000-000000000001",
  name: "Priya Nair",
  title: "VP Government Affairs",
  email: "priya@example.test",
  phone: null,
  notes: "Dated synthetic source",
  version: 1,
  createdAt: "2026-10-10T12:00:00Z",
  updatedAt: "2026-10-10T12:00:00Z",
};
const base = `**/business-development/prospects/${prospectId}/contacts`;
const detail = `/portfolio/prospects/${prospectId}`;

test("undeployed contact contract is explicit and never offers a successful-looking save", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.route(base, (route) => json(route, { message: "Not Found" }, 404));
  await page.goto(detail);
  const card = page.getByRole("region", { name: "Prospect contacts" });
  await expect(card.getByRole("status")).toContainText("unavailable");
  await expect(
    card.getByRole("button", { name: "+ Add", exact: true }),
  ).toBeDisabled();
  expect(unexpected).toEqual([]);
});

test("create validates, preserves failed draft and retries with the same request identity", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let saved = false;
  let storedRequest: string | undefined;
  let creates = 0;
  const bodies: Record<string, unknown>[] = [];
  await page.route(base, async (route) => {
    if (route.request().method() === "GET")
      return json(route, {
        prospectId,
        readOnly: false,
        contacts: saved ? [{ ...contact, requestId: storedRequest }] : [],
        nextCursor: null,
      });
    expect(route.request().method()).toBe("POST");
    const body = route.request().postDataJSON();
    bodies.push(body);
    if (!storedRequest) {
      storedRequest = body.requestId;
      creates++;
      saved = true;
    }
    expect(body.requestId).toBe(storedRequest);
    if (bodies.length === 1)
      return json(route, { message: "Synthetic reply lost after commit" }, 503);
    return json(route, { ...contact, requestId: body.requestId });
  });
  await page.goto(detail);
  const card = page.getByRole("region", { name: "Prospect contacts" });
  await card.getByRole("button", { name: "+ Add", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Add prospect contact" });
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer.getByRole("alert")).toContainText("Name is required");
  expect(bodies).toHaveLength(0);
  await drawer.getByLabel("Name *", { exact: true }).fill(contact.name);
  await drawer.getByLabel("Title", { exact: true }).fill(contact.title);
  await drawer.getByLabel("Email", { exact: true }).fill("invalid");
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer.getByLabel("Email", { exact: true })).toBeFocused();
  await expect(drawer.getByLabel("Email", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(bodies).toHaveLength(0);
  await drawer.getByLabel("Email", { exact: true }).fill(contact.email);
  await drawer.getByLabel("Notes", { exact: true }).fill(contact.notes);
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer.getByRole("alert")).toContainText(
    "Synthetic reply lost after commit",
  );
  await expect(drawer.getByLabel("Name *", { exact: true })).toHaveValue(
    contact.name,
  );
  await drawer.screenshot({
    path: "work/prospect-contacts/create-drawer-desktop.png",
  });
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  await expect(card.getByRole("button", { name: /Priya Nair/ })).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(creates).toBe(1);
  expect(unexpected).toEqual([]);
});

test("version409 keeps unsaved fields and requires deliberate review before resaving", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let current = { ...contact };
  let writes = 0;
  await page.route(base, (route) =>
    json(route, {
      prospectId,
      readOnly: false,
      contacts: [current],
      nextCursor: null,
    }),
  );
  await page.route(`${base}/${contactId}`, async (route) => {
    const body = route.request().postDataJSON();
    writes++;
    if (writes === 1) {
      expect(body.expectedVersion).toBe(1);
      current = {
        ...current,
        version: 2,
        title: "Concurrent title",
        notes: "Remote notes",
      };
      return json(route, { message: "Contact changed. Reload latest." }, 409);
    }
    expect(body.expectedVersion).toBe(2);
    expect(body.notes).toBe("Remote notes");
    current = { ...current, ...body, version: 3 };
    return json(route, current);
  });
  await page.goto(detail);
  const card = page.getByRole("region", { name: "Prospect contacts" });
  await card.getByRole("button", { name: /Priya Nair/ }).click();
  const drawer = page.getByRole("dialog", { name: "Priya Nair" });
  await drawer.getByLabel("Title", { exact: true }).fill("My unsaved title");
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(
    drawer.getByText(/Your unsaved changes are preserved/),
  ).toBeVisible();
  await expect(drawer.getByLabel("Title", { exact: true })).toHaveValue(
    "My unsaved title",
  );
  await expect(
    drawer.getByRole("button", { name: "Save contact", exact: true }),
  ).toBeDisabled();
  await drawer
    .getByRole("button", { name: "Review latest contact", exact: true })
    .click();
  await expect(drawer.getByText("Remote notes", { exact: true })).toBeVisible();
  await expect(drawer.getByLabel("Title", { exact: true })).toHaveValue(
    "My unsaved title",
  );
  await drawer
    .getByRole("button", {
      name: "Replace my draft with latest values",
      exact: true,
    })
    .click();
  await expect(drawer.getByLabel("Title", { exact: true })).toHaveValue(
    "Concurrent title",
  );
  await drawer.getByLabel("Title", { exact: true }).fill("Reviewed title");
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  await expect(card.getByText("Reviewed title", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: /Priya Nair/ })).toBeFocused();
  expect(writes).toBe(2);
  expect(unexpected).toEqual([]);
});

test("removal needs explicit confirmation and rejects false successful receipts", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let removed = false;
  let deletes = 0;
  await page.route(base, (route) =>
    json(route, {
      prospectId,
      readOnly: false,
      contacts: removed ? [] : [contact],
      nextCursor: null,
    }),
  );
  await page.route(`${base}/${contactId}`, async (route) => {
    expect(route.request().method()).toBe("DELETE");
    expect(route.request().postDataJSON()).toEqual({ expectedVersion: 1 });
    deletes++;
    if (deletes === 1)
      return json(route, {
        id: contactId,
        prospectId,
        removed: false,
        version: 2,
      });
    removed = true;
    return json(route, {
      id: contactId,
      prospectId,
      removed: true,
      version: 2,
    });
  });
  await page.goto(detail);
  const card = page.getByRole("region", { name: "Prospect contacts" });
  await card.getByRole("button", { name: /Priya Nair/ }).click();
  const drawer = page.getByRole("dialog", { name: "Priya Nair" });
  await drawer.getByRole("button", { name: "Remove", exact: true }).click();
  expect(deletes).toBe(0);
  await drawer
    .getByRole("button", { name: "Keep contact", exact: true })
    .click();
  expect(deletes).toBe(0);
  await drawer.getByRole("button", { name: "Remove", exact: true }).click();
  await drawer
    .getByRole("button", { name: "Confirm removal", exact: true })
    .click();
  await expect(drawer.getByText(/unexpected response/)).toBeVisible();
  await expect(drawer).toBeVisible();
  await drawer
    .getByRole("button", { name: "Confirm removal", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  await expect(card.getByText("No contacts yet.")).toBeVisible();
  await expect(card).toBeFocused();
  expect(deletes).toBe(2);
  expect(unexpected).toEqual([]);
});

test("read-only lifecycle and lower role prevent edits; phone dark drawer stays in viewport", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let role = "user_admin";
  let readOnly = false;
  await page.route("**/core/me", (route) =>
    json(route, {
      user: { id: "test-viewer", email: null },
      tenant: { id: "synthetic", name: "Test" },
      role,
    }),
  );
  await page.route(base, (route) =>
    json(route, {
      prospectId,
      readOnly,
      contacts: [
        contact,
        {
          ...contact,
          id: "80000000-0000-4000-8000-000000000002",
          name: "Marcus Hale",
          title: "Director, Business Development",
        },
      ],
      nextCursor: null,
    }),
  );
  await page.goto(detail);
  const card = page.getByRole("region", { name: "Prospect contacts" });
  await expect(
    card.getByRole("button", { name: "+ Add", exact: true }),
  ).toBeEnabled();
  await card.screenshot({ path: "work/prospect-contacts/card-desktop.png" });
  readOnly = true;
  await page.reload();
  await expect(card.getByText(/Archived or converted prospect/)).toBeVisible();
  await expect(
    card.getByRole("button", { name: "+ Add", exact: true }),
  ).toBeDisabled();
  role = "client_portal_user";
  readOnly = false;
  await page.reload();
  await expect(
    card.getByRole("button", { name: "+ Add", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await card.getByRole("button", { name: /Priya Nair/ }).click();
  const drawer = page.getByRole("dialog", { name: "Priya Nair" });
  await expect(drawer.getByLabel("Name *", { exact: true })).toBeDisabled();
  await expect(
    drawer.getByRole("button", { name: "Save contact", exact: true }),
  ).toHaveCount(0);
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);
  await drawer.screenshot({
    path: "work/prospect-contacts/drawer-mobile-dark.png",
  });
  await drawer
    .getByRole("button", { name: "Close contact", exact: true })
    .click();
  expect(unexpected).toEqual([]);
});

test("wrong-client edit receipt and permission denial preserve draft;401 exits to session recovery", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let writes = 0;
  await page.route(base, (route) =>
    json(route, {
      prospectId,
      readOnly: false,
      contacts: [contact],
      nextCursor: null,
    }),
  );
  await page.route(`${base}/${contactId}`, async (route) => {
    writes++;
    if (writes === 1)
      return json(route, {
        ...contact,
        prospectId: "70000000-0000-4000-8000-000000000002",
        version: 2,
      });
    if (writes === 2)
      return json(route, { message: "Permission revoked" }, 403);
    return json(route, { message: "Expired" }, 401);
  });
  await page.goto(detail);
  const card = page.getByRole("region", { name: "Prospect contacts" });
  await card.getByRole("button", { name: /Priya Nair/ }).click();
  const drawer = page.getByRole("dialog", { name: "Priya Nair" });
  await drawer.getByLabel("Title", { exact: true }).fill("Unsaved title");
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer.getByRole("alert")).toContainText("unexpected response");
  await expect(drawer.getByLabel("Title", { exact: true })).toHaveValue(
    "Unsaved title",
  );
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer.getByRole("alert")).toContainText(
    "do not have permission",
  );
  await expect(drawer.getByLabel("Title", { exact: true })).toHaveValue(
    "Unsaved title",
  );
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your session expired", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/sign-in");
  expect(writes).toBe(3);
  expect(unexpected).toEqual([]);
});

import { test, expect, type Page, type Route } from "@playwright/test";
import { clientId, installFixtures } from "./fixtures";
import {
  governmentTarget,
  installGovernmentFixtures,
} from "./government-fixtures";

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

const member = { id: "member-42", name: "Sen. Synthetic Member" };
const noteText = "Reviewed the public briefing.";
const noteEndpoint = `**/api/backend/core/directory/contacts/${member.id}/notes`;
const detailEndpoint = `**/api/backend/core/directory/members/${member.id}`;
const searchEndpoint = "**/api/backend/core/directory/contacts?*";
const detail = {
  id: member.id,
  kind: "member",
  socialContacts: [],
  offices: [],
};
const identity = {
  user: { id: "user-test", email: "test@example.test" },
  tenant: { id: "tenant-test", name: "Synthetic tenant" },
  role: "standard_user",
};
const receipt = {
  id: "70000000-0000-4000-8000-000000000001",
  directoryContactId: member.id,
  directoryContactName: member.name,
  body: noteText,
  createdAt: "2026-10-11T12:00:00Z",
  createdBy: {
    id: identity.user.id,
    email: identity.user.email,
    firstName: null,
    lastName: null,
  },
};
const result = (page = 1, total = 1) => ({
  page,
  pageSize: 20,
  total,
  contacts: [
    {
      id: member.id,
      fullName: member.name,
      title: "Senator",
      chamber: "Senate",
      state: "TX",
      party: "R",
    },
  ],
});
const fulfill = (route: Route, json: unknown, status = 200) =>
  route.fulfill({ json, status });
async function setup(page: Page, government = false) {
  const unexpected = await (government
    ? installGovernmentFixtures(page)
    : installFixtures(page));
  const searches: string[] = [];
  const writes: { path: string; body: unknown }[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/backend/") && request.method() !== "GET")
      writes.push({ path: request.url(), body: request.postDataJSON() });
  });
  await page.route("**/api/backend/core/me", (route) =>
    fulfill(route, identity),
  );
  await page.route(searchEndpoint, (route) => {
    searches.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    return fulfill(route, result());
  });
  await page.route(detailEndpoint, (route) => fulfill(route, detail));
  await page.route(noteEndpoint, (route) => fulfill(route, receipt));
  return { unexpected, searches, writes };
}
async function openMember(page: Page, path = "/portfolio?log=1&keep=scope") {
  await page.goto(path);
  await page.getByRole("button", { name: "Member", exact: true }).click();
  await expect(
    page.getByRole("searchbox", { name: "Member", exact: true }),
  ).toBeVisible();
}
async function selectMember(page: Page, path?: string) {
  await openMember(page, path);
  await page
    .getByRole("searchbox", { name: "Member", exact: true })
    .fill("synthetic");
  await page.getByRole("button", { name: /^Sen\. Synthetic Member/ }).click();
  await expect(
    page.getByRole("textbox", { name: "What happened" }),
  ).toBeVisible();
}
const saveButton = (page: Page) =>
  page.getByRole("button", { name: "Log it", exact: true });
async function draft(page: Page, path?: string) {
  await selectMember(page, path);
  await page
    .getByRole("textbox", { name: "What happened" })
    .fill(`  ${noteText}\n`);
}
async function event(page: Page, name: string) {
  await page.evaluate((value) => window.dispatchEvent(new Event(value)), name);
}

test("global entry searches real members, preserves Client handoff and closes without writes", async ({
  page,
}) => {
  const { writes, searches, unexpected } = await setup(page);
  await openMember(page);
  const search = page.getByRole("searchbox", { name: "Member", exact: true });
  await search.fill("s");
  await expect(
    page.getByText("Search for a member to record a shared Directory note."),
  ).toBeVisible();
  expect(searches).toEqual([]);
  await search.fill("synthetic");
  const choice = page.getByRole("button", { name: /^Sen\. Synthetic Member/ });
  await choice.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      "Shared with users in your tenant who can access Directory notes.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Change member", exact: true })
    .click();
  await expect(search).toHaveValue("synthetic");
  await page.getByRole("button", { name: "Client", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Client", exact: true })
    .selectOption(clientId);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(`/portfolio/${clientId}?log=1`);
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect(writes).toEqual([]);
  expect(unexpected).toEqual([]);
});

test("explicit Note save sends only supported fields and displays its verified receipt", async ({
  page,
}) => {
  const { writes, unexpected } = await setup(page);
  await draft(page);
  const dialog = page.getByRole("dialog", { name: "Quick log", exact: true });
  await expect(dialog).toHaveCSS("width", "640px");
  await expect(
    page.getByText("The service records the time when the note is saved."),
  ).toBeVisible();
  for (const name of ["Call", "Meeting", "Email", "Commitment"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  const activeNote = page.getByText("Note", { exact: true });
  await expect(activeNote).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(activeNote).toHaveCSS("background-image", /linear-gradient/);
  await expect(page.getByRole("textbox", { name: "What happened" })).toHaveCSS(
    "height",
    "110px",
  );
  await page.screenshot({
    path: "work/member-note-desktop.png",
    fullPage: true,
  });
  await saveButton(page).click();
  await expect(page.getByText(/^Note saved to Directory/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeDisabled();
  expect(writes).toHaveLength(1);
  expect(writes[0]!.path).toContain(`/directory/contacts/${member.id}/notes`);
  expect(writes[0]!.body).toEqual({
    body: noteText,
    directoryContactName: member.name,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/keep=scope/);
  await expect(page).not.toHaveURL(/log=/);
  expect(unexpected).toEqual([]);
});

test("paging is explicit and an empty member search does not fabricate results", async ({
  page,
}) => {
  const { writes } = await setup(page);
  const pages: number[] = [];
  await page.route(searchEndpoint, (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page"));
    pages.push(pageNumber);
    return fulfill(
      route,
      url.searchParams.get("q") === "absent"
        ? { ...result(), total: 0, contacts: [] }
        : result(pageNumber, 21),
    );
  });
  await openMember(page);
  const search = page.getByRole("searchbox", { name: "Member", exact: true });
  await search.fill("synthetic");
  await page.getByRole("button", { name: "Next members" }).click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  expect(pages).toEqual([1, 2]);
  await search.fill("absent");
  await expect(page.getByText("No members match your search.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Sen\. Synthetic Member/ }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("search failure and retry preserve the query without writing", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let attempts = 0;
  await page.route(searchEndpoint, (route) =>
    fulfill(
      route,
      ++attempts === 1
        ? { message: "Directory temporarily unavailable" }
        : result(),
      attempts === 1 ? 400 : 200,
    ),
  );
  await openMember(page);
  await page
    .getByRole("searchbox", { name: "Member", exact: true })
    .fill("synthetic");
  await expect(page.getByRole("alert")).toContainText(
    "Directory temporarily unavailable",
  );
  await page.getByRole("button", { name: "Retry member search" }).click();
  await expect(
    page.getByRole("button", { name: /^Sen\. Synthetic Member/ }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  expect(writes).toEqual([]);
});

test("wrong member detail blocks dispatch and retains unsaved text", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.route(detailEndpoint, (route) =>
    fulfill(route, { ...detail, id: "member-other" }),
  );
  await draft(page);
  await saveButton(page).click();
  await expect(page.getByRole("alert")).toContainText("unexpected response");
  await expect(
    page.getByRole("textbox", { name: "What happened" }),
  ).toHaveValue(`  ${noteText}\n`);
  await expect(saveButton(page)).toBeEnabled();
  expect(writes).toEqual([]);
});

for (const [field, wrongReceipt] of [
  ["contact", { ...receipt, directoryContactId: "member-other" }],
  [
    "author",
    { ...receipt, createdBy: { ...receipt.createdBy, id: "other-author" } },
  ],
  ["body", { ...receipt, body: "Unexpected text" }],
] as const) {
  test(`wrong ${field} success freezes replay and never claims a saved note`, async ({
    page,
  }) => {
    const { writes } = await setup(page);
    await page.route(noteEndpoint, (route) => fulfill(route, wrongReceipt));
    await draft(page);
    await saveButton(page).click();
    await expect(page.getByText(/The save result is uncertain/)).toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Change member" }),
    ).toBeDisabled();
    await expect(page.getByText(/^Note saved to Directory/)).toHaveCount(0);
    expect(writes).toHaveLength(1);
  });
}

test("lost POST reply freezes automatic and explicit replay", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.route(noteEndpoint, (route) => route.abort("connectionreset"));
  await draft(page);
  await saveButton(page).click();
  await expect(page.getByText(/The save result is uncertain/)).toBeVisible();
  await expect(saveButton(page)).toBeDisabled();
  await page
    .getByRole("dialog")
    .locator("form")
    .filter({ has: page.getByRole("textbox", { name: "What happened" }) })
    .evaluate((form) =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  expect(writes).toHaveLength(1);
});

test("switching Client and Member cannot bypass an uncertain save freeze", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.route(noteEndpoint, (route) =>
    fulfill(route, { ...receipt, directoryContactId: "member-other" }),
  );
  await draft(page);
  await saveButton(page).click();
  await expect(page.getByText(/The save result is uncertain/)).toBeVisible();
  await page.getByRole("button", { name: "Client", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Client", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Member", exact: true }).click();
  await expect(page.getByText(/The save result is uncertain/)).toBeVisible();
  await expect(saveButton(page)).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "What happened" }),
  ).toHaveValue(`  ${noteText}\n`);
  expect(writes).toHaveLength(1);
});

test("pending note blocks duplicate submits before receiving a verified saved receipt", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(noteEndpoint, async (route) => {
    await held;
    await fulfill(route, receipt);
  });
  await draft(page);
  await saveButton(page).click();
  await expect.poll(() => writes.length).toBe(1);
  await expect(
    page.getByRole("button", { name: "Saving…", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .locator("form")
    .filter({ has: page.getByRole("textbox", { name: "What happened" }) })
    .evaluate((form) => {
      for (let index = 0; index < 2; index++)
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
  expect(writes).toHaveLength(1);
  release();
  await expect(page.getByText(/^Note saved to Directory/)).toBeVisible();
  expect(writes).toHaveLength(1);
});

test("Congress target drawer reuses the same tenant-shared form without creating a client activity", async ({
  page,
}) => {
  const { writes, unexpected } = await setup(page, true);
  await page.route(`**/clients/${clientId}/targets`, (route) =>
    fulfill(route, [
      {
        ...governmentTarget,
        memberId: member.id,
        memberName: member.name,
        sourceDirectory: "congress",
        staffKind: null,
      },
    ]),
  );
  await page.goto(
    `/portfolio/${clientId}/relationships?kind=government&target=${member.id}`,
  );
  const drawer = page.getByRole("dialog", { name: member.name, exact: true });
  await expect(
    drawer.getByText(
      "This note is shared in Directory. It is not linked to this client.",
    ),
  ).toBeVisible();
  await drawer.getByRole("textbox", { name: "What happened" }).fill(noteText);
  await drawer.getByRole("button", { name: "Log it", exact: true }).click();
  await expect(drawer.getByText(/^Note saved to Directory/)).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]!.path).toContain(`/directory/contacts/${member.id}/notes`);
  expect(writes[0]!.body).toEqual({
    body: noteText,
    directoryContactName: member.name,
  });
  expect(unexpected).toEqual([]);
});

test("known validation refusal retains draft and supports an explicit reviewed retry", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let attempts = 0;
  await page.route(noteEndpoint, (route) =>
    ++attempts === 1
      ? fulfill(route, { message: "Review note text" }, 400)
      : fulfill(route, receipt),
  );
  await draft(page);
  await saveButton(page).click();
  await expect(page.getByRole("alert")).toContainText("Review note text");
  await expect(saveButton(page)).toBeEnabled();
  expect(writes).toHaveLength(1);
  await saveButton(page).click();
  await expect(page.getByText(/^Note saved to Directory/)).toBeVisible();
  expect(writes).toHaveLength(2);
});

test("portal role cannot search or save member notes", async ({ page }) => {
  const { searches, writes } = await setup(page);
  await page.route("**/api/backend/core/me", (route) =>
    fulfill(route, { ...identity, role: "client_portal_user" }),
  );
  await openMember(page);
  await expect(
    page.getByRole("searchbox", { name: "Member", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Your current session cannot save Directory notes."),
  ).toBeVisible();
  expect(searches).toEqual([]);
  expect(writes).toEqual([]);
});

test("session expiry at preflight cannot send a note", async ({ page }) => {
  const { writes } = await setup(page);
  await page.route(detailEndpoint, (route) =>
    fulfill(route, { message: "Expired" }, 401),
  );
  await draft(page);
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("closing while detail is held sends zero POSTs and discards late results", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route(detailEndpoint, async (route) => {
    started = true;
    await held;
    await fulfill(route, detail).catch(() => {});
  });
  await draft(page);
  await saveButton(page).click();
  await expect.poll(() => started).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  release();
  await page.getByRole("heading", { name: /Portfolio/ }).waitFor();
  expect(writes).toEqual([]);
});

test("authority invalidation during held preflight sends zero POSTs", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route(detailEndpoint, async (route) => {
    started = true;
    await held;
    await fulfill(route, detail).catch(() => {});
  });
  await draft(page, "/__test/member-notes?log=1");
  await saveButton(page).click();
  await expect.poll(() => started).toBe(true);
  await event(page, "member-note-identity-invalidate");
  release();
  await expect(page.getByRole("status")).toContainText(
    "current session cannot save",
  );
  expect(writes).toEqual([]);
});

test("role change after dispatch freezes the same-scope form even when role is restored", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(noteEndpoint, async (route) => {
    await held;
    await fulfill(route, receipt);
  });
  await draft(page, "/__test/member-notes?log=1");
  await saveButton(page).click();
  await expect.poll(() => writes.length).toBe(1);
  await event(page, "member-note-role-change");
  release();
  await expect(page.getByText(/The save result is uncertain/)).toBeVisible();
  await event(page, "member-note-role-restore");
  await expect(saveButton(page)).toBeDisabled();
  await expect(page.getByText(/^Note saved to Directory/)).toHaveCount(0);
  expect(writes).toHaveLength(1);
});

test("actor change during held detail discards the old draft and sends zero POSTs", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route(detailEndpoint, async (route) => {
    started = true;
    await held;
    await fulfill(route, detail).catch(() => {});
  });
  await draft(page, "/__test/member-notes?log=1");
  await saveButton(page).click();
  await expect.poll(() => started).toBe(true);
  await event(page, "member-note-actor-change");
  release();
  await expect(
    page.getByRole("searchbox", { name: "Member", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "What happened" }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("mobile dark shared note layout stays within the viewport", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await draft(page);
  const dialog = page.getByRole("dialog", { name: "Quick log", exact: true });
  await expect(dialog).toHaveCSS("width", "358px");
  await expect(dialog).toHaveCSS("background-color", "rgb(27, 27, 27)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "work/member-note-mobile-dark-top.png",
    fullPage: false,
  });
  await saveButton(page).scrollIntoViewIfNeeded();
  await expect(saveButton(page)).toBeVisible();
  const bounds = await saveButton(page).boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({
    path: "work/member-note-mobile-dark.png",
    fullPage: false,
  });
  expect(writes).toEqual([]);
});

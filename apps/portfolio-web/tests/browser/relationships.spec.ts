import { expect, test } from "@playwright/test";
import { clientId, person, personId, json, installFixtures } from "./fixtures";
const path = `/portfolio/${clientId}/relationships`;
const endpoint = `**/clients/${clientId}/people`;
const item = `${endpoint}/${personId}`;
const screenshotRoot =
  process.env.PORTFOLIO_RELATIONSHIPS_EVIDENCE_DIR ?? "work/relationships";

test("contact deep link, search empty state and keyboard close retain organization scope", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.goto(`${path}?person=${personId}&keep=scope`);
  const drawer = page.getByRole("dialog", { name: person.name, exact: true });
  await expect(drawer.getByLabel("Name *", { exact: true })).toHaveValue(
    person.name,
  );
  await expect(
    drawer.getByRole("heading", { name: "Message history" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/keep=scope/);
  await expect(page).not.toHaveURL(/person=/);
  await page.getByLabel("Search contacts").fill("no-such-contact");
  await expect(page.getByText("No contacts match your search.")).toBeVisible();
  expect(unexpected).toEqual([]);
});

test("create retains a rejected draft, refuses duplicate pending submits and refreshes the roster after verified save", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let rows = [person];
  let attempts = 0;
  let release: (() => void) | undefined;
  await page.route(endpoint, async (route) => {
    if (route.request().method() === "GET") return json(route, rows);
    attempts++;
    if (attempts === 1)
      return json(route, { message: "Review the contact details" }, 409);
    const body = route.request().postDataJSON();
    expect(body).toEqual({
      name: "New Contact",
      title: "Director",
      email: null,
      phone: "",
      role: "Advocacy",
      notes: "Dated source retained",
    });
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    const saved = {
      ...person,
      ...body,
      id: "20000000-0000-4000-8000-000000000002",
    };
    rows = [...rows, saved];
    return json(route, saved);
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Add contact", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Add contact", exact: true });
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer.getByLabel("Name *", { exact: true })).toBeFocused();
  expect(attempts).toBe(0);
  await drawer.getByLabel("Name *", { exact: true }).fill(" New Contact ");
  await drawer.getByLabel("Title", { exact: true }).fill("Director");
  await drawer.getByLabel("Role", { exact: true }).fill("Advocacy");
  await drawer
    .getByLabel("Notes", { exact: true })
    .fill("Dated source retained");
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer.getByRole("alert")).toContainText(
    "Review the contact details",
  );
  await expect(drawer.getByLabel("Notes", { exact: true })).toHaveValue(
    "Dated source retained",
  );
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await expect(
    drawer.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeVisible();
  await drawer
    .locator("form")
    .first()
    .evaluate((form) => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
  expect(attempts).toBe(2);
  release!();
  await expect(drawer).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New Contact · Director", exact: true }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});

test("edit rejects a foreign receipt without closing or losing inputs, then saves only through the scoped core route", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let saved = person;
  let attempts = 0;
  await page.route(endpoint, (route) => json(route, [saved]));
  await page.route(item, async (route) => {
    expect(route.request().method()).toBe("PATCH");
    attempts++;
    const body = route.request().postDataJSON();
    expect(body.phone).toBe("");
    expect(body.notes).toBe("Verified new source");
    if (attempts === 1)
      return json(route, {
        ...person,
        ...body,
        clientId: "10000000-0000-4000-8000-000000000002",
      });
    saved = { ...person, ...body };
    return json(route, saved);
  });
  await page.goto(`${path}?person=${personId}`);
  const drawer = page.getByRole("dialog", { name: person.name, exact: true });
  await drawer.getByLabel("Notes", { exact: true }).fill("Verified new source");
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer.getByRole("alert")).toContainText("unexpected response");
  await expect(drawer.getByLabel("Notes", { exact: true })).toHaveValue(
    "Verified new source",
  );
  await expect(drawer).toBeVisible();
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer).toHaveCount(0);
  expect(attempts).toBe(2);
  expect(unexpected).toEqual([]);
});

test("dirty drawer confirms discard, preserves edits when cancelled and restores keyboard focus", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.goto(path);
  const opener = page.getByRole("button", {
    name: `${person.name} · ${person.title}`,
    exact: true,
  });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: person.name, exact: true });
  await drawer.getByLabel("Title", { exact: true }).fill("Draft title");
  await page.keyboard.press("Escape");
  const discard = page.getByRole("dialog", {
    name: "Discard contact changes?",
  });
  await discard.getByRole("button", { name: "Keep editing" }).click();
  await expect(drawer.getByLabel("Title", { exact: true })).toHaveValue(
    "Draft title",
  );
  await drawer.getByRole("button", { name: "Cancel", exact: true }).click();
  await discard.getByRole("button", { name: "Discard changes" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(unexpected).toEqual([]);
});

test("remove requires confirmation and a deleted:true receipt; failure retains the contact", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let deleted = false;
  let attempts = 0;
  await page.route(endpoint, (route) => json(route, deleted ? [] : [person]));
  await page.route(item, async (route) => {
    expect(route.request().method()).toBe("DELETE");
    attempts++;
    if (attempts === 1) return json(route, { deleted: false });
    deleted = true;
    return json(route, { deleted: true });
  });
  await page.goto(`${path}?person=${personId}`);
  const drawer = page.getByRole("dialog", { name: person.name, exact: true });
  await drawer.getByRole("button", { name: "Remove", exact: true }).click();
  const remove = page.getByRole("dialog", {
    name: "Remove contact",
    exact: true,
  });
  await remove.getByRole("button", { name: "Keep contact" }).click();
  expect(attempts).toBe(0);
  await drawer.getByRole("button", { name: "Remove", exact: true }).click();
  await remove.getByRole("button", { name: "Confirm remove" }).click();
  await expect(remove.getByRole("alert")).toContainText("unexpected response");
  await expect(remove).toBeVisible();
  await remove.getByRole("button", { name: "Confirm remove" }).click();
  await expect(remove).toHaveCount(0);
  await expect(
    page.getByText("No contacts. Add the first contact for this client."),
  ).toBeVisible();
  expect(attempts).toBe(2);
  expect(unexpected).toEqual([]);
});

test("unknown create completion retains draft and prevents a blind duplicate creation", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let attempts = 0;
  await page.route(endpoint, (route) => {
    if (route.request().method() === "GET") return json(route, [person]);
    attempts++;
    return json(route, { message: "Reply unavailable after dispatch" }, 503);
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Add contact", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Add contact", exact: true });
  await drawer.getByLabel("Name *", { exact: true }).fill("Uncertain Contact");
  await drawer
    .getByRole("button", { name: "Save contact", exact: true })
    .click();
  await expect(drawer.getByText(/This request may have saved/)).toBeVisible();
  await expect(drawer.getByLabel("Name *", { exact: true })).toHaveValue(
    "Uncertain Contact",
  );
  await expect(
    drawer.getByRole("button", { name: "Save contact", exact: true }),
  ).toBeDisabled();
  expect(attempts).toBe(1);
  expect(unexpected).toEqual([]);
});

test("read-only identity cannot save, remove or change hierarchy", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "readonly", email: null },
      tenant: { id: "test", name: "Test" },
      role: "viewer",
    }),
  );
  await page.goto(`${path}?person=${personId}`);
  const drawer = page.getByRole("dialog", { name: person.name, exact: true });
  await expect(
    drawer.getByRole("button", { name: "Save contact", exact: true }),
  ).toBeDisabled();
  await expect(
    drawer.getByRole("button", { name: "Remove", exact: true }),
  ).toBeDisabled();
  await expect(
    drawer.getByRole("button", { name: "Save placement", exact: true }),
  ).toBeDisabled();
  await expect(drawer.getByLabel("Notes", { exact: true })).toBeDisabled();
  expect(unexpected).toEqual([]);
});

test("wrong-client roster fails closed and an expired session uses the shared sign-in recovery", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.route(endpoint, (route) =>
    json(route, [
      { ...person, clientId: "10000000-0000-4000-8000-000000000002" },
    ]),
  );
  await page.goto(path);
  await expect(page.getByRole("alert")).toContainText("unexpected response");
  await expect(
    page.getByRole("button", { name: "Add contact", exact: true }),
  ).toBeDisabled();
  await page.route(endpoint, (route) =>
    json(route, { message: "Expired" }, 401),
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  expect(unexpected).toEqual([]);
});

test("desktop and mobile drawer keep actions visible while content scrolls in light and dark themes", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  for (const [width, height, theme] of [
    [1440, 1040, "light"],
    [390, 844, "dark"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(`${path}?person=${personId}`);
    const drawer = page.getByRole("dialog", { name: person.name, exact: true });
    const save = drawer.getByRole("button", {
      name: "Save contact",
      exact: true,
    });
    await expect(save).toBeVisible();
    expect(
      await page.evaluate(
        async () => (await document.fonts.load('14px "Geist Test"')).length,
      ),
    ).toBe(1);
    await expect(drawer).toHaveCSS(
      "background-color",
      theme === "dark" ? "rgb(27, 27, 27)" : "rgb(255, 255, 255)",
    );
    await drawer.screenshot({
      path: `${screenshotRoot}/contact-drawer-${width}-${theme}-top.png`,
    });
    const before = await save.boundingBox();
    await drawer.getByLabel("Notes", { exact: true }).scrollIntoViewIfNeeded();
    const after = await save.boundingBox();
    expect(before?.y).toBe(after?.y);
    const bounds = await drawer.boundingBox();
    expect(Math.round(bounds!.width)).toBe(width === 1440 ? 640 : width);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await drawer.screenshot({
      path: `${screenshotRoot}/contact-drawer-${width}-${theme}.png`,
    });
  }
  expect(unexpected).toEqual([]);
});

test("identity pending and stale-data refresh failures both refuse contact writes", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let reads = 0;
  let release: (() => void) | undefined;
  await page.clock.install();
  await page.route("**/api/backend/core/me", async (route) => {
    reads++;
    if (reads > 1)
      return json(route, { message: "Identity no longer authorized" }, 403);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return json(route, {
      user: { id: "test", email: null },
      tenant: { id: "test", name: "Test" },
      role: "standard_user",
    });
  });
  await page.goto(path);
  await expect.poll(() => Boolean(release)).toBe(true);
  const add = page.getByRole("button", { name: "Add contact", exact: true });
  await expect(add).toBeDisabled();
  release!();
  await expect(add).toBeEnabled();
  await page.clock.fastForward(31_000);
  await page
    .getByRole("button", {
      name: `${person.name} · ${person.title}`,
      exact: true,
    })
    .click();
  const drawer = page.getByRole("dialog", { name: person.name, exact: true });
  await expect(
    drawer.getByRole("button", { name: "Save contact", exact: true }),
  ).toBeDisabled();
  await expect(drawer.getByRole("alert")).toContainText("permission");
  await expect(drawer.getByLabel("Name *", { exact: true })).toHaveValue(
    person.name,
  );
  expect(reads).toBeGreaterThan(1);
  expect(unexpected).toEqual([]);
});

test("hierarchy saves stay separate from contact details and fence competing controls while pending", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let attempts = 0;
  let release: (() => void) | undefined;
  let saved = person;
  await page.route(endpoint, (route) => json(route, [saved]));
  await page.route(`${item}/hierarchy`, async (route) => {
    attempts++;
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toEqual({
      hierarchyLevel: "team",
      reportsToPersonId: null,
      reviewRequired: false,
    });
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    saved = { ...person, hierarchyLevel: "team" };
    return json(route, saved);
  });
  await page.goto(`${path}?person=${personId}`);
  const drawer = page.getByRole("dialog", { name: person.name, exact: true });
  await drawer
    .getByRole("combobox", { name: "Level", exact: true })
    .selectOption("team");
  await drawer
    .getByRole("button", { name: "Save placement", exact: true })
    .click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await expect(
    drawer.getByRole("button", { name: "Save contact", exact: true }),
  ).toBeDisabled();
  await expect(
    drawer.getByRole("button", { name: "Remove", exact: true }),
  ).toBeDisabled();
  await drawer
    .locator("form")
    .nth(1)
    .evaluate((form) => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
  await page.keyboard.press("Escape");
  await expect(drawer).toBeVisible();
  expect(attempts).toBe(1);
  release!();
  await expect(
    drawer.getByRole("combobox", { name: "Level", exact: true }),
  ).toHaveValue("team");
  await expect(
    drawer.getByRole("button", { name: "Save contact", exact: true }),
  ).toBeEnabled();
  expect(unexpected).toEqual([]);
});

test("person-linked QuickLog retains its failed note and existing email provider refusal remains visible", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let notes = 0;
  let sends = 0;
  await page.route(`**/clients/${clientId}/activity`, (route) => {
    expect(route.request().method()).toBe("POST");
    notes++;
    expect(route.request().postDataJSON()).toMatchObject({
      personId,
      kind: "note",
      title: "Follow-up",
      body: "Dated note",
    });
    return json(route, { message: "Note unavailable" }, 409);
  });
  await page.route("**/engagement/mail/send", (route) => {
    sends++;
    expect(route.request().postDataJSON()).toMatchObject({
      clientId,
      personIds: [personId],
      to: [{ email: person.email, name: person.name }],
    });
    return json(route, { message: "Mailbox not connected" }, 409);
  });
  await page.goto(`${path}?person=${personId}`);
  const drawer = page.getByRole("dialog", { name: person.name, exact: true });
  await drawer.getByRole("button", { name: "Log note", exact: true }).click();
  const note = page.getByRole("dialog", { name: "Quick log", exact: true });
  await note.getByLabel("Title", { exact: true }).fill("Follow-up");
  await note.getByLabel("Details", { exact: true }).fill("Dated note");
  await note.getByRole("button", { name: "Save activity" }).click();
  await expect(note.getByRole("alert")).toContainText("Note unavailable");
  await expect(note.getByLabel("Details", { exact: true })).toHaveValue(
    "Dated note",
  );
  await note.getByRole("button", { name: "Close", exact: true }).click();
  await drawer.getByRole("button", { name: "Mail", exact: true }).click();
  const mail = page.getByRole("dialog", { name: "New email", exact: true });
  await mail.getByLabel("Subject", { exact: true }).fill("Synthetic subject");
  await mail.getByLabel("Message", { exact: true }).fill("Synthetic message");
  await mail.getByRole("button", { name: "Review email", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Send email",
    exact: true,
  });
  await confirmation
    .getByRole("button", { name: "Send email", exact: true })
    .click();
  await expect(
    confirmation.getByText("Mailbox not connected", { exact: true }),
  ).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(mail.getByLabel("Message", { exact: true })).toHaveValue(
    "Synthetic message",
  );
  await expect(mail.getByText("Email sent.", { exact: true })).toHaveCount(0);
  expect(notes).toBe(1);
  expect(sends).toBe(1);
  expect(unexpected).toEqual([]);
});

test("existing client-filtered email history opens the permitted full thread from the contact drawer", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const threadId = "a0000000-0000-4000-8000-000000000001";
  const thread = {
    id: threadId,
    clientId,
    subject: "Synthetic briefing",
    snippet: "Summary",
    connectionEmail: "test@example.test",
    participants: [{ email: person.email, name: person.name }],
    messages: [
      {
        id: "b0000000-0000-4000-8000-000000000001",
        subject: "Synthetic briefing",
        fromEmail: person.email,
        fromName: person.name,
        toRecipients: [],
        ccRecipients: [],
        bodyText: "Accessible synthetic thread content",
        sentAt: null,
        receivedAt: "2026-10-10T12:00:00Z",
        createdAt: "2026-10-10T12:00:00Z",
      },
    ],
  };
  await page.route("**/engagement/mail-threads?**", (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("clientId")).toBe(clientId);
    expect(url.searchParams.get("recipientEmails")).toBe(person.email);
    return json(route, [thread]);
  });
  await page.route(`**/engagement/mail-threads/${threadId}`, (route) =>
    json(route, thread),
  );
  await page.goto(`${path}?person=${personId}`);
  const drawer = page.getByRole("dialog", { name: person.name, exact: true });
  await drawer.getByRole("button", { name: /Synthetic briefing/ }).click();
  const history = page.getByRole("dialog", {
    name: "Synthetic briefing",
    exact: true,
  });
  await expect(
    history.getByText("Accessible synthetic thread content", { exact: true }),
  ).toBeVisible();
  await expect(
    history.getByRole("button", {
      name: `Reply to ${person.name}`,
      exact: true,
    }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});

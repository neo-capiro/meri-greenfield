import { test, expect, type Page } from "@playwright/test";
import { installFixtures, json, clientId, client, file } from "./fixtures";
import type { Meeting } from "../../src/features/calendar/contracts";
const meetingId = "90000000-0000-4000-8000-000000000001";
const otherClient = {
  ...client,
  id: "10000000-0000-4000-8000-000000000002",
  name: "Other synthetic client",
};
const initialMeeting: Meeting = {
  id: meetingId,
  subject: "Synthetic archive meeting",
  description: null,
  location: null,
  startsAt: "2026-10-15T14:00:00Z",
  endsAt: "2026-10-15T15:00:00Z",
  status: "scheduled",
  joinLink: null,
  visibility: "shared",
  isVirtual: false,
  meri: null,
  client: { id: clientId, name: client.name },
  attendees: [],
  preps: [],
};
const row = {
  id: meetingId,
  subject: initialMeeting.subject,
  startsAt: initialMeeting.startsAt,
  client: initialMeeting.client,
  visibility: "shared",
  libraryQualifiedBy: [
    { kind: "prep", current: false },
    { kind: "notes", current: true },
  ],
};
async function setup(page: Page) {
  const unexpected = await installFixtures(page);
  const state = { meeting: { ...initialMeeting }, puts: 0 };
  await page.route("**/core/clients", (route) =>
    json(route, [client, otherClient]),
  );
  await page.route("**/core/engagement/meetings**", async (route) => {
    const url = new URL(route.request().url());
    if (
      route.request().method() === "GET" &&
      url.pathname.endsWith("/notetaker")
    )
      return json(route, null);
    if (route.request().method() === "PUT") {
      state.puts++;
      const body = route.request().postDataJSON();
      expect(Object.keys(body)).toEqual(["clientId"]);
      state.meeting = {
        ...state.meeting,
        client: body.clientId
          ? { id: otherClient.id, name: otherClient.name }
          : null,
        visibility: "private",
      };
      return json(route, state.meeting);
    }
    if (url.pathname.endsWith("/notes") || url.pathname.endsWith("/debriefs"))
      return json(route, []);
    return json(
      route,
      url.pathname.endsWith(meetingId) ? state.meeting : [state.meeting],
    );
  });
  await page.route("**/core/engagement/meetings/library?**", (route) => {
    const url = new URL(route.request().url());
    return json(route, {
      data: [row],
      total: 51,
      page: Number(url.searchParams.get("page")),
      limit: 50,
    });
  });
  return { unexpected, state };
}
test("Library uses real page/filter contract, historical qualification and calendar-preserving deep links", async ({
  page,
}) => {
  const { unexpected } = await setup(page);
  const requests: URL[] = [];
  page.on("request", (r) => {
    if (r.url().includes("meetings/library?")) requests.push(new URL(r.url()));
  });
  await page.goto(
    `/portfolio/${clientId}/calendar?library=1&view=week&date=2026-11-01&zone=America%2FNew_York&libraryFrom=2026-11-01&libraryTo=2026-11-01`,
  );
  await expect(
    page.getByRole("heading", { name: "Meeting Library", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Meeting Library", exact: true }),
  ).toHaveCSS("font-size", "20px");
  await expect(
    page.getByText("Previously approved · Prep · Notes", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("to"))
    .toBe("2026-11-02T05:00:00Z");
  expect(requests.at(-1)?.searchParams.get("from")).toBe(
    "2026-11-01T04:00:00Z",
  );
  expect(requests.at(-1)?.searchParams.get("clientId")).toBe(clientId);
  await page.getByLabel("Library material type").selectOption("prep");
  await page.getByLabel("Library visibility").selectOption("private");
  await page.getByLabel("Search meeting library").fill("Archive & source");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("search"))
    .toBe("Archive & source");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/libraryPage=2/);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(
    /libraryPage|librarySearch|libraryFrom|libraryType|libraryVisibility/,
  );
  for (const value of [
    "view=week",
    "date=2026-11-01",
    "zone=America%2FNew_York",
  ])
    expect(page.url()).toContain(value);
  await page.getByRole("row", { name: `Open ${row.subject}` }).click();
  await expect(page.getByRole("dialog", { name: row.subject })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.screenshot({
    path: "work/screens/meeting-library-desktop.png",
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});
test("Library surfaces failure/retry, empty results, scoped receipt rejection and session expiry", async ({
  page,
}) => {
  const { unexpected } = await setup(page);
  let mode = "failed";
  await page.route("**/core/engagement/meetings/library?**", (route) =>
    mode === "failed"
      ? json(route, { message: "Synthetic archive unavailable" }, 503)
      : mode === "empty"
        ? json(route, { data: [], page: 1, limit: 50, total: 0 })
        : mode === "foreign"
          ? json(route, {
              data: [
                {
                  ...row,
                  client: { id: otherClient.id, name: otherClient.name },
                },
              ],
              page: 1,
              limit: 50,
              total: 1,
            })
          : json(route, { message: "Expired" }, 401),
  );
  await page.goto(`/portfolio/${clientId}/calendar?library=1`);
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic archive unavailable",
  );
  mode = "empty";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByText("No approved meetings match these filters."),
  ).toBeVisible();
  mode = "foreign";
  await page.getByLabel("Library material type").selectOption("notes");
  await expect(page.getByRole("alert")).toContainText("unexpected response");
  await expect(
    page.getByRole("row", { name: `Open ${row.subject}` }),
  ).toHaveCount(0);
  mode = "expired";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});
test("Library responsive dark layout keeps metadata and scope accessible", async ({
  page,
}) => {
  const { unexpected } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`/portfolio/${clientId}/calendar?library=1&zone=UTC`);
  await expect(
    page.getByRole("row", { name: `Open ${row.subject}` }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "work/screens/meeting-library-mobile-dark.png",
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});
async function openAssignment(page: Page) {
  await page.goto(
    `/calendar?view=agenda&date=2026-10-15&zone=UTC&meeting=${meetingId}`,
  );
  await page
    .getByRole("dialog", { name: initialMeeting.subject })
    .getByRole("button", { name: "Client assignment", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Client assignment", exact: true });
}
test("Assignment requires explicit move/revoke review, retains chosen draft on conflict and retries only after review", async ({
  page,
}) => {
  const { unexpected, state } = await setup(page);
  const dialog = await openAssignment(page);
  await dialog.getByLabel("Assignment client").selectOption(otherClient.id);
  await expect(
    dialog.getByRole("button", { name: "Save assignment", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await page.screenshot({
    path: "work/screens/meeting-assignment-review.png",
    fullPage: true,
  });
  state.meeting = {
    ...state.meeting,
    client: null,
    visibility: "private",
  };
  await dialog
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("changed");
  expect(state.puts).toBe(0);
  await expect(dialog.getByLabel("Assignment client")).toHaveValue(
    otherClient.id,
  );
  await dialog
    .getByRole("button", { name: "Review current assignment" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Save assignment", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(state.puts).toBe(1);
  expect(state.meeting.visibility).toBe("private");
  expect(unexpected).toEqual([]);
});
test("Assignment rejects wrong successful receipt and preserves unsaved selection", async ({
  page,
}) => {
  const { unexpected, state } = await setup(page);
  await page.route(`**/core/engagement/meetings/${meetingId}`, (route) =>
    route.request().method() === "PUT"
      ? json(route, {
          ...state.meeting,
          id: otherClient.id,
          client: { id: otherClient.id, name: otherClient.name },
          visibility: "private",
        })
      : json(route, state.meeting),
  );
  const dialog = await openAssignment(page);
  await dialog.getByLabel("Assignment client").selectOption(otherClient.id);
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("unexpected response");
  await expect(dialog.getByLabel("Assignment client")).toHaveValue(
    otherClient.id,
  );
  expect(unexpected).toEqual([]);
});
test("Read-only identity cannot assign or list caller archive", async ({
  page,
}) => {
  const { unexpected, state } = await setup(page);
  await page.route("**/core/me", (route) =>
    json(route, {
      user: { id: "viewer", email: null },
      tenant: { id: "tenant-test", name: "Synthetic" },
      role: "viewer",
    }),
  );
  const dialog = await openAssignment(page);
  await expect(dialog.getByLabel("Assignment client")).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Save assignment", exact: true }),
  ).toBeDisabled();
  expect(state.puts).toBe(0);
  await page.goto(`/calendar?library=1`);
  await expect(page.getByRole("alert")).toContainText("permission");
  await expect(
    page.getByRole("row", { name: `Open ${row.subject}` }),
  ).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
test("Transcript shares canonical upload, retries extraction without duplicate bytes and reviews truncation", async ({
  page,
}) => {
  const { unexpected } = await setup(page);
  let storage = 0,
    confirms = 0,
    extracts = 0;
  let generations = 0,
    saved = false;
  await page.route(
    `**/core/engagement/meetings/${meetingId}/debrief-draft`,
    (route) => {
      generations++;
      expect(route.request().postDataJSON()).toEqual({
        method: "upload",
        sourceText: "Reviewed synthetic source",
      });
      return json(route, {
        recap: "Synthetic generated recap",
        actionItems: [],
        notes: "Synthetic generated notes",
        provider: "openai",
        model: "fixture",
      });
    },
  );
  await page.route(
    `**/core/engagement/meetings/${meetingId}/debriefs`,
    (route) => {
      if (route.request().method() === "POST") {
        saved = true;
        expect(route.request().postDataJSON()).toMatchObject({
          confidential: false,
        });
        return json(route, { id: "debrief-synthetic" });
      }
      return json(
        route,
        saved
          ? [
              {
                id: "debrief-synthetic",
                body: "Synthetic generated recap",
                restricted: false,
                confidential: false,
                status: "draft",
                createdAt: "2026-10-15T16:00:00Z",
                updatedAt: "2026-10-15T16:00:00Z",
                sharedAt: null,
              },
            ]
          : [],
      );
    },
  );
  await page.route("**/core/engagement/capabilities", (route) =>
    json(route, {
      meetingPrepComprehensiveEnabled: false,
      runtime: { externalActionsEnabled: true },
    }),
  );
  await page.route("**/core/engagement/attachments/upload-url", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      meetingId,
      clientId,
      fileName: "source.txt",
    });
    return json(route, {
      url: "https://storage.example.test/upload",
      fields: { key: "source-key" },
      s3Key: "source-key",
    });
  });
  await page.route("https://storage.example.test/upload", async (route) => {
    storage++;
    await route.fulfill({ status: 204 });
  });
  await page.route("**/core/engagement/attachments/confirm", (route) => {
    confirms++;
    return json(route, {
      ...file,
      meetingId,
      s3Key: "source-key",
      fileName: "source.txt",
      contentType: "text/plain",
    });
  });
  await page.route(
    `**/core/engagement/attachments/${file.id}/extract-text`,
    (route) => {
      extracts++;
      return extracts === 1
        ? json(route, { message: "Scan pending" }, 400)
        : json(route, {
            attachmentId: file.id,
            text: "Reviewed synthetic source",
            truncated: true,
            disclosure: "Not independently scanned",
          });
    },
  );
  await page.goto(
    `/calendar?view=agenda&date=2026-10-15&zone=UTC&meeting=${meetingId}`,
  );
  const meeting = page.getByRole("dialog", { name: initialMeeting.subject });
  await meeting.getByRole("button", { name: "Debriefs", exact: true }).click();
  await meeting
    .getByRole("button", { name: "Transcript and attachments", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Transcript and attachments",
    exact: true,
  });
  await dialog.getByLabel("Meeting source file").setInputFiles({
    name: "source.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Source text"),
  });
  await dialog
    .getByRole("button", { name: "Upload and extract", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Scan pending");
  await dialog
    .getByRole("button", { name: "Retry extraction", exact: true })
    .click();
  await expect(dialog.getByLabel("Extracted meeting source")).toHaveValue(
    "Reviewed synthetic source",
  );
  await expect(dialog.getByText(/Only part of this source/)).toBeVisible();
  await expect(dialog.getByText("Not independently scanned")).toBeVisible();
  expect({ storage, confirms, extracts }).toEqual({
    storage: 1,
    confirms: 1,
    extracts: 2,
  });
  expect(generations).toBe(0);
  await page.screenshot({
    path: "work/screens/meeting-transcript-review.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Use extracted source", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Review generated debrief",
    exact: true,
  });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("Content")).toHaveValue(
    /Synthetic generated recap/,
  );
  expect(generations).toBe(1);
  expect(saved).toBe(false);
  await editor
    .getByRole("button", { name: "Save debrief", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect(saved).toBe(true);
  expect(unexpected).toEqual([]);
});

test("Lost storage reply retries same-key confirmation; wrong parent receipt cannot reach extraction", async ({
  page,
}) => {
  const { unexpected } = await setup(page);
  let storage = 0,
    confirms = 0,
    extracts = 0;
  await page.route("**/core/engagement/capabilities", (route) =>
    json(route, {
      meetingPrepComprehensiveEnabled: false,
      runtime: { externalActionsEnabled: true },
    }),
  );
  await page.route("**/core/engagement/attachments/upload-url", (route) =>
    json(route, {
      url: "https://storage.example.test/upload",
      fields: { key: "same-key" },
      s3Key: "same-key",
    }),
  );
  await page.route("https://storage.example.test/upload", async (route) => {
    storage++;
    await route.abort("failed");
  });
  await page.route("**/core/engagement/attachments/confirm", (route) => {
    confirms++;
    expect(route.request().postDataJSON().s3Key).toBe("same-key");
    return json(route, {
      ...file,
      meetingId: confirms === 1 ? otherClient.id : meetingId,
      s3Key: "same-key",
      fileName: "source.txt",
      contentType: "text/plain",
    });
  });
  await page.route(
    `**/core/engagement/attachments/${file.id}/extract-text`,
    (route) => {
      extracts++;
      return json(route, {
        attachmentId: file.id,
        text: "Recovered source",
        truncated: false,
      });
    },
  );
  await page.goto(
    `/calendar?view=agenda&date=2026-10-15&zone=UTC&meeting=${meetingId}`,
  );
  const meeting = page.getByRole("dialog", { name: initialMeeting.subject });
  await meeting.getByRole("button", { name: "Debriefs", exact: true }).click();
  await meeting
    .getByRole("button", { name: "Transcript and attachments", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Transcript and attachments",
    exact: true,
  });
  await dialog.getByLabel("Meeting source file").setInputFiles({
    name: "source.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Source"),
  });
  await dialog
    .getByRole("button", { name: "Upload and extract", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "completion is unknown",
  );
  await dialog
    .getByRole("button", { name: "Retry confirmation", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("unexpected response");
  expect(extracts).toBe(0);
  await dialog
    .getByRole("button", { name: "Retry confirmation", exact: true })
    .click();
  await expect(dialog.getByLabel("Extracted meeting source")).toHaveValue(
    "Recovered source",
  );
  expect({ storage, confirms, extracts }).toEqual({
    storage: 1,
    confirms: 2,
    extracts: 1,
  });
  expect(unexpected).toEqual([]);
});

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function leaveMeeting(page: Page) {
  await page.evaluate(() => {
    history.pushState({}, "", "/calendar?view=agenda&date=2026-10-15&zone=UTC");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function settledFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}
test("Leaving the meeting during assignment preflight prevents a later PUT", async ({
  page,
}) => {
  const { unexpected, state } = await setup(page);
  const dialog = await openAssignment(page);
  const started = barrier(),
    release = barrier(),
    completed = barrier();
  await page.route(
    `**/core/engagement/meetings/${meetingId}`,
    async (route) => {
      if (route.request().method() === "PUT") {
        state.puts++;
        return json(route, {
          ...state.meeting,
          client: null,
          visibility: "private",
        });
      }
      started.release();
      await release.promise;
      await json(route, state.meeting);
      completed.release();
    },
  );
  await dialog.getByLabel("Assignment client").selectOption("");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await started.promise;
  await leaveMeeting(page);
  release.release();
  await completed.promise;
  await settledFrames(page);
  expect(state.puts).toBe(0);
  expect(unexpected).toEqual([]);
});

for (const heldStage of ["ticket", "storage", "confirm"] as const) {
  test(`Leaving the meeting while ${heldStage} is pending prevents subsequent upload or extraction dispatch`, async ({
    page,
  }) => {
    const { unexpected } = await setup(page);
    let storage = 0,
      confirms = 0,
      extracts = 0;
    const started = barrier(),
      release = barrier(),
      completed = barrier();
    async function hold(stage: typeof heldStage) {
      if (heldStage !== stage) return;
      started.release();
      await release.promise;
    }
    await page.route("**/core/engagement/capabilities", (route) =>
      json(route, {
        meetingPrepComprehensiveEnabled: false,
        runtime: { externalActionsEnabled: true },
      }),
    );
    await page.route(
      "**/core/engagement/attachments/upload-url",
      async (route) => {
        await hold("ticket");
        await json(route, {
          url: "https://storage.example.test/upload",
          fields: { key: "held-key" },
          s3Key: "held-key",
        });
        if (heldStage === "ticket") completed.release();
      },
    );
    await page.route("https://storage.example.test/upload", async (route) => {
      storage++;
      await hold("storage");
      await route.fulfill({ status: 204 });
      if (heldStage === "storage") completed.release();
    });
    await page.route(
      "**/core/engagement/attachments/confirm",
      async (route) => {
        confirms++;
        await hold("confirm");
        await json(route, {
          ...file,
          meetingId,
          s3Key: "held-key",
          fileName: "source.txt",
          contentType: "text/plain",
        });
        if (heldStage === "confirm") completed.release();
      },
    );
    await page.route(
      `**/core/engagement/attachments/${file.id}/extract-text`,
      (route) => {
        extracts++;
        return json(route, {
          attachmentId: file.id,
          text: "Must not be reached",
          truncated: false,
        });
      },
    );
    await page.goto(
      `/calendar?view=agenda&date=2026-10-15&zone=UTC&meeting=${meetingId}`,
    );
    const meeting = page.getByRole("dialog", { name: initialMeeting.subject });
    await meeting
      .getByRole("button", { name: "Debriefs", exact: true })
      .click();
    await meeting
      .getByRole("button", { name: "Transcript and attachments", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Transcript and attachments",
      exact: true,
    });
    await dialog.getByLabel("Meeting source file").setInputFiles({
      name: "source.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Source"),
    });
    await dialog
      .getByRole("button", { name: "Upload and extract", exact: true })
      .click();
    await started.promise;
    await leaveMeeting(page);
    release.release();
    await completed.promise;
    await settledFrames(page);
    expect({ storage, confirms, extracts }).toEqual({
      storage: heldStage === "ticket" ? 0 : 1,
      confirms: heldStage === "confirm" ? 1 : 0,
      extracts: 0,
    });
    expect(unexpected).toEqual([]);
  });
}

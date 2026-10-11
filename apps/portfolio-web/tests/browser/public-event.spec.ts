import { test, expect, type Page } from "@playwright/test";
import {
  installPublicEventFixtures,
  installPublicEventCalendarFixtures,
  publicEventFixture,
  publicEventId,
  publicEventClientId,
} from "./public-event-fixtures";
import { json } from "./fixtures";
async function open(page: Page) {
  await page
    .getByRole("button", { name: "Open public proceeding", exact: true })
    .click();
  return page.getByRole("dialog");
}
async function setup(page: Page) {
  const fixtures = await installPublicEventFixtures(page);
  await page.goto("/__test/public-event");
  return fixtures;
}
test("read-only event detail preserves source, client relevance, independent follow/capture and canonical destination", async ({
  page,
}, testInfo) => {
  const { state, unexpected } = await setup(page);
  const dialog = await open(page);
  await expect(dialog).toHaveAccessibleName(publicEventFixture.hearing.title);
  await expect(dialog).toContainText("Thu, Oct 8, 2026");
  await expect(dialog).toContainText("10:00 AM EDT");
  await expect(dialog).toContainText("Synthetic authorized client");
  await expect(dialog).not.toContainText("Synthetic unrelated client");
  await expect(dialog.getByLabel("Following status")).toHaveText("Following");
  await expect(
    dialog.getByRole("button", { name: "Following", exact: true }),
  ).toHaveCount(0);
  await expect(dialog).toContainText("Automatic attendance available");
  await expect(dialog).not.toContainText("Transcription scheduled");
  await expect(
    dialog.getByRole("link", { name: "Open in LegiWatch" }),
  ).toHaveAttribute(
    "href",
    `https://existing.example.test/legiwatch/hearings/${publicEventId}`,
  );
  expect((await dialog.boundingBox())?.width).toBe(300);
  await expect(dialog).toHaveCSS("padding", "16px");
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await document.fonts.load('14px "Geist Test"')).length,
      ),
    )
    .toBeGreaterThan(0);
  const assets = dialog.locator("img");
  await expect(assets).toHaveCount(2);
  expect(
    await assets.evaluateAll((images) =>
      images.map((image) => ({
        width: image.getBoundingClientRect().width,
        height: image.getBoundingClientRect().height,
        loaded: (image as HTMLImageElement).naturalWidth > 0,
      })),
    ),
  ).toEqual([
    { width: 8, height: 8, loaded: true },
    { width: 16, height: 16, loaded: true },
  ]);
  await page.screenshot({
    path: testInfo.outputPath("public-event-desktop-light.png"),
  });
  expect(state.reads).toHaveLength(1);
  expect(state.writes).toEqual([]);
  expect(unexpected).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open public proceeding", exact: true }),
  ).toBeFocused();
});
test("partial or malformed tenant rails stay unavailable without hiding the public source", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.body = {
    hearing: publicEventFixture.hearing,
    followState: publicEventFixture.followState,
  };
  const dialog = await open(page);
  await expect(dialog).toHaveAccessibleName(publicEventFixture.hearing.title);
  await expect(dialog).toContainText("Capture state unavailable");
  await expect(dialog).toContainText("Client relevance unavailable");
  await expect(dialog.getByLabel("Following status")).toHaveText("Following");
  await expect(dialog).not.toContainText("Synthetic authorized client");
  expect(state.writes).toEqual([]);
});
test("selected client parameter cannot reuse an all-clients private projection", async ({
  page,
}) => {
  const { state } = await setup(page);
  await page.getByRole("button", { name: "Select client scope" }).click();
  const dialog = await open(page);
  await expect(dialog).toContainText("Client relevance unavailable");
  expect(state.reads[0]).toContain(`?clientId=${publicEventClientId}`);
  await expect(dialog).not.toContainText("Synthetic authorized client");
});
test("date-only and invalid source zones never invent an exact start", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.body = {
    ...publicEventFixture,
    hearing: {
      ...publicEventFixture.hearing,
      timePrecision: "date",
      calendarDate: "2026-10-08",
      timeZone: "America/Los_Angeles",
    },
    attendanceState: {
      ...publicEventFixture.attendanceState,
      state: "SCHEDULED",
      message: "Browser attendance is scheduled for this proceeding.",
      scheduled: true,
    },
  };
  const dialog = await open(page);
  await expect(dialog).toContainText("Thu, Oct 8, 2026");
  await expect(dialog).toContainText("Date only · time not supplied");
  await expect(dialog).toContainText("Attendance scheduled");
  await expect(dialog).toContainText("Browser attendance is scheduled");
  await expect(dialog).not.toContainText("10:00 AM");
});
test("missing destination never invents a deployed LegiWatch URL", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Remove destination" }).click();
  const dialog = await open(page);
  await expect(dialog).toContainText(
    "Configure the existing application destination",
  );
  await expect(
    dialog.getByRole("link", { name: "Open in LegiWatch" }),
  ).toHaveCount(0);
});
for (const status of [403, 404, 503])
  test(`HTTP${status} stays visible and retries only the same read`, async ({
    page,
  }) => {
    const { state } = await setup(page);
    state.status = status;
    const dialog = await open(page);
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(state.reads).toHaveLength(1);
    state.status = 200;
    await dialog.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(dialog).toHaveAccessibleName(publicEventFixture.hearing.title);
    expect(state.reads).toHaveLength(2);
    expect(state.writes).toEqual([]);
  });
test("session expiry returns to sign-in without retaining private detail", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.status = 401;
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  await expect(
    page.getByText("Synthetic authorized client", { exact: true }),
  ).toHaveCount(0);
  expect(state.reads).toHaveLength(1);
});
test("invalidated identity cannot dispatch private relevance reads", async ({
  page,
}) => {
  const { state } = await setup(page);
  await expect
    .poll(() => page.evaluate(() => typeof window.__publicIdentityInvalidate))
    .toBe("function");
  await page.evaluate(() => window.__publicIdentityInvalidate?.());
  const dialog = await open(page);
  await expect(dialog).toContainText(
    "A current authorized session is required",
  );
  expect(state.reads).toHaveLength(0);
});
test("invalidating identity immediately hides already cached private relevance", async ({
  page,
}) => {
  const { state } = await setup(page);
  const dialog = await open(page);
  await expect(dialog).toContainText("Synthetic authorized client");
  await page.evaluate(() => window.__publicIdentityInvalidate?.());
  await expect(dialog).not.toContainText("Synthetic authorized client");
  await expect(dialog).toHaveAccessibleName("Public proceeding");
  await expect(dialog).toContainText(
    "A current authorized session is required",
  );
  expect(state.reads).toHaveLength(1);
});
test("a loaded unpermitted role cannot fetch tenant relevance", async ({
  page,
}) => {
  const { state } = await installPublicEventFixtures(page);
  await page.route("**/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      tenant: { id: "tenant-test", name: "UI tests" },
      role: "viewer",
    }),
  );
  await page.goto("/__test/public-event");
  const dialog = await open(page);
  await expect(dialog).toContainText(
    "A current authorized session is required",
  );
  expect(state.reads).toHaveLength(0);
  await expect(dialog).not.toContainText("Synthetic authorized client");
});
for (const close of ["close", "unmount"] as const)
  test(`${close} refuses late private relevance publication`, async ({
    page,
  }) => {
    const { state } = await setup(page);
    let release!: () => void;
    state.wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const dialog = await open(page);
    await expect.poll(() => state.reads.length).toBe(1);
    if (close === "close") await page.keyboard.press("Escape");
    else {
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "Unmount public proceeding" })
        .click();
    }
    release();
    await expect(dialog).not.toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__publicDetails?.().every((entry) => !entry.data),
        ),
      )
      .toBe(true);
    expect(state.writes).toEqual([]);
  });
test("actual actor change clears private relevance and refuses the old late response", async ({
  page,
}) => {
  const { state } = await setup(page);
  let release!: () => void;
  state.wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const dialog = await open(page);
  await expect.poll(() => state.reads.length).toBe(1);
  state.wait = undefined;
  state.body = {
    ...publicEventFixture,
    clientRelevance: {
      ...publicEventFixture.clientRelevance,
      clients: [
        {
          ...publicEventFixture.clientRelevance.clients[0],
          clientName: "Synthetic new tenant client",
        },
      ],
    },
  };
  await page.evaluate(() => window.__publicActor?.());
  await expect(dialog).toContainText("Synthetic new tenant client");
  release();
  await expect(dialog).not.toContainText("Synthetic authorized client");
  expect(
    await page.evaluate(() =>
      window
        .__publicDetails?.()
        .filter((entry) => entry.key.includes("user-test"))
        .every((entry) => !entry.data),
    ),
  ).toBe(true);
  expect(state.writes).toEqual([]);
});
test("mobile dark keeps compact geometry, exact local assets and readable wrapping", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  const dialog = await open(page);
  await expect(dialog).toHaveAccessibleName(publicEventFixture.hearing.title);
  expect((await dialog.boundingBox())?.width).toBe(300);
  await expect(dialog).toHaveCSS("background-color", "rgb(27, 27, 27)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("public-event-mobile-dark.png"),
  });
});

const masterAgendaUrl =
  "/calendar?date=2026-10-08&view=agenda&zone=America%2FNew_York&retained=one";
test("actual Master Agenda opens sourceId rather than dedupe ID and closes without losing calendar state", async ({
  page,
}, testInfo) => {
  const { state, unexpected } = await installPublicEventCalendarFixtures(page);
  await page.goto(masterAgendaUrl);
  await page
    .getByRole("button", {
      name: publicEventFixture.hearing.title,
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName(publicEventFixture.hearing.title);
  expect(new URL(page.url()).searchParams.get("hearing")).toBe(publicEventId);
  expect(new URL(page.url()).searchParams.has("meeting")).toBe(false);
  expect(state.reads).toHaveLength(1);
  expect(state.reads[0]).toContain(`/events/${publicEventId}/detail-v2`);
  expect(state.reads[0]).not.toContain("different-dedupe-event-id");
  await expect(
    dialog.getByRole("link", { name: "Open in LegiWatch" }),
  ).toHaveAttribute(
    "href",
    `https://existing.example.test/legiwatch/hearings/${publicEventId}`,
  );
  await page.screenshot({
    path: testInfo.outputPath("public-event-master-agenda-light.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  const params = new URL(page.url()).searchParams;
  expect(Object.fromEntries(params)).toEqual({
    date: "2026-10-08",
    view: "agenda",
    zone: "America/New_York",
    retained: "one",
  });
  await expect(
    page.getByRole("button", {
      name: publicEventFixture.hearing.title,
      exact: true,
    }),
  ).toBeFocused();
  expect(state.writes).toEqual([]);
  expect(unexpected).toEqual([]);
});

for (const change of ["client", "view"] as const)
  test(`Master Agenda hearing deep link aborts late detail when external navigation changes ${change}`, async ({
    page,
  }) => {
    const { state, unexpected } =
      await installPublicEventCalendarFixtures(page);
    let release!: () => void;
    state.wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.goto(`${masterAgendaUrl}&hearing=${publicEventId}`);
    await expect.poll(() => state.reads.length).toBe(1);
    await expect(page.getByRole("dialog")).toBeVisible();
    // Back/deep-link navigation can change route state while the modal is open.
    await page.evaluate(
      ({ change, clientId }) => {
        const url = new URL(location.href);
        if (change === "client") url.searchParams.set("clientId", clientId);
        else url.searchParams.set("view", "week");
        history.replaceState({}, "", url);
        dispatchEvent(new PopStateEvent("popstate"));
      },
      { change, clientId: publicEventClientId },
    );
    await expect(page.getByRole("dialog")).not.toBeVisible();
    release();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__publicDetails?.().every((entry) => !entry.data),
        ),
      )
      .toBe(true);
    await expect(
      page.getByText("Synthetic authorized client", { exact: true }),
    ).toHaveCount(0);
    expect(state.reads).toHaveLength(1);
    expect(state.writes).toEqual([]);
    expect(unexpected).toEqual([]);
  });

test("client Agenda and Master Month deep links remain meetings-only without fetching tenant event detail", async ({
  page,
}) => {
  const { state, unexpected } = await installPublicEventCalendarFixtures(page);
  await page.goto(
    `${masterAgendaUrl}&clientId=${publicEventClientId}&hearing=${publicEventId}`,
  );
  await expect(
    page.getByRole("heading", { name: "Master Calendar", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: publicEventFixture.hearing.title,
      exact: true,
    }),
  ).toHaveCount(0);
  expect(state.reads).toHaveLength(0);
  await page.goto(
    `/calendar?date=2026-10-08&view=month&hearing=${publicEventId}`,
  );
  await expect(
    page.getByRole("heading", { name: "Master Calendar", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.reads).toHaveLength(0);
  expect(state.writes).toEqual([]);
  expect(unexpected).toEqual([]);
});

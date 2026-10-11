import { test, expect, type Page, type Locator } from "@playwright/test";
import { installFixtures, json, clientId, client } from "./fixtures";
import type { Meeting } from "../../src/features/calendar/contracts";
import type { BotSession } from "../../src/features/calendar/attendance/contracts";

const meetingId = "90000000-0000-4000-8000-000000000001";
const sessionId = "91000000-0000-4000-8000-000000000001";
const meeting: Meeting = {
  id: meetingId,
  subject: "Synthetic attendance review",
  description: null,
  location: null,
  startsAt: "2099-10-15T14:00:00Z",
  endsAt: "2099-10-15T15:00:00Z",
  status: "scheduled",
  joinLink: "https://meet.google.com/abc-defg-hij",
  visibility: "private",
  isVirtual: true,
  meri: null,
  client: { id: clientId, name: client.name },
  attendees: [],
  preps: [],
};
const bot: BotSession = {
  id: sessionId,
  meetingId,
  clientId,
  provider: "recall",
  platform: "google_meet",
  status: "joining",
  recordingPolicy: "transcript_only",
  error: null,
  startedAt: null,
  endedAt: null,
  createdAt: "2026-10-11T07:00:00Z",
  updatedAt: "2026-10-11T07:00:00Z",
};
async function setup(page: Page) {
  const unexpected = await installFixtures(page);
  const state = {
    session: null as BotSession | null,
    preference: { enabled: false, stopping: false },
    sends: [] as unknown[],
    removals: 0,
    preferenceMethods: [] as string[],
  };
  await page.route("**/core/engagement/capabilities", (route) =>
    json(route, {
      meetingPrepComprehensiveEnabled: false,
      runtime: { externalActionsEnabled: true },
    }),
  );
  await page.route("**/core/engagement/meetings**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/notes") || path.endsWith("/debriefs"))
      return json(route, []);
    return json(route, path.endsWith(meetingId) ? meeting : [meeting]);
  });
  await page.route(
    `**/core/engagement/meetings/${meetingId}/notetaker`,
    (route) => {
      const method = route.request().method();
      if (method === "POST") {
        state.sends.push(route.request().postDataJSON());
        state.session = { ...bot };
      }
      if (method === "DELETE") {
        state.removals++;
        state.session = { ...bot, status: "removed" };
      }
      return json(route, state.session);
    },
  );
  await page.route(
    `**/core/engagement/clients/${clientId}/notetaker`,
    (route) => {
      const method = route.request().method();
      if (method !== "GET") {
        state.preferenceMethods.push(method);
        if (method === "POST") {
          expect(route.request().postDataJSON()).toEqual({
            authorizedToRecord: true,
            allPartiesWillBeNotified: true,
          });
          state.preference = { enabled: true, stopping: false };
        } else {
          state.preference = {
            enabled: false,
            stopping: state.preference.enabled,
          };
        }
      }
      return json(route, state.preference);
    },
  );
  return { state, unexpected };
}
async function openMeeting(page: Page) {
  await page.goto(
    `/portfolio/${clientId}/calendar?view=agenda&date=2099-10-15&zone=UTC&meeting=${meetingId}`,
  );
  const panel = page.getByRole("region", { name: "Meri meeting attendance" });
  await expect(panel).toBeVisible();
  return panel;
}
async function openSend(page: Page) {
  const panel = await openMeeting(page);
  await panel.getByRole("button", { name: "Send Meri to take notes" }).click();
  return page.getByRole("dialog", {
    name: "Send Meri to take notes",
    exact: true,
  });
}
async function consent(dialog: Locator) {
  await dialog.getByRole("checkbox").nth(0).check();
  await dialog.getByRole("checkbox").nth(1).check();
}
async function openPreferences(page: Page) {
  await page.goto(`/portfolio/${clientId}`);
  await page.getByRole("button", { name: "Meri actions", exact: true }).click();
  await page
    .getByRole("menuitem", { name: /Notetaker for this client/ })
    .click();
  return page.getByRole("dialog", { name: "Automatic Meri attendance" });
}
test("Owned meeting dispatch requires both confirmations and preserves future scheduling without claiming attendance", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  const dialog = await openSend(page);
  await expect(dialog).toHaveCSS("width", "660px");
  await expect(dialog.getByLabel("Meeting join URL")).toHaveCSS(
    "font-weight",
    "400",
  );
  await expect(dialog.getByRole("checkbox").nth(0).locator("..")).toHaveCSS(
    "font-weight",
    "400",
  );
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.fonts.check('13px "Geist Test"')),
  ).toBe(true);
  const send = dialog.getByRole("button", { name: "Send Meri", exact: true });
  await expect(send).toBeDisabled();
  await dialog.getByRole("checkbox").nth(0).check();
  await expect(send).toBeDisabled();
  await dialog.getByRole("checkbox").nth(1).check();
  await expect(dialog).toContainText("private Meeting Notes for review");
  await expect(dialog).toContainText("Scheduling does not confirm attendance");
  await page.screenshot({
    path: "work/screens/attendance-desktop.png",
    fullPage: true,
  });
  await send.click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("region", { name: "Meri meeting attendance" }),
  ).toContainText("Joining or scheduled · attendance not yet confirmed");
  expect(state.sends).toEqual([
    {
      meetingUrl: meeting.joinLink,
      authorizedToRecord: true,
      allPartiesWillBeNotified: true,
      recordingPolicy: "transcript_only",
      joinAt: meeting.startsAt,
    },
  ]);
  expect(unexpected).toEqual([]);
});
test("Server validation retains the join URL and confirmations for explicit correction", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  await page.route(
    `**/core/engagement/meetings/${meetingId}/notetaker`,
    (route) => {
      if (route.request().method() === "POST") {
        state.sends.push(route.request().postDataJSON());
        return json(route, { message: "Unrecognized meeting provider" }, 400);
      }
      return json(route, null);
    },
  );
  const dialog = await openSend(page);
  await dialog
    .getByLabel("Meeting join URL")
    .fill("https://unsupported.test/join");
  await consent(dialog);
  await dialog.getByRole("button", { name: "Send Meri", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Unrecognized meeting provider",
  );
  await expect(dialog.getByLabel("Meeting join URL")).toHaveValue(
    "https://unsupported.test/join",
  );
  await expect(dialog.getByRole("checkbox").nth(1)).toBeChecked();
  expect(state.sends).toHaveLength(1);
  expect(unexpected).toEqual([]);
});
test("A foreign success receipt is uncertain and cannot be resent automatically or from the same form", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  await page.route(
    `**/core/engagement/meetings/${meetingId}/notetaker`,
    (route) => {
      if (route.request().method() === "POST") {
        state.sends.push(route.request().postDataJSON());
        return json(route, {
          ...bot,
          meetingId: "90000000-0000-4000-8000-000000000002",
        });
      }
      return json(route, null);
    },
  );
  const dialog = await openSend(page);
  await consent(dialog);
  await dialog.getByRole("button", { name: "Send Meri", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Completion is unknown",
  );
  await expect(
    dialog.getByRole("button", { name: "Send Meri", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Refresh Meri status" }).click();
  await expect(
    dialog.getByRole("button", { name: "Send Meri", exact: true }),
  ).toBeDisabled();
  expect(state.sends).toHaveLength(1);
  expect(unexpected).toEqual([]);
});
test("Explicit removal handles a still-dispatching error and then accepts the actual removed receipt", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  state.session = { ...bot };
  let fail = true;
  await page.route(
    `**/core/engagement/meetings/${meetingId}/notetaker`,
    (route) => {
      if (route.request().method() === "DELETE") {
        state.removals++;
        if (fail)
          return json(
            route,
            {
              message:
                "Notetaker is still being dispatched — try again in a moment.",
            },
            400,
          );
        state.session = { ...bot, status: "removed" };
      }
      return json(route, state.session);
    },
  );
  const panel = await openMeeting(page);
  await panel.getByRole("button", { name: "Cancel Meri attendance" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Cancel Meri attendance",
    exact: true,
  });
  await expect(dialog).toContainText("Cancelling does not delete them");
  await dialog
    .getByRole("button", { name: "Remove Meri", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "still being dispatched",
  );
  expect(state.removals).toBe(1);
  fail = false;
  await dialog
    .getByRole("button", { name: "Remove Meri", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(panel).toContainText("Removed from meeting");
  expect(state.removals).toBe(2);
  expect(unexpected).toEqual([]);
});
test("Client preference saves consent once, preserves Off/stopping, and retries only DELETE", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  const dialog = await openPreferences(page);
  await expect(
    dialog.getByRole("button", { name: "Enable automatic attendance" }),
  ).toBeDisabled();
  await consent(dialog);
  await dialog
    .getByRole("button", { name: "Enable automatic attendance" })
    .click();
  await expect(dialog.getByRole("status")).toContainText("On ·");
  await dialog
    .getByRole("button", { name: "Turn off automatic attendance" })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Off · Meri is still leaving a meeting",
  );
  await expect(dialog.getByRole("checkbox").nth(0)).toBeDisabled();
  await dialog.getByRole("button", { name: "Retry stopping Meri" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Off · Automatic attendance is disabled",
  );
  expect(state.preferenceMethods).toEqual(["POST", "DELETE", "DELETE"]);
  expect(unexpected).toEqual([]);
});
test("A concurrent preference change requires refresh and preserves the unsaved affirmations", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  const dialog = await openPreferences(page);
  await consent(dialog);
  state.preference = { enabled: true, stopping: false };
  await dialog
    .getByRole("button", { name: "Enable automatic attendance" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Automatic attendance changed",
  );
  await expect(dialog.getByRole("checkbox").nth(0)).toBeChecked();
  expect(state.preferenceMethods).toEqual([]);
  await dialog
    .getByRole("button", { name: "Refresh attendance setting" })
    .click();
  await expect(dialog.getByRole("status")).toContainText("On ·");
  expect(unexpected).toEqual([]);
});
test("Runtime disabled keeps real session status visible and forbids external actions", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  state.session = { ...bot, status: "recording" };
  await page.route("**/core/engagement/capabilities", (route) =>
    json(route, {
      meetingPrepComprehensiveEnabled: false,
      runtime: { externalActionsEnabled: false },
    }),
  );
  const panel = await openMeeting(page);
  await expect(panel.getByRole("status")).toContainText("Recording");
  await expect(
    panel.getByRole("button", { name: "Send Meri to take notes" }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "Cancel Meri attendance" }),
  ).toBeDisabled();
  expect(state.sends).toEqual([]);
  expect(state.removals).toBe(0);
  expect(unexpected).toEqual([]);
});
test("Read-only role does not fetch private attendance or expose dispatch controls", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  let reads = 0;
  await page.route("**/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      tenant: { id: "tenant-test", name: "UI tests" },
      role: "read_only",
    }),
  );
  await page.route(
    `**/core/engagement/meetings/${meetingId}/notetaker`,
    (route) => {
      reads++;
      return json(route, null);
    },
  );
  const panel = await openMeeting(page);
  await expect(panel.getByRole("alert")).toContainText(
    "current role or session cannot access",
  );
  await expect(
    panel.getByRole("button", { name: "Send Meri to take notes" }),
  ).toHaveCount(0);
  expect(reads).toBe(0);
  expect(state.sends).toEqual([]);
  expect(unexpected).toEqual([]);
});
test("Meeting privacy errors and session expiry never expose a successful-looking attendance control", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  let status = 404;
  await page.route(
    `**/core/engagement/meetings/${meetingId}/notetaker`,
    (route) =>
      json(
        route,
        { message: status === 404 ? "Meeting not found" : "Expired" },
        status,
      ),
  );
  const panel = await openMeeting(page);
  await expect(panel.getByRole("alert")).toContainText("Meeting not found");
  await expect(
    panel.getByRole("button", { name: "Send Meri to take notes" }),
  ).toHaveCount(0);
  status = 401;
  await panel.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  expect(state.sends).toEqual([]);
  expect(unexpected).toEqual([]);
});
test("Unmounting during held dispatch preflight prevents the later POST", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  const dialog = await openSend(page);
  await consent(dialog);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route(
    `**/core/engagement/meetings/${meetingId}`,
    async (route) => {
      started = true;
      await held;
      return json(route, meeting);
    },
  );
  await dialog.getByRole("button", { name: "Send Meri", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => {
    history.pushState({}, "", `/calendar?view=agenda&date=2099-10-15&zone=UTC`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  release();
  await expect.poll(() => state.sends.length).toBe(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(state.sends).toEqual([]);
  expect(unexpected).toEqual([]);
});
test("Leaving the client during held preference preflight prevents the later enable POST", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  const dialog = await openPreferences(page);
  await consent(dialog);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route(
    `**/core/engagement/clients/${clientId}/notetaker`,
    async (route) => {
      if (route.request().method() !== "GET") {
        state.preferenceMethods.push(route.request().method());
        return json(route, { enabled: true, stopping: false });
      }
      started = true;
      await held;
      return json(route, { enabled: false, stopping: false });
    },
  );
  await dialog
    .getByRole("button", { name: "Enable automatic attendance" })
    .click();
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => {
    history.pushState({}, "", "/portfolio");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  release();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(state.preferenceMethods).toEqual([]);
  expect(unexpected).toEqual([]);
});
test("Mobile dark Send Meri dialog fits the viewport and retains accessible consent and actions", async ({
  page,
}) => {
  const { unexpected } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const dialog = await openSend(page);
  await expect(dialog).toHaveCSS("padding", "16px");
  await expect(
    dialog.getByRole("heading", { name: "Send Meri to take notes" }),
  ).toHaveCSS("font-size", "20px");
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await consent(dialog);
  await expect(
    dialog.getByRole("button", { name: "Send Meri", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "work/screens/attendance-mobile-dark.png",
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});

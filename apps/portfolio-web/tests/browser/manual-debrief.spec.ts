import { test, expect, type Page } from "@playwright/test";
import { installFixtures, json, clientId, client } from "./fixtures";

const meetingId = "90000000-0000-4000-8000-000000000013";
const meeting = {
  id: meetingId,
  subject: "Synthetic manual-source meeting",
  description: null,
  location: null,
  startsAt: "2026-10-10T14:00:00Z",
  endsAt: "2026-10-10T15:00:00Z",
  status: "scheduled",
  joinLink: null,
  visibility: "private",
  isVirtual: false,
  meri: null,
  client: { id: clientId, name: client.name },
  attendees: [],
  preps: [],
};
const source =
  "Staff requested the evidence.\nNina will review — café notes retained.";

async function setup(page: Page, enabled = true) {
  const unexpected = await installFixtures(page);
  const state = {
    requests: [] as unknown[],
    saves: 0,
    status: 200,
    hold: undefined as Promise<void> | undefined,
  };
  await page.route("**/core/engagement/capabilities", (route) =>
    json(route, {
      meetingPrepComprehensiveEnabled: false,
      runtime: { externalActionsEnabled: enabled },
    }),
  );
  await page.route("**/core/engagement/meetings**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/debrief-draft")) {
      state.requests.push(route.request().postDataJSON());
      if (state.hold) await state.hold;
      return state.status === 200
        ? json(route, {
            recap: "Synthetic reviewed recap",
            actionItems: ["Review evidence"],
            notes: "Retain the written qualification.",
            provider: "anthropic",
            model: "synthetic-model",
          })
        : json(route, { message: "Generation unavailable" }, state.status);
    }
    if (url.pathname.endsWith("/notetaker")) return json(route, null);
    if (url.pathname.endsWith("/notes")) return json(route, []);
    if (url.pathname.endsWith("/debriefs")) {
      if (route.request().method() === "POST") {
        state.saves++;
        expect(route.request().postDataJSON()).toMatchObject({
          body: "Synthetic reviewed recap\n\nAction items\n• Review evidence\n\nNotes\nRetain the written qualification.",
          confidential: false,
        });
        return json(route, { id: "synthetic-debrief" });
      }
      return json(route, []);
    }
    return json(route, url.pathname.endsWith(meetingId) ? meeting : [meeting]);
  });
  await page.goto(
    `/calendar?view=agenda&date=2026-10-10&zone=UTC&meeting=${meetingId}`,
  );
  await page
    .getByRole("dialog", { name: meeting.subject })
    .getByRole("button", { name: "Debriefs", exact: true })
    .click();
  return { state, unexpected };
}

async function openManual(page: Page) {
  await page
    .getByRole("button", { name: "Type Notes Manually", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Type Notes Manually", exact: true });
}

test("manual debrief reviews written context, generates only on submit and saves separately", async ({
  page,
}, testInfo) => {
  const { state, unexpected } = await setup(page);
  const dialog = await openManual(page);
  const submit = dialog.getByRole("button", {
    name: "Generate Debrief",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Meeting context", { exact: true }).fill("   ");
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Meeting context", { exact: true }).fill(source);
  expect(state.requests).toHaveLength(0);
  expect((await dialog.boundingBox())?.width).toBe(660);
  await expect(dialog.locator("textarea")).toHaveCSS("height", "180px");
  await page.screenshot({ path: testInfo.outputPath("manual-desktop.png") });
  await submit.click();
  const editor = page.getByRole("dialog", {
    name: "Review generated debrief",
    exact: true,
  });
  await expect(editor.getByLabel("Content")).toHaveValue(
    /Synthetic reviewed recap/,
  );
  expect(state.requests).toEqual([{ method: "manual", sourceText: source }]);
  expect(state.saves).toBe(0);
  await editor
    .getByRole("button", { name: "Save debrief", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect(state.saves).toBe(1);
  expect(unexpected).toEqual([]);
});

test("manual generation failure preserves source without automatic generation or save", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.status = 500;
  const dialog = await openManual(page);
  await dialog.getByLabel("Meeting context", { exact: true }).fill(source);
  await dialog
    .getByRole("button", { name: "Generate Debrief", exact: true })
    .click();
  const progress = page.getByRole("dialog", {
    name: "Generate meeting debrief",
    exact: true,
  });
  await expect(progress.getByRole("alert")).toContainText(
    "Generation unavailable",
  );
  await expect(progress).toContainText(
    "generating again starts another request",
  );
  expect(state.requests).toHaveLength(1);
  expect(state.saves).toBe(0);
  await progress.getByRole("button", { name: "Close", exact: true }).click();
  const reopened = await openManual(page);
  await expect(
    reopened.getByLabel("Meeting context", { exact: true }),
  ).toHaveValue(source);
  expect(state.requests).toHaveLength(1);
});

test("leaving the meeting during manual generation refuses a late draft", async ({
  page,
}) => {
  const { state } = await setup(page);
  let release!: () => void;
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const dialog = await openManual(page);
  await dialog.getByLabel("Meeting context", { exact: true }).fill(source);
  await dialog
    .getByRole("button", { name: "Generate Debrief", exact: true })
    .click();
  await expect.poll(() => state.requests.length).toBe(1);
  await page.evaluate(() => {
    history.pushState({}, "", "/calendar?view=agenda&date=2026-10-10&zone=UTC");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.saves).toBe(0);
});

test("manual source respects runtime denial and mobile dark reference geometry", async ({
  page,
}, testInfo) => {
  await setup(page, false);
  await expect(
    page.getByRole("button", { name: "Type Notes Manually", exact: true }),
  ).toBeDisabled();
  await page.unrouteAll({ behavior: "wait" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  const { state } = await setup(page);
  const dialog = await openManual(page);
  await dialog.getByLabel("Meeting context", { exact: true }).fill(source);
  expect((await dialog.boundingBox())?.width).toBe(358);
  await expect(dialog).toHaveCSS("padding", "16px");
  await expect(dialog).toHaveCSS("background-color", "rgb(27, 27, 27)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("manual-mobile-dark.png"),
  });
  expect(state.requests).toHaveLength(0);
});

import { test, expect, type Page } from "@playwright/test";
import {
  installFixtures,
  json,
  clientId,
  client,
  file as baseFile,
} from "./fixtures";
import type {
  MeetingAttachment,
  SavedNote,
} from "../../src/features/calendar/review/contracts";

const meetingId = "90000000-0000-4000-8000-000000000013";
const meeting = {
  id: meetingId,
  subject: "Synthetic saved-note meeting",
  description: null,
  location: null,
  startsAt: "2026-10-10T14:00:00Z",
  endsAt: "2026-10-10T15:00:00Z",
  status: "scheduled",
  joinLink: null,
  visibility: "private",
  isVirtual: false,
  meri: "done",
  client: { id: clientId, name: client.name },
  attendees: [],
  preps: [],
};
const source =
  "Staff requested evidence.\nNina will review — café notes retained.";
const note: SavedNote = {
  id: "note-synthetic",
  meetingId,
  clientId,
  body: source,
  restricted: false,
  confidential: true,
  authorUserId: "user-test",
  createdAt: "2026-10-10T15:00:00Z",
  updatedAt: "2026-10-10T15:00:00Z",
};
const attachment: MeetingAttachment = {
  ...baseFile,
  tenantId: "tenant-test",
  meetingId,
  s3Key: "synthetic/briefing.pdf",
  lifecycleStatus: "ready",
  scanStatus: "clean",
  extractionStatus: null,
  usable: true,
  supersededByAttachmentId: null,
  approvedAt: null,
  approvedByUserId: null,
  downloadUrl: "https://files.example.test/review.pdf",
  uploadedByUserId: "user-test",
  viewerMode: "all",
  blockedReason: undefined,
};
function held() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function event(page: Page, name: string) {
  await page.evaluate((value) => window.dispatchEvent(new Event(value)), name);
}
async function setup(
  page: Page,
  options: { enabled?: boolean; role?: string } = {},
) {
  const unexpected = await installFixtures(page);
  const state = {
    notes: [note] as SavedNote[],
    files: [attachment] as MeetingAttachment[],
    noteReads: 0,
    fileReads: 0,
    noteCompleted: 0,
    fileCompleted: 0,
    generations: [] as unknown[],
    approvals: 0,
    saves: 0,
    noteHold: undefined as Promise<void> | undefined,
    fileHold: undefined as Promise<void> | undefined,
    approvalHold: undefined as Promise<void> | undefined,
    approvalStatus: 200,
    lost: false,
    wrongReceipt: false,
    generationStatus: 200,
    notesStatus: 200,
  };
  if (options.role)
    await page.route("**/core/me", (route) =>
      json(route, {
        user: { id: "user-test", email: "test@example.test" },
        tenant: { id: "tenant-test", name: "Synthetic" },
        role: options.role,
      }),
    );
  await page.route("**/core/engagement/capabilities", (route) =>
    json(route, {
      meetingPrepComprehensiveEnabled: false,
      runtime: { externalActionsEnabled: options.enabled !== false },
    }),
  );
  await page.route("**/core/engagement/attachments?**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("meetingId")).toBe(
      meetingId,
    );
    state.fileReads++;
    if (state.fileHold) await state.fileHold;
    await json(route, state.files).catch(() => {});
    state.fileCompleted++;
  });
  await page.route("**/core/engagement/meetings**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/approve")) {
      expect(path).toBe(
        `/api/backend/core/engagement/meetings/${meetingId}/attachments/${attachment.id}/approve`,
      );
      expect(route.request().method()).toBe("POST");
      expect(route.request().postData()).toBeNull();
      state.approvals++;
      if (state.approvalHold) await state.approvalHold;
      if (state.lost) return route.abort("failed");
      if (state.approvalStatus !== 200)
        return json(
          route,
          { message: "Approval refused" },
          state.approvalStatus,
        );
      const result = {
        ...attachment,
        id: state.wrongReceipt
          ? "60000000-0000-4000-8000-000000000002"
          : attachment.id,
        approvedAt: "2026-10-11T12:00:00Z",
        approvedByUserId: "user-test",
      };
      return json(route, result);
    }
    if (path.endsWith("/debrief-draft")) {
      state.generations.push(route.request().postDataJSON());
      return state.generationStatus === 200
        ? json(route, {
            recap: "Synthetic reviewed recap",
            actionItems: ["Review evidence"],
            notes: "Retain qualification.",
            provider: "anthropic",
            model: "synthetic-model",
          })
        : json(
            route,
            { message: "Generation unavailable" },
            state.generationStatus,
          );
    }
    if (path.endsWith("/notetaker")) return json(route, null);
    if (path.endsWith("/notes")) {
      state.noteReads++;
      if (state.noteHold) await state.noteHold;
      await json(
        route,
        state.notesStatus === 200
          ? state.notes
          : { message: "Saved notes unavailable" },
        state.notesStatus,
      ).catch(() => {});
      state.noteCompleted++;
      return;
    }
    if (path.endsWith("/debriefs")) {
      if (route.request().method() === "POST") {
        state.saves++;
        expect(route.request().postDataJSON()).toMatchObject({
          confidential: false,
        });
        return json(route, { id: "synthetic-debrief" });
      }
      return json(route, []);
    }
    return json(route, path.endsWith(meetingId) ? meeting : [meeting]);
  });
  return { state, unexpected };
}
async function openSource(page: Page, path = "/__test/meeting-review") {
  await page.goto(path);
  await page
    .getByRole("button", { name: "Use saved meeting notes", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Use saved meeting notes",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function chooseSource(page: Page) {
  const dialog = await openSource(page);
  await dialog
    .getByRole("combobox", { name: "Saved note" })
    .selectOption(note.id);
  await expect(
    dialog.getByRole("region", { name: "Selected saved note" }),
  ).toContainText(source);
  return dialog;
}
async function approve(page: Page) {
  const region = page.getByRole("region", {
    name: "Meeting attachment approvals",
  });
  await region
    .getByRole("checkbox", { name: `I have reviewed ${attachment.fileName}` })
    .check();
  await region
    .getByRole("button", { name: "Approve attachment", exact: true })
    .click();
  return region;
}

test("saved note is reviewed exactly, generation is explicit and existing editor saves separately", async ({
  page,
}, info) => {
  const { state, unexpected } = await setup(page);
  const dialog = await chooseSource(page);
  expect(state.generations).toEqual([]);
  expect(state.saves).toBe(0);
  await expect(dialog).toHaveCSS("width", "660px");
  await expect(dialog).toContainText(
    "does not identify which saved notes were created by Meri",
  );
  await page.screenshot({ path: info.outputPath("saved-note-desktop.png") });
  await dialog
    .getByRole("button", { name: "Generate Debrief", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Review generated debrief",
    exact: true,
  });
  await expect(editor.getByLabel("Content", { exact: true })).toHaveValue(
    /Synthetic reviewed recap/,
  );
  expect(state.generations).toEqual([{ method: "manual", sourceText: source }]);
  expect(state.saves).toBe(0);
  await editor
    .getByLabel("Content", { exact: true })
    .fill("Explicitly reviewed draft.");
  await editor
    .getByRole("button", { name: "Save debrief", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect(state.saves).toBe(1);
  expect(state.approvals).toBe(0);
  expect(unexpected).toEqual([]);
});
test("restricted or empty notes never enter the source picker or generation", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  state.notes = [
    { ...note, body: null, restricted: true },
    { ...note, id: "empty-note", body: "  " },
  ];
  const dialog = await openSource(page);
  await expect(
    dialog.getByText("No readable saved notes are available for this meeting."),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Generate Debrief", exact: true }),
  ).toBeDisabled();
  expect(state.generations).toEqual([]);
  expect(state.saves).toBe(0);
  expect(unexpected).toEqual([]);
});
test("changed source refuses generation, refresh requires a new explicit review", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  const dialog = await chooseSource(page);
  state.notes = [
    {
      ...note,
      body: "Changed after review",
      updatedAt: "2026-10-11T12:00:00Z",
    },
  ];
  await dialog
    .getByRole("button", { name: "Generate Debrief", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "selected note changed",
  );
  expect(state.generations).toEqual([]);
  await dialog
    .getByRole("button", { name: "Refresh notes", exact: true })
    .click();
  await expect(
    dialog.getByRole("combobox", { name: "Saved note" }),
  ).toHaveValue("");
  await dialog
    .getByRole("combobox", { name: "Saved note" })
    .selectOption(note.id);
  await expect(
    dialog.getByRole("region", { name: "Selected saved note" }),
  ).toContainText("Changed after review");
  await dialog
    .getByRole("button", { name: "Generate Debrief", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Review generated debrief" }),
  ).toBeVisible();
  expect(state.generations).toEqual([
    { method: "manual", sourceText: "Changed after review" },
  ]);
  expect(state.saves).toBe(0);
  expect(unexpected).toEqual([]);
});
test("wrong-parent notes are rejected before rendering source or POST", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.notes = [{ ...note, meetingId: "foreign" }];
  const dialog = await openSource(page);
  await expect(dialog.getByRole("alert")).toContainText("unexpected response");
  await expect(
    dialog.getByRole("region", { name: "Selected saved note" }),
  ).toHaveCount(0);
  expect(state.generations).toEqual([]);
  expect(state.saves).toBe(0);
});
test("generation failure keeps source in the existing explicit retry flow without saving", async ({
  page,
}) => {
  const { state, unexpected } = await setup(page);
  state.generationStatus = 503;
  const dialog = await chooseSource(page);
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
  await expect(
    progress.getByRole("button", {
      name: "Generate again from this source",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.generations).toHaveLength(1);
  expect(state.saves).toBe(0);
  expect(unexpected).toEqual([]);
});
for (const name of [
  "review-actor-change",
  "review-identity-invalidate",
  "review-unmount",
]) {
  test(`held source preflight refuses ${name} before generation`, async ({
    page,
  }) => {
    const { state } = await setup(page);
    const dialog = await chooseSource(page);
    const hold = held();
    state.noteHold = hold.promise;
    const prior = state.noteReads;
    await dialog
      .getByRole("button", { name: "Generate Debrief", exact: true })
      .click();
    await expect.poll(() => state.noteReads).toBe(prior + 1);
    await event(page, name);
    hold.release();
    await expect.poll(() => state.noteCompleted).toBe(prior + 1);
    await expect(
      page.getByRole("dialog", { name: "Review generated debrief" }),
    ).toHaveCount(0);
    expect(state.generations).toEqual([]);
    expect(state.saves).toBe(0);
  });
}
test("disabled generation capability and portal role send no source generation", async ({
  page,
}) => {
  const { state } = await setup(page, { enabled: false });
  await page.goto("/__test/meeting-review");
  await expect(
    page.getByRole("button", { name: "Use saved meeting notes", exact: true }),
  ).toBeDisabled();
  expect(state.noteReads).toBe(0);
  expect(state.generations).toEqual([]);
  await page.route("**/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: null },
      tenant: { id: "tenant-test", name: "Synthetic" },
      role: "client_portal_user",
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Use saved meeting notes", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("dialog", { name: "Use saved meeting notes", exact: true }),
  ).toHaveCount(0);
  expect(state.generations).toEqual([]);
});
test("approval requires explicit reviewed file acknowledgement and records no scan, extraction or share", async ({
  page,
}, info) => {
  const { state, unexpected } = await setup(page);
  await page.goto("/__test/meeting-review");
  const region = page.getByRole("region", {
    name: "Meeting attachment approvals",
  });
  await expect(
    region.getByRole("button", { name: "Approve attachment", exact: true }),
  ).toBeDisabled();
  await expect(region).toContainText(
    "does not perform a security scan, extract text or share",
  );
  await expect(
    region.getByRole("link", {
      name: `Review ${attachment.fileName}`,
      exact: true,
    }),
  ).toHaveAttribute("href", attachment.downloadUrl!);
  await approve(page);
  await expect(region.getByText(/^Approved ·/)).toBeVisible();
  await expect(
    region.getByRole("button", { name: "Approve attachment", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("attachment-approval-desktop.png"),
  });
  expect(state.approvals).toBe(1);
  expect(state.generations).toEqual([]);
  expect(state.saves).toBe(0);
  expect(unexpected).toEqual([]);
});
test("unusable or nonviewer attachment never exposes approval", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.files = [
    {
      ...attachment,
      usable: false,
      lifecycleStatus: "quarantined",
      scanStatus: "pending",
      blockedReason: "scan_pending",
    },
  ];
  await page.goto("/__test/meeting-review");
  const region = page.getByRole("region", {
    name: "Meeting attachment approvals",
  });
  await expect(region).toContainText(
    "File unavailable for review: scan_pending",
  );
  await expect(
    region.getByRole("button", { name: "Approve attachment", exact: true }),
  ).toHaveCount(0);
  state.files = [
    {
      ...attachment,
      viewerMode: "restricted",
      viewerUserIds: [],
      uploadedByUserId: "other",
    },
  ];
  await region
    .getByRole("button", { name: "Refresh attachment status", exact: true })
    .click();
  await expect(region.getByRole("alert")).toContainText("unexpected response");
  expect(state.approvals).toBe(0);
});
test("changed file preflight rejects old acknowledgement, requiring review of current file", async ({
  page,
}) => {
  const { state } = await setup(page);
  await page.goto("/__test/meeting-review");
  const region = page.getByRole("region", {
    name: "Meeting attachment approvals",
  });
  await region.getByRole("checkbox").check();
  state.files = [{ ...attachment, s3Key: "synthetic/replacement.pdf" }];
  await region
    .getByRole("button", { name: "Approve attachment", exact: true })
    .click();
  await expect(region.getByRole("alert")).toContainText("attachment changed");
  expect(state.approvals).toBe(0);
  await region
    .getByRole("button", { name: "Refresh attachment status", exact: true })
    .click();
  await expect(region.getByRole("checkbox")).not.toBeChecked();
  await expect(
    region.getByRole("button", { name: "Approve attachment", exact: true }),
  ).toBeDisabled();
});
test("lost approval reply freezes repeat; unapproved read cannot resolve but actual approved status can", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.lost = true;
  await page.goto("/__test/meeting-review");
  const region = await approve(page);
  await expect(region.getByRole("alert")).toContainText(
    "Approval may have completed",
  );
  await expect(
    region.getByRole("button", { name: "Approve attachment", exact: true }),
  ).toBeDisabled();
  await region
    .getByRole("button", { name: "Refresh attachment status", exact: true })
    .click();
  await expect(
    region.getByRole("button", { name: "Approve attachment", exact: true }),
  ).toBeDisabled();
  state.files = [
    {
      ...attachment,
      approvedAt: "2026-10-11T12:00:00Z",
      approvedByUserId: "user-test",
    },
  ];
  await region
    .getByRole("button", { name: "Refresh attachment status", exact: true })
    .click();
  await expect(region.getByText(/^Approved ·/)).toBeVisible();
  await expect(region.getByRole("alert")).toHaveCount(0);
  expect(state.approvals).toBe(1);
});
test("mismatched successful approval receipt freezes automatic or repeated mutation", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.wrongReceipt = true;
  await page.goto("/__test/meeting-review");
  const region = await approve(page);
  await expect(region.getByRole("alert")).toContainText(
    "Approval may have completed",
  );
  await expect(
    region.getByRole("button", { name: "Approve attachment", exact: true }),
  ).toBeDisabled();
  expect(state.approvals).toBe(1);
});
test("actual HTTP refusal leaves a deliberate retry available", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.approvalStatus = 403;
  await page.goto("/__test/meeting-review");
  const region = await approve(page);
  await expect(region.getByRole("alert")).toContainText("Approval refused");
  await expect(
    region.getByRole("button", { name: "Approve attachment", exact: true }),
  ).toBeEnabled();
  state.approvalStatus = 200;
  await region
    .getByRole("button", { name: "Approve attachment", exact: true })
    .click();
  await expect(region.getByText(/^Approved ·/)).toBeVisible();
  expect(state.approvals).toBe(2);
});
test("role revocation during held attachment preflight sends zero approval POSTs", async ({
  page,
}) => {
  const { state } = await setup(page);
  await page.goto("/__test/meeting-review");
  const region = page.getByRole("region", {
    name: "Meeting attachment approvals",
  });
  await expect(region.getByRole("checkbox")).toBeVisible();
  const hold = held();
  state.fileHold = hold.promise;
  const prior = state.fileReads;
  await approve(page);
  await expect.poll(() => state.fileReads).toBe(prior + 1);
  await event(page, "review-role-change");
  hold.release();
  await expect.poll(() => state.fileCompleted).toBe(prior + 1);
  expect(state.approvals).toBe(0);
  await event(page, "review-role-restore");
  await expect(region.getByText(/^Approved ·/)).toHaveCount(0);
});
test("role loss after POST remains uncertain after the same actor role is restored", async ({
  page,
}) => {
  const { state } = await setup(page);
  await page.goto("/__test/meeting-review");
  const hold = held();
  state.approvalHold = hold.promise;
  const region = await approve(page);
  await expect.poll(() => state.approvals).toBe(1);
  await event(page, "review-role-change");
  hold.release();
  await expect(region.getByRole("alert")).toContainText(
    "Approval may have completed",
  );
  await event(page, "review-role-restore");
  await expect(
    region.getByRole("button", { name: "Approve attachment", exact: true }),
  ).toBeDisabled();
  expect(state.approvals).toBe(1);
});
test("mobile dark saved-note review keeps source and actions within viewport", async ({
  page,
}, info) => {
  const { state } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const dialog = await chooseSource(page);
  await expect(dialog).toHaveCSS("width", "358px");
  await expect(dialog).toHaveCSS("background-color", "rgb(27, 27, 27)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "Generate Debrief", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("saved-note-mobile-dark.png"),
  });
  expect(state.generations).toEqual([]);
  expect(state.saves).toBe(0);
});

test("actual client Calendar deep link reaches approval and saved-note generation without losing scope", async ({
  page,
}, info) => {
  const { state, unexpected } = await setup(page);
  await page.goto(
    `/portfolio/${clientId}/calendar?view=agenda&date=2026-10-10&zone=UTC&meeting=${meetingId}`,
  );
  const detail = page.getByRole("dialog", {
    name: meeting.subject,
    exact: true,
  });
  await detail
    .getByRole("button", { name: "Preparation", exact: true })
    .click();
  const region = await approve(page);
  await expect(region.getByText(/^Approved ·/)).toBeVisible();
  expect(state.approvals).toBe(1);
  await page.screenshot({
    path: info.outputPath("calendar-attachment-review.png"),
  });
  await detail.getByRole("button", { name: "Debriefs", exact: true }).click();
  await detail
    .getByRole("button", { name: "Use saved meeting notes", exact: true })
    .click();
  const sourceDialog = page.getByRole("dialog", {
    name: "Use saved meeting notes",
    exact: true,
  });
  await sourceDialog
    .getByRole("combobox", { name: "Saved note" })
    .selectOption(note.id);
  await sourceDialog
    .getByRole("button", { name: "Generate Debrief", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Review generated debrief", exact: true }),
  ).toBeVisible();
  expect(state.generations).toEqual([{ method: "manual", sourceText: source }]);
  expect(state.saves).toBe(0);
  expect(page.url()).toContain(`/portfolio/${clientId}/calendar`);
  for (const part of ["view=agenda", "date=2026-10-10", `meeting=${meetingId}`])
    expect(page.url()).toContain(part);
  expect(unexpected).toEqual([]);
});
test("source GET failures support deliberate read retry and session expiry never generates", async ({
  page,
}) => {
  const { state } = await setup(page);
  state.notesStatus = 503;
  const dialog = await openSource(page);
  await expect(dialog.getByRole("alert")).toContainText(
    "Saved notes unavailable",
  );
  state.notesStatus = 200;
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await dialog
    .getByRole("combobox", { name: "Saved note" })
    .selectOption(note.id);
  state.notesStatus = 401;
  await dialog
    .getByRole("button", { name: "Refresh notes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your session expired", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/sign-in");
  await expect(dialog).not.toBeVisible();
  expect(state.generations).toEqual([]);
  expect(state.saves).toBe(0);
});
for (const name of ["review-actor-change", "review-unmount"]) {
  test(`held attachment preflight refuses ${name} before approval`, async ({
    page,
  }) => {
    const { state } = await setup(page);
    await page.goto("/__test/meeting-review");
    await expect(
      page
        .getByRole("region", { name: "Meeting attachment approvals" })
        .getByRole("checkbox"),
    ).toBeVisible();
    const hold = held();
    state.fileHold = hold.promise;
    const prior = state.fileReads;
    await approve(page);
    await expect.poll(() => state.fileReads).toBe(prior + 1);
    await event(page, name);
    hold.release();
    await expect.poll(() => state.fileCompleted).toBe(prior + 1);
    expect(state.approvals).toBe(0);
  });
}

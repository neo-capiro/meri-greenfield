import { test, expect, type Page } from "@playwright/test";
import {
  installVoiceFixtures,
  voiceFile,
  voiceMeetingId,
  voiceAttachmentId,
} from "./voice-fixtures";
import { clientId, json } from "./fixtures";

async function open(page: Page) {
  await page
    .getByRole("button", { name: "Open voice memo", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Record Voice Memo", exact: true });
}
async function setup(page: Page) {
  const fixture = await installVoiceFixtures(page);
  await page.goto("/__test/voice-source");
  const dialog = await open(page);
  await expect(dialog.getByLabel("Audio memo", { exact: true })).toBeEnabled();
  return { ...fixture, dialog };
}

test("audio source requires explicit upload, transcript review and generation; preview URLs are released", async ({
  page,
}, testInfo) => {
  const { state, unexpected, dialog } = await setup(page);
  await dialog
    .getByLabel("Audio memo", { exact: true })
    .setInputFiles(voiceFile);
  expect(state.writes).toHaveLength(0);
  expect(state.storage).toBe(0);
  await expect(dialog.getByLabel("Review selected audio memo")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(
    dialog.getByRole("button", { name: "Generate Debrief", exact: true }),
  ).toHaveCount(0);
  expect((await dialog.boundingBox())?.width).toBe(660);
  await page.screenshot({
    path: testInfo.outputPath("voice-desktop-light.png"),
  });
  await dialog
    .getByRole("button", { name: "Upload and transcribe", exact: true })
    .click();
  await expect(dialog.getByLabel("Reviewed voice transcript")).toHaveValue(
    "Synthetic transcript — café notes retained.",
  );
  await expect(dialog).toContainText("did not report transcript completeness");
  await expect(dialog).toContainText("Synthetic scan disclosure");
  await page.screenshot({
    path: testInfo.outputPath("voice-desktop-transcript-review.png"),
  });
  await expect(page.getByLabel("Reviewed voice source")).toHaveText("");
  expect(state.storage).toBe(1);
  expect(state.extracts).toBe(1);
  expect(state.writes[1]?.body).toMatchObject({
    meetingId: voiceMeetingId,
    clientId,
    source: "voice",
  });
  await dialog
    .getByRole("button", { name: "Generate Debrief", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Reviewed voice source")).toContainText(
    `"attachmentId":"${voiceAttachmentId}"`,
  );
  await expect(page.getByLabel("Reviewed voice source")).toContainText(
    '"method":"voice"',
  );
  const urls = await page.evaluate(() => window.__voiceUrls);
  expect(urls?.created.length).toBeGreaterThan(0);
  expect(urls?.revoked).toEqual(urls?.created);
  expect(unexpected).toEqual([]);
});

test("quarantine blocks extraction and explicit readiness recheck retains the original upload", async ({
  page,
}) => {
  const { state, dialog } = await setup(page);
  state.ready = false;
  await dialog
    .getByLabel("Audio memo", { exact: true })
    .setInputFiles(voiceFile);
  await dialog
    .getByRole("button", { name: "Upload and transcribe", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Scan pending");
  expect(state.extracts).toBe(0);
  await expect(dialog.getByLabel("Audio memo", { exact: true })).toBeDisabled();
  state.ready = true;
  await dialog
    .getByRole("button", {
      name: "Check saved audio and transcribe",
      exact: true,
    })
    .click();
  await expect(dialog.getByLabel("Reviewed voice transcript")).toBeVisible();
  expect(state.storage).toBe(1);
  expect(
    state.writes.filter((write) => write.path.endsWith("/confirm")),
  ).toHaveLength(1);
});

for (const status of [400, 500])
  test(`unverified provider${status} freezes the source across close/reopen without retry`, async ({
    page,
  }) => {
    const { state, dialog } = await setup(page);
    state.extractStatus = status;
    await dialog
      .getByLabel("Audio memo", { exact: true })
      .setInputFiles(voiceFile);
    await dialog
      .getByRole("button", { name: "Upload and transcribe", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText("may have completed");
    await expect(
      dialog.getByRole("button", {
        name: "Check saved audio and transcribe",
        exact: true,
      }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const reopened = await open(page);
    await expect(reopened).toContainText(voiceFile.name);
    await expect(reopened.getByRole("alert")).toContainText(
      "may have completed",
    );
    expect(state.extracts).toBe(1);
    expect(state.storage).toBe(1);
    await expect(page.getByLabel("Reviewed voice source")).toHaveText("");
  });

test("wrong-parent confirmation is refused and rechecking never uploads duplicate bytes", async ({
  page,
}) => {
  const { state, dialog } = await setup(page);
  state.wrongParent = true;
  await dialog
    .getByLabel("Audio memo", { exact: true })
    .setInputFiles(voiceFile);
  await dialog
    .getByRole("button", { name: "Upload and transcribe", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("unexpected response");
  expect(state.extracts).toBe(0);
  state.wrongParent = false;
  await dialog
    .getByRole("button", {
      name: "Check saved audio and transcribe",
      exact: true,
    })
    .click();
  await expect(dialog.getByLabel("Reviewed voice transcript")).toBeVisible();
  expect(state.storage).toBe(1);
  expect(
    state.writes.filter((write) => write.path.endsWith("/confirm")),
  ).toHaveLength(2);
});

test("actor change during upload preparation blocks storage, confirmation and transcription", async ({
  page,
}) => {
  const { state, dialog } = await setup(page);
  let release!: () => void;
  state.ticketWait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await dialog
    .getByLabel("Audio memo", { exact: true })
    .setInputFiles(voiceFile);
  await dialog
    .getByRole("button", { name: "Upload and transcribe", exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() => window.__voiceChangeActor?.());
  release();
  await expect(dialog.getByLabel("Audio memo", { exact: true })).toBeEnabled();
  expect(state.storage).toBe(0);
  expect(state.extracts).toBe(0);
  expect(state.writes).toHaveLength(1);
  await expect(page.getByLabel("Reviewed voice source")).toHaveText("");
});

test("invalidated identity refuses upload dispatch despite retained stale role data", async ({
  page,
}) => {
  const { state, dialog } = await setup(page);
  await dialog
    .getByLabel("Audio memo", { exact: true })
    .setInputFiles(voiceFile);
  await page.evaluate(() => window.__voiceInvalidate?.());
  await dialog
    .getByRole("button", { name: "Upload and transcribe", exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  expect(state.storage).toBe(0);
});

test("closing during transcription discards the late receipt and keeps the uncertain attempt frozen", async ({
  page,
}) => {
  const { state, dialog } = await setup(page);
  let release!: () => void;
  state.extractWait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await dialog
    .getByLabel("Audio memo", { exact: true })
    .setInputFiles(voiceFile);
  await dialog
    .getByRole("button", { name: "Upload and transcribe", exact: true })
    .click();
  await expect.poll(() => state.extracts).toBe(1);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  release();
  const reopened = await open(page);
  await expect(reopened.getByRole("alert")).toContainText("may have completed");
  await expect(
    reopened.getByRole("button", {
      name: "Check saved audio and transcribe",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(reopened.getByLabel("Reviewed voice transcript")).toHaveCount(0);
  expect(state.extracts).toBe(1);
});

for (const change of ["invalidation", "refetch"] as const)
  test(`same-actor ${change} during transcription freezes the dispatched attempt across close/reopen`, async ({
    page,
  }) => {
    const { state, dialog } = await setup(page);
    let releaseExtraction!: () => void;
    let releaseIdentity!: () => void;
    let identityReads = 0;
    state.extractWait = new Promise<void>((resolve) => {
      releaseExtraction = resolve;
    });
    const identityWait = new Promise<void>((resolve) => {
      releaseIdentity = resolve;
    });
    await page.route("**/core/me", async (route) => {
      identityReads++;
      if (change === "refetch") await identityWait;
      return json(route, {
        user: { id: "user-test", email: "test@example.test" },
        tenant: { id: "tenant-test", name: "UI tests" },
        role: "user_admin",
      });
    });
    await dialog
      .getByLabel("Audio memo", { exact: true })
      .setInputFiles(voiceFile);
    await dialog
      .getByRole("button", { name: "Upload and transcribe", exact: true })
      .click();
    await expect.poll(() => state.extracts).toBe(1);
    if (change === "invalidation")
      await page.evaluate(() => window.__voiceInvalidate?.());
    else {
      await page.evaluate(() => {
        void window.__voiceRefetchIdentity?.();
      });
      await expect.poll(() => identityReads).toBe(1);
    }
    releaseExtraction();
    await expect(dialog.getByRole("alert")).toContainText("may have completed");
    releaseIdentity();
    await page.evaluate(() => window.__voiceRefetchIdentity?.());
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const reopened = await open(page);
    await expect(reopened.getByRole("alert")).toContainText(
      "may have completed",
    );
    await expect(
      reopened.getByRole("button", {
        name: "Check saved audio and transcribe",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(reopened.getByLabel("Reviewed voice transcript")).toHaveCount(
      0,
    );
    await expect(
      reopened.getByLabel("Audio memo", { exact: true }),
    ).toBeDisabled();
    expect(state.extracts).toBe(1);
    expect(state.storage).toBe(1);
  });

test("invalidated identity and close during storage retain the original upload reference without repeated bytes", async ({
  page,
}) => {
  const { state, dialog } = await setup(page);
  let release!: () => void;
  state.storageWait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await dialog
    .getByLabel("Audio memo", { exact: true })
    .setInputFiles(voiceFile);
  await dialog
    .getByRole("button", { name: "Upload and transcribe", exact: true })
    .click();
  await expect.poll(() => state.storage).toBe(1);
  await page.evaluate(() => window.__voiceInvalidate?.());
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  release();
  await page.evaluate(() => window.__voiceRefetchIdentity?.());
  const reopened = await open(page);
  const check = reopened.getByRole("button", {
    name: "Check saved audio and transcribe",
    exact: true,
  });
  await expect(check).toBeEnabled();
  await expect(
    reopened.getByLabel("Audio memo", { exact: true }),
  ).toBeDisabled();
  await check.click();
  await expect(reopened.getByLabel("Reviewed voice transcript")).toBeVisible();
  expect(state.storage).toBe(1);
  expect(state.extracts).toBe(1);
  expect(
    state.writes.filter((write) => write.path.endsWith("upload-url")),
  ).toHaveLength(1);
});

test("actual actor change during transcription cannot publish the old actor receipt or source", async ({
  page,
}) => {
  const { state, dialog } = await setup(page);
  let release!: () => void;
  state.extractWait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await dialog
    .getByLabel("Audio memo", { exact: true })
    .setInputFiles(voiceFile);
  await dialog
    .getByRole("button", { name: "Upload and transcribe", exact: true })
    .click();
  await expect.poll(() => state.extracts).toBe(1);
  await page.evaluate(() => window.__voiceChangeActor?.());
  release();
  await expect(dialog.getByLabel("Audio memo", { exact: true })).toHaveValue(
    "",
  );
  await expect(dialog.getByLabel("Reviewed voice transcript")).toHaveCount(0);
  await expect(page.getByLabel("Reviewed voice source")).toHaveText("");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const reopened = await open(page);
  await expect(reopened.getByLabel("Audio memo", { exact: true })).toHaveValue(
    "",
  );
  expect(state.extracts).toBe(1);
  expect(state.storage).toBe(1);
});

test("unsupported memo is rejected without upload and local playback URL is released on replacement/unmount", async ({
  page,
}) => {
  const { state, dialog } = await setup(page);
  const input = dialog.getByLabel("Audio memo", { exact: true });
  await input.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Synthetic notes"),
  });
  await expect(dialog.getByRole("alert")).toContainText("Choose an audio memo");
  await expect(
    dialog.getByRole("button", { name: "Upload and transcribe", exact: true }),
  ).toBeDisabled();
  await input.setInputFiles(voiceFile);
  await input.setInputFiles({ ...voiceFile, name: "Another memo.webm" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Unmount voice source", exact: true })
    .click();
  const urls = await page.evaluate(() => window.__voiceUrls);
  expect(urls?.created).toHaveLength(2);
  expect(urls?.revoked).toEqual(urls?.created);
  expect(state.writes).toHaveLength(0);
});

test("voice source follows mobile dark geometry and runtime refusal", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  const { state, dialog } = await setup(page);
  expect((await dialog.boundingBox())?.width).toBe(358);
  await expect(dialog).toHaveCSS("padding", "16px");
  await expect(dialog).toHaveCSS("background-color", "rgb(27, 27, 27)");
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await document.fonts.load('13px "Geist Test"')).length,
      ),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("voice-mobile-dark.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  state.runtime = false;
  await page.reload();
  const denied = await open(page);
  await expect(denied.getByLabel("Audio memo", { exact: true })).toBeDisabled();
  await expect(denied).toContainText("enabled transcription service");
  expect(state.writes).toHaveLength(0);
});

import { test, expect } from "@playwright/test";
import { json } from "./fixtures";
import {
  installVoiceFixtures,
  voiceMeeting,
  voiceMeetingId,
  voiceFile,
} from "./voice-fixtures";

test("Calendar voice source explicitly generates a reviewed draft and saves separately", async ({
  page,
}, info) => {
  const { state, unexpected } = await installVoiceFixtures(page);
  const generated: unknown[] = [];
  const saved: unknown[] = [];
  await page.route("**/core/engagement/meetings**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/debrief-draft")) {
      generated.push(route.request().postDataJSON());
      return json(route, {
        recap: "Reviewed voice recap",
        actionItems: ["Review the original evidence"],
        notes: "Keep the source qualification.",
        provider: "anthropic",
        model: "synthetic-model",
      });
    }
    if (path.endsWith("/debriefs")) {
      if (route.request().method() === "POST") {
        saved.push(route.request().postDataJSON());
        return json(route, { id: "synthetic-voice-debrief" });
      }
      return json(route, []);
    }
    if (path.endsWith("/notetaker")) return json(route, null);
    if (path.endsWith("/notes")) return json(route, []);
    return json(
      route,
      path.endsWith(voiceMeetingId) ? voiceMeeting : [voiceMeeting],
    );
  });
  await page.goto(
    `/calendar?view=agenda&date=2026-10-11&zone=UTC&meeting=${voiceMeetingId}`,
  );
  await page
    .getByRole("dialog", { name: voiceMeeting.subject })
    .getByRole("button", {
      name: "Debriefs",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Record Voice Memo", exact: true })
    .click();
  const source = page.getByRole("dialog", {
    name: "Record Voice Memo",
    exact: true,
  });
  await source
    .getByLabel("Audio memo", { exact: true })
    .setInputFiles(voiceFile);
  expect(generated).toEqual([]);
  await source
    .getByRole("button", { name: "Upload and transcribe", exact: true })
    .click();
  await expect(source.getByLabel("Reviewed voice transcript")).toHaveValue(
    "Synthetic transcript — café notes retained.",
  );
  expect(generated).toEqual([]);
  expect(saved).toEqual([]);
  await source
    .getByRole("button", { name: "Generate Debrief", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Review generated debrief",
    exact: true,
  });
  await expect(editor.getByLabel("Content")).toHaveValue(
    "Reviewed voice recap\n\nAction items\n• Review the original evidence\n\nNotes\nKeep the source qualification.",
  );
  expect(generated).toEqual([
    {
      method: "voice",
      sourceText: "Synthetic transcript — café notes retained.",
    },
  ]);
  expect(saved).toEqual([]);
  expect(state.storage).toBe(1);
  expect(state.extracts).toBe(1);
  await page.screenshot({
    path: info.outputPath("calendar-voice-generated-review.png"),
  });
  await editor
    .getByRole("button", { name: "Save debrief", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect(saved).toEqual([
    {
      body: "Reviewed voice recap\n\nAction items\n• Review the original evidence\n\nNotes\nKeep the source qualification.",
      confidential: false,
    },
  ]);
  expect(unexpected).toEqual([]);
});

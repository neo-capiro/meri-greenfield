import type { Page } from "@playwright/test";
import { installFixtures, json, clientId } from "./fixtures";
import { voiceMeeting } from "./voice-meeting";
export { voiceMeeting } from "./voice-meeting";
export const voiceMeetingId = voiceMeeting.id;
export const voiceAttachmentId = "80000000-0000-4000-8000-000000000001";
export const voiceFile = {
  name: "Meeting voice memo.webm",
  mimeType: "audio/webm",
  buffer: Buffer.from("Synthetic audio bytes, not a real recording"),
};
export async function installVoiceFixtures(page: Page) {
  const unexpected = await installFixtures(page);
  const state = {
    writes: [] as { path: string; body: unknown }[],
    storage: 0,
    extracts: 0,
    ready: true,
    extractStatus: 200,
    runtime: true,
    wrongParent: false,
    ticketWait: undefined as Promise<void> | undefined,
    extractWait: undefined as Promise<void> | undefined,
    storageWait: undefined as Promise<void> | undefined,
  };
  const receipt = () => ({
    id: voiceAttachmentId,
    clientId,
    meetingId: state.wrongParent ? clientId : voiceMeetingId,
    s3Key: "synthetic-owned-key",
    fileName: voiceFile.name,
    contentType: "audio/webm",
    byteSize: voiceFile.buffer.byteLength,
    source: "voice",
    folder: null,
    viewerMode: "all",
    viewerUserIds: [],
    uploadedByUserId: "user-test",
    createdAt: "2026-10-11T00:00:00Z",
    lifecycleStatus: state.ready ? "ready" : "quarantined",
    scanStatus: state.ready ? "clean" : "pending",
    extractionStatus: "pending",
    indexedAt: null,
    usable: state.ready,
    ...(state.ready ? {} : { blockedReason: "Scan pending" }),
  });
  await page.route("**/core/engagement/capabilities", (route) =>
    json(route, {
      meetingPrepComprehensiveEnabled: false,
      runtime: { externalActionsEnabled: state.runtime },
    }),
  );
  await page.route("**/core/engagement/attachments**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") return json(route, [receipt()]);
    state.writes.push({ path, body: request.postDataJSON() });
    if (path.endsWith("upload-url")) {
      if (state.ticketWait) await state.ticketWait;
      return json(route, {
        url: "https://storage.example.test/upload",
        fields: { key: "synthetic-owned-key" },
        s3Key: "synthetic-owned-key",
      });
    }
    if (path.endsWith("/confirm")) return json(route, receipt());
    if (path.endsWith("/extract-text")) {
      state.extracts++;
      if (state.extractWait) await state.extractWait;
      return state.extractStatus === 200
        ? json(route, {
            attachmentId: voiceAttachmentId,
            text: "Synthetic transcript — café notes retained.",
            source: "transcription",
            contentHash: "a".repeat(64),
            disclosure: "Synthetic scan disclosure",
          })
        : json(
            route,
            { message: "Synthetic provider error" },
            state.extractStatus,
          );
    }
    throw new Error(`Unexpected voice write ${path}`);
  });
  await page.route("https://storage.example.test/upload", async (route) => {
    state.storage++;
    if (state.storageWait) await state.storageWait;
    await route.fulfill({
      status: 204,
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    const urls = { created: [] as string[], revoked: [] as string[] };
    window.__voiceUrls = urls;
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      urls.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      urls.revoked.push(url);
      revoke(url);
    };
  });
  return { state, unexpected };
}

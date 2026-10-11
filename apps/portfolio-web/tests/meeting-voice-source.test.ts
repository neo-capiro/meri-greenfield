import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  prepareVoiceSource,
  voiceAttemptFrozen,
  voiceFileValidation,
  type VoiceAttempt,
} from "../src/features/calendar/debrief/voice/source";

const meetingId = "90000000-0000-4000-8000-000000000001";
const clientId = "10000000-0000-4000-8000-000000000001";
const id = "80000000-0000-4000-8000-000000000001";
const file = new File(["synthetic audio bytes"], "memo.webm", {
  type: "audio/webm;codecs=opus",
});
const parent = { meetingId, clientId };
const ticket = {
  url: "https://storage.example.test",
  fields: { key: "owned-key" },
  s3Key: "owned-key",
};
const receipt = {
  id,
  clientId,
  meetingId,
  s3Key: ticket.s3Key,
  fileName: file.name,
  contentType: "audio/webm",
  byteSize: file.size,
  source: "voice",
  folder: null,
  viewerMode: "all",
  viewerUserIds: [],
  uploadedByUserId: null,
  createdAt: "2026-10-11T00:00:00Z",
  lifecycleStatus: "ready",
  scanStatus: "clean",
  extractionStatus: "pending",
  indexedAt: null,
  usable: true,
};
function fixture(
  options: {
    ready?: boolean;
    row?: Partial<Omit<typeof receipt, "clientId">> & {
      clientId?: string | null;
    };
    extractStatus?: number;
    extractId?: string;
    storageUnknown?: boolean;
    afterRead?: () => void;
    afterExtract?: () => void;
  } = {},
) {
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.endsWith("upload-url")) return Response.json(ticket);
      if (path.endsWith("/confirm")) return Response.json(receipt);
      if (path.includes("attachments?meetingId=")) {
        options.afterRead?.();
        return Response.json([
          { ...receipt, usable: options.ready ?? true, ...options.row },
        ]);
      }
      if (path.endsWith("/extract-text")) {
        expect(init?.method).toBe("POST");
        options.afterExtract?.();
        return Response.json(
          options.extractStatus
            ? { message: "Provider unavailable" }
            : {
                attachmentId: options.extractId ?? id,
                text: "Synthetic transcript — café notes.",
                source: "transcription",
                fileName: file.name,
                contentType: receipt.contentType,
                contentHash: "a".repeat(64),
                disclosure: "Synthetic scan disclosure",
              },
          { status: options.extractStatus ?? 200 },
        );
      }
      throw new Error(`Unexpected request ${path}`);
    });
  const transport = vi.fn<typeof fetch>().mockImplementation(async () => {
    if (options.storageUnknown) throw new TypeError("Lost storage reply");
    return new Response(null, { status: 204 });
  });
  const attempt: VoiceAttempt = { upload: {} };
  const scope = new AbortController();
  const prepare = (assertCurrent = () => {}) =>
    prepareVoiceSource(
      createApiClient(request),
      parent,
      file,
      attempt,
      () => {},
      assertCurrent,
      scope.signal,
      transport,
    );
  return { request, transport, attempt, scope, prepare };
}

describe("voice source canonical composition", () => {
  it("validates audio files before any upload and does not infer types from a name", () => {
    expect(voiceFileValidation(file)).toBeNull();
    expect(
      voiceFileValidation(
        new File(["text"], "memo.webm", { type: "text/plain" }),
      ),
    ).toMatch(/audio memo/);
    expect(
      voiceFileValidation(
        new File(["audio"], "memo.ogg", { type: "audio/ogg" }),
      ),
    ).toMatch(/MP3/);
    expect(
      voiceFileValidation(new File([], "empty.wav", { type: "audio/wav" })),
    ).toMatch(/Empty/);
  });
  it("uploads once, confirms exact parents, reads readiness and accepts real audio receipt without fabricated completeness", async () => {
    const f = fixture();
    const result = await f.prepare();
    expect(result).toEqual({
      attachmentId: id,
      text: "Synthetic transcript — café notes.",
      disclosure: "Synthetic scan disclosure",
    });
    expect(result.truncated).toBeUndefined();
    expect(
      f.request.mock.calls.map(([url]) => String(url).split("/").pop()),
    ).toEqual([
      "upload-url",
      "confirm",
      `attachments?meetingId=${meetingId}`,
      "extract-text",
    ]);
    expect(
      JSON.parse(String(f.request.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      meetingId,
      clientId,
      source: "voice",
      contentType: "audio/webm",
      s3Key: ticket.s3Key,
    });
    expect(f.transport).toHaveBeenCalledOnce();
    expect(voiceAttemptFrozen(f.attempt)).toBe(true);
  });
  it("quarantine refuses extraction; explicit readiness check reuses the saved upload", async () => {
    const options = { ready: false };
    const f = fixture(options);
    await expect(f.prepare()).rejects.toMatchObject({ status: 409 });
    expect(f.request).toHaveBeenCalledTimes(3);
    expect(f.attempt.attachmentId).toBe(id);
    expect(f.attempt.extractionUnknown).toBeUndefined();
    options.ready = true;
    await expect(f.prepare()).resolves.toMatchObject({ attachmentId: id });
    expect(f.transport).toHaveBeenCalledOnce();
    expect(
      f.request.mock.calls.filter(([url]) => String(url).endsWith("/confirm")),
    ).toHaveLength(1);
  });
  it.each([
    { meetingId: clientId },
    { clientId: null },
    { fileName: "different.webm" },
  ])(
    "refuses changed saved source/parent %j before transcription",
    async (row) => {
      const f = fixture({ row });
      await expect(f.prepare()).rejects.toMatchObject({ status: 409 });
      expect(f.request).toHaveBeenCalledTimes(3);
      expect(f.attempt.extractionUnknown).toBeUndefined();
    },
  );
  it("actor change after readiness reads refuses the next POST without ambiguous classification", async () => {
    let current = true;
    const f = fixture({
      afterRead: () => {
        current = false;
      },
    });
    await expect(
      f.prepare(() => {
        if (!current) throw new Error("Actor changed");
      }),
    ).rejects.toThrow("Actor changed");
    expect(f.request).toHaveBeenCalledTimes(3);
    expect(f.attempt.extractionUnknown).toBeUndefined();
  });
  it.each([
    { extractStatus: 400 },
    { extractStatus: 500 },
    { extractId: clientId },
  ])(
    "freezes dispatched transcription on unverified response %j without retry",
    async (options) => {
      const f = fixture(options);
      await expect(f.prepare()).rejects.toThrow(/may have completed/);
      await expect(f.prepare()).rejects.toThrow(/may have completed/);
      expect(f.request).toHaveBeenCalledTimes(4);
      expect(f.attempt.extractionUnknown).toBe(true);
    },
  );
  it("lost storage reply confirms the original key without uploading another copy", async () => {
    const options = { storageUnknown: true };
    const f = fixture(options);
    await expect(f.prepare()).rejects.toThrow(/completion is unknown/);
    expect(f.attempt.upload.storageUnknown).toBe(true);
    await expect(f.prepare()).resolves.toMatchObject({ attachmentId: id });
    expect(f.transport).toHaveBeenCalledOnce();
    expect(
      f.request.mock.calls.filter(([url]) =>
        String(url).endsWith("upload-url"),
      ),
    ).toHaveLength(1);
  });
  it("closed lifetime discards a late transcription receipt and preserves frozen outcome", async () => {
    const options: { afterExtract?: () => void } = {};
    const f = fixture(options);
    options.afterExtract = () => f.scope.abort();
    await expect(f.prepare()).rejects.toThrow(/may have completed/);
    expect(f.attempt.extractionUnknown).toBe(true);
    expect(f.request).toHaveBeenCalledTimes(4);
  });
  it("never reuses a confirmed attempt with different audio bytes", async () => {
    const f = fixture();
    await f.prepare();
    await expect(
      prepareVoiceSource(
        createApiClient(f.request),
        parent,
        new File(["different bytes"], file.name, { type: file.type }),
        f.attempt,
        () => {},
        () => {},
        f.scope.signal,
        f.transport,
      ),
    ).rejects.toThrow(/another audio memo/);
    expect(f.request).toHaveBeenCalledTimes(4);
  });
});

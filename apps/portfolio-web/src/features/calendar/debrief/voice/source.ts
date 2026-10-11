import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import {
  attachmentSchema,
  fileValidation,
  uploadParentFile,
  type UploadAttempt,
} from "@/features/files/public";
import {
  extractMeetingSource,
  type ExtractedMeetingSource,
} from "../../library/public";

export type VoiceParent = { meetingId: string; clientId: string | null };
export type ReviewedVoiceSource = ExtractedMeetingSource & { method: "voice" };
export interface VoiceAttempt {
  upload: UploadAttempt;
  attachmentId?: string;
  extractionUnknown?: boolean;
}
export function voiceFileValidation(file: File) {
  return (
    fileValidation(file) ??
    (!file.type.toLowerCase().startsWith("audio/")
      ? "Choose an audio memo. Use Transcript and attachments for other files."
      : !/\.(mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i.test(file.name)
        ? "Choose MP3, MP4/M4A, MPEG/MPGA, WAV or WebM audio."
        : null)
  );
}
export function voiceAttemptFrozen(attempt: VoiceAttempt) {
  return Boolean(
    attempt.attachmentId ||
    attempt.upload.bytesUploaded ||
    attempt.upload.storageUnknown,
  );
}
export class VoiceExtractionUnknown extends Error {
  constructor() {
    super(
      "Transcription did not return a verified result and may have completed. This source is frozen; it will not be transcribed again automatically. The uploaded audio remains attached to this meeting.",
    );
    this.name = "VoiceExtractionUnknown";
  }
}
const meetingAttachment = attachmentSchema.extend({
  meetingId: z.string().uuid().nullable(),
});

/** Reuses the canonical upload and extraction owners; no provider or storage client. */
export async function prepareVoiceSource(
  api: ApiClient,
  parent: VoiceParent,
  file: File,
  attempt: VoiceAttempt,
  onStage: (stage: string) => void,
  assertCurrent: () => void,
  signal: AbortSignal,
  transport: typeof fetch = fetch,
): Promise<ExtractedMeetingSource> {
  const invalid = voiceFileValidation(file);
  if (invalid) throw new ApiError(422, invalid);
  if (attempt.extractionUnknown) throw new VoiceExtractionUnknown();
  if (attempt.upload.file && attempt.upload.file !== file)
    throw new ApiError(
      409,
      "This attempt belongs to another audio memo. Keep the original source.",
    );
  let extractionDispatched = false;
  const scopedApi: ApiClient = {
    request(service, path, schema, options) {
      assertCurrent();
      signal.throwIfAborted();
      if (path.endsWith("/extract-text")) extractionDispatched = true;
      return api.request(service, path, schema, { ...options, signal });
    },
  };
  const scopedTransport: typeof fetch = (input, options) => {
    assertCurrent();
    signal.throwIfAborted();
    return transport(input, {
      ...options,
      signal: options?.signal
        ? AbortSignal.any([signal, options.signal])
        : signal,
    });
  };
  if (!attempt.attachmentId) {
    const receipt = await uploadParentFile(
      scopedApi,
      parent,
      file,
      attempt.upload,
      onStage,
      "voice",
      scopedTransport,
      assertCurrent,
    );
    assertCurrent();
    signal.throwIfAborted();
    attempt.attachmentId = receipt.id;
  }
  onStage("Checking saved audio readiness");
  const attachments = await scopedApi.request(
    "core",
    `engagement/attachments?meetingId=${encodeURIComponent(parent.meetingId)}`,
    z.array(meetingAttachment),
  );
  assertCurrent();
  signal.throwIfAborted();
  const saved = attachments.find((row) => row.id === attempt.attachmentId);
  if (
    !saved ||
    saved.meetingId !== parent.meetingId ||
    saved.clientId !== parent.clientId ||
    saved.fileName !== file.name ||
    saved.contentType !== file.type.split(";")[0]?.trim().toLowerCase()
  )
    throw new ApiError(
      409,
      "The saved audio or its meeting/client association changed. Review the meeting files before continuing.",
    );
  if (saved.usable !== true)
    throw new ApiError(
      409,
      saved.blockedReason ??
        "The uploaded audio is not ready for transcription. Check its scan status before continuing.",
    );
  onStage("Transcribing saved audio");
  try {
    const result = await extractMeetingSource(scopedApi, saved.id);
    assertCurrent();
    signal.throwIfAborted();
    return result;
  } catch (error) {
    if (!extractionDispatched) throw error;
    attempt.extractionUnknown = true;
    throw new VoiceExtractionUnknown();
  }
}

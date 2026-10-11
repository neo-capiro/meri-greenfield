import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { meetingSchema, noteSchema } from "../contracts";
import {
  assertExportable,
  attachmentCompatibility,
  documentId,
  preparationSnapshot,
  type DocumentMeeting,
  type SavedMeetingDocument,
  type PreparationPdfReceipt,
} from "./contracts";
import type { Preparation } from "../preparation/schema";

export async function readSavedDocument(
  api: ApiClient,
  meeting: DocumentMeeting,
  requested: SavedMeetingDocument,
  signal?: AbortSignal,
): Promise<{ meeting: DocumentMeeting; document: SavedMeetingDocument }> {
  const current = await api.request(
    "core",
    `engagement/meetings/${encodeURIComponent(meeting.id)}`,
    meetingSchema,
    { signal },
  );
  if (current.id !== meeting.id || current.client?.id !== meeting.client?.id)
    throw new ApiError(
      409,
      "The meeting or client changed. Reopen this meeting before exporting.",
    );
  let document: SavedMeetingDocument;
  if (requested.kind === "preparation") {
    const preparation = current.preps.find(
      (item) => item.id === documentId(requested),
    );
    if (!preparation)
      throw new ApiError(
        409,
        "This saved preparation is no longer available. Refresh the meeting.",
      );
    document = { kind: "preparation", preparation };
  } else {
    const rows = await api.request(
      "core",
      `engagement/meetings/${encodeURIComponent(meeting.id)}/debriefs`,
      z.array(noteSchema),
      { signal },
    );
    const debrief = rows.find((item) => item.id === documentId(requested));
    if (!debrief)
      throw new ApiError(
        409,
        "This saved debrief is no longer available. Refresh the meeting.",
      );
    document = { kind: "debrief", debrief };
  }
  assertExportable(document);
  return { meeting: current, document };
}

export class PreparationPdfAttemptError extends Error {
  constructor(
    message: string,
    public readonly uncertain: boolean,
  ) {
    super(message);
    this.name = "PreparationPdfAttemptError";
  }
}
const receiptSchema = z.object({
  id: z.string().uuid(),
  fileName: z
    .string()
    .min(1)
    .max(512)
    .refine((name) => name.toLowerCase().endsWith(".pdf")),
});

export async function preparePdfAttachment(
  api: ApiClient,
  meeting: DocumentMeeting,
  reviewed: Preparation,
  assertCurrent: () => void,
): Promise<PreparationPdfReceipt> {
  let dispatched = false;
  try {
    assertCurrent();
    const current = await readSavedDocument(api, meeting, {
      kind: "preparation",
      preparation: reviewed,
    });
    assertCurrent();
    if (current.meeting.subject !== meeting.subject)
      throw new ApiError(
        409,
        "The meeting title changed. Refresh and review the current preparation before creating an attachment.",
      );
    if (current.document.kind !== "preparation")
      throw new Error("Preparation is unavailable.");
    if (
      preparationSnapshot(current.document.preparation) !==
      preparationSnapshot(reviewed)
    )
      throw new ApiError(
        409,
        "The saved preparation changed. Refresh and review its current content before creating an attachment.",
      );
    const incompatible = attachmentCompatibility(
      current.document.preparation,
      current.meeting.subject,
    );
    if (incompatible) throw new ApiError(409, incompatible);
    // No asynchronous boundary between authority check and dispatch.
    assertCurrent();
    dispatched = true;
    const receipt = await api.request(
      "core",
      `engagement/meeting-preps/${encodeURIComponent(reviewed.id)}/pdf-attachment`,
      receiptSchema,
      { method: "POST" },
    );
    assertCurrent();
    return receipt;
  } catch (error) {
    const uncertain =
      dispatched &&
      !(error instanceof ApiError && [401, 403].includes(error.status));
    throw new PreparationPdfAttemptError(
      uncertain
        ? "Attachment creation may have completed. Check this meeting’s Files before starting another attempt. This action will not retry automatically."
        : error instanceof Error
          ? error.message
          : "The PDF attachment could not be prepared.",
      uncertain,
    );
  }
}

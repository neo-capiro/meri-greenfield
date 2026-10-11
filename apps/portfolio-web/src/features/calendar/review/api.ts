import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { meetingSchema } from "../contracts";
import {
  approvalReceiptSchema,
  attachmentSnapshot,
  canReviewAttachment,
  meetingAttachmentSchema,
  noteSnapshot,
  savedNoteSchema,
  type MeetingAttachment,
  type ReviewActor,
  type ReviewMeeting,
  type SavedNote,
} from "./contracts";

async function readMeeting(
  api: ApiClient,
  meeting: ReviewMeeting,
  signal?: AbortSignal,
) {
  return api.request(
    "core",
    `engagement/meetings/${encodeURIComponent(meeting.id)}`,
    meetingSchema.refine(
      (row) =>
        row.id === meeting.id &&
        (row.client?.id ?? null) === (meeting.client?.id ?? null),
      "The meeting or client association changed. Reopen the meeting.",
    ),
    { signal },
  );
}
export async function readSavedNotes(
  api: ApiClient,
  meeting: ReviewMeeting,
  signal?: AbortSignal,
) {
  await readMeeting(api, meeting, signal);
  return api.request(
    "core",
    `engagement/meetings/${encodeURIComponent(meeting.id)}/notes`,
    z
      .array(savedNoteSchema)
      .refine(
        (rows) =>
          new Set(rows.map((row) => row.id)).size === rows.length &&
          rows.every(
            (row) =>
              row.meetingId === meeting.id &&
              row.clientId === (meeting.client?.id ?? null),
          ),
        "Saved notes do not match this meeting and client.",
      ),
    { signal },
  );
}
export async function revalidateSavedNote(
  api: ApiClient,
  meeting: ReviewMeeting,
  reviewed: SavedNote,
  assertCurrent: () => void,
  signal?: AbortSignal,
) {
  assertCurrent();
  const notes = await readSavedNotes(api, meeting, signal);
  assertCurrent();
  const current = notes.find((note) => note.id === reviewed.id);
  if (
    !current ||
    current.restricted ||
    !current.body?.trim() ||
    noteSnapshot(current) !== noteSnapshot(reviewed)
  )
    throw new ApiError(
      409,
      "The selected note changed or is no longer readable. Refresh and review the current note before generating.",
    );
  return { text: current.body, method: "manual" as const };
}
export async function readMeetingAttachments(
  api: ApiClient,
  meeting: ReviewMeeting,
  actor: ReviewActor,
  signal?: AbortSignal,
) {
  await readMeeting(api, meeting, signal);
  return api.request(
    "core",
    `engagement/attachments?meetingId=${encodeURIComponent(meeting.id)}`,
    z
      .array(meetingAttachmentSchema)
      .refine(
        (rows) =>
          new Set(rows.map((row) => row.id)).size === rows.length &&
          rows.every(
            (row) =>
              row.tenantId === actor.tenantId &&
              row.meetingId === meeting.id &&
              row.clientId === (meeting.client?.id ?? null) &&
              row.supersededByAttachmentId === null &&
              (row.viewerMode === "all" ||
                row.uploadedByUserId === actor.userId ||
                row.viewerUserIds.includes(actor.userId)),
          ),
        "Attachments do not match the current meeting, client or viewer.",
      ),
    { signal },
  );
}
export class AttachmentApprovalError extends Error {
  constructor(
    message: string,
    public readonly uncertain: boolean,
  ) {
    super(message);
    this.name = "AttachmentApprovalError";
  }
}
export async function approveReviewedAttachment(
  api: ApiClient,
  meeting: ReviewMeeting,
  actor: ReviewActor,
  reviewed: MeetingAttachment,
  assertCurrent: () => void,
) {
  let dispatched = false;
  let knownRefusal = false;
  try {
    assertCurrent();
    const rows = await readMeetingAttachments(api, meeting, actor);
    assertCurrent();
    const current = rows.find((row) => row.id === reviewed.id);
    if (
      !current ||
      !canReviewAttachment(current, actor.userId) ||
      current.approvedAt ||
      attachmentSnapshot(current) !== attachmentSnapshot(reviewed)
    )
      throw new ApiError(
        409,
        "This attachment changed, is already approved or cannot currently be reviewed. Refresh its current status.",
      );
    assertCurrent();
    dispatched = true;
    const receipt = await api
      .request(
        "core",
        `engagement/meetings/${encodeURIComponent(meeting.id)}/attachments/${encodeURIComponent(current.id)}/approve`,
        approvalReceiptSchema.refine(
          (row) =>
            attachmentSnapshot(row) === attachmentSnapshot(current) &&
            row.approvedByUserId === actor.userId &&
            Boolean(row.approvedAt),
          "The approval receipt does not match the reviewed attachment and actor.",
        ),
        { method: "POST" },
      )
      .catch((error: unknown) => {
        knownRefusal =
          error instanceof ApiError &&
          [400, 401, 403, 404, 409, 422].includes(error.status);
        throw error;
      });
    assertCurrent();
    return receipt;
  } catch (error) {
    const uncertain = dispatched && !knownRefusal;
    throw new AttachmentApprovalError(
      uncertain
        ? "Approval may have completed. Refresh the attachment status before another action. This attempt will not retry automatically."
        : error instanceof Error
          ? error.message
          : "The attachment could not be approved.",
      uncertain,
    );
  }
}

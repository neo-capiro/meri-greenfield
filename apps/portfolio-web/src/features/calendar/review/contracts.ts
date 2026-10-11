import { z } from "zod";
import { attachmentSchema } from "@/features/files/public";
import type { Meeting } from "../contracts";

export type ReviewMeeting = Pick<Meeting, "id" | "client">;
export type ReviewActor = { userId: string; tenantId: string };
export type SavedNotesSource = { text: string; method: "manual" };
export const savedNoteSchema = z.object({
  id: z.string().min(1),
  meetingId: z.string().min(1),
  clientId: z.string().nullable(),
  body: z.string().nullable(),
  restricted: z.boolean(),
  confidential: z.boolean(),
  authorUserId: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type SavedNote = z.infer<typeof savedNoteSchema>;
export const meetingAttachmentSchema = attachmentSchema.extend({
  tenantId: z.string().min(1),
  meetingId: z.string().nullable(),
  s3Key: z.string().min(1),
  supersededByAttachmentId: z.string().nullable(),
  approvedAt: z.string().datetime({ offset: true }).nullable(),
  approvedByUserId: z.string().nullable(),
  usable: z.boolean(),
});
export type MeetingAttachment = z.infer<typeof meetingAttachmentSchema>;
export const approvalReceiptSchema = meetingAttachmentSchema.omit({
  usable: true,
  blockedReason: true,
  scanDisclosure: true,
  downloadUrl: true,
  previewUrl: true,
  uploadedByName: true,
});
export type ApprovalReceipt = z.infer<typeof approvalReceiptSchema>;
export function attachmentSnapshot(file: MeetingAttachment | ApprovalReceipt) {
  return JSON.stringify([
    file.id,
    file.tenantId,
    file.meetingId,
    file.clientId,
    file.s3Key,
    file.fileName,
    file.contentType,
    file.byteSize,
    file.source,
    file.viewerMode,
    [...file.viewerUserIds].sort(),
    file.uploadedByUserId,
    file.lifecycleStatus,
    file.scanStatus,
    file.supersededByAttachmentId,
  ]);
}
export function noteSnapshot(note: SavedNote) {
  return JSON.stringify([
    note.id,
    note.meetingId,
    note.clientId,
    note.body,
    note.updatedAt,
    note.restricted,
    note.confidential,
    note.authorUserId,
  ]);
}
export function canReviewAttachment(file: MeetingAttachment, userId: string) {
  return (
    file.usable &&
    file.supersededByAttachmentId === null &&
    (file.viewerMode === "all" ||
      file.uploadedByUserId === userId ||
      file.viewerUserIds.includes(userId))
  );
}
export const reviewKey = (
  kind: "notes" | "attachments",
  meeting: ReviewMeeting,
  actor: Partial<ReviewActor>,
) =>
  [
    "meeting-review",
    kind,
    actor.tenantId ?? null,
    actor.userId ?? null,
    meeting.id,
    meeting.client?.id ?? null,
  ] as const;

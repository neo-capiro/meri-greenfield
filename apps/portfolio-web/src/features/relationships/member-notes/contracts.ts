import { z } from "zod";

// Directory identifiers are opaque strings, not ClientPerson UUIDs.
export const memberReferenceSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(240),
});
export type MemberReference = z.infer<typeof memberReferenceSchema>;
export const memberNoteInputSchema = z.object({
  body: z.string().trim().min(1, "Enter what happened.").max(4000),
  directoryContactName: memberReferenceSchema.shape.name,
});
export const memberNoteReceiptSchema = z.object({
  id: z.uuid(),
  directoryContactId: z.string(),
  directoryContactName: z.string().nullable(),
  body: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  createdBy: z.object({
    id: z.string().min(1),
    email: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }),
});
export type MemberNoteReceipt = z.infer<typeof memberNoteReceiptSchema>;
export const memberNotesKey = (
  tenantId: string,
  userId: string,
  memberId: string,
) => ["directory-member-notes", tenantId, userId, memberId] as const;

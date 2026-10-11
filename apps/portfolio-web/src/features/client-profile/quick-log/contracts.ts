import { z } from "zod";
export const quickLogInputSchema = z.object({
  kind: z.enum(["note", "call", "email", "decision", "request"]),
  title: z.string().trim().min(1, "Enter an activity title.").max(300),
  body: z.string().trim().max(5000),
  personId: z.uuid().optional(),
});
export type QuickLogInput = z.infer<typeof quickLogInputSchema>;
export const quickLogReceiptSchema = z.object({
  id: z.uuid(),
  clientId: z.uuid(),
  tenantId: z.uuid(),
  actorUserId: z.uuid(),
  createdByUserId: z.uuid(),
  kind: quickLogInputSchema.shape.kind,
  title: z.string(),
  body: z.string().nullable(),
  personId: z.uuid().nullable(),
  pinned: z.boolean(),
  dueAt: z.string().nullable(),
  settledAt: z.string().nullable(),
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
  occurredAt: z.iso.datetime({ offset: true }),
});
export type QuickLogReceipt = z.infer<typeof quickLogReceiptSchema>;

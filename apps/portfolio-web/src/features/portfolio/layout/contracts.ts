import { z } from "zod";

export const layoutCardId = z
  .string()
  .regex(
    /^client:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
export const layoutOrderSchema = z
  .array(layoutCardId)
  .max(2000)
  .refine((ids) => new Set(ids).size === ids.length);
export const layoutReceiptSchema = z
  .object({
    contractVersion: z.literal(1),
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    version: z.number().int().min(0).max(2147483647),
    updatedAt: z.string().datetime().nullable(),
    order: layoutOrderSchema,
  })
  .strict()
  .refine((value) => (value.version === 0) === (value.updatedAt === null));
export type LayoutReceipt = z.infer<typeof layoutReceiptSchema>;
export type LayoutActor = { tenantId: string; userId: string };
export type LayoutSave = {
  contractVersion: 1;
  expectedVersion: number;
  order: string[];
};

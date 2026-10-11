import { z } from "zod";

const amount = z.number().finite().nonnegative();
export const billingSummarySchema = z.object({
  billingEnabled: z.boolean(),
  status: z.enum([
    "none",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "comped",
  ]),
  slots: z.number().int().nonnegative(),
  usedSlots: z.number().int().nonnegative(),
  pricePerSlotUsd: amount,
  llmAllowanceUsd: amount,
  llmUsedUsd: amount,
  llmOverageUsd: amount,
  llmWarn: z.boolean(),
  llmHardCapUsd: amount.nullable(),
  currentPeriodEnd: z.iso.datetime({ offset: true }).nullable(),
  hasSubscription: z.boolean(),
});
export type BillingSummary = z.infer<typeof billingSummarySchema>;

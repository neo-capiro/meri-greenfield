import { z } from "zod";

// Core BillingService.getState, verified at fd8765ec. This projection is
// deliberately available to every authenticated role and contains no prices.
export const billingStateSchema = z.object({
  billingEnabled: z.boolean(),
  status: z.enum([
    "none",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "comped",
  ]),
  slots: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  usedSlots: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  trialEndsAt: z.iso.datetime({ offset: true }).nullable(),
  onboardingFlowVersion: z.number().int().nonnegative().nullable(),
  locked: z.boolean(),
});
export type BillingState = z.infer<typeof billingStateSchema>;

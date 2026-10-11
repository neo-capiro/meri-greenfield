import { z } from "zod";

export const syncProviderSchema = z.enum(["microsoft_365", "google_workspace"]);
export const calendarConnectionSchema = z.object({
  id: z.uuid(),
  provider: z.enum([
    "microsoft_365",
    "google_workspace",
    "imap_caldav",
    "manual",
  ]),
  accountEmail: z.string().nullable(),
  displayName: z.string().nullable(),
  status: z.enum(["connected", "error", "needs_configuration", "disabled"]),
  createdByUserId: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
});
export const calendarConnectionsSchema = z.array(calendarConnectionSchema);
export type CalendarConnection = z.infer<typeof calendarConnectionSchema>;
export const syncStatsSchema = z.object({
  scanned: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  pages: z.number().int().min(0).max(12),
  hasMore: z.boolean(),
});
export const syncRangeSchema = z
  .object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .refine((range) => Date.parse(range.to) > Date.parse(range.from), {
    message: "The end must be after the start.",
  });
export type CalendarSyncRange = z.infer<typeof syncRangeSchema>;
export const syncIntentSchema = z
  .object({
    connectionId: z.uuid(),
    provider: syncProviderSchema,
    range: syncRangeSchema.optional(),
  })
  .refine((intent) => !intent.range || intent.provider === "microsoft_365", {
    message: "Google sync does not accept a date range.",
  });
export type CalendarSyncIntent = z.infer<typeof syncIntentSchema>;
export type CalendarSyncReceipt =
  | {
      kind: "connection";
      connectionId: string;
      calendar: z.infer<typeof syncStatsSchema>;
    }
  | { kind: "window"; calendar: z.infer<typeof syncStatsSchema> };
export type CalendarSyncAttempt =
  | { status: "idle" }
  | { status: "pending" | "unknown"; intent: CalendarSyncIntent }
  | {
      status: "completed";
      intent: CalendarSyncIntent;
      receipt: CalendarSyncReceipt;
    };
/** An actor-wide fence: remounting or choosing another connection cannot retry uncertainty. */
export const syncAttemptKey = (tenantId: string, userId: string) =>
  ["calendar-sync-attempt", tenantId, userId] as const;

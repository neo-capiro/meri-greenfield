import { z } from "zod";

/** Verified engagement capabilities. Provider/tenant readiness remains server-enforced. */
export const calendarCapabilitiesSchema = z.object({
  meetingPrepComprehensiveEnabled: z.boolean().optional(),
  runtime: z.object({ externalActionsEnabled: z.boolean() }).optional(),
});
export type CalendarCapabilities = z.infer<typeof calendarCapabilitiesSchema>;

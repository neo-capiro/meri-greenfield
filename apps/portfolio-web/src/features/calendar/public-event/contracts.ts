import { z } from "zod";

const hearingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  chamber: z.string(),
  committeeName: z.string().nullable(),
  calendarDate: z.string().nullable(),
  scheduledStart: z.string().nullable(),
  time: z.string().nullable(),
  timeZone: z.string().nullable(),
  eventStatus: z.string(),
  eventType: z.string().nullable(),
  visibility: z.string(),
  timePrecision: z.string().nullish(),
});
export const publicEventEnvelope = z.object({
  hearing: hearingSchema,
  followState: z.unknown().optional(),
  attendanceState: z.unknown().optional(),
  clientRelevance: z.unknown().optional(),
});
export const followStateSchema = z.object({
  hearingId: z.string().min(1),
  following: z.boolean(),
  createdCaptureDemand: z.literal(false),
});
export const attendanceSchema = z.object({
  state: z.enum([
    "AUTOMATIC_AVAILABLE",
    "AUTOMATIC_PENDING_PREFLIGHT",
    "BROWSER_ONLY",
    "NO_PUBLIC_STREAM",
    "CLOSED_SESSION",
    "NOT_ELIGIBLE",
    "SCHEDULED",
    "CAPTURING",
    "PROCESSING",
    "COMPLETE",
    "FAILED",
  ]),
  reasonCode: z.string(),
  message: z.string(),
  scheduled: z.boolean(),
});
const relevanceClientSchema = z.object({
  hearingId: z.string().min(1),
  clientId: z.string().min(1),
  clientName: z.string().nullable(),
  band: z.enum(["HIGH", "MEDIUM", "LOW", "NONE", "INSUFFICIENT_EVIDENCE"]),
});
const relevanceSchema = z.union([
  z.object({
    hearingId: z.string().min(1),
    scope: z.literal("all-clients"),
    clients: z.array(relevanceClientSchema),
  }),
  relevanceClientSchema,
]);
export type PublicEvent = {
  hearing: z.infer<typeof hearingSchema>;
  follow: z.infer<typeof followStateSchema> | null;
  attendance: z.infer<typeof attendanceSchema> | null;
  clients: z.infer<typeof relevanceClientSchema>[] | null;
};

/** Partial tenant projections are explicitly unavailable, never inferred from another rail. */
export function projectPublicEvent(
  envelope: z.infer<typeof publicEventEnvelope>,
  clientId?: string,
): PublicEvent {
  const id = envelope.hearing.id;
  const follow = followStateSchema.safeParse(envelope.followState);
  const attendance = attendanceSchema.safeParse(envelope.attendanceState);
  const relevance = relevanceSchema.safeParse(envelope.clientRelevance);
  let clients: PublicEvent["clients"] = null;
  if (relevance.success && relevance.data.hearingId === id) {
    const result = relevance.data;
    if (
      "clients" in result &&
      !clientId &&
      result.clients.every((client) => client.hearingId === id) &&
      new Set(result.clients.map((client) => client.clientId)).size ===
        result.clients.length
    )
      clients = result.clients;
    if (!("clients" in result) && clientId === result.clientId)
      clients = [result];
  }
  return {
    hearing: envelope.hearing,
    follow: follow.success && follow.data.hearingId === id ? follow.data : null,
    attendance: attendance.success ? attendance.data : null,
    clients,
  };
}

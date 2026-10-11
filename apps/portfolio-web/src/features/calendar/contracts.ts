import { z } from "zod";
import { preparationSchema } from "./preparation/schema";
export { prepItemSchema } from "./preparation/schema";
export const meetingSchema = z
  .object({
    id: z.string(),
    subject: z.string(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    startsAt: z.string(),
    endsAt: z.string(),
    status: z.string(),
    joinLink: z.string().nullable(),
    visibility: z.enum(["private", "shared"]),
    isVirtual: z.boolean(),
    meri: z.string().nullable(),
    client: z.object({ id: z.string(), name: z.string() }).nullable(),
    attendees: z.array(
      z.object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        role: z.string().nullable(),
      }),
    ),
    preps: z.array(preparationSchema),
  })
  .superRefine((meeting, ctx) => {
    meeting.preps.forEach((prep, index) => {
      if (prep.meetingId !== undefined && prep.meetingId !== meeting.id) {
        ctx.addIssue({
          code: "custom",
          path: ["preps", index, "meetingId"],
          message: "Preparation belongs to another meeting",
        });
      }
      if (
        prep.clientId !== undefined &&
        prep.clientId !== (meeting.client?.id ?? null)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["preps", index, "clientId"],
          message: "Preparation belongs to another client",
        });
      }
    });
  });
export type Meeting = z.infer<typeof meetingSchema>;
export const hearingSchema = z.object({
  id: z.string(),
  canonicalEventId: z.string().nullish(),
  title: z.string(),
  date: z.string(),
  startsAt: z.string().nullable(),
  timezone: z.string(),
  eventStatus: z.string(),
  officialPageUrl: z.string().nullable(),
});
export const hearingPageSchema = z.object({
  rows: z.array(hearingSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  archived: z.boolean(),
  dueOn: z.string().nullable(),
  startOn: z.string().nullable(),
  dueTime: z.string().nullish(),
  startTime: z.string().nullish(),
  timeZone: z.string().nullish(),
  clientId: z.string().nullable(),
});
export const taskPageSchema = z.object({
  items: z.array(taskSchema),
  nextCursor: z.string().nullable(),
});
export const deadlineSchema = z.object({
  id: z.string(),
  documentNumber: z.string(),
  title: z.string(),
  commentEndDate: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  htmlUrl: z.string().nullable(),
});
export type CalendarKind =
  | "meeting"
  | "hearing"
  | "planner"
  | "deadline"
  | "government";
export interface CalendarItem {
  key: string;
  kind: CalendarKind;
  sourceId: string;
  title: string;
  day: string;
  startAt?: string;
  endAt?: string;
  timeZone: string;
  clientId?: string;
  status?: string;
  href?: string;
  provenance: string;
}
export interface CalendarFeed {
  items: CalendarItem[];
  limitations: string[];
}
export const noteSchema = z.object({
  id: z.string(),
  body: z.string().nullable(),
  restricted: z.boolean(),
  confidential: z.boolean(),
  status: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sharedAt: z.string().nullable().optional(),
});

import { z } from "zod";
import { Temporal } from "temporal-polyfill";
import { validDay, type CalendarZone } from "../range";

export const PAGE_SIZE = 50;
export const libraryFiltersSchema = z
  .object({
    search: z.string().trim().max(160).default(""),
    artifactType: z.enum(["", "prep", "notes", "debrief"]).default(""),
    visibility: z.enum(["", "private", "shared"]).default(""),
    from: z
      .string()
      .refine(
        (value) => !value || Boolean(validDay(value)),
        "Enter a valid start date.",
      )
      .default(""),
    to: z
      .string()
      .refine(
        (value) => !value || Boolean(validDay(value)),
        "Enter a valid end date.",
      )
      .default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "The end date must be on or after the start date.",
  );
export type LibraryFilters = z.infer<typeof libraryFiltersSchema>;
export const filterParams = {
  search: "librarySearch",
  artifactType: "libraryType",
  visibility: "libraryVisibility",
  from: "libraryFrom",
  to: "libraryTo",
  page: "libraryPage",
} as const;
export function readLibraryFilters(params: Pick<URLSearchParams, "get">) {
  return libraryFiltersSchema.safeParse(
    Object.fromEntries(
      Object.entries(filterParams).map(([key, value]) => [
        key,
        params.get(value) ?? (key === "page" ? 1 : ""),
      ]),
    ),
  );
}
export function libraryBounds(filters: LibraryFilters, zone: CalendarZone) {
  const start = (day: string) =>
    Temporal.PlainDate.from(day)
      .toZonedDateTime({ timeZone: zone })
      .toInstant()
      .toString();
  return {
    from: filters.from ? start(filters.from) : undefined,
    to: filters.to
      ? start(Temporal.PlainDate.from(filters.to).add({ days: 1 }).toString())
      : undefined,
  };
}
export const libraryMeetingSchema = z.object({
  id: z.string().uuid(),
  subject: z.string(),
  startsAt: z.string().datetime({ offset: true }),
  client: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  visibility: z.enum(["private", "shared"]),
  libraryQualifiedBy: z
    .array(
      z.object({
        kind: z.enum(["prep", "notes", "debrief"]),
        current: z.boolean(),
      }),
    )
    .min(1),
});
export type LibraryMeeting = z.infer<typeof libraryMeetingSchema>;
export const libraryPageSchema = z.object({
  data: z.array(libraryMeetingSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100),
});
export function materialsLabel(row: LibraryMeeting) {
  const labels = { prep: "Prep", notes: "Notes", debrief: "Debrief" };
  return row.libraryQualifiedBy
    .map(
      ({ kind, current }) =>
        `${current ? "" : "Previously approved · "}${labels[kind]}`,
    )
    .join(" · ");
}
export const extractionSchema = z.object({
  attachmentId: z.string().uuid(),
  text: z.string().min(1),
  // Audio transcription omits this field; absence is not proof of completeness.
  truncated: z.boolean().optional(),
  disclosure: z.string().optional(),
});
export type ExtractedMeetingSource = z.infer<typeof extractionSchema>;

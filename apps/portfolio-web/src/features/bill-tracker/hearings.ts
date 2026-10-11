import { z } from "zod";
import type { ApiClient } from "@/shared/api/http";
import { ApiError } from "@/shared/api/http";
import type { TrackerBackend } from "@/shared/config/config";

const mentionSchema = z
  .object({
    segmentId: z.string().min(1).nullable(),
    timestampMs: z.number().finite().nonnegative().nullable(),
    speakerName: z.string().nullable(),
    quote: z.string().nullable(),
    quoteSource: z.string().optional(),
    issueTags: z.array(z.string()),
  })
  .refine(
    (mention) => mention.quoteSource !== "encrypted" || mention.quote === null,
    "Encrypted quotes must remain pointers",
  );
export const billHearingsSchema = z
  .object({
    count: z.number().int().nonnegative(),
    hearings: z.array(
      z.object({
        sessionId: z.string().min(1),
        // Older deployed responses may lack this field. Never substitute sessionId.
        hearingId: z.string().min(1).nullable().optional(),
        title: z.string().nullable(),
        occurredAt: z.string().nullable(),
        committeeId: z.string().nullable(),
        mentions: z.array(mentionSchema),
      }),
    ),
  })
  .refine(
    (response) =>
      response.count === response.hearings.length &&
      new Set(response.hearings.map((row) => row.sessionId)).size ===
        response.hearings.length,
    "Inconsistent hearing response",
  );
export type BillHearing = z.infer<
  typeof billHearingsSchema
>["hearings"][number];

export function fetchBillHearings(
  api: ApiClient,
  clientId: string,
  billId: string,
  backend: TrackerBackend,
  signal?: AbortSignal,
) {
  if (backend !== "intelligence")
    throw new ApiError(
      404,
      "Hearing links are not available for the configured tracker.",
    );
  if (!clientId.trim() || !billId.trim())
    throw new ApiError(400, "Select a client and bill.");
  return api.request(
    "intelligence",
    `clients/${encodeURIComponent(clientId)}/bills/${encodeURIComponent(billId)}/hearings`,
    billHearingsSchema,
    { signal },
  );
}

export function billDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (
    Number.isNaN(date.getTime()) ||
    (dateOnly && date.toISOString().slice(0, 10) !== value)
  )
    return undefined;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  }).format(date);
}

export function mentionTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function hearingHref(
  existingApp: string | undefined,
  hearingId: string | null | undefined,
): string | undefined {
  return existingApp && hearingId
    ? `${existingApp.replace(/\/+$/, "")}/legiwatch/hearings/${encodeURIComponent(hearingId)}`
    : undefined;
}
export function fullBoardHref(
  existingApp: string | undefined,
  clientId: string,
): string | undefined {
  return existingApp
    ? `${existingApp.replace(/\/+$/, "")}/legiwatch?tab=bills&client=${encodeURIComponent(clientId)}`
    : undefined;
}

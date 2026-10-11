import { ApiError, queryString, type ApiClient } from "@/shared/api/http";
import { meetingSchema, type Meeting } from "../contracts";
import type { CalendarZone } from "../range";
import {
  extractionSchema,
  libraryBounds,
  libraryPageSchema,
  PAGE_SIZE,
  type LibraryFilters,
} from "./contracts";

export async function readLibrary(
  api: ApiClient,
  filters: LibraryFilters,
  zone: CalendarZone,
  clientId?: string,
  signal?: AbortSignal,
) {
  const query = queryString({
    clientId,
    search: filters.search || undefined,
    artifactType: filters.artifactType || undefined,
    visibility: filters.visibility || undefined,
    ...libraryBounds(filters, zone),
    page: filters.page,
    limit: PAGE_SIZE,
  });
  return api.request(
    "core",
    `engagement/meetings/library?${query}`,
    libraryPageSchema.refine(
      (result) =>
        result.page === filters.page &&
        result.limit === PAGE_SIZE &&
        result.data.length <= PAGE_SIZE &&
        new Set(result.data.map((row) => row.id)).size === result.data.length &&
        (!clientId || result.data.every((row) => row.client?.id === clientId)),
      {
        message:
          "Meeting library receipt does not match the requested scope or page",
      },
    ),
    { signal },
  );
}
export class AssignmentConflict extends ApiError {
  constructor(public readonly current: Meeting) {
    super(
      409,
      "This meeting's client or sharing changed. Review its current assignment before saving.",
    );
  }
}
export async function assignMeeting(
  api: ApiClient,
  reviewed: Meeting,
  clientId: string | null,
  beforeDispatch?: () => void,
) {
  const path = `engagement/meetings/${encodeURIComponent(reviewed.id)}`;
  const current = await api.request(
    "core",
    path,
    meetingSchema.refine((row) => row.id === reviewed.id),
  );
  if (
    current.client?.id !== reviewed.client?.id ||
    current.visibility !== reviewed.visibility
  )
    throw new AssignmentConflict(current);
  beforeDispatch?.();
  return api.request(
    "core",
    path,
    meetingSchema.refine(
      (row) =>
        row.id === reviewed.id &&
        (row.client?.id ?? null) === clientId &&
        ((reviewed.client?.id ?? null) === clientId ||
          row.visibility === "private"),
    ),
    { method: "PUT", body: { clientId } },
  );
}
export function extractMeetingSource(api: ApiClient, attachmentId: string) {
  return api.request(
    "core",
    `engagement/attachments/${encodeURIComponent(attachmentId)}/extract-text`,
    extractionSchema.refine(
      (result) =>
        result.attachmentId === attachmentId && Boolean(result.text.trim()),
    ),
    { method: "POST" },
  );
}

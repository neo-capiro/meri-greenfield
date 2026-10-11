import type { ApiClient } from "@/shared/api/http";
import { ApiError, queryString } from "@/shared/api/http";
import { publicEventEnvelope, projectPublicEvent } from "./contracts";

/** Calendar supplies canonical committee-hearing row IDs, never capture/session/dedupe IDs. */
export async function readPublicEvent(
  api: ApiClient,
  eventId: string,
  clientId?: string,
  signal?: AbortSignal,
) {
  if (!eventId.trim() || (clientId !== undefined && !clientId.trim()))
    throw new ApiError(
      400,
      "Select a public proceeding and valid client scope.",
    );
  const query = queryString({ clientId });
  const data = await api.request(
    "core",
    `legiwatch/live-hearings/events/${encodeURIComponent(eventId)}/detail-v2${query ? `?${query}` : ""}`,
    publicEventEnvelope,
    { signal },
  );
  if (data.hearing.id !== eventId)
    throw new ApiError(
      409,
      "This calendar entry no longer identifies the same canonical proceeding. Refresh the calendar before opening it again.",
    );
  return projectPublicEvent(data, clientId);
}

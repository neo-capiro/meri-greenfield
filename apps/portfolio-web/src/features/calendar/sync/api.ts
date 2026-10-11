import { z } from "zod";
import { ApiError, queryString, type ApiClient } from "@/shared/api/http";
import {
  calendarConnectionsSchema,
  syncIntentSchema,
  syncStatsSchema,
  type CalendarSyncIntent,
  type CalendarSyncReceipt,
} from "./contracts";

export async function fetchOwnedCalendarConnections(
  api: ApiClient,
  userId: string,
  signal?: AbortSignal,
) {
  const connections = await api.request(
    "core",
    "engagement/integrations",
    calendarConnectionsSchema,
    { signal },
  );
  if (!userId || connections.some((item) => item.createdByUserId !== userId))
    throw new ApiError(
      502,
      "The service returned an account outside the current caller's scope.",
    );
  return connections;
}

export class CalendarSyncError extends Error {
  constructor(
    public readonly uncertain: boolean,
    message: string,
  ) {
    super(message);
    this.name = "CalendarSyncError";
  }
}

/** No retries: a failed response can follow committed calendar pages. */
export async function runCalendarSync(
  api: ApiClient,
  input: CalendarSyncIntent,
  userId: string,
  assertCurrent: () => void,
  beforeDispatch: (intent: CalendarSyncIntent) => void,
  signal?: AbortSignal,
): Promise<CalendarSyncReceipt> {
  let dispatched = false;
  try {
    const intent = syncIntentSchema.parse(input);
    assertCurrent();
    const accounts = await fetchOwnedCalendarConnections(api, userId, signal);
    assertCurrent();
    const connection = accounts.find(
      (account) => account.id === intent.connectionId,
    );
    if (
      !connection ||
      connection.provider !== intent.provider ||
      connection.status !== "connected"
    )
      throw new ApiError(
        409,
        "This connected account changed. Refresh and review it again.",
      );
    const provider =
      intent.provider === "microsoft_365" ? "microsoft" : "google";
    const path = `engagement/integrations/${provider}/${encodeURIComponent(intent.connectionId)}`;
    assertCurrent();
    beforeDispatch(intent);
    dispatched = true;
    if (intent.range) {
      const calendar = await api.request(
        "core",
        `${path}/calendar-window?${queryString(intent.range)}`,
        syncStatsSchema,
        { method: "POST", signal },
      );
      assertCurrent();
      // This route returns bare statistics, not a connection/range-bound receipt.
      return { kind: "window", calendar };
    }
    const result = await api.request(
      "core",
      `${path}/sync?calendar=1&mail=0`,
      z.object({
        connectionId: z.uuid().refine((id) => id === intent.connectionId),
        calendar: syncStatsSchema,
      }),
      { method: "POST", signal },
    );
    assertCurrent();
    return { kind: "connection", ...result };
  } catch (error) {
    throw new CalendarSyncError(
      dispatched,
      dispatched
        ? "The sync outcome is unknown. Meetings may already have been imported. Do not repeat this request."
        : error instanceof Error
          ? error.message
          : "The account could not be reviewed.",
    );
  }
}

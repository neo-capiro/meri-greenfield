import { ApiError, type ApiClient } from "@/shared/api/http";
import { meetingSchema, type Meeting } from "../contracts";
import {
  botSessionSchema,
  dispatchSchema,
  preferenceSchema,
  recordingConsentSchema,
  removable,
  progressing,
  type AttendancePreference,
  type BotSession,
  type DispatchConsent,
  type RecordingConsent,
} from "./contracts";

const meetingPath = (id: string) =>
  `engagement/meetings/${encodeURIComponent(id)}`;
const preferencePath = (id: string) =>
  `engagement/clients/${encodeURIComponent(id)}/notetaker`;
export function readSession(
  api: ApiClient,
  meetingId: string,
  signal?: AbortSignal,
) {
  return api.request(
    "core",
    `${meetingPath(meetingId)}/notetaker`,
    botSessionSchema.refine((row) => row.meetingId === meetingId).nullable(),
    { signal },
  );
}
export function readPreference(
  api: ApiClient,
  clientId: string,
  signal?: AbortSignal,
) {
  return api.request("core", preferencePath(clientId), preferenceSchema, {
    signal,
  });
}
export class AttendanceConflict extends ApiError {
  constructor(message: string) {
    super(409, message);
  }
}
export class AttendanceUncertain extends ApiError {
  constructor(public readonly cause: unknown) {
    super(
      cause instanceof ApiError ? cause.status : 0,
      "Completion is unknown. Refresh the current status before taking another action. This request will not be retried automatically.",
    );
  }
}
async function uncertainWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500)
      throw new AttendanceUncertain(error);
    throw error;
  }
}

export async function sendMeri(
  api: ApiClient,
  reviewed: Meeting,
  input: DispatchConsent,
  guard: () => void,
  now = Date.now(),
) {
  const values = dispatchSchema.parse(input);
  const current = await api.request(
    "core",
    meetingPath(reviewed.id),
    meetingSchema.refine((row) => row.id === reviewed.id),
  );
  if (
    current.client?.id !== reviewed.client?.id ||
    current.startsAt !== reviewed.startsAt ||
    current.joinLink !== reviewed.joinLink ||
    current.status !== reviewed.status
  )
    throw new AttendanceConflict(
      "This meeting changed. Close this form and review the current meeting before sending Meri.",
    );
  if (
    ["cancelled", "canceled", "deleted"].includes(
      current.status.trim().toLowerCase(),
    )
  )
    throw new ApiError(422, "Meri cannot join a cancelled or deleted meeting.");
  const latest = await readSession(api, reviewed.id);
  if (progressing(latest))
    throw new AttendanceConflict(
      "A Meri session already exists. Refresh its status before taking another action.",
    );
  if (!Number.isFinite(Date.parse(current.startsAt)))
    throw new ApiError(
      422,
      "The meeting start time is unavailable. Review the meeting before sending Meri.",
    );
  guard();
  return uncertainWrite(() =>
    api.request(
      "core",
      `${meetingPath(reviewed.id)}/notetaker`,
      botSessionSchema.refine(
        (row) =>
          row.meetingId === reviewed.id &&
          row.clientId === (current.client?.id ?? null),
      ),
      {
        method: "POST",
        body: {
          ...values,
          recordingPolicy: "transcript_only",
          ...(Date.parse(current.startsAt) > now
            ? { joinAt: current.startsAt }
            : {}),
        },
      },
    ),
  );
}
export async function removeMeri(
  api: ApiClient,
  meetingId: string,
  reviewed: BotSession,
  guard: () => void,
) {
  const current = await readSession(api, meetingId);
  if (!current || current.id !== reviewed.id || !removable(current))
    throw new AttendanceConflict(
      "The Meri session changed. Refresh status before requesting removal.",
    );
  guard();
  return uncertainWrite(() =>
    api.request(
      "core",
      `${meetingPath(meetingId)}/notetaker`,
      botSessionSchema.refine(
        (row) =>
          row.meetingId === meetingId &&
          row.id === reviewed.id &&
          !removable(row),
      ),
      { method: "DELETE" },
    ),
  );
}
export async function changePreference(
  api: ApiClient,
  clientId: string,
  reviewed: AttendancePreference,
  enabled: boolean,
  consent: RecordingConsent | undefined,
  guard: () => void,
) {
  if (enabled) recordingConsentSchema.parse(consent);
  const current = await readPreference(api, clientId);
  if (
    current.enabled !== reviewed.enabled ||
    current.stopping !== reviewed.stopping
  )
    throw new AttendanceConflict(
      "Automatic attendance changed. Refresh and review the current setting before saving.",
    );
  if (enabled && current.stopping)
    throw new ApiError(
      409,
      "Meri is still leaving a meeting. Refresh before enabling automatic attendance.",
    );
  guard();
  return uncertainWrite(() =>
    api.request(
      "core",
      preferencePath(clientId),
      preferenceSchema.refine((row) => row.enabled === enabled),
      {
        method: enabled ? "POST" : "DELETE",
        ...(enabled
          ? {
              body: {
                authorizedToRecord: true,
                allPartiesWillBeNotified: true,
              },
            }
          : {}),
      },
    ),
  );
}

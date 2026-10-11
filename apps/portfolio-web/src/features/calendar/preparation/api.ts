import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import {
  boardMappingSchema,
  preparationSchema,
  prepJobSchema,
  type PrepJob,
  type Preparation,
  type PrepDepth,
} from "./schema";

export const meetingPath = (id: string) =>
  `engagement/meetings/${encodeURIComponent(id)}`;
export function checkJob(
  job: PrepJob | null,
  meetingId: string,
  jobId?: string,
) {
  if (job && (job.meetingId !== meetingId || (jobId && job.jobId !== jobId)))
    throw new ApiError(
      502,
      "Preparation status belongs to a different meeting. Refresh this meeting.",
    );
  return job;
}
export function checkPreparation(
  prep: Preparation,
  meetingId: string,
  prepId?: string,
  clientId?: string | null,
) {
  if (
    (prep.meetingId && prep.meetingId !== meetingId) ||
    (prepId && prep.id !== prepId) ||
    (clientId !== undefined && prep.clientId !== clientId)
  )
    throw new ApiError(
      502,
      "Preparation receipt did not match this meeting. Refresh to check the saved content.",
    );
  return prep;
}
export async function readJob(
  api: ApiClient,
  meetingId: string,
  signal?: AbortSignal,
) {
  return checkJob(
    await api.request(
      "core",
      `${meetingPath(meetingId)}/prep-jobs/latest`,
      prepJobSchema.nullable(),
      { signal },
    ),
    meetingId,
  );
}
export interface GenerateInput {
  requestKey: string;
  depth: PrepDepth;
  additionalContext: string;
}
export async function generatePreparation(
  api: ApiClient,
  meetingId: string,
  input: GenerateInput,
  clientId?: string | null,
) {
  const body = { ...input, additionalContext: input.additionalContext.trim() };
  const result = await api.request(
    "core",
    `${meetingPath(meetingId)}/prep`,
    z.union([
      prepJobSchema,
      preparationSchema.extend({
        meetingId: z.string(),
        clientId: z.string().nullable(),
      }),
    ]),
    { method: "POST", body },
  );
  return "jobId" in result
    ? checkJob(result, meetingId)
    : checkPreparation(result, meetingId, undefined, clientId);
}
export async function changeJob(
  api: ApiClient,
  meetingId: string,
  jobId: string,
  action: "cancel" | "resume",
) {
  const result = await api.request(
    "core",
    `${meetingPath(meetingId)}/prep-jobs/${encodeURIComponent(jobId)}${action === "resume" ? "/resume" : ""}`,
    prepJobSchema.nullable(),
    { method: action === "resume" ? "POST" : "DELETE" },
  );
  if (!result)
    throw new ApiError(
      503,
      "Preparation status is unavailable. Check status before trying again.",
    );
  return checkJob(result, meetingId, jobId);
}
export type EditPreparation = Partial<Pick<Preparation, "summary">> &
  Partial<
    Record<
      "agenda" | "talkingPoints" | "risks" | "followUps" | "emailEvidence",
      string[]
    >
  >;
export async function savePreparation(
  api: ApiClient,
  meetingId: string,
  prepId: string,
  body: EditPreparation,
  clientId?: string | null,
) {
  return checkPreparation(
    await api.request(
      "core",
      `engagement/meeting-preps/${encodeURIComponent(prepId)}`,
      preparationSchema.extend({
        meetingId: z.string(),
        clientId: z.string().nullable(),
      }),
      { method: "PATCH", body },
    ),
    meetingId,
    prepId,
    clientId,
  );
}
export async function readBoards(
  api: ApiClient,
  meetingId: string,
  clientId: string,
  signal?: AbortSignal,
) {
  const result = await api.request(
    "core",
    `${meetingPath(meetingId)}/prep-monday-mapping`,
    boardMappingSchema.nullable(),
    { signal },
  );
  if (!result)
    throw new ApiError(503, "Board settings are currently unavailable.");
  if (result.clientId !== clientId)
    throw new ApiError(
      409,
      "The meeting client changed. Reopen this meeting before saving board settings.",
    );
  return result;
}
export async function saveBoards(
  api: ApiClient,
  meetingId: string,
  clientId: string,
  boardIds: string[],
) {
  const result = await api.request(
    "core",
    `${meetingPath(meetingId)}/prep-monday-mapping`,
    boardMappingSchema,
    { method: "PUT", body: { boardIds } },
  );
  if (
    result.clientId !== clientId ||
    JSON.stringify(result.boardIds) !== JSON.stringify(boardIds)
  )
    throw new ApiError(
      409,
      "Board settings receipt did not match. Reload the settings before continuing.",
    );
  return result;
}

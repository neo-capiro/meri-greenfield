import { ApiError, type ApiClient } from "@/shared/api/http";
import { z } from "zod";
import {
  currentSchema,
  writeSchema,
  versionsSchema,
  versionSchema,
  refreshSchema,
  resolutionSchema,
  type Citation,
  type Sections,
} from "./contracts";

const path = (id: string) =>
  `business-development/prospects/${encodeURIComponent(id)}/brief`;
export type BriefScope = { prospectId: string; tenantId: string };
function assertScope(
  scope: BriefScope,
  brief: { prospectId: string; tenantId: string },
) {
  if (
    scope.prospectId !== brief.prospectId ||
    scope.tenantId !== brief.tenantId
  )
    throw new ApiError(
      502,
      "The saved brief did not match this prospect and account.",
    );
}
export async function readBrief(
  api: ApiClient,
  scope: BriefScope,
  signal?: AbortSignal,
) {
  const result = await api.request(
    "core",
    path(scope.prospectId),
    currentSchema,
    { signal },
  );
  if (result.brief) assertScope(scope, result.brief);
  return result;
}
export type CreateInput = { idempotencyKey: string; title?: string };
export type SaveInput = CreateInput & {
  expectedVersionNumber: number;
  sections: Sections;
};
const keySchema = z.string().min(8).max(400);
export async function writeBrief(
  api: ApiClient,
  scope: BriefScope,
  input: CreateInput | SaveInput,
) {
  keySchema.parse(input.idempotencyKey);
  const editing = "expectedVersionNumber" in input;
  const result = await api.request(
    "core",
    `${path(scope.prospectId)}/versions`,
    writeSchema,
    { method: editing ? "PUT" : "POST", body: input },
  );
  assertScope(scope, result.brief);
  const expected = editing ? input.expectedVersionNumber + 1 : 1;
  if (
    result.version.versionNumber !== expected ||
    (result.created && result.brief.currentVersionId !== result.version.id)
  )
    throw new ApiError(
      502,
      "The saved version receipt did not match this operation. Check saved status before retrying.",
    );
  return result;
}
export async function listVersions(
  api: ApiClient,
  scope: BriefScope,
  signal?: AbortSignal,
) {
  const result = await api.request(
    "core",
    `${path(scope.prospectId)}/versions`,
    versionsSchema,
    { signal },
  );
  assertScope(scope, result.brief);
  return result;
}
export async function readVersion(
  api: ApiClient,
  prospectId: string,
  number: number,
  expectedId: string,
  signal?: AbortSignal,
) {
  const result = await api.request(
    "core",
    `${path(prospectId)}/versions/${number}`,
    versionSchema,
    { signal },
  );
  if (result.versionNumber !== number || result.id !== expectedId)
    throw new ApiError(
      502,
      "The saved version did not match the selected history entry.",
    );
  return result;
}
export async function readRefresh(
  api: ApiClient,
  prospectId: string,
  number: number,
  signal?: AbortSignal,
) {
  const result = await api.request(
    "core",
    `${path(prospectId)}/refresh-proposal`,
    refreshSchema,
    { signal },
  );
  if (result.baseVersionNumber !== number)
    throw new ApiError(
      409,
      "The saved version changed. Reopen the latest brief before comparing a refresh.",
    );
  return result;
}
export async function resolveCitation(
  api: ApiClient,
  prospectId: string,
  index: number,
  expected: Citation,
  signal?: AbortSignal,
) {
  const result = await api.request(
    "core",
    `${path(prospectId)}/citations?index=${index}`,
    resolutionSchema,
    { signal },
  );
  if (
    result.citation &&
    JSON.stringify(result.citation) !== JSON.stringify(expected)
  )
    throw new ApiError(
      409,
      "The current citation changed. Reopen the latest saved version before checking this source.",
    );
  return result;
}

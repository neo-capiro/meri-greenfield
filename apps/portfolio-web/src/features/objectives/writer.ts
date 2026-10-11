import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import {
  emptyFields,
  objectiveFieldsSchema,
  objectiveSchema,
  type Objective,
  type ObjectiveFields,
} from "./contracts";
export type ObjectiveAction = "save" | "request_review" | "confirm_ready";
export interface SaveObjective {
  fields: ObjectiveFields;
  record?: Objective;
  requestId: string;
}
const fieldKeys = Object.keys(emptyFields) as (keyof ObjectiveFields)[];
const sameFields = (left: ObjectiveFields, right: ObjectiveFields) =>
  fieldKeys.every((key) => left[key] === right[key]);
function assertClient(record: Objective, clientId: string) {
  if (record.clientId !== clientId)
    throw new ApiError(
      409,
      "This objective belongs to a different client. Refresh before continuing.",
    );
}
function assertReceipt(valid: boolean) {
  if (!valid)
    throw new ApiError(
      502,
      "The service did not confirm this exact objective operation. Refresh Objectives before continuing.",
    );
}
// Persistence and lifecycle are distinct calls. Retain the saved record before a
// transition, so a failed transition cannot cause another create on retry.
export async function saveObjective(
  api: ApiClient,
  clientId: string,
  input: SaveObjective,
  action: ObjectiveAction,
  onPersisted: (record: Objective) => void,
) {
  const parsed = objectiveFieldsSchema.parse(input.fields);
  const { record, requestId } = input;
  if (record) assertClient(record, clientId);
  const base = `clients/${clientId}/objectives`;
  const changed = !record || !sameFields(parsed, record);
  const saved = changed
    ? await api.request(
        "core",
        record ? `${base}?objectiveId=${encodeURIComponent(record.id)}` : base,
        objectiveSchema,
        {
          method: record ? "PATCH" : "POST",
          body: record
            ? { ...parsed, expectedVersion: record.version }
            : { ...parsed, requestId },
        },
      )
    : record;
  assertReceipt(
    saved.clientId === clientId &&
      saved.requestId === (record?.requestId ?? requestId) &&
      sameFields(saved, parsed) &&
      (!record ||
        (saved.id === record.id &&
          saved.ownerUserId === record.ownerUserId &&
          saved.version === record.version + (changed ? 1 : 0) &&
          (!changed || saved.status === "draft"))),
  );
  onPersisted(saved);
  if (
    action === "save" ||
    (action === "confirm_ready" && saved.status === "ready") ||
    (action === "request_review" && saved.status === "in_review")
  )
    return saved;
  const transitioned = await api.request(
    "core",
    `${base}/transition?objectiveId=${encodeURIComponent(saved.id)}`,
    objectiveSchema,
    { method: "POST", body: { action, expectedVersion: saved.version } },
  );
  assertReceipt(
    transitioned.id === saved.id &&
      transitioned.clientId === clientId &&
      transitioned.requestId === saved.requestId &&
      transitioned.ownerUserId === saved.ownerUserId &&
      transitioned.version === saved.version + 1 &&
      transitioned.status ===
        (action === "confirm_ready" ? "ready" : "in_review") &&
      sameFields(transitioned, saved),
  );
  return transitioned;
}

export async function deleteObjective(
  api: ApiClient,
  clientId: string,
  objective: Objective,
) {
  assertClient(objective, clientId);
  return api.request(
    "core",
    `clients/${clientId}/objectives?objectiveId=${encodeURIComponent(objective.id)}`,
    z.object({
      id: z.literal(objective.id),
      deleted: z.literal(true),
      version: z.literal(objective.version + 1),
    }),
    { method: "DELETE", body: { expectedVersion: objective.version } },
  );
}

import type { ApiClient } from "@/shared/api/http";
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
  const base = `clients/${clientId}/objectives`;
  const changed =
    !record ||
    Object.keys(emptyFields).some(
      (key) =>
        parsed[key as keyof ObjectiveFields] !==
        record[key as keyof ObjectiveFields],
    );
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
  onPersisted(saved);
  if (
    action === "save" ||
    (action === "confirm_ready" && saved.status === "ready") ||
    (action === "request_review" && saved.status === "in_review")
  )
    return saved;
  return api.request(
    "core",
    `${base}/transition?objectiveId=${encodeURIComponent(saved.id)}`,
    objectiveSchema,
    { method: "POST", body: { action, expectedVersion: saved.version } },
  );
}

import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import {
  activityEditSchema,
  activitySchema,
  type Activity,
  type ActivityEdit,
} from "./contracts";
import type { ClientWriter } from "./quick-log/public";

export type ActivityChange =
  | { action: "edit"; fields: ActivityEdit }
  | { action: "pin"; pinned: boolean }
  | { action: "settle"; settled: boolean }
  | { action: "remove" };
const timelineSchema = z
  .array(activitySchema)
  .max(500)
  .refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    "The activity list contains duplicate records.",
  );
const receiptSchema = activitySchema
  .omit({ origin: true })
  .extend({ clientId: z.string(), tenantId: z.string() });
const stableFields = ["kind", "occurredAt", "sourceType", "sourceId"] as const;
const allFields = [
  "title",
  "body",
  "dueAt",
  "settledAt",
  "pinned",
  ...stableFields,
] as const;
const conflict = () =>
  new ApiError(
    409,
    "This activity changed or is no longer available. Review the latest timeline before trying again.",
  );
export async function readActivityForChange(
  api: ApiClient,
  clientId: string,
  guard: () => void,
  signal: AbortSignal,
) {
  guard();
  const rows = await api.request(
    "core",
    `clients/${encodeURIComponent(clientId)}/activity?limit=500`,
    timelineSchema,
    { signal },
  );
  guard();
  return rows;
}
export async function changeActivity(
  api: ApiClient,
  clientId: string,
  actor: ClientWriter,
  expected: Activity,
  change: ActivityChange,
  guard: () => void,
  signal: AbortSignal,
  onDispatch: () => void,
) {
  guard();
  if (expected.origin !== "recorded")
    throw new ApiError(
      400,
      "Open the original record to change this activity.",
    );
  if (change.action === "pin" && expected.kind !== "note")
    throw new ApiError(400, "Only recorded notes can be pinned here.");
  if (change.action === "settle" && !expected.dueAt)
    throw new ApiError(400, "This activity does not have a due date.");
  const fields =
    change.action === "edit"
      ? activityEditSchema.parse(change.fields)
      : undefined;
  const rows = await readActivityForChange(api, clientId, guard, signal);
  const current = rows.find((row) => row.id === expected.id);
  const compare =
    change.action === "remove"
      ? allFields
      : change.action === "edit"
        ? ([...stableFields, "title", "body"] as const)
        : change.action === "pin"
          ? ([...stableFields, "pinned"] as const)
          : ([...stableFields, "dueAt", "settledAt"] as const);
  if (
    !current ||
    current.origin !== "recorded" ||
    compare.some((field) => current[field] !== expected[field])
  )
    throw conflict();
  const path = `clients/${encodeURIComponent(clientId)}/activity/${encodeURIComponent(expected.id)}`;
  guard();
  onDispatch();
  if (change.action === "remove") {
    await api.request("core", path, z.object({ ok: z.literal(true) }), {
      method: "DELETE",
      signal,
    });
    guard();
    return;
  }
  const receipt = await api.request("core", path, receiptSchema, {
    method: "PATCH",
    signal,
    body:
      change.action === "edit"
        ? fields
        : change.action === "pin"
          ? { pinned: change.pinned }
          : { settled: change.settled },
  });
  guard();
  const matches =
    receipt.id === expected.id &&
    receipt.clientId === clientId &&
    receipt.tenantId === actor.tenantId &&
    stableFields.every((field) => receipt[field] === current[field]) &&
    (fields
      ? receipt.title === fields.title && receipt.body === (fields.body || null)
      : change.action === "pin"
        ? receipt.pinned === change.pinned
        : change.action === "settle" &&
          receipt.dueAt === current.dueAt &&
          (change.settled
            ? receipt.settledAt !== null &&
              Number.isFinite(Date.parse(receipt.settledAt))
            : receipt.settledAt === null));
  if (!matches)
    throw new ApiError(
      502,
      "The service did not confirm the requested activity change. Review the latest activity before trying again.",
    );
}

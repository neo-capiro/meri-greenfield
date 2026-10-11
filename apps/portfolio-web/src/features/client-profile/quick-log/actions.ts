import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { activitySchema } from "../contracts";
import {
  quickLogInputSchema,
  quickLogReceiptSchema,
  type QuickLogInput,
  type QuickLogReceipt,
} from "./contracts";
import type { ClientWriter } from "./authority";
export async function createQuickLog(
  api: ApiClient,
  clientId: string,
  actor: ClientWriter,
  input: QuickLogInput,
  guard: () => void,
  signal: AbortSignal,
  dispatched: () => void,
) {
  const body = quickLogInputSchema.parse(input);
  guard();
  signal.throwIfAborted();
  dispatched();
  const receipt = await api.request(
    "core",
    `clients/${encodeURIComponent(clientId)}/activity`,
    quickLogReceiptSchema,
    { method: "POST", body, signal },
  );
  guard();
  if (
    receipt.clientId !== clientId ||
    receipt.tenantId !== actor.tenantId ||
    receipt.createdByUserId !== actor.userId ||
    receipt.actorUserId !== actor.userId ||
    receipt.kind !== body.kind ||
    receipt.title !== body.title ||
    receipt.body !== (body.body || null) ||
    receipt.personId !== (body.personId ?? null) ||
    receipt.pinned ||
    receipt.dueAt !== null ||
    receipt.settledAt !== null ||
    receipt.sourceType !== null ||
    receipt.sourceId !== null
  )
    throw new ApiError(
      502,
      "The saved activity receipt does not match this Quick log. Inspect the timeline before logging again.",
    );
  return receipt;
}
export async function undoQuickLog(
  api: ApiClient,
  receipt: QuickLogReceipt,
  actor: ClientWriter,
  guard: () => void,
  signal: AbortSignal,
  dispatched: () => void,
) {
  quickLogReceiptSchema.parse(receipt);
  if (
    receipt.tenantId !== actor.tenantId ||
    receipt.actorUserId !== actor.userId ||
    receipt.createdByUserId !== actor.userId
  )
    throw new ApiError(
      403,
      "Undo belongs to the session that created this activity.",
    );
  guard();
  const rows = await api.request(
    "core",
    `clients/${encodeURIComponent(receipt.clientId)}/activity?limit=500`,
    z
      .array(activitySchema.extend({ personId: z.uuid().nullable() }))
      .max(500)
      .refine(
        (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
      ),
    { signal },
  );
  guard();
  signal.throwIfAborted();
  const current = rows.find(
    (row) => row.id === receipt.id && row.origin === "recorded",
  );
  if (
    !current ||
    current.kind !== receipt.kind ||
    current.title !== receipt.title ||
    current.body !== receipt.body ||
    Date.parse(current.occurredAt) !== Date.parse(receipt.occurredAt) ||
    current.personId !== receipt.personId ||
    current.pinned !== receipt.pinned ||
    current.dueAt !== receipt.dueAt ||
    current.settledAt !== receipt.settledAt ||
    current.sourceType !== receipt.sourceType ||
    current.sourceId !== receipt.sourceId
  )
    throw new ApiError(
      409,
      "This entry changed or is not visible in the latest 500 timeline items. Open the timeline to review it; Undo was not sent.",
    );
  dispatched();
  await api.request(
    "core",
    `clients/${encodeURIComponent(receipt.clientId)}/activity/${encodeURIComponent(receipt.id)}`,
    z.object({ ok: z.literal(true) }),
    { method: "DELETE", signal },
  );
  guard();
}

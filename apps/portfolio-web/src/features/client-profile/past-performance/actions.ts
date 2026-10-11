import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { loadSubmissions } from "./queries";
import type { SavedSubmission } from "./contracts";
export async function removeSubmission(
  api: ApiClient,
  item: SavedSubmission,
  guard: () => void,
  signal: AbortSignal,
  dispatched: () => void,
) {
  guard();
  const rows = await loadSubmissions(api, item.clientId, item.tenantId, signal);
  guard();
  signal.throwIfAborted();
  const current = rows.find((row) => row.id === item.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(item))
    throw new ApiError(
      409,
      "This submission changed or is not visible in the bounded history feed. Refresh and review it before removing.",
    );
  dispatched();
  await api.request(
    "core",
    `clients/${encodeURIComponent(item.clientId)}/history/${encodeURIComponent(item.id)}`,
    z.object({ deleted: z.literal(true) }),
    { method: "DELETE", signal },
  );
  guard();
}

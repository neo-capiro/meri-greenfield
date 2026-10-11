import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/shared/api/http";
import { billingSummarySchema } from "./summary-contracts";
import { assertBillingReader, type BillingReader } from "./summary-authority";

export const billingSummaryKey = (actor: BillingReader | null) =>
  ["billing", "summary", actor?.tenantId, actor?.userId] as const;

export async function readBillingSummary(
  api: ApiClient,
  cache: QueryClient,
  actor: BillingReader,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  assertBillingReader(cache, actor);
  const summary = await api.request(
    "core",
    "billing/summary",
    billingSummarySchema,
    {
      signal,
    },
  );
  signal.throwIfAborted();
  assertBillingReader(cache, actor);
  return summary;
}

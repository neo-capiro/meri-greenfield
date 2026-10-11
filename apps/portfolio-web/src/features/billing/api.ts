import type { ApiClient } from "@/shared/api/http";
import { billingStateSchema } from "./contracts";
import { assertProfileCapacity } from "./capacity";

export const billingStateKey = ["billing", "state"] as const;
export function readBillingState(api: ApiClient, signal?: AbortSignal) {
  return api.request("core", "billing/state", billingStateSchema, { signal });
}
/** A fresh snapshot, never a reservation or a substitute for server enforcement. */
export async function verifyProfileCapacity(
  api: ApiClient,
  quantity: number,
  assertCurrent: () => void,
  signal?: AbortSignal,
) {
  assertCurrent();
  const state = await readBillingState(api, signal);
  assertCurrent();
  assertProfileCapacity(state, quantity);
  return state;
}

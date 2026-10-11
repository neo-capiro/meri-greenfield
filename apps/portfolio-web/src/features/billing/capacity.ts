import { ApiError } from "@/shared/api/http";
import type { BillingState } from "./contracts";

export function profileCapacity(state: BillingState) {
  if (!state.billingEnabled) return { kind: "unlimited" } as const;
  if (state.locked) return { kind: "locked" } as const;
  if (state.status === "none" || state.status === "canceled")
    return { kind: "subscription-required" } as const;
  if (state.status === "comped") return { kind: "unlimited" } as const;
  // Core's canonical effectiveClientSlots contract gives trials at least ten
  // profiles. past_due keeps its slots until the server publishes a lock.
  const limit =
    state.status === "trialing" ? Math.max(10, state.slots) : state.slots;
  return {
    kind: "limited",
    limit,
    used: state.usedSlots,
    remaining: Math.max(0, limit - state.usedSlots),
  } as const;
}
export function capacityIssue(state: BillingState, quantity = 1) {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    return "Select a valid number of profiles.";
  const capacity = profileCapacity(state);
  if (capacity.kind === "locked")
    return "Your workspace is locked pending payment. Contact your billing administrator.";
  if (capacity.kind === "subscription-required")
    return "A subscription is required to create client profiles. Contact your billing administrator.";
  if (capacity.kind === "limited" && quantity > capacity.remaining)
    return capacity.remaining === 0
      ? "All client slots are in use. Contact your billing administrator to add capacity."
      : `Only ${capacity.remaining} client slot${capacity.remaining === 1 ? " is" : "s are"} available. Reduce your selection or contact your billing administrator.`;
  return null;
}
export function assertProfileCapacity(state: BillingState, quantity = 1) {
  const issue = capacityIssue(state, quantity);
  if (issue) throw new ApiError(402, issue);
}

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BillingSummaryPanel } from "@/features/billing/summary-public";
import { identitySchema, useIdentity } from "@/shared/auth/identity";

// Test-only actor/invalidation probes; product entry is the Add profile chooser.
export function BillingSummaryHarness() {
  const [enabled, setEnabled] = useState(true);
  const cache = useQueryClient();
  const identity = useIdentity();
  useEffect(() => {
    const change = (event: Event) => {
      const parsed = identitySchema.safeParse(
        (event as CustomEvent<unknown>).detail,
      );
      if (parsed.success) cache.setQueryData(["identity"], parsed.data);
    };
    const invalidate = () => {
      void cache.invalidateQueries({
        queryKey: ["identity"],
        refetchType: "none",
      });
    };
    window.addEventListener("billing-summary-identity", change);
    window.addEventListener("billing-summary-invalidate", invalidate);
    return () => {
      window.removeEventListener("billing-summary-identity", change);
      window.removeEventListener("billing-summary-invalidate", invalidate);
    };
  }, [cache]);
  return (
    <main style={{ maxWidth: 560, margin: "48px auto", padding: 24 }}>
      <h1>Billing summary test</h1>
      <output aria-label="Summary probe identity">
        {identity.isPending
          ? "Loading identity"
          : identity.isError
            ? "Identity unavailable"
            : identity.data?.user.id}
      </output>
      <button className="button" onClick={() => setEnabled(!enabled)}>
        {enabled ? "Hide summary" : "Show summary"}
      </button>
      <BillingSummaryPanel enabled={enabled} />
    </main>
  );
}

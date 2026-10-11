import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClientIntakeDialog } from "@/features/client-intake/public";
declare global {
  interface Window {
    __capacityPendingWrites?: () => number;
  }
}
// Test-only lifetime/authority probes. Product entry remains Add profile.
export function ProfileCapacityHarness() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(0);
  const cache = useQueryClient();
  useEffect(() => {
    window.__capacityPendingWrites = () => cache.isMutating();
    const invalidate = () => {
      void cache.invalidateQueries({
        queryKey: ["identity"],
        refetchType: "none",
      });
    };
    const unmount = () => setOpen(false);
    window.addEventListener("capacity-invalidate-actor", invalidate);
    window.addEventListener("capacity-unmount", unmount);
    return () => {
      delete window.__capacityPendingWrites;
      window.removeEventListener("capacity-invalidate-actor", invalidate);
      window.removeEventListener("capacity-unmount", unmount);
    };
  }, [cache]);
  return (
    <main className="stack">
      <button className="button" onClick={() => setOpen(true)}>
        Start profile test
      </button>
      <ClientIntakeDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={() => {
          setSaved((count) => count + 1);
          setOpen(false);
        }}
      />
      <span data-testid="saved-profiles">{saved}</span>
    </main>
  );
}

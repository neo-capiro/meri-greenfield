import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClientIntakeDialog } from "@/features/client-intake/public";
// Test-only lifetime/authority probes. Product entry remains Add profile.
export function ProfileCapacityHarness() {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  useEffect(() => {
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
        onSaved={() => setOpen(false)}
      />
    </main>
  );
}

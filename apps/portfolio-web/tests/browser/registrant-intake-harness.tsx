import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RegistrantImportDialog } from "@/features/intake/registrant/public";

declare global {
  interface Window {
    __registrantRecheck?: () => Promise<void>;
  }
}
/** Test-only callback/authority probe; never imported by production routes. */
export function RegistrantIntakeHarness() {
  const [open, setOpen] = useState(false);
  const [receipts, setReceipts] = useState(0);
  const cache = useQueryClient();
  useEffect(() => {
    window.__registrantRecheck = () =>
      cache.invalidateQueries({ queryKey: ["identity"] });
    return () => {
      delete window.__registrantRecheck;
    };
  }, [cache]);
  return (
    <main style={{ padding: 32 }}>
      <h1>Portfolio</h1>
      <p>Synthetic retained LDA intake acceptance.</p>
      <button className="button" onClick={() => setOpen(true)}>
        Import with LDA
      </button>
      <span data-testid="receipts">{receipts}</span>
      <RegistrantImportDialog
        open={open}
        onOpenChange={setOpen}
        onImported={() => setReceipts((count) => count + 1)}
      />
    </main>
  );
}

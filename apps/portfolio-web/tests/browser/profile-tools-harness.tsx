import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClientFrame } from "@/features/client-profile/ClientFrame";
import { FocusTags } from "@/features/client-profile/tags/public";
import { ClientProfileExport } from "@/features/client-profile/export/public";
import { CsvImportDialog } from "@/features/intake/csv/public";
const clientId = "10000000-0000-4000-8000-000000000001";
// Test-only component entry. It does not add a product CSV menu or route.
export function ProfileToolsHarness() {
  const [scopedClientId, setScopedClientId] = useState(clientId);
  const [csv, setCsv] = useState(false);
  const [exporting, setExporting] = useState(false);
  const cache = useQueryClient();
  useEffect(() => {
    const invalidate = () => {
      void cache.invalidateQueries({
        queryKey: ["identity"],
        refetchType: "none",
      });
    };
    const switchClient = () =>
      setScopedClientId("10000000-0000-4000-8000-000000000003");
    const switchActor = () => {
      cache.setQueryData(["identity"], {
        user: { id: "other-user", email: "other@example.test" },
        tenant: {
          id: "10000000-0000-4000-8000-000000000004",
          name: "Other synthetic tenant",
        },
        role: "user_admin",
      });
    };
    window.addEventListener("profile-tools-authority-invalidate", invalidate);
    window.addEventListener("profile-tools-client-change", switchClient);
    window.addEventListener("profile-tools-actor-change", switchActor);
    return () => {
      window.removeEventListener(
        "profile-tools-authority-invalidate",
        invalidate,
      );
      window.removeEventListener("profile-tools-client-change", switchClient);
      window.removeEventListener("profile-tools-actor-change", switchActor);
    };
  }, [cache]);
  return (
    <ClientFrame
      clientId={clientId}
      destinations={{
        existingApp: "http://127.0.0.1:5191/existing",
        meri: "http://127.0.0.1:5191/meri",
      }}
    >
      <section className="card stack">
        <h1>Profile tools qualification</h1>
        <FocusTags clientId={scopedClientId} />
        <div className="row">
          <button className="button" onClick={() => setExporting(true)}>
            Review profile JSON
          </button>
          <button className="button" onClick={() => setCsv(true)}>
            Review client CSV
          </button>
        </div>
      </section>
      <ClientProfileExport
        clientId={clientId}
        open={exporting}
        onOpenChange={setExporting}
      />
      <CsvImportDialog open={csv} onOpenChange={setCsv} />
    </ClientFrame>
  );
}

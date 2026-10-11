import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GlobalQuickLog } from "@/features/portfolio/GlobalQuickLog";
import { useClients } from "@/features/portfolio/public";
// Test-only authority transitions around the actual global composition.
export function MemberNotesHarness() {
  const cache = useQueryClient();
  const clients = useClients();
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const identity = (
      role: string,
      userId = "user-test",
      tenantId = "tenant-test",
    ) =>
      cache.setQueryData(["identity"], {
        user: { id: userId, email: "fixture@example.test" },
        tenant: { id: tenantId, name: "Synthetic" },
        role,
      });
    const events = {
      "member-note-identity-invalidate": () => {
        void cache.invalidateQueries({
          queryKey: ["identity"],
          refetchType: "none",
        });
      },
      "member-note-role-change": () => identity("client_portal_user"),
      "member-note-role-restore": () => identity("user_admin"),
      "member-note-actor-change": () =>
        identity("user_admin", "other-user", "other-tenant"),
      "member-note-unmount": () => setShown(false),
    };
    for (const [name, handler] of Object.entries(events))
      window.addEventListener(name, handler);
    return () => {
      for (const [name, handler] of Object.entries(events))
        window.removeEventListener(name, handler);
    };
  }, [cache]);
  return shown ? <GlobalQuickLog clients={clients.data ?? []} /> : null;
}

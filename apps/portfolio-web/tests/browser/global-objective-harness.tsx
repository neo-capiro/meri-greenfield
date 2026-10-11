import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { GlobalObjectiveClientPicker } from "@/features/objectives/global-create/public";
import { clientsKey } from "@/features/portfolio/public";

/** Synthetic cache transitions only; the picker and destination editor are real. */
export function GlobalObjectiveHarness() {
  const cache = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [shown, setShown] = useState(true);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const actor = () =>
      cache.setQueryData(["identity"], {
        user: { id: "other-user", email: "other@example.test" },
        tenant: { id: "other-tenant", name: "Other synthetic tenant" },
        role: "standard_user",
      });
    const role = () =>
      cache.setQueryData(["identity"], {
        user: { id: "user-test", email: "test@example.test" },
        tenant: { id: "tenant-test", name: "Synthetic tenant" },
        role: "client_portal_user",
      });
    const invalidate = () =>
      void cache.invalidateQueries({
        queryKey: ["identity"],
        refetchType: "none",
      });
    const catalog = () =>
      void cache.invalidateQueries({
        queryKey: clientsKey,
        refetchType: "none",
      });
    const refresh = () => void cache.refetchQueries({ queryKey: clientsKey });
    const unmount = () => setShown(false);
    const events = {
      "objective-actor-change": actor,
      "objective-role-change": role,
      "objective-authority-invalidate": invalidate,
      "objective-catalog-invalidate": catalog,
      "objective-catalog-refresh": refresh,
      "objective-unmount": unmount,
    };
    for (const [name, handler] of Object.entries(events))
      window.addEventListener(name, handler);
    return () => {
      for (const [name, handler] of Object.entries(events))
        window.removeEventListener(name, handler);
    };
  }, [cache]);
  return (
    <main className="page">
      <h1>Objective client selection</h1>
      <button ref={trigger} className="button" onClick={() => setOpen(true)}>
        Open client picker
      </button>
      {shown && (
        <GlobalObjectiveClientPicker
          open={open}
          onOpenChange={setOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
          onContinue={(clientId) =>
            router.push(`/portfolio/${clientId}/objectives?new=1`)
          }
        />
      )}
    </main>
  );
}

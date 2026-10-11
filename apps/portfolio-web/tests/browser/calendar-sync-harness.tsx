import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarSyncDialog } from "@/features/calendar/sync/public";
declare global {
  interface Window {
    __syncInvalidate?: () => Promise<void>;
    __syncActor?: (other: boolean) => void;
  }
}
export function CalendarSyncHarness() {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false),
    [mounted, setMounted] = useState(true);
  useEffect(() => {
    window.__syncInvalidate = () =>
      cache.invalidateQueries({ queryKey: ["identity"], refetchType: "none" });
    window.__syncActor = (other) =>
      cache.setQueryData(["identity"], {
        user: {
          id: other ? "other-user" : "sync-user",
          email: "synthetic@example.test",
        },
        tenant: { id: "sync-tenant", name: "Synthetic tenant" },
        role: "standard_user",
      });
    return () => {
      delete window.__syncInvalidate;
      delete window.__syncActor;
    };
  }, [cache]);
  return (
    <main>
      <button
        className="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        Open calendar sync
      </button>
      <button
        className="button"
        onClick={() => {
          setMounted(false);
          setOpen(false);
        }}
      >
        Unmount sync
      </button>
      {mounted && (
        <CalendarSyncDialog
          open={open}
          onOpenChange={setOpen}
          clientName="Synthetic Aerospace"
          range={{ from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" }}
        />
      )}
    </main>
  );
}

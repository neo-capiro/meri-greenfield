import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PublicEventDetail } from "@/features/calendar/public-event/public";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { publicEventId, publicEventClientId } from "./public-event-data";
declare global {
  interface Window {
    __publicActor?: () => void;
    __publicIdentityInvalidate?: () => Promise<void>;
    __publicDetails?: () => { key: readonly unknown[]; data: unknown }[];
  }
}
function usePublicEventTestControls() {
  const cache = useQueryClient();
  useEffect(() => {
    window.__publicActor = () =>
      cache.setQueryData(["identity"], {
        user: { id: "other-user", email: "other@example.test" },
        tenant: { id: "other-tenant", name: "Synthetic other tenant" },
        role: "user_admin",
      });
    window.__publicIdentityInvalidate = () =>
      cache.invalidateQueries({ queryKey: ["identity"], refetchType: "none" });
    window.__publicDetails = () =>
      cache
        .getQueryCache()
        .findAll({ queryKey: ["public-event-detail"] })
        .map((query) => ({ key: query.queryKey, data: query.state.data }));
    return () => {
      delete window.__publicActor;
      delete window.__publicIdentityInvalidate;
      delete window.__publicDetails;
    };
  }, [cache]);
}
export function PublicEventCalendarHarness() {
  usePublicEventTestControls();
  return (
    <CalendarPage
      destinations={{ existingApp: "https://existing.example.test" }}
    />
  );
}
export function PublicEventHarness() {
  usePublicEventTestControls();
  const [open, setOpen] = useState(false),
    [visible, setVisible] = useState(true),
    [clientId, setClientId] = useState<string>(),
    [destination, setDestination] = useState(true);
  return (
    <main>
      <button className="button" onClick={() => setOpen(true)}>
        Open public proceeding
      </button>
      <button
        className="button"
        onClick={() => setClientId(publicEventClientId)}
      >
        Select client scope
      </button>
      <button className="button" onClick={() => setDestination(false)}>
        Remove destination
      </button>
      <button className="button" onClick={() => setVisible(false)}>
        Unmount public proceeding
      </button>
      {visible && (
        <PublicEventDetail
          eventId={publicEventId}
          open={open}
          onOpenChange={setOpen}
          clientId={clientId}
          destinations={
            destination ? { existingApp: "https://existing.example.test" } : {}
          }
        />
      )}
    </main>
  );
}

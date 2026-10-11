import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MeetingArtifacts } from "@/features/calendar/MeetingArtifacts";
import { MeetingAttachmentApprovals } from "@/features/calendar/review/public";
import type { Meeting } from "@/features/calendar/contracts";
import { client, clientId } from "./fixtures";

const meeting: Meeting = {
  id: "90000000-0000-4000-8000-000000000013",
  subject: "Synthetic saved-note meeting",
  description: null,
  location: null,
  startsAt: "2026-10-10T14:00:00Z",
  endsAt: "2026-10-10T15:00:00Z",
  status: "scheduled",
  joinLink: null,
  visibility: "private",
  isVirtual: false,
  meri: null,
  client: { id: clientId, name: client.name },
  attendees: [],
  preps: [],
};

// Test-only current-authority/lifetime probes; all product behavior is composed
// from the actual Calendar features and existing generation/review/save editor.
export function MeetingReviewHarness() {
  const cache = useQueryClient();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const unmount = () => setVisible(false);
    const invalidate = () => {
      void cache.invalidateQueries({
        queryKey: ["identity"],
        refetchType: "none",
      });
    };
    const changeRole = () =>
      cache.setQueryData(["identity"], {
        user: { id: "user-test", email: "synthetic@example.test" },
        tenant: { id: "tenant-test", name: "Synthetic tenant" },
        role: "client_portal_user",
      });
    const restoreRole = () =>
      cache.setQueryData(["identity"], {
        user: { id: "user-test", email: "synthetic@example.test" },
        tenant: { id: "tenant-test", name: "Synthetic tenant" },
        role: "user_admin",
      });
    const changeActor = () =>
      cache.setQueryData(["identity"], {
        user: { id: "other-user", email: "synthetic@example.test" },
        tenant: { id: "other-tenant", name: "Synthetic other tenant" },
        role: "user_admin",
      });
    const listeners = [
      ["review-unmount", unmount],
      ["review-role-change", changeRole],
      ["review-role-restore", restoreRole],
      ["review-actor-change", changeActor],
      ["review-identity-invalidate", invalidate],
    ] as const;
    listeners.forEach(([name, listener]) =>
      window.addEventListener(name, listener),
    );
    return () =>
      listeners.forEach(([name, listener]) =>
        window.removeEventListener(name, listener),
      );
  }, [cache]);
  return (
    <main className="stack" style={{ padding: 24 }}>
      <h1>{meeting.subject}</h1>
      {visible && (
        <>
          <MeetingAttachmentApprovals meeting={meeting} />
          <MeetingArtifacts meeting={meeting} kind="debriefs" />
        </>
      )}
    </main>
  );
}

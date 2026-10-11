import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/shared/shell/Shell";
import { TimelineMailThread } from "@/features/relationships/thread/public";
import {
  threadClientId,
  threadId,
  threadTenantId,
} from "../thread-mail-fixture";
// Component qualification only; parent owns actual ActivityTimeline composition.
export function ThreadMailHarness() {
  const cache = useQueryClient();
  const [clientId, setClientId] = useState(threadClientId);
  useEffect(() => {
    const actor = () =>
      cache.setQueryData(["identity"], {
        user: { id: "other-actor", email: "other@example.test" },
        tenant: { id: threadTenantId, name: "Synthetic" },
        role: "standard_user",
      });
    const client = () => setClientId("10000000-0000-4000-8000-000000000003");
    const invalidate = () => {
      void cache.invalidateQueries({
        queryKey: ["identity"],
        refetchType: "none",
      });
    };
    window.addEventListener("thread-actor-change", actor);
    window.addEventListener("thread-client-change", client);
    window.addEventListener("thread-identity-invalidate", invalidate);
    return () => {
      window.removeEventListener("thread-actor-change", actor);
      window.removeEventListener("thread-client-change", client);
      window.removeEventListener("thread-identity-invalidate", invalidate);
    };
  }, [cache]);
  return (
    <Shell
      destinations={{
        existingApp: "http://127.0.0.1:5194/existing",
        meri: "http://127.0.0.1:5194/meri",
      }}
    >
      <section className="card stack">
        <h1>Activity timeline</h1>
        <article className="stack">
          <strong>Synthetic policy discussion</strong>
          <small>Synced email</small>
          <p>Stored preview</p>
          <TimelineMailThread clientId={clientId} threadId={threadId} />
        </article>
      </section>
    </Shell>
  );
}

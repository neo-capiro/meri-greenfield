"use client";
import { useState } from "react";
import { useIdentity } from "@/shared/auth/identity";
import { QueryState } from "@/shared/ui/QueryState";
import { useSubmissions } from "./queries";
import { RemoveSubmission } from "./RemoveSubmission";
import type { SavedSubmission } from "./contracts";
import styles from "./past-performance.module.css";
export function PastPerformance({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const identity = useIdentity();
  if (!identity.data?.tenant?.id || !identity.data.user.id)
    return (
      <section className="card stack" aria-label="Past performance">
        <h2>Past performance</h2>
        <QueryState
          pending={identity.isPending || identity.isFetching}
          error={identity.error}
        />
        <p>
          A current client-write role is required to inspect saved submission
          history.
        </p>
      </section>
    );
  return (
    <History
      key={`${clientId}:${identity.data.tenant.id}:${identity.data.user.id}`}
      clientId={clientId}
      clientName={clientName}
    />
  );
}
function History({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const history = useSubmissions(clientId);
  const [selected, setSelected] = useState<SavedSubmission | null>(null);
  const [receipt, setReceipt] = useState("");
  return (
    <section className="card stack" aria-label="Past performance">
      <div className="row between">
        <h2>Past performance</h2>
        <button
          className="button ghost"
          disabled={history.isFetching}
          onClick={() => void history.refetch()}
        >
          Refresh history
        </button>
      </div>
      <p className="muted">
        Saved capability submissions and their recorded outcomes.
      </p>
      <QueryState
        pending={history.isPending}
        error={history.error}
        retry={() => void history.refetch()}
      />
      {!history.error && history.data && (
        <>
          <p className="muted">
            {history.data.length} saved submissions shown
            {history.data.length === 200 ? " · feed limit reached" : ""}.
          </p>
          {history.data.length === 0 && (
            <p>No saved submissions in this history feed.</p>
          )}
          <ul className={styles.list}>
            {history.data.map((item) => (
              <li key={item.id}>
                <div>
                  <small>
                    {item.fiscalYear} · {item.outcomeType}
                  </small>
                  <h3>{item.title}</h3>
                  {item.meta && <p>{item.meta}</p>}
                  {item.outcome && <p>{item.outcome}</p>}
                  {item.notes && (
                    <details>
                      <summary>Saved notes</summary>
                      <p>{item.notes}</p>
                    </details>
                  )}
                  {item.capabilityId && (
                    <small>Capability ID: {item.capabilityId}</small>
                  )}
                </div>
                <button
                  className="button ghost"
                  aria-label={`Remove submission: ${item.title}`}
                  onClick={() => {
                    setReceipt("");
                    setSelected(item);
                  }}
                >
                  Remove…
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {receipt && <p role="status">{receipt}</p>}
      <RemoveSubmission
        item={selected}
        clientName={clientName}
        onClose={() => setSelected(null)}
        onRemoved={() => {
          setReceipt(
            "Saved submission removed. Its capability and documents remain.",
          );
          setSelected(null);
        }}
      />
    </section>
  );
}

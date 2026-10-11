"use client";
import { QueryState } from "@/shared/ui/QueryState";
import type { AttentionClient } from "./contracts";
import { accessibleAlerts } from "./model";
import { usePortfolioAttention } from "./query";
import { AttentionItem } from "./AttentionItem";
import styles from "./attention.module.css";

export function PortfolioAttention({
  clients,
}: {
  clients: readonly AttentionClient[];
}) {
  const { identity, permitted, alerts } = usePortfolioAttention(clients);
  const data = permitted && !alerts.error ? alerts.data : undefined;
  const rows = data ? accessibleAlerts(data.alerts, clients) : [];
  return (
    <aside className={styles.card} aria-label="Needs attention">
      <header className={styles.header}>
        <h3>Needs attention</h3>
        {data && (
          <span
            className={styles.count}
            aria-label={`${rows.length} shown alerts`}
          >
            {rows.length} shown
          </span>
        )}
        <span className={styles.order} title="Ordered by the source service">
          ↑↓ Most urgent
        </span>
      </header>
      <p className={styles.description}>
        Updates automatically. Open an item in its client profile.
      </p>
      <QueryState
        pending={identity.isPending}
        error={identity.error}
        retry={() => void identity.refetch()}
      />
      {!identity.isPending && !identity.error && !permitted && (
        <p className="status">This account cannot access portfolio alerts.</p>
      )}
      {permitted && clients.length === 0 && (
        <p className="status">No accessible clients to check.</p>
      )}
      {permitted && clients.length > 0 && (
        <QueryState
          pending={alerts.isPending}
          error={alerts.error}
          retry={() => void alerts.refetch()}
        />
      )}
      {data && (
        <>
          {rows.length ? (
            <ul className={styles.list} aria-label="Reported client alerts">
              {rows.map((alert) => (
                <AttentionItem key={alert.id} alert={alert} />
              ))}
            </ul>
          ) : (
            <p className="status" role="status">
              No alerts were returned for your accessible clients. Coverage is
              incomplete; this does not confirm there is nothing to review.
            </p>
          )}
          <footer className={styles.footer}>
            <p>
              Limited feed: up to 50 alerts from the first 40 active clients,
              with up to 20 per client. Some sources may be unavailable.
            </p>
            <div className={styles.freshness}>
              <span>
                Snapshot{" "}
                <time dateTime={data.generatedAt} title={data.generatedAt}>
                  {new Date(data.generatedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "short",
                  })}
                </time>
              </span>
              <button
                className="button ghost"
                disabled={alerts.isFetching}
                onClick={() => void alerts.refetch()}
              >
                {alerts.isFetching ? "Refreshing…" : "Refresh alerts"}
              </button>
            </div>
          </footer>
        </>
      )}
    </aside>
  );
}

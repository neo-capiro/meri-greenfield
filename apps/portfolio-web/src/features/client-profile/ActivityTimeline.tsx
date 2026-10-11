"use client";
import Link from "next/link";
import { useState } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import { useActivity } from "./queries";
import styles from "./overview.module.css";
export function ActivityTimeline({ clientId }: { clientId: string }) {
  const activity = useActivity(clientId);
  const [kind, setKind] = useState("");
  const rows = (activity.data ?? []).filter(
    (item) => !kind || item.kind === kind,
  );
  return (
    <section className="card stack" aria-label="Activity timeline">
      <header className="row between">
        <div>
          <p className="eyebrow">Relationship history</p>
          <h2>Activity timeline</h2>
        </div>
        <select
          aria-label="Activity type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">All activity</option>
          {[...new Set((activity.data ?? []).map((i) => i.kind))].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </header>
      <QueryState
        pending={activity.isPending}
        error={activity.error}
        retry={() => void activity.refetch()}
      />
      {activity.data &&
        (rows.length ? (
          <ol className={styles.timeline}>
            {rows.map((item) => (
              <li key={item.id}>
                <span className={styles.timelineDot} />
                <div className="stack">
                  <div className="row between">
                    <strong>{item.title}</strong>
                    <time className="muted" dateTime={item.occurredAt}>
                      {new Date(item.occurredAt).toLocaleString()}
                    </time>
                  </div>
                  <small>{item.kind}</small>
                  {item.body && <p className={styles.body}>{item.body}</p>}
                  {item.sourceType === "meeting" && item.sourceId && (
                    <Link
                      className="muted"
                      href={`/portfolio/${clientId}/calendar?meeting=${encodeURIComponent(item.sourceId)}`}
                    >
                      Open meeting ↗
                    </Link>
                  )}
                  {item.sourceType === "attachment" && item.sourceId && (
                    <Link
                      className="muted"
                      href={`/portfolio/${clientId}/files?file=${encodeURIComponent(item.sourceId)}`}
                    >
                      Open file ↗
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">No activity to show.</p>
        ))}
      {activity.data?.length === 500 && (
        <small>
          Showing the latest 500 items available from this history feed.
        </small>
      )}
    </section>
  );
}

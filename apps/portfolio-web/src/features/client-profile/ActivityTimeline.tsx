"use client";
import Link from "next/link";
import { useState } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import { useActivity } from "./queries";
import { ActivityFilters } from "./ActivityFilters";
import {
  emptyActivityFilters,
  filterActivity,
  activityRangeError,
} from "./activity-filters";
import styles from "./overview.module.css";
export function ActivityTimeline({ clientId }: { clientId: string }) {
  const activity = useActivity(clientId);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [filters, setFilters] = useState({ ...emptyActivityFilters });
  const rangeError = activityRangeError(filters);
  const rows = filterActivity(activity.data ?? [], filters, zone);
  return (
    <section className="card stack" aria-label="Activity timeline">
      <header className="row between">
        <div>
          <p className="eyebrow">Relationship history</p>
          <h2>Activity timeline</h2>
        </div>
      </header>
      <ActivityFilters
        value={filters}
        onChange={setFilters}
        zone={zone}
        kinds={[...new Set((activity.data ?? []).map((i) => i.kind))]}
      />
      {rangeError && <p role="alert">{rangeError}</p>}
      <QueryState
        pending={activity.isPending}
        error={activity.error}
        retry={() => void activity.refetch()}
      />
      {activity.data &&
        !rangeError &&
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

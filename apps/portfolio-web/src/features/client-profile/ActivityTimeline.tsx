"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { z } from "zod";
import { QueryState } from "@/shared/ui/QueryState";
import { TimelineMailThread } from "@/features/relationships/thread/public";
import { useActivity } from "./queries";
import { ActivityFilters } from "./ActivityFilters";
import { ActivityActions } from "./ActivityActions";
import {
  emptyActivityFilters,
  filterActivity,
  activityRangeError,
} from "./activity-filters";
import styles from "./overview.module.css";
export function ActivityTimeline({ clientId }: { clientId: string }) {
  const activity = useActivity(clientId);
  const timeline = useRef<HTMLElement>(null);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [filters, setFilters] = useState({ ...emptyActivityFilters });
  const rangeError = activityRangeError(filters);
  const rows = filterActivity(activity.data ?? [], filters, zone);
  return (
    <section
      id="activity-timeline"
      ref={timeline}
      tabIndex={-1}
      className="card stack"
      aria-label="Activity timeline"
    >
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
                    <div className="row">
                      <time className="muted" dateTime={item.occurredAt}>
                        {new Date(item.occurredAt).toLocaleString()}
                      </time>
                      <ActivityActions
                        clientId={clientId}
                        item={item}
                        onFallbackFocus={() => timeline.current?.focus()}
                      />
                    </div>
                  </div>
                  <small>{item.kind}</small>
                  {item.body && <p className={styles.body}>{item.body}</p>}
                  {item.origin === "derived" &&
                    item.kind === "email" &&
                    item.sourceType === "mail_thread" &&
                    item.sourceId &&
                    z.uuid().safeParse(item.sourceId).success && (
                      <TimelineMailThread
                        clientId={clientId}
                        threadId={item.sourceId}
                      />
                    )}
                  {item.dueAt && (
                    <small>
                      {item.settledAt ? "Settled " : "Due "}
                      <time dateTime={item.settledAt ?? item.dueAt}>
                        {new Date(
                          item.settledAt ?? item.dueAt,
                        ).toLocaleString()}
                      </time>
                    </small>
                  )}
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

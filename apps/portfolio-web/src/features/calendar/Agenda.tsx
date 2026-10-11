"use client";
import type { CalendarItem } from "./contracts";
import { formatInstant } from "./range";
import styles from "./calendar.module.css";
const labels = {
  meeting: "Meeting",
  hearing: "Hearing",
  planner: "Planner",
  government: "Government",
  deadline: "Deadline",
};
export function Agenda({
  items,
  onMeeting,
  onPublicEvent,
}: {
  items: CalendarItem[];
  onMeeting: (id: string) => void;
  onPublicEvent: (id: string) => void;
}) {
  const sorted = [...items].sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (a.startAt ?? "").localeCompare(b.startAt ?? "") ||
      a.key.localeCompare(b.key),
  );
  const groups = new Map<string, CalendarItem[]>();
  for (const item of sorted)
    groups.set(item.day, [...(groups.get(item.day) ?? []), item]);
  return (
    <div className="stack">
      {[...groups].map(([day, rows]) => (
        <section className="card stack" key={day}>
          <h2>
            <time dateTime={day}>{day}</time>
          </h2>
          {rows.map((item) => (
            <article className={styles.agendaRow} key={item.key}>
              <span className="chip">{labels[item.kind]}</span>
              <div className="stack">
                <h3>
                  {item.kind === "meeting" ? (
                    <button
                      className={styles.titleButton}
                      onClick={() => onMeeting(item.sourceId)}
                    >
                      {item.title}
                    </button>
                  ) : item.kind === "hearing" ? (
                    <button
                      className={styles.titleButton}
                      onClick={() => onPublicEvent(item.sourceId)}
                    >
                      {item.title}
                    </button>
                  ) : item.href && /^https?:\/\//.test(item.href) ? (
                    <a href={item.href} target="_blank" rel="noreferrer">
                      {item.title} ↗
                    </a>
                  ) : (
                    item.title
                  )}
                </h3>
                <small>
                  {item.startAt
                    ? formatInstant(item.startAt, item.timeZone)
                    : "Date only · time not supplied"}
                  {item.status && ` · ${item.status}`}
                </small>
                <small>{item.provenance}</small>
              </div>
            </article>
          ))}
        </section>
      ))}
      {sorted.length === 0 && (
        <div className="status">
          No events found in the selected feeds and date range.
        </div>
      )}
    </div>
  );
}

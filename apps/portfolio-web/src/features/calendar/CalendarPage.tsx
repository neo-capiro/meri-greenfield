"use client";
import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Temporal } from "temporal-polyfill";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import type { Destinations } from "@/shared/config/config";
import { QueryState } from "@/shared/ui/QueryState";
import { useClients } from "@/features/portfolio/public";
import {
  calendarRange,
  moveDate,
  validDay,
  zones,
  type CalendarView,
} from "./range";
import { useCalendarFeeds } from "./queries";
import { CalendarGrid } from "./CalendarGrid";
import { Agenda } from "./Agenda";
import { MeetingDetail } from "./MeetingDetail";
import { MeetingForm } from "./MeetingForm";
import type { CalendarKind } from "./contracts";
import { deduplicate } from "./feeds";
import styles from "./calendar.module.css";
export function CalendarPage({
  clientId,
  destinations,
}: {
  clientId?: string;
  destinations: Destinations;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const clients = useClients();
  const zone =
    zones.find((zone) => zone === params.get("zone")) ?? "America/New_York";
  const date =
    validDay(params.get("date")) ?? Temporal.Now.plainDateISO(zone).toString();
  const view: CalendarView =
    params.get("view") === "week"
      ? "week"
      : params.get("view") === "agenda"
        ? "agenda"
        : "month";
  const scope = clientId ?? params.get("clientId") ?? undefined;
  const mixed = !scope && view === "agenda";
  const range = calendarRange(date, view, zone);
  const feeds = useCalendarFeeds(range, zone, scope, mixed);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [hidden, setHidden] = useState<CalendarKind[]>([]);
  function update(values: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values))
      if (value) next.set(key, value);
      else next.delete(key);
    router.replace(`${path}?${next}`, { scroll: false });
  }
  const all = deduplicate([
    ...(feeds.meetings.data?.items ?? []),
    ...(mixed
      ? [
          ...(feeds.hearings.data?.items ?? []),
          ...(feeds.planner.data?.items ?? []),
          ...(feeds.deadlines.data?.items ?? []),
        ]
      : []),
  ]);
  const items = all.filter(
    (item) =>
      !hidden.includes(item.kind) &&
      (!search ||
        item.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
  );
  const activeFeeds = mixed
    ? Object.entries(feeds)
    : [["meetings", feeds.meetings] as const];
  return (
    <div className="page">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">
            {clientId ? "Client meetings" : "Your accessible calendar"}
          </p>
          <h1>{clientId ? "Calendar" : "Master Calendar"}</h1>
        </div>
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          New meeting
        </button>
      </header>
      <div className="toolbar">
        {!clientId && (
          <select
            aria-label="Calendar scope"
            value={scope ?? ""}
            onChange={(e) => update({ clientId: e.target.value || undefined })}
          >
            <option value="">Master view</option>
            {clients.data?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
            {scope && !clients.data?.some((c) => c.id === scope) && (
              <option value={scope}>Selected client unavailable</option>
            )}
          </select>
        )}
        <button
          className="button iconButton"
          aria-label="Previous period"
          onClick={() => update({ date: moveDate(date, view, -1) })}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="button"
          onClick={() =>
            update({ date: Temporal.Now.plainDateISO(zone).toString() })
          }
        >
          Today
        </button>
        <button
          className="button iconButton"
          aria-label="Next period"
          onClick={() => update({ date: moveDate(date, view, 1) })}
        >
          <ChevronRight size={16} />
        </button>
        <input
          type="date"
          aria-label="Calendar date"
          value={date}
          onChange={(e) => {
            if (validDay(e.target.value)) update({ date: e.target.value });
          }}
        />
        <select
          aria-label="Calendar view"
          value={view}
          onChange={(e) => update({ view: e.target.value })}
        >
          <option value="month">Month</option>
          <option value="week">Week</option>
          <option value="agenda">Agenda</option>
        </select>
        <select
          aria-label="Calendar timezone"
          value={zone}
          onChange={(e) => update({ zone: e.target.value })}
        >
          {zones.map((zone) => (
            <option key={zone}>{zone}</option>
          ))}
        </select>
      </div>
      {!clientId && (
        <QueryState
          error={clients.error}
          retry={() => void clients.refetch()}
        />
      )}
      {view === "agenda" && (
        <div className="toolbar">
          <input
            aria-label="Search calendar events"
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(mixed
            ? ["meeting", "hearing", "planner", "deadline"]
            : ["meeting"]
          ).map((kind) => (
            <button
              key={kind}
              className="button"
              aria-pressed={!hidden.includes(kind as CalendarKind)}
              onClick={() =>
                setHidden(
                  hidden.includes(kind as CalendarKind)
                    ? hidden.filter((k) => k !== kind)
                    : [...hidden, kind as CalendarKind],
                )
              }
            >
              {kind[0]?.toUpperCase()}
              {kind.slice(1)}
            </button>
          ))}
          {mixed && (
            <span
              className="chip"
              title="A verified effective-date and confidence contract is required"
            >
              Government unavailable
            </span>
          )}
          <button
            className="button ghost"
            onClick={() => {
              setHidden([]);
              setSearch("");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="stack">
        {activeFeeds.map(([name, feed]) => (
          <div key={name}>
            {feed.isPending && (name === "meetings" || mixed) && (
              <p role="status" className="muted">
                Loading {name}…
              </p>
            )}
            {feed.error && (
              <QueryState
                error={feed.error}
                retry={() => void feed.refetch()}
              />
            )}
            {feed.data?.limitations.map((message) => (
              <p key={message} role="status" className="muted">
                {message}
              </p>
            ))}
          </div>
        ))}
      </div>
      <p className={styles.scopeNote}>
        Master view includes meetings allowed by your calendar ownership and
        explicit client sharing. It does not grant access to teammates&apos;
        private calendars.
      </p>
      {view === "agenda" ? (
        <Agenda items={items} onMeeting={(id) => update({ meeting: id })} />
      ) : (
        <CalendarGrid
          key={`${view}:${date}:${zone}`}
          items={items}
          date={date}
          view={view}
          zone={zone}
          onDate={(value) => {
            if (value !== date) update({ date: value });
          }}
          onMeeting={(id) => update({ meeting: id })}
        />
      )}
      <MeetingDetail
        key={params.get("meeting") ?? "none"}
        id={params.get("meeting")}
        onClose={() => update({ meeting: undefined })}
        zone={zone}
        destinations={destinations}
        clientId={clientId}
      />
      <MeetingForm
        key={creating ? "new" : "closed"}
        open={creating}
        onOpenChange={setCreating}
        clientId={scope}
        zone={zone}
      />
    </div>
  );
}

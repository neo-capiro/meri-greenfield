"use client";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { QueryState } from "@/shared/ui/QueryState";
import { ApiError } from "@/shared/api/http";
import { useClients } from "@/features/portfolio/public";
import type { CalendarZone } from "../range";
import {
  filterParams,
  materialsLabel,
  readLibraryFilters,
  type LibraryFilters,
} from "./contracts";
import { useMeetingLibrary } from "./hooks";
import styles from "./library.module.css";

export function MeetingLibrary({
  clientId,
  zone,
  onMeeting,
  onClose,
}: {
  clientId?: string;
  zone: CalendarZone;
  onMeeting: (id: string) => void;
  onClose: () => void;
}) {
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const identity = useIdentity();
  const clients = useClients();
  const parsed = readLibraryFilters(params);
  const allowed = Boolean(
    identity.data &&
    identity.data.user.id &&
    identity.data.tenant?.id &&
    !identity.isPending &&
    !identity.isFetching &&
    (identity.data.role === "standard_user" ||
      canAdminister(identity.data.role)) &&
    !identity.error,
  );
  const query = useMeetingLibrary(
    parsed.success ? parsed.data : undefined,
    zone,
    clientId,
    allowed,
    `${identity.data?.tenant?.id}:${identity.data?.user.id}`,
  );
  const filters = parsed.success ? parsed.data : undefined;
  function update(values: Partial<LibraryFilters>, clear = false) {
    const next = new URLSearchParams(params);
    if (clear) Object.values(filterParams).forEach((key) => next.delete(key));
    for (const [key, value] of Object.entries({
      ...values,
      page: values.page ?? 1,
    })) {
      const name = filterParams[key as keyof LibraryFilters];
      if (value && !(key === "page" && value === 1))
        next.set(name, String(value));
      else next.delete(name);
    }
    router.replace(`${path}?${next}`, { scroll: false });
  }
  const clientName = clients.data?.find(
    (client) => client.id === clientId,
  )?.name;
  const denied =
    identity.isSuccess && !identity.isFetching && !allowed
      ? new ApiError(
          403,
          "Meeting library access is unavailable for this role.",
        )
      : null;
  return (
    <section className={`page ${styles.library}`} aria-label="Meeting library">
      <header className="pageHeader">
        <h1>Meeting Library</h1>
        <button className="button" onClick={onClose}>
          ← Calendar
        </button>
      </header>
      <p className="muted">
        Your {clientName ? `${clientName} ` : ""}meetings — created by you or
        imported from a calendar you connected — with at least one approved
        prep, note or debrief.
      </p>
      <form
        key={params.toString()}
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          update({ search: String(form.get("search") ?? "") });
        }}
      >
        <label className={styles.search}>
          Search
          <input
            name="search"
            aria-label="Search meeting library"
            defaultValue={filters?.search ?? ""}
            maxLength={160}
            placeholder="Search by meeting or client…"
          />
        </label>
        <button className="button" type="submit">
          Search
        </button>
        <label>
          Type
          <select
            aria-label="Library material type"
            value={filters?.artifactType ?? ""}
            onChange={(e) =>
              update({
                artifactType: e.target.value as LibraryFilters["artifactType"],
              })
            }
          >
            <option value="">All</option>
            <option value="prep">Prep</option>
            <option value="notes">Notes</option>
            <option value="debrief">Debrief</option>
          </select>
        </label>
        <label>
          Visibility
          <select
            aria-label="Library visibility"
            value={filters?.visibility ?? ""}
            onChange={(e) =>
              update({
                visibility: e.target.value as LibraryFilters["visibility"],
              })
            }
          >
            <option value="">All</option>
            <option value="shared">Shared</option>
            <option value="private">Private</option>
          </select>
        </label>
      </form>
      <div className={styles.dates}>
        <label>
          From
          <input
            aria-label="Library from date"
            type="date"
            value={filters?.from ?? ""}
            onChange={(e) => update({ from: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            aria-label="Library to date"
            type="date"
            value={filters?.to ?? ""}
            onChange={(e) => update({ to: e.target.value })}
          />
        </label>
      </div>
      <div className={`row between ${styles.scope}`}>
        <small className="muted">
          {clientId
            ? `Client scope · ${clientName ?? "Selected client"}`
            : "Your accessible meeting archive"}{" "}
          · Dates use {zone}
        </small>
        <button className="button ghost" onClick={() => update({}, true)}>
          Clear filters
        </button>
      </div>
      {!parsed.success && <p role="alert">{parsed.error.issues[0]?.message}</p>}
      <QueryState
        pending={
          identity.isPending ||
          identity.isFetching ||
          (allowed && query.isPending && Boolean(filters))
        }
        error={identity.error ?? denied ?? query.error}
        retry={() =>
          void (identity.error ? identity.refetch() : query.refetch())
        }
      />
      {allowed && !query.error && query.data && (
        <>
          <div
            className={styles.table}
            role="table"
            aria-label="Approved meeting archive"
          >
            <div className={styles.head} role="row">
              <span role="columnheader">Date</span>
              <span role="columnheader">Meeting</span>
              <span role="columnheader">Materials</span>
              <span role="columnheader">Visibility</span>
            </div>
            {query.data.data.map((row) => (
              <button
                className={styles.item}
                role="row"
                key={row.id}
                onClick={() => onMeeting(row.id)}
                aria-label={`Open ${row.subject}`}
              >
                <span role="cell">
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: zone,
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(row.startsAt))}
                </span>
                <span role="cell" className={styles.subject}>
                  <strong>{row.subject}</strong>
                  <small>{row.client?.name ?? "No client"}</small>
                </span>
                <span role="cell">{materialsLabel(row)}</span>
                <span role="cell">
                  {row.visibility === "shared" ? "Shared" : "Private"}
                </span>
              </button>
            ))}
            {query.data.data.length === 0 && (
              <p className="empty">No approved meetings match these filters.</p>
            )}
          </div>
          <nav className="row between" aria-label="Meeting library pages">
            <button
              className="button"
              disabled={query.isFetching || !filters || filters.page === 1}
              onClick={() => update({ page: (filters?.page ?? 1) - 1 })}
            >
              Previous
            </button>
            <small>
              Page {query.data.page} · {query.data.total} meetings
            </small>
            <button
              className="button"
              disabled={
                query.isFetching ||
                query.data.page * query.data.limit >= query.data.total
              }
              onClick={() => update({ page: (filters?.page ?? 1) + 1 })}
            >
              Next
            </button>
          </nav>
        </>
      )}
      <p className="muted">
        <small>
          A meeting can qualify through a previously approved artifact even
          after a new draft replaces it. Sharing remains per artifact.
        </small>
      </p>
    </section>
  );
}

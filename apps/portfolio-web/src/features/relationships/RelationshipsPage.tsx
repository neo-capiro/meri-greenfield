"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { QueryState } from "@/shared/ui/QueryState";
import { Dialog } from "@/shared/ui/Dialog";
import { usePeople } from "./queries";
import { titleOverlaps } from "./contracts";
import { OrganizationChart } from "./OrganizationChart";
import { ContactDrawer } from "./ContactDrawer";
import styles from "./relationships.module.css";
export function RelationshipsPage({ clientId }: { clientId: string }) {
  const query = usePeople(clientId);
  const people = query.data ?? [];
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const selected = params.get("person");
  const person = people.find((p) => p.id === selected);
  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("person", id);
    else next.delete("person");
    router.replace(`${path}?${next}`, { scroll: false });
  };
  const overlaps = new Set(titleOverlaps(people).map((p) => p.id));
  const review = people.filter(
    (p) => p.reviewRequired || overlaps.has(p.id) || !p.hierarchyLevel,
  );
  return (
    <div className="page stack">
      <header className="row between">
        <h1>Relationships</h1>
        <div className="row">
          <button className="button" onClick={() => setReviewing(true)}>
            Configure hierarchy
          </button>
          <button className="button primary" onClick={() => open("new")}>
            Add contact
          </button>
        </div>
      </header>
      <nav className="row" aria-label="Relationship type">
        <button className="button" aria-current="page">
          Organization
        </button>
        <button
          className="button"
          disabled
          title="Government relationship workflow is being connected"
        >
          Government relationships
        </button>
      </nav>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <section className={styles.container}>
          <div className="toolbar">
            <input
              aria-label="Search contacts"
              placeholder="Search name or title…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="muted">
              {people.length} contacts ·{" "}
              {people.filter((p) => p.hierarchyLevel).length} placed
            </span>
            <button className="button" onClick={() => setReviewing(true)}>
              Title-based hierarchy
            </button>
          </div>
          {review.length > 0 && (
            <div className={styles.review}>
              <img src="/design/411-50673-imgIconTriangleAlert.svg" alt="" />
              <span>
                {review.length} contacts need title or placement review. Verify
                roles before changing placement.
              </span>
              <button className="button" onClick={() => setReviewing(true)}>
                Review titles
              </button>
            </div>
          )}
          <p className={styles.legend}>
            Title tiers organize the roster. Blue lines show saved reports-to
            links.
          </p>
          {people.length ? (
            <OrganizationChart
              people={people}
              search={search}
              onSelect={open}
            />
          ) : (
            <p className="empty">
              No contacts. Add the first contact for this client.
            </p>
          )}
          <section className="card stack">
            <h3>Contact list</h3>
            {people
              .filter((p) =>
                `${p.name} ${p.title}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  key={p.id}
                  className="button ghost"
                  onClick={() => open(p.id)}
                >
                  {p.name} · {p.title ?? "No title"}
                </button>
              ))}
          </section>
        </section>
      )}
      {selected && selected !== "new" && query.isSuccess && !person && (
        <p role="alert">
          This contact is no longer in the client roster.{" "}
          <button onClick={() => open(null)}>Close</button>
        </p>
      )}
      <ContactDrawer
        key={selected ?? "closed"}
        clientId={clientId}
        person={person}
        people={people}
        open={selected === "new" || Boolean(person)}
        onClose={() => open(null)}
      />
      <Dialog
        open={reviewing}
        onOpenChange={setReviewing}
        title="Review hierarchy"
        description="Automatic placements come from saved titles. Only saved reporting relationships create connecting lines."
      >
        <div className="stack">
          {people.map((p) => (
            <button
              key={p.id}
              className="button"
              onClick={() => {
                setReviewing(false);
                open(p.id);
              }}
            >
              {p.name} · {p.title ?? "No title"}
              {review.includes(p) ? " · Needs review" : ""}
            </button>
          ))}
          {people.length === 0 && <p>No contacts to configure.</p>}
        </div>
      </Dialog>
    </div>
  );
}

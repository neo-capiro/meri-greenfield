"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { Destinations } from "@/shared/config/config";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { Shell } from "@/shared/shell/Shell";
import { QueryState } from "@/shared/ui/QueryState";
import { useClients, useAccountOwners } from "./queries";
import {
  clearPortfolioFilters,
  filterClients,
  portfolioHref,
  readPortfolioState,
  sortClients,
} from "./filter";
import { CreateProfileDialog } from "./CreateProfileDialog";
import { PortfolioProfiles } from "./PortfolioProfiles";
import { IndexFilters } from "./IndexFilters";
import { PortfolioPulse } from "./PortfolioPulse";
import { GlobalQuickLog } from "./GlobalQuickLog";
import { PortfolioAttention } from "./attention/public";
import { GlobalObjectiveClientPicker } from "@/features/objectives/global-create/public";
import styles from "./portfolio.module.css";

export function PortfolioIndex({
  destinations,
}: {
  destinations: Destinations;
}) {
  const clients = useClients();
  const owners = useAccountOwners();
  const identity = useIdentity();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const state = readPortfolioState(params);
  const permitted =
    !identity.error &&
    (identity.data?.role === "standard_user" ||
      canAdminister(identity.data?.role));
  const set = (key: string, value: string) =>
    router.replace(
      portfolioHref(pathname, new URLSearchParams(params), key, value),
      { scroll: false },
    );
  const clear = () =>
    router.replace(
      clearPortfolioFilters(pathname, new URLSearchParams(params)),
      { scroll: false },
    );
  const rows = sortClients(
    filterClients(
      clients.data ?? [],
      state,
      owners.error ? {} : (owners.data ?? {}),
    ).filter((client) => !state.type || client.profileType === state.type),
    state.sort,
  );
  const ownerFilterWaiting = Boolean(
    state.owner && (owners.isPending || owners.error),
  );
  const activeFilters = Boolean(
    state.search || state.status || state.sector || state.owner || state.type,
  );
  return (
    <Shell destinations={destinations}>
      <div className={`page ${styles.indexPage}`}>
        <header className={`pageHeader ${styles.indexHeader}`}>
          <div className="stack" style={{ gap: 6 }}>
            <p className="eyebrow">Your client portfolio</p>
            <h1 className={styles.title}>
              Portfolio <span>{clients.data?.length ?? "—"}</span>
            </h1>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.search}>
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search profiles"
                autoFocus={params.has("search")}
                placeholder="Search profiles…"
                value={state.search}
                onChange={(e) => set("q", e.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={!permitted}
              onClick={() => setCreating(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Add profile
            </button>
          </div>
        </header>
        <QueryState
          error={identity.error}
          retry={() => void identity.refetch()}
        />
        {identity.data && !permitted && !identity.error && (
          <p className="muted">Your role does not allow creating profiles.</p>
        )}
        <PortfolioPulse clients={clients.data} />
        <IndexFilters
          state={state}
          clients={clients.data ?? []}
          owners={owners.error ? undefined : owners.data}
          ownerPending={owners.isPending}
          set={set}
          clear={clear}
        />
        {state.unsupportedSort && (
          <p className="status" role="status">
            This sort is unavailable. Showing most recently added profiles.{" "}
            <button className="button ghost" onClick={() => set("sort", "")}>
              Use recent order
            </button>
          </p>
        )}
        {state.type === "PROSPECT" && (
          <p className="status" role="status">
            These are legacy prospect profiles. Current Business Development
            prospects are in <Link href="/portfolio/prospects">Prospects</Link>.
          </p>
        )}
        <QueryState
          pending={clients.isPending}
          error={clients.error}
          retry={() => void clients.refetch()}
        />
        {owners.error && (
          <QueryState
            error={owners.error}
            retry={() => void owners.refetch()}
          />
        )}
        {clients.data && !clients.error && (
          <>
            <div className={styles.columns}>
              <section className="stack" aria-label="Portfolio profiles">
                <nav className={styles.tabs} aria-label="Profile type">
                  {[
                    ["All", ""],
                    ["Clients", "CLIENT"],
                  ].map(([label, value]) => (
                    <button
                      key={label}
                      className={`button ${state.type === value ? "primary" : ""}`}
                      aria-pressed={state.type === value}
                      onClick={() => set("type", value ?? "")}
                    >
                      {label}{" "}
                      <small>
                        {value
                          ? clients.data.filter((c) => c.profileType === value)
                              .length
                          : clients.data.length}
                      </small>
                    </button>
                  ))}
                  <Link className="button" href="/portfolio/prospects">
                    Prospects
                  </Link>
                  <Link
                    className="button"
                    href="/portfolio/prospects?pipeline=1"
                  >
                    Pipeline
                  </Link>
                </nav>
                {ownerFilterWaiting ? (
                  <div className="status" role="status">
                    {owners.isPending
                      ? "Loading account owners…"
                      : "The account owner filter cannot be applied until owners are available."}
                  </div>
                ) : (
                  <>
                    <p className={styles.resultCount} role="status">
                      {rows.length} {rows.length === 1 ? "profile" : "profiles"}
                      {activeFilters ? ` of ${clients.data.length}` : ""}
                    </p>
                    {rows.length ? (
                      <PortfolioProfiles
                        catalog={clients.data}
                        rows={rows}
                        state={state}
                        filtered={activeFilters}
                        owners={owners.error ? undefined : owners.data}
                        onRefreshCatalog={() => void clients.refetch()}
                      />
                    ) : (
                      <div className="status">
                        <h3>
                          {clients.data.length
                            ? "No profiles found"
                            : "No profiles yet"}
                        </h3>
                        <p className="muted">
                          {clients.data.length
                            ? "Try a different search or clear your filters."
                            : "Add your first client or track a prospect in Business Development."}
                        </p>
                        {activeFilters && (
                          <button className="button" onClick={clear}>
                            Clear filters
                          </button>
                        )}
                        {!activeFilters && permitted && (
                          <button
                            className="button"
                            onClick={() => setCreating(true)}
                          >
                            Add profile
                          </button>
                        )}
                      </div>
                    )}
                    {rows.length > 0 &&
                      (state.view !== "cards" ||
                        state.sort !== "saved" ||
                        activeFilters) && (
                        <p className="muted">
                          To rearrange profiles, choose Card view and Saved
                          order, then clear profile filters.
                        </p>
                      )}
                  </>
                )}
                {state.view === "cards" && permitted && (
                  <button
                    className={styles.addCard}
                    onClick={() => setCreating(true)}
                  >
                    + Add profile
                  </button>
                )}
              </section>
              <PortfolioAttention clients={clients.data} />
            </div>
            <GlobalQuickLog clients={clients.data} />
          </>
        )}
        <CreateProfileDialog
          open={creating}
          onOpenChange={setCreating}
          destinations={destinations}
        />
        <GlobalObjectiveClientPicker
          open={params.get("new") === "objective"}
          onOpenChange={(open) => {
            if (!open) {
              const next = new URLSearchParams(params);
              next.delete("new");
              router.replace(`/portfolio?${next}`, { scroll: false });
            }
          }}
          onContinue={(clientId) =>
            router.push(`/portfolio/${clientId}/objectives?new=1`)
          }
        />
      </div>
    </Shell>
  );
}

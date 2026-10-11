"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Plus, LayoutGrid, List, Search } from "lucide-react";
import type { Destinations } from "@/shared/config/config";
import { Shell } from "@/shared/shell/Shell";
import { QueryState } from "@/shared/ui/QueryState";
import { useClients, useAccountOwners } from "./queries";
import { memberName } from "./contracts";
import { filterClients } from "./filter";
import { CreateProfileDialog } from "./CreateProfileDialog";
import { ProfileResults } from "./ProfileResults";
import { PortfolioPulse } from "./PortfolioPulse";
import { GlobalQuickLog } from "./GlobalQuickLog";
import styles from "./portfolio.module.css";
export function PortfolioIndex({
  destinations,
}: {
  destinations: Destinations;
}) {
  const clients = useClients();
  const owners = useAccountOwners();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const filter = {
    search: params.get("q") ?? "",
    status: params.get("status") ?? "",
    sector: params.get("sector") ?? "",
    owner: params.get("owner") ?? "",
  };
  const view = params.get("view") === "list" ? "list" : "cards";
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }
  const type = params.get("type") ?? "";
  const rows = filterClients(
    clients.data ?? [],
    filter,
    owners.data ?? {},
  ).filter((client) => !type || client.profileType === type);
  const sectors = [
    ...new Set(
      (clients.data ?? [])
        .map((c) => c.sectorTag)
        .filter((s): s is string => Boolean(s)),
    ),
  ].sort();
  const ownerChoices = [
    ...new Map(
      Object.values(owners.data ?? {})
        .filter((a) => a.accountOwner)
        .map((a) => [a.accountOwnerUserId, a.accountOwner]),
    ).entries(),
  ];
  return (
    <Shell destinations={destinations}>
      <div className="page">
        <header className="pageHeader">
          <div className="stack" style={{ gap: 6 }}>
            <p className="eyebrow">Your client portfolio</p>
            <h1 className={styles.title}>
              Portfolio <span>{clients.data?.length ?? "—"}</span>
            </h1>
          </div>
          <button className="button primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            Add profile
          </button>
        </header>
        <PortfolioPulse clients={clients.data} />
        <div className="toolbar">
          <label className={styles.search}>
            <Search size={16} />
            <input
              aria-label="Search profiles"
              autoFocus={params.has("search")}
              placeholder="Search profiles…"
              value={filter.search}
              onChange={(e) => setParam("q", e.target.value)}
            />
          </label>
          <select
            aria-label="Profile status"
            value={filter.status}
            onChange={(e) => setParam("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {[...new Set((clients.data ?? []).map((c) => c.profileStatus))].map(
              (status) => (
                <option key={status}>{status}</option>
              ),
            )}
          </select>
          <select
            aria-label="Sector"
            value={filter.sector}
            onChange={(e) => setParam("sector", e.target.value)}
          >
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Account owner"
            disabled={!owners.data}
            value={filter.owner}
            onChange={(e) => setParam("owner", e.target.value)}
          >
            <option value="">All owners</option>
            {ownerChoices.map(([id, owner]) => (
              <option key={id} value={id ?? ""}>
                {memberName(owner)}
              </option>
            ))}
          </select>
          <span className={styles.viewSwitch}>
            <button
              className="button iconButton"
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => setParam("view", "list")}
            >
              <List size={16} />
            </button>
            <button
              className="button iconButton"
              aria-label="Card view"
              aria-pressed={view === "cards"}
              onClick={() => setParam("view", "cards")}
            >
              <LayoutGrid size={16} />
            </button>
          </span>
        </div>
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
        {clients.data && (
          <>
            <div className={styles.columns}>
              <section className="stack">
                <nav className={styles.tabs} aria-label="Profile type">
                  {[
                    ["All", ""],
                    ["Clients", "CLIENT"],
                    ["Prospects", "PROSPECT"],
                  ].map(([label, value]) => (
                    <button
                      key={label}
                      className={`button ${type === value ? "primary" : ""}`}
                      aria-pressed={type === value}
                      onClick={() => setParam("type", value ?? "")}
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
                    Pipeline
                  </Link>
                </nav>
                {rows.length ? (
                  <ProfileResults
                    rows={rows}
                    view={view}
                    owners={owners.data}
                  />
                ) : (
                  <div className="status">
                    <h3>No profiles found</h3>
                    <p className="muted">
                      Adjust your filters or add a profile.
                    </p>
                  </div>
                )}
              </section>
              <aside className={`card stack ${styles.attention}`}>
                <h3>Needs attention</h3>
                <p className="muted">
                  The portfolio attention feed is not connected yet.
                </p>
                <p className="muted">
                  Objective coverage, attention priority, off-track status and
                  aggregate counts need verified Portfolio contracts.
                </p>
                <small>
                  Open a client to review its current objectives, activity,
                  meetings and work.
                </small>
              </aside>
            </div>
            <GlobalQuickLog clients={clients.data} />
          </>
        )}
        <CreateProfileDialog open={creating} onOpenChange={setCreating} />
      </div>
    </Shell>
  );
}

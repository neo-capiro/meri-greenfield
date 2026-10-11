"use client";
import { LayoutGrid, List } from "lucide-react";
import { sectorLabel } from "@/shared/domain/sector";
import {
  clientSectors,
  memberName,
  type Client,
  type Member,
} from "./contracts";
import { unassignedOwner, type PortfolioIndexState } from "./filter";
import styles from "./portfolio.module.css";

export function IndexFilters({
  state,
  clients,
  owners,
  set,
  clear,
  ownerPending,
}: {
  state: PortfolioIndexState;
  clients: Client[];
  owners?: Record<
    string,
    { accountOwnerUserId: string | null; accountOwner: Member | null }
  >;
  set: (key: string, value: string) => void;
  clear: () => void;
  ownerPending: boolean;
}) {
  const statuses = [...new Set(clients.map((c) => c.profileStatus))].sort();
  const sectors = [...new Set(clients.flatMap(clientSectors))].sort();
  const choices = [
    ...new Map(
      Object.values(owners ?? {}).flatMap((a) =>
        a.accountOwner && a.accountOwnerUserId
          ? [[a.accountOwnerUserId, a.accountOwner] as const]
          : [],
      ),
    ).entries(),
  ].sort((a, b) => memberName(a[1]).localeCompare(memberName(b[1])));
  const filtered = Boolean(
    state.search || state.status || state.sector || state.owner || state.type,
  );
  return (
    <div className={styles.filters} aria-label="Portfolio filters">
      <select
        aria-label="Profile status"
        value={state.status}
        onChange={(e) => set("status", e.target.value)}
      >
        <option value="">All statuses</option>
        {state.status && !statuses.includes(state.status) && (
          <option value={state.status}>
            {state.status} (not in current profiles)
          </option>
        )}
        {statuses.map((status) => (
          <option key={status}>{status}</option>
        ))}
      </select>
      <select
        aria-label="Sector"
        value={state.sector}
        onChange={(e) => set("sector", e.target.value)}
      >
        <option value="">All sectors</option>
        {state.sector && !sectors.includes(state.sector) && (
          <option value={state.sector}>
            {state.sector} (not in current profiles)
          </option>
        )}
        {sectors.map((sector) => (
          <option key={sector} value={sector}>
            {sectorLabel(sector)}
          </option>
        ))}
      </select>
      <select
        aria-label="Account owner"
        disabled={!owners || ownerPending}
        value={state.owner}
        onChange={(e) => set("owner", e.target.value)}
      >
        <option value="">All owners</option>
        <option value={unassignedOwner}>Unassigned</option>
        {state.owner &&
          state.owner !== unassignedOwner &&
          !choices.some(([id]) => id === state.owner) && (
            <option value={state.owner}>Selected owner (not available)</option>
          )}
        {choices.map(([id, owner]) => (
          <option key={id} value={id}>
            {memberName(owner)}
          </option>
        ))}
      </select>
      <select
        aria-label="Sort profiles"
        value={state.sort}
        onChange={(e) => set("sort", e.target.value)}
      >
        <option value="saved">Saved order</option>
        <option value="recent">Recently added</option>
        <option value="name">Name A–Z</option>
      </select>
      {filtered && (
        <button className="button ghost" onClick={clear}>
          Clear filters
        </button>
      )}
      <div className={styles.viewSwitch} aria-label="Profile layout">
        <button
          className="button iconButton"
          aria-label="List view"
          aria-pressed={state.view === "list"}
          onClick={() => set("view", "list")}
        >
          <List size={16} />
        </button>
        <button
          className="button iconButton"
          aria-label="Card view"
          aria-pressed={state.view === "cards"}
          onClick={() => set("view", "cards")}
        >
          <LayoutGrid size={16} />
        </button>
      </div>
    </div>
  );
}

"use client";
import type { Client, Member } from "./contracts";
import type { PortfolioIndexState } from "./filter";
import { ProfileCard, ProfileResults } from "./ProfileResults";
import { PortfolioLayoutEditor, usePortfolioLayout } from "./layout/public";

/** Mounted after the canonical client catalog loads; filters never become saved subsets. */
export function PortfolioProfiles({
  catalog,
  rows,
  state,
  filtered,
  owners,
  onRefreshCatalog,
}: {
  catalog: Client[];
  rows: Client[];
  state: PortfolioIndexState;
  filtered: boolean;
  owners?: Record<string, { accountOwner: Member | null }>;
  onRefreshCatalog: () => void;
}) {
  const layout = usePortfolioLayout(catalog.map(({ id }) => id));
  const byId = new Map(rows.map((client) => [client.id, client]));
  const ordered =
    state.sort === "saved"
      ? layout.orderedIds.flatMap((id) => {
          const client = byId.get(id);
          return client ? [client] : [];
        })
      : rows;
  return (
    <>
      {layout.error && (
        <button className="button" onClick={onRefreshCatalog}>
          Refresh profiles
        </button>
      )}
      {state.view === "cards" && state.sort === "saved" && !filtered ? (
        <PortfolioLayoutEditor
          cards={catalog.map(({ id, name }) => ({ id, name }))}
          layout={layout}
          renderCard={(id) => {
            const client = byId.get(id);
            return client ? (
              <ProfileCard client={client} ownership={owners?.[id]} />
            ) : null;
          }}
        />
      ) : (
        <ProfileResults rows={ordered} view={state.view} owners={owners} />
      )}
    </>
  );
}

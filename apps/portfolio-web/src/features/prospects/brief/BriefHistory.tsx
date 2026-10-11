"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { QueryState } from "@/shared/ui/QueryState";
import { listVersions, type BriefScope } from "./api";
import { BriefDate } from "./BriefDate";
export function BriefHistory({
  scope,
  onSelect,
}: {
  scope: BriefScope;
  onSelect: (version: { id: string; versionNumber: number }) => void;
}) {
  const api = useApi();
  const history = useQuery({
    queryKey: ["prospect-brief-history", scope.tenantId, scope.prospectId],
    queryFn: ({ signal }) => listVersions(api, scope, signal),
  });
  return (
    <section className="stack" aria-label="Saved brief versions">
      <h3>Version history</h3>
      <QueryState
        pending={history.isPending}
        error={history.error}
        retry={() => void history.refetch()}
      />
      {history.data?.versions.map((version) => (
        <button
          key={version.id}
          className="button"
          onClick={() => onSelect(version)}
        >
          Version {version.versionNumber} ·{" "}
          <BriefDate value={version.createdAt} /> · {version.citationCount}{" "}
          citations
        </button>
      ))}
      {history.data && !history.data.versions.length && (
        <p>No saved versions were returned.</p>
      )}
      <small>
        The service returns the full saved history, up to its 100-version limit.
        Each version preserves its original source snapshot.
      </small>
    </section>
  );
}

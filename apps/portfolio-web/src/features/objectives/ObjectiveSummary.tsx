"use client";
import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import { QueryState } from "@/shared/ui/QueryState";
import { useObjectives } from "./queries";
import { statusLabels } from "./contracts";
export function ObjectiveSummary({ clientId }: { clientId: string }) {
  const query = useObjectives(clientId);
  return (
    <section className="card stack">
      <header className="row between">
        <h2>Objectives</h2>
        <Link
          className="button ghost iconButton"
          href={`/portfolio/${clientId}/objectives?new=1`}
          aria-label="New objective"
        >
          <Plus size={16} />
        </Link>
      </header>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data?.slice(0, 3).map((objective) => (
        <Link
          className="stack"
          key={objective.id}
          href={`/portfolio/${clientId}/objectives?objective=${objective.id}`}
        >
          <div className="row between">
            <strong>{objective.outcome || "Untitled objective"}</strong>
            <span className="chip">{statusLabels[objective.status]}</span>
          </div>
          <p className="muted">
            {objective.minimumWin || "Minimum win not defined"}
          </p>
        </Link>
      ))}
      {query.data?.length === 0 && (
        <p className="muted">
          No objectives yet. Define the first outcome for this client.
        </p>
      )}
      <Link className="button" href={`/portfolio/${clientId}/objectives`}>
        View objectives
        <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}

"use client";
import { useDeleteObjective } from "./mutations";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { AdvocacyHistory } from "@/features/advocacy/public";
import { useMemberOptions, memberName } from "@/features/portfolio/public";
import { useObjectives } from "./queries";
import { statusLabels, type Objective } from "./contracts";
import { ObjectiveEditor } from "./ObjectiveEditor";
import styles from "./objectives.module.css";
export function ObjectivesPage({ clientId }: { clientId: string }) {
  const query = useObjectives(clientId);
  const members = useMemberOptions();
  const params = useSearchParams();
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [deleting, setDeleting] = useState<Objective>();
  const selected = query.data?.find((o) => o.id === params.get("objective"));
  const creating = params.has("new");
  const remove = useDeleteObjective(clientId, () => setDeleting(undefined));
  function navigate(key?: string, value?: string) {
    const next = new URLSearchParams(params);
    next.delete("objective");
    next.delete("new");
    if (key && value) next.set(key, value);
    router.replace(`/portfolio/${clientId}/objectives?${next}`, {
      scroll: false,
    });
  }
  return (
    <div className="page">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Outcomes and institutional memory</p>
          <h1>Objectives</h1>
        </div>
        <button className="button primary" onClick={() => navigate("new", "1")}>
          <Plus size={16} />
          New objective
        </button>
      </header>
      <div className={styles.columns}>
        <AdvocacyHistory clientId={clientId} />
        <section className="stack">
          <header className="row between">
            <h2>Current objectives</h2>
            <select
              aria-label="Objective status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </header>
          <QueryState
            pending={query.isPending}
            error={query.error}
            retry={() => void query.refetch()}
          />
          {query.data
            ?.filter((o) => !filter || o.status === filter)
            .map((objective) => (
              <article className="card stack" key={objective.id}>
                <div className="row between">
                  <span className="chip">{statusLabels[objective.status]}</span>
                  <button
                    className="button ghost iconButton"
                    aria-label={`Delete ${objective.outcome || "untitled objective"}`}
                    onClick={() => setDeleting(objective)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <h2>
                  <button
                    className={styles.titleButton}
                    onClick={() => navigate("objective", objective.id)}
                  >
                    {objective.outcome || "Untitled objective"}
                  </button>
                </h2>
                <p className="muted">
                  {objective.governmentProblem ||
                    "Government problem not defined"}
                </p>
                <hr className="divider" />
                <p>
                  <span className="eyebrow">Minimum win </span>
                  {objective.minimumWin || "Not defined"}
                </p>
                <div className="row between">
                  <small>
                    {members.data
                      ? memberName(
                          members.data.find(
                            (m) => m.id === objective.ownerUserId,
                          ),
                        )
                      : "Owner unavailable"}
                  </small>
                  <small>
                    {objective.readiness.completedFields}/4 required fields
                  </small>
                </div>
                <button
                  className="button"
                  onClick={() => navigate("objective", objective.id)}
                >
                  Open objective
                </button>
              </article>
            ))}
          {query.data?.length === 0 && (
            <div className="status">
              <h3>No current objectives</h3>
              <p className="muted">
                Create a draft to define the client&apos;s next outcome.
              </p>
            </div>
          )}
          {params.has("objective") && query.isSuccess && !selected && (
            <p role="alert">
              This objective is unavailable or has been removed.
            </p>
          )}
        </section>
      </div>
      <ObjectiveEditor
        key={selected?.id ?? (creating ? "new" : "closed")}
        clientId={clientId}
        objective={selected}
        open={creating || Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) navigate();
        }}
      />
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(undefined);
        }}
        title="Delete objective"
        description="The objective will be removed from current objectives; its audit history is retained."
      >
        <p>{deleting?.outcome || "Untitled objective"}</p>
        <QueryState error={remove.error} />
        <div className="formActions">
          <button
            className="button"
            disabled={remove.isPending}
            onClick={() => setDeleting(undefined)}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={remove.isPending}
            onClick={() => {
              if (deleting) remove.mutate(deleting);
            }}
          >
            Delete objective
          </button>
        </div>
      </Dialog>
    </div>
  );
}

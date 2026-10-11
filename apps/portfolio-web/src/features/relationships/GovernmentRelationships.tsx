"use client";
import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Destinations } from "@/shared/config/config";
import { QueryState } from "@/shared/ui/QueryState";
import { useGovernmentTargets } from "./target-queries";
import { type GovernmentTarget, targetKind } from "./target-contracts";
import { AddTargetDialog } from "./AddTargetDialog";
import { TargetDrawer } from "./TargetDrawer";
import { TargetRecommendations } from "./TargetRecommendations";
import { PriorityTarget } from "./PriorityTarget";
import { RelationshipTypeNavigation } from "./RelationshipTypeNavigation";
import styles from "./targets.module.css";
export function GovernmentRelationships({
  clientId,
  destinations,
}: {
  clientId: string;
  destinations: Destinations;
}) {
  const query = useGovernmentTargets(clientId);
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [adding, setAdding] = useState<"all" | "committee" | null>(null);
  const selected = params.get("target");
  const target = query.data?.find((row) => row.memberId === selected);
  function open(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set("target", id);
    else next.delete("target");
    router.replace(`${path}?${next}`, { scroll: false });
  }
  const targets = query.data ?? [];
  const priority = targets
    .filter((row) => row.tier !== null)
    .sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4))
    .slice(0, 3);
  const groups = [
    [
      "Congressional and state targets",
      targets.filter((row) => row.sourceDirectory !== "staff"),
    ],
    [
      "Committee staff targets",
      targets.filter(
        (row) =>
          row.sourceDirectory === "staff" && row.staffKind === "committee",
      ),
    ],
    [
      "Personal-office and other staff",
      targets.filter(
        (row) =>
          row.sourceDirectory === "staff" && row.staffKind !== "committee",
      ),
    ],
  ] as const;
  return (
    <div className="page stack">
      <header className="row between">
        <h1>Relationships</h1>
        <button className="button primary" onClick={() => setAdding("all")}>
          Add relationship
        </button>
      </header>
      <RelationshipTypeNavigation />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <>
          <section className={styles.prioritySection}>
            <header className="row between">
              <h2>Priority targets</h2>
              <small>
                {priority.length} of {targets.length} targets
              </small>
            </header>
            <div className={styles.priority}>
              {priority.map((row, index) => (
                <PriorityTarget
                  key={row.id}
                  target={row}
                  index={index}
                  onOpen={open}
                />
              ))}
            </div>
            {priority.length === 0 && (
              <p className="empty">
                Assign a tier to a saved target to prioritize it.
              </p>
            )}
          </section>
          {groups.map(([title, rows]) => (
            <TargetTable
              key={title}
              title={title}
              rows={rows}
              onOpen={open}
              onAdd={() =>
                setAdding(
                  title === "Committee staff targets" ? "committee" : "all",
                )
              }
            />
          ))}
          <TargetRecommendations clientId={clientId} targets={targets} />
        </>
      )}
      {adding && (
        <AddTargetDialog
          clientId={clientId}
          targets={targets}
          committee={adding === "committee"}
          onClose={() => setAdding(null)}
        />
      )}
      {target && (
        <TargetDrawer
          key={target.memberId}
          clientId={clientId}
          target={target}
          base={destinations.existingApp}
          onClose={() => open(null)}
        />
      )}
      {selected && !target && query.isSuccess && (
        <p role="alert">
          This saved target is no longer available.{" "}
          <button className="button" onClick={() => open(null)}>
            Close target
          </button>
        </p>
      )}
    </div>
  );
}
function TargetTable({
  title,
  rows,
  onOpen,
  onAdd,
}: {
  title: string;
  rows: GovernmentTarget[];
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className={styles.targetTable} aria-label={title}>
      <header className="row between">
        <h2 className="eyebrow">
          {title} · {rows.length}
        </h2>
        <button className="button ghost" onClick={onAdd}>
          {title === "Committee staff targets"
            ? "Add committee staff"
            : "Add relationship"}
        </button>
      </header>
      <div className={styles.tableScroll}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Jurisdiction</th>
              <th>Office</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    className="button ghost"
                    onClick={() => onOpen(row.memberId)}
                  >
                    {row.memberName ?? row.memberId}
                  </button>
                </td>
                <td>{targetKind(row)}</td>
                <td>
                  {[row.state, row.chamber].filter(Boolean).join(" · ") || "—"}
                </td>
                <td>{row.committee ?? "—"}</td>
                <td>{row.tier ? `Tier ${row.tier}` : "Untiered"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="empty">No saved targets in this group.</p>
      )}
    </section>
  );
}

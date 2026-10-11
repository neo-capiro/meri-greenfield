"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { BriefVersion } from "./contracts";
import { resolveCitation } from "./api";
import { sourceHref } from "./editing";
import styles from "./brief.module.css";
import { BriefDate } from "./BriefDate";

export function BriefSource({
  prospectId,
  version,
  index,
  current,
  onClose,
}: {
  prospectId: string;
  version: BriefVersion;
  index: number;
  current: boolean;
  onClose: () => void;
}) {
  const api = useApi();
  const citation = version.citations[index];
  const resolution = useQuery({
    queryKey: ["prospect-brief-source", prospectId, version.id, index],
    enabled: current && !!citation,
    queryFn: ({ signal }) => {
      if (!citation) throw new Error("This version has no such citation.");
      return resolveCitation(api, prospectId, index, citation, signal);
    },
  });
  const saved =
    citation &&
    version.sourceSnapshot.evidence.find(
      (item) =>
        item.sourceFamily === citation.sourceFamily &&
        (item.recordId ?? item.originalSourceId ?? "(no record id)") ===
          citation.recordId,
    );
  const href = sourceHref(citation?.locator ?? null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Brief source ${index + 1}`}
      description={`Saved citation for version ${version.versionNumber}.`}
      className={styles.sourceDialog}
    >
      {citation ? (
        <div className="stack">
          <h3>{citation.title}</h3>
          <p>
            {citation.originalSourceName ?? citation.sourceFamily} ·{" "}
            <code>{citation.originalSourceId ?? citation.recordId}</code>
          </p>
          <dl className={styles.dates}>
            <dt>Event date</dt>
            <dd>
              <BriefDate value={citation.eventDate} />
            </dd>
            <dt>Source updated</dt>
            <dd>
              <BriefDate value={citation.sourceUpdatedAt} />
            </dd>
            <dt>Retrieved</dt>
            <dd>
              <BriefDate value={citation.retrievedAt} />
            </dd>
            <dt>Relationship</dt>
            <dd>{citation.relationshipStrength}</dd>
            <dt>Stage</dt>
            <dd>{citation.stage ?? "Not provided"}</dd>
          </dl>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              Open original source ↗
            </a>
          ) : (
            <p className="muted">
              No usable source link was saved.
              {citation.locator && ` Reference: ${citation.locator}`}
            </p>
          )}
          <section className="stack">
            <h3>Saved snapshot</h3>
            <small>
              Identity basis: {version.sourceSnapshot.identityBasis}
            </small>
            <small>
              Snapshot built{" "}
              <BriefDate value={version.sourceSnapshot.generatedAt} />
            </small>
            <p>
              {saved?.title ??
                "No matching evidence item is present in the saved snapshot."}
            </p>
            {saved && (
              <small>
                Status: {saved.status}; scope checked:{" "}
                {saved.scopeChecked ?? "Not provided"}
              </small>
            )}
          </section>
          {current ? (
            <>
              <QueryState
                pending={resolution.isPending}
                error={resolution.error}
                retry={() => void resolution.refetch()}
              />
              {resolution.data &&
                (resolution.data.resolvable ? (
                  <section className="stack">
                    <h3>Current dossier</h3>
                    <p>
                      {resolution.data.currentDossierEvidence?.title ??
                        "The citation resolves through the saved snapshot; no current dossier match was returned."}
                    </p>
                  </section>
                ) : (
                  <p role="note">{resolution.data.message}</p>
                ))}
            </>
          ) : (
            <p role="note">
              Historical source shown from its immutable snapshot. Current
              dossier checks are available only for the current version.
            </p>
          )}
        </div>
      ) : (
        <p role="alert">This version has no such citation.</p>
      )}
    </Dialog>
  );
}

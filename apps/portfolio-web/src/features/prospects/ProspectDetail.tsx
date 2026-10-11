"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell } from "@/shared/shell/Shell";
import type { Destinations } from "@/shared/config/config";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import {
  initials,
  safeWebsite,
  memberName,
  useMemberOptions,
} from "@/features/portfolio/public";
import { useProspect, useStageCatalog } from "./queries";
import { stageLabel } from "./contracts";
import { ProspectEditor } from "./ProspectEditor";
import { NextStepEditor } from "./NextStepEditor";
import { ProspectHistory } from "./ProspectHistory";
import { StageEditor } from "./StageEditor";
import { useProspectVisibility } from "./mutations";
import { ProspectContacts } from "./contacts/public";
import { ProspectClientLink } from "./conversion/public";
import { ProspectBrief } from "./brief/public";
import { ProspectProposals } from "./proposals/public";
import styles from "./prospects.module.css";
export function ProspectDetail({
  id,
  destinations,
}: {
  id: string;
  destinations: Destinations;
}) {
  const query = useProspect(id);
  const catalog = useStageCatalog();
  const owners = useMemberOptions();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState(false);
  const [archive, setArchive] = useState(false);
  const [stage, setStage] = useState(false);
  const visibility = useProspectVisibility(id, () => {
    setArchive(false);
    router.push("/portfolio/prospects");
  });
  const record = query.data;
  return (
    <Shell destinations={destinations}>
      <div className="page stack">
        <nav className="row" aria-label="Breadcrumb">
          <Link href="/portfolio/prospects">← Prospects</Link>
          <span>/</span>
          <span>{record?.displayName ?? "Company details"}</span>
        </nav>
        <QueryState
          pending={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {record && (
          <>
            <header className="pageHeader">
              <div className="row">
                <span className={styles.monogram}>
                  {initials(record.displayName)}
                </span>
                <h1>{record.displayName}</h1>
                <span className="chip">Prospect</span>
              </div>
              <div className="row">
                <span className="chip">{stageLabel(record.stage)}</span>
                <ProspectClientLink record={record} />
                <button
                  className="button primary"
                  onClick={() => setEditing(true)}
                >
                  Edit details
                </button>
              </div>
            </header>
            <div className={styles.columns}>
              <div className="stack">
                <section className="card stack">
                  <p>{record.description ?? "No company description yet."}</p>
                  {safeWebsite(record.website) && (
                    <a
                      href={safeWebsite(record.website)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {record.website} ↗
                    </a>
                  )}
                  {record.serviceHypothesis && (
                    <p>
                      <span className="eyebrow">Focus </span>
                      {record.serviceHypothesis}
                    </p>
                  )}
                  <hr className="divider" />
                  <div className="row">
                    <small>Owner</small>
                    <span>
                      {memberName(
                        owners.data?.find(
                          (owner) => owner.id === record.ownerUserId,
                        ),
                      )}
                    </span>
                    <small>
                      Added {new Date(record.createdAt).toLocaleDateString()}
                    </small>
                    {record.geography && <span>{record.geography}</span>}
                  </div>
                </section>
                <section className="card stack">
                  <header className="row between">
                    <h2>Pipeline stage</h2>
                    <button className="button" onClick={() => setStage(true)}>
                      Change stage
                    </button>
                  </header>
                  <p className="muted">
                    {catalog.data
                      ? "Stage changes are recorded in activity. Conversion and billing require separate actions."
                      : "Stage updates are currently unavailable. Your existing stage is preserved."}
                  </p>
                </section>
                <ProspectBrief prospectId={id} />
                <ProspectProposals
                  prospectId={id}
                  workspaceUrl={destinations.workspace}
                />
                <ProspectHistory id={id} />
              </div>
              <div className="stack">
                <section className="card stack">
                  <header className="row between">
                    <h2>Next step</h2>
                    <button className="button" onClick={() => setNext(true)}>
                      Edit
                    </button>
                  </header>
                  <p>{record.nextAction ?? "No next step assigned."}</p>
                  {record.nextActionDueAt && (
                    <time dateTime={record.nextActionDueAt}>
                      <small>
                        Due {new Date(record.nextActionDueAt).toLocaleString()}
                      </small>
                    </time>
                  )}
                </section>
                <ProspectContacts prospectId={id} />
                <button className="button" onClick={() => setArchive(true)}>
                  {record.status === "dismissed"
                    ? "Restore prospect"
                    : "Archive prospect"}
                </button>
              </div>
            </div>
            {editing && (
              <ProspectEditor
                record={record}
                onClose={() => setEditing(false)}
                onSaved={() => setEditing(false)}
              />
            )}
            {next && (
              <NextStepEditor record={record} onClose={() => setNext(false)} />
            )}
            {stage && (
              <StageEditor
                record={record}
                catalog={catalog.data}
                onClose={() => setStage(false)}
              />
            )}
            <Dialog
              open={archive}
              title={
                record.status === "dismissed"
                  ? "Restore prospect"
                  : "Archive prospect"
              }
              description="History is preserved. No client conversion, email or billing action is performed."
              onOpenChange={(open) => {
                if (!visibility.isPending) setArchive(open);
              }}
            >
              <QueryState error={visibility.error} />
              <button
                className="button primary"
                disabled={visibility.isPending}
                onClick={() =>
                  visibility.mutate(
                    record.status === "dismissed" ? "restore" : "dismiss",
                  )
                }
              >
                Confirm {record.status === "dismissed" ? "restore" : "archive"}
              </button>
            </Dialog>
          </>
        )}
      </div>
    </Shell>
  );
}

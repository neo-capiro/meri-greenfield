"use client";
import { useRef, useState } from "react";
import { useIdentity } from "@/shared/auth/identity";
import { QueryState } from "@/shared/ui/QueryState";
import { TemplateCatalog } from "./TemplateCatalog";
import styles from "./proposals.module.css";

export function ProspectProposals({
  prospectId,
  workspaceUrl,
}: {
  prospectId: string;
  workspaceUrl?: string;
}) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const tenantId = identity.data?.tenant?.id;
  const authorized =
    identity.isSuccess && !identity.error && !identity.isPending && !!tenantId;
  return (
    <section className={`card ${styles.card}`} aria-label="Proposal">
      <h2>Proposal</h2>
      <p>
        Review available templates in Workspace. Creating and sending a proposal
        for this prospect is unavailable.
      </p>
      <QueryState
        pending={identity.isPending}
        error={identity.error}
        retry={() => void identity.refetch()}
      />
      {authorized ? (
        <div className="row">
          <button
            ref={trigger}
            className="button"
            onClick={() => setOpen(true)}
          >
            Browse templates
          </button>
          {workspaceUrl && (
            <a className="button" href={workspaceUrl}>
              Open Workspace ↗
            </a>
          )}
        </div>
      ) : !identity.isPending && !identity.error ? (
        <p className="muted">
          An active account membership is required to browse templates.
        </p>
      ) : null}
      <small className="muted">
        Proposal documents and send history cannot be linked to this prospect
        yet.
      </small>
      {authorized && tenantId && open && (
        <TemplateCatalog
          key={`${identity.data?.user.id}:${tenantId}:${prospectId}`}
          tenantId={tenantId}
          onClose={() => setOpen(false)}
          onRestoreFocus={() => trigger.current?.focus()}
        />
      )}
    </section>
  );
}

"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useMatters, useMatter } from "./queries";
import { MatterEditor } from "./MatterEditor";
import { RecordDialog } from "./RecordDialog";
import { MatterDetail } from "./MatterDetail";
import { CorrectionDialog, type CorrectionContext } from "./CorrectionDialog";
import { UnassignedRecords } from "./UnassignedRecords";
import { useAdvocacyAccess } from "./access";
import type { Matter } from "./contracts";
import styles from "./advocacy.module.css";

export function AdvocacyHistory({ clientId }: { clientId: string }) {
  const { identity, canRead, canEdit } = useAdvocacyAccess();
  const matters = useMatters(clientId, canRead);
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(() =>
    params.get("matter"),
  );
  const detail = useMatter(clientId, selected, canRead);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Matter>();
  const [addRecord, setAddRecord] = useState(false);
  const [correction, setCorrection] = useState<CorrectionContext>();
  const [notice, setNotice] = useState("");
  const current = canRead && !detail.error ? detail.data : undefined;
  return (
    <section
      className={`card stack ${styles.history}`}
      aria-label="Advocacy history"
    >
      <header className="row between">
        <div>
          <p className="eyebrow">Institutional memory</p>
          <h2>Advocacy history</h2>
        </div>
        <button
          className="button"
          disabled={!canEdit}
          onClick={() => setCreating(true)}
        >
          <Plus size={14} aria-hidden="true" />
          New matter
        </button>
      </header>
      <QueryState
        pending={identity.isPending || identity.isFetching}
        error={identity.error}
        retry={() => void identity.refetch()}
      />
      {!identity.isPending &&
        !identity.isFetching &&
        !identity.error &&
        !canRead && (
          <p className="status">This account cannot access advocacy history.</p>
        )}
      {notice && (
        <p className="status" role="status">
          {notice}
        </p>
      )}
      {canRead && (
        <>
          <QueryState
            pending={matters.isPending}
            error={matters.error}
            retry={() => void matters.refetch()}
          />
          {!matters.error &&
            matters.data?.map((matter) => (
              <button
                className={`button ghost stack ${styles.matterButton}`}
                key={matter.id}
                onClick={() => setSelected(matter.id)}
              >
                <span className="row between">
                  <strong>{matter.title}</strong>
                  <span className="chip">
                    {matter.status.replaceAll("_", " ")}
                  </span>
                </span>
                <small>
                  {matter.recordCount} records · {matter.outcomeCount} outcomes
                </small>
                {matter.summary && <p className="muted">{matter.summary}</p>}
              </button>
            ))}
          {!matters.error && matters.data?.length === 0 && (
            <p className="empty">No advocacy matters yet.</p>
          )}
          <UnassignedRecords
            clientId={clientId}
            canEdit={canEdit}
            onCorrect={setCorrection}
          />
        </>
      )}
      <MatterEditor
        key={editing?.id ?? "new"}
        clientId={clientId}
        matter={editing}
        open={creating || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(undefined);
          }
        }}
      />
      <Dialog
        open={Boolean(selected) && !correction}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={current?.title ?? "Advocacy matter"}
        className={styles.detail}
      >
        {canRead ? (
          <>
            <QueryState
              pending={detail.isPending}
              error={detail.error}
              retry={() => void detail.refetch()}
            />
            {current && (
              <MatterDetail
                matter={current}
                canEdit={canEdit && !matters.error}
                onEdit={() => setEditing(current)}
                onAdd={() => setAddRecord(true)}
                onCorrect={setCorrection}
              />
            )}
          </>
        ) : (
          <p className="status">Current advocacy access is unavailable.</p>
        )}
      </Dialog>
      {addRecord && (
        <RecordDialog
          clientId={clientId}
          matterId={selected}
          onClose={() => setAddRecord(false)}
        />
      )}
      {correction && (
        <CorrectionDialog
          clientId={clientId}
          context={correction}
          matters={!matters.error ? (matters.data ?? []) : []}
          onClose={() => setCorrection(undefined)}
          onSaved={() => {
            setCorrection(undefined);
            setNotice("Updated history reflects this correction.");
          }}
        />
      )}
    </section>
  );
}

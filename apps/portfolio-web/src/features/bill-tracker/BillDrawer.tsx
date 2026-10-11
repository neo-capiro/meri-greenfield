"use client";
import { useState } from "react";
import type { TrackerBackend, Destinations } from "@/shared/config/config";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { TrackedBill } from "./contracts";
import { useTrackBill } from "./queries";
import { BillHearings } from "./BillHearings";
import { billDate, fullBoardHref } from "./hearings";
import styles from "./bill-updates.module.css";
export function BillDrawer({
  bill,
  clientId,
  backend,
  destinations,
  onClose,
}: {
  bill: TrackedBill;
  clientId: string;
  backend: TrackerBackend;
  destinations: Destinations;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : document.activeElement,
  );
  const untrack = useTrackBill(clientId, backend, onClose);
  const trackedDate = billDate(bill.trackedAt);
  const actionDate = billDate(bill.latestActionDate);
  const board = fullBoardHref(destinations.existingApp, clientId);
  const detail = destinations.existingApp
    ? `${destinations.existingApp}/bills/${encodeURIComponent(bill.billId)}?clientId=${encodeURIComponent(clientId)}`
    : undefined;
  return (
    <Dialog
      open
      className={styles.dialog}
      title={bill.displayNum}
      description={bill.title ?? "Bill details"}
      onCloseAutoFocus={(event) => {
        if (opener instanceof HTMLElement && opener.isConnected) {
          event.preventDefault();
          opener.focus();
        }
      }}
      onOpenChange={(open) => {
        if (!open && !untrack.isPending) onClose();
      }}
    >
      <div className={styles.body}>
        <div className="row">
          <span
            className="chip"
            title="Estimate supplied by the configured service, not a confirmed outcome."
          >
            {Math.round(bill.probability * 100)}% estimate
          </span>
          {bill.changeLabel && (
            <span
              className={`chip ${styles.change}`}
              data-tone={bill.changeTone}
            >
              {bill.changeLabel}
            </span>
          )}
          {bill.terminalRisk && <span className="danger">Terminal risk</span>}
          {bill.jurisdiction && <span>{bill.jurisdiction}</span>}
        </div>
        <section className={styles.section}>
          <h3>Latest update</h3>
          <strong>{bill.canonicalStatus ?? bill.stage}</strong>
          <p>{bill.latestActionText ?? "No latest action available."}</p>
          {actionDate && (
            <time dateTime={bill.latestActionDate ?? undefined}>
              {actionDate}
            </time>
          )}
        </section>
        {bill.note && (
          <section className={styles.section}>
            <h3>Note</h3>
            <p>{bill.note}</p>
          </section>
        )}
        {bill.tags.length > 0 && (
          <section className={styles.section}>
            <h3>Matched topics</h3>
            <div className="row">
              {bill.tags.map((tag, index) => (
                <span key={`${tag}-${index}`} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}
        <BillHearings
          clientId={clientId}
          billId={bill.billId}
          backend={backend}
          existingApp={destinations.existingApp}
        />
        <footer className={styles.footer}>
          {trackedDate ? (
            <time dateTime={bill.trackedAt ?? undefined}>
              Tracked {trackedDate}
            </time>
          ) : (
            <span className="muted">Tracked date unavailable</span>
          )}
          {board ? (
            <a href={board}>Open full board →</a>
          ) : (
            <span className="muted">
              Full board is unavailable in this environment.
            </span>
          )}
        </footer>
        <div className={styles.secondary}>
          {detail ? (
            <a className="button" href={detail}>
              Open Bill 360 ↗
            </a>
          ) : (
            <p className="muted">
              Bill 360 is unavailable in this environment.
            </p>
          )}
        </div>
        {confirm ? (
          <>
            <p>Remove this bill from the selected client tracker?</p>
            <QueryState error={untrack.error} />
            <div className="row">
              <button
                className="button"
                disabled={untrack.isPending}
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="button"
                disabled={untrack.isPending}
                onClick={() =>
                  untrack.mutate({ billId: bill.billId, track: false })
                }
              >
                {untrack.isPending ? "Removing…" : "Confirm untrack"}
              </button>
            </div>
          </>
        ) : (
          <button className="button" onClick={() => setConfirm(true)}>
            Untrack bill
          </button>
        )}
      </div>
    </Dialog>
  );
}

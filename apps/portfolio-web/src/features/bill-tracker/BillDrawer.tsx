"use client";
import { useState } from "react";
import type { TrackerBackend, Destinations } from "@/shared/config/config";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { TrackedBill } from "./contracts";
import { useTrackBill } from "./queries";
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
  const untrack = useTrackBill(clientId, backend, onClose);
  const detail = destinations.existingApp
    ? `${destinations.existingApp}/bills/${encodeURIComponent(bill.billId)}?clientId=${encodeURIComponent(clientId)}`
    : undefined;
  return (
    <Dialog
      open
      drawer
      title={bill.displayNum}
      description={bill.title ?? "Bill details"}
      onOpenChange={(open) => {
        if (!open && !untrack.isPending) onClose();
      }}
    >
      <div className="stack">
        <div className="row">
          <span className="chip">{bill.canonicalStatus ?? bill.stage}</span>
          {bill.terminalRisk && <span className="danger">Terminal risk</span>}
          {bill.jurisdiction && <span>{bill.jurisdiction}</span>}
        </div>
        <section className="stack">
          <h3>Latest official action</h3>
          <p>{bill.latestActionText ?? "No latest action available."}</p>
          {bill.latestActionDate && (
            <time dateTime={bill.latestActionDate}>
              {bill.latestActionDate.slice(0, 10)}
            </time>
          )}
        </section>
        <section>
          <h3>Passage estimate</h3>
          <p>
            {Math.round(bill.probability * 100)}% · supplied by the configured
            service
          </p>
          <small className="muted">
            An estimate is not a confirmed legislative outcome.
          </small>
        </section>
        {bill.tags.length > 0 && (
          <div className="row">
            {bill.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}
        {bill.note && (
          <section>
            <h3>Tracking note</h3>
            <p>{bill.note}</p>
          </section>
        )}
        {bill.hearingCount !== undefined && (
          <p>{bill.hearingCount} linked hearings</p>
        )}
        {detail ? (
          <a className="button" href={detail}>
            Open Bill 360 ↗
          </a>
        ) : (
          <p className="muted">Bill 360 is unavailable in this environment.</p>
        )}
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

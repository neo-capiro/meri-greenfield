"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { TrackerBackend } from "@/shared/config/config";
import { useBillSearch, useBillJurisdictions, useTrackBill } from "./queries";
export function TrackBillDialog({
  clientId,
  backend,
  onClose,
}: {
  clientId: string;
  backend: TrackerBackend;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [jurisdictions, setJurisdictions] = useState(["US"]);
  const [selected, setSelected] = useState("");
  const corpus = useBillJurisdictions(backend);
  const results = useBillSearch(clientId, backend, q, jurisdictions);
  const track = useTrackBill(clientId, backend, onClose);
  return (
    <Dialog
      open
      title="Track a bill"
      description="Search by bill number or title, then choose a bill to track for this client."
      onOpenChange={(open) => {
        if (!open && !track.isPending) onClose();
      }}
    >
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          setSelected("");
          setQ(input.trim());
        }}
      >
        <input
          aria-label="Bill number or title"
          value={input}
          maxLength={200}
          autoFocus
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          className="button"
          disabled={input.trim().length < 2 || track.isPending}
        >
          Search
        </button>
      </form>
      {backend === "intelligence" && (
        <fieldset className="row">
          <legend>Jurisdictions</legend>
          {corpus.data?.jurisdictions.map(({ key }) => (
            <label className="row" key={key}>
              <input
                type="checkbox"
                checked={jurisdictions.includes(key)}
                onChange={(event) => {
                  setSelected("");
                  setJurisdictions((current) =>
                    event.target.checked
                      ? [...current, key]
                      : current.filter((value) => value !== key),
                  );
                }}
              />
              {key === "US" ? "Federal" : key}
            </label>
          ))}
        </fieldset>
      )}
      {backend === "core" && (
        <p className="muted">Federal bills in the current Congress.</p>
      )}
      {!jurisdictions.length && (
        <p role="status">
          No jurisdiction selected. Search includes all available jurisdictions.
        </p>
      )}
      <QueryState
        pending={Boolean(q) && results.isPending}
        error={results.error ?? corpus.error}
        retry={() => {
          void results.refetch();
          if (backend === "intelligence") void corpus.refetch();
        }}
      />
      {results.data && (
        <fieldset className="stack">
          <legend>Search results</legend>
          {results.data.map((bill) => (
            <label className="row" key={bill.billId}>
              <input
                type="radio"
                name="bill"
                value={bill.billId}
                checked={selected === bill.billId}
                onChange={() => setSelected(bill.billId)}
              />
              <span>
                <strong className="mono">{bill.displayNum}</strong>{" "}
                {bill.jurisdiction && <small>{bill.jurisdiction}</small>}
                <br />
                {bill.title ?? "Title unavailable"}
              </span>
            </label>
          ))}
          {!results.data.length && <p className="empty">No matching bills.</p>}
        </fieldset>
      )}
      <QueryState error={track.error} />
      <button
        className="button primary"
        disabled={!selected || track.isPending}
        onClick={() => track.mutate({ billId: selected, track: true })}
      >
        {track.isPending ? "Tracking…" : "Track selected bill"}
      </button>
    </Dialog>
  );
}

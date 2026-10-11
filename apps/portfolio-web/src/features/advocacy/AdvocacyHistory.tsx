"use client";
import { useAddAdvocacyRecord } from "./mutations";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useMatters, useMatter } from "./queries";
import { MatterEditor } from "./MatterEditor";
import type { Matter } from "./contracts";
export function AdvocacyHistory({ clientId }: { clientId: string }) {
  const matters = useMatters(clientId);
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useMatter(clientId, selected);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Matter>();
  const [addRecord, setAddRecord] = useState(false);
  return (
    <section className="card stack">
      <header className="row between">
        <div>
          <p className="eyebrow">Institutional memory</p>
          <h2>Advocacy history</h2>
        </div>
        <button className="button" onClick={() => setCreating(true)}>
          <Plus size={14} />
          New matter
        </button>
      </header>
      <QueryState
        pending={matters.isPending}
        error={matters.error}
        retry={() => void matters.refetch()}
      />
      {matters.data?.map((matter) => (
        <button
          className="button ghost stack"
          style={{ alignItems: "stretch", textAlign: "left" }}
          key={matter.id}
          onClick={() => setSelected(matter.id)}
        >
          <span className="row between">
            <strong>{matter.title}</strong>
            <span className="chip">{matter.status.replaceAll("_", " ")}</span>
          </span>
          <small>
            {matter.recordCount} records · {matter.outcomeCount} outcomes
          </small>
          {matter.summary && <p className="muted">{matter.summary}</p>}
        </button>
      ))}
      {matters.data?.length === 0 && (
        <p className="empty">No advocacy matters yet.</p>
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
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={detail.data?.title ?? "Advocacy matter"}
        drawer
      >
        <QueryState
          pending={detail.isPending}
          error={detail.error}
          retry={() => void detail.refetch()}
        />
        {detail.data && (
          <>
            <div className="row">
              <span className="chip">
                {detail.data.status.replaceAll("_", " ")}
              </span>
              <button
                className="button"
                onClick={() => setEditing(detail.data)}
              >
                Edit matter
              </button>
              <button className="button" onClick={() => setAddRecord(true)}>
                Add advocacy record
              </button>
            </div>
            <p>{detail.data.summary}</p>
            <h3>Records</h3>
            {detail.data.records.map((record) => (
              <article className="card stack" key={record.id}>
                <div className="row between">
                  <strong>{record.title}</strong>
                  <small>
                    {record.activityDate?.slice(0, 10) ?? "Date not supplied"}
                  </small>
                </div>
                <span className="eyebrow">
                  {record.recordType.replaceAll("_", " ")}
                </span>
                {record.summary && <p>{record.summary}</p>}
                {record.outcome && (
                  <p>
                    <strong>Outcome:</strong> {record.outcome}
                  </p>
                )}
                <small>
                  Source: {record.sourceType} · {record.evidenceClass}
                </small>
                {record.sourceUrl && /^https?:\/\//.test(record.sourceUrl) && (
                  <a
                    className="button"
                    href={record.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View source ↗
                  </a>
                )}
              </article>
            ))}
            {detail.data.records.length === 0 && (
              <p className="muted">No records in this matter.</p>
            )}
            <h3>Linked work</h3>
            {detail.data.links.map((link) => (
              <p key={link.id}>
                {link.label ?? link.linkType} <code>{link.linkKey}</code>
              </p>
            ))}
          </>
        )}
      </Dialog>
      <RecordDialog
        clientId={clientId}
        matterId={selected}
        open={addRecord}
        onOpenChange={setAddRecord}
      />
    </section>
  );
}
function RecordDialog({
  clientId,
  matterId,
  open,
  onOpenChange,
}: {
  clientId: string;
  matterId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useAddAdvocacyRecord(clientId, () => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add advocacy record">
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const date = String(form.get("activityDate"));
          mutation.mutate({
            matterId,
            recordType: form.get("recordType"),
            title: String(form.get("title")).trim(),
            summary: form.get("summary"),
            ...(date ? { activityDate: new Date(date).toISOString() } : {}),
          });
        }}
      >
        <label>
          Record type
          <select name="recordType">
            {[
              "advocacy_ask",
              "meeting",
              "submission",
              "congressional_request",
              "regulatory_comment",
              "testimony",
              "outreach",
              "government_action",
              "outcome",
              "other",
            ].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input name="title" required maxLength={500} />
        </label>
        <label>
          Date and time (your browser time zone)
          <input name="activityDate" type="datetime-local" />
        </label>
        <label>
          Summary
          <textarea name="summary" maxLength={4000} />
        </label>
        <QueryState error={mutation.error} />
        <button className="button primary" disabled={mutation.isPending}>
          Save record
        </button>
      </form>
    </Dialog>
  );
}

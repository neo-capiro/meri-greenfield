"use client";
import { useState } from "react";
import type { TrackerBackend } from "@/shared/config/config";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useIdentity, canAdminister } from "@/shared/auth/identity";
import {
  useIssueAreas,
  useWatchlist,
  useSaveWatchlist,
} from "./watchlist-queries";
import { useBillJurisdictions } from "./queries";
import { WatchlistTopics } from "./WatchlistTopics";
import type { Watchlist, WatchlistDraft } from "./watchlist-contracts";
export function WatchlistDialog({
  clientId,
  backend,
  onClose,
}: {
  clientId: string;
  backend: TrackerBackend;
  onClose: () => void;
}) {
  const source = useWatchlist(clientId, backend);
  const taxonomy = useIssueAreas(backend);
  const identity = useIdentity();
  const jurisdictions = useBillJurisdictions(backend);
  const [generation, setGeneration] = useState(0);
  const [reloading, setReloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const editable = backend === "core" || canAdminister(identity.data?.role);
  return (
    <Dialog
      open
      wide
      title="Configure Bill Tracker"
      description="Shared client targeting. Changes take effect when you save; notification settings are separate."
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <QueryState
        pending={source.isPending || taxonomy.isPending}
        error={
          source.error ??
          taxonomy.error ??
          identity.error ??
          jurisdictions.error
        }
        retry={() => {
          void source.refetch();
          void taxonomy.refetch();
        }}
      />
      {source.data && taxonomy.data && (
        <WatchlistForm
          key={generation}
          record={source.data}
          issueAreas={taxonomy.data.issueAreas}
          jurisdictions={
            jurisdictions.data?.jurisdictions.map((entry) => entry.key) ?? []
          }
          editable={editable}
          backend={backend}
          clientId={clientId}
          onClose={onClose}
          onBusy={setSaving}
          onReload={() => setReloading(true)}
        />
      )}
      <Dialog
        open={reloading}
        title="Reload saved targeting"
        description="Discard these local edits and reload the saved watchlist?"
        onOpenChange={setReloading}
      >
        <button
          className="button"
          onClick={async () => {
            const result = await source.refetch();
            if (result.isSuccess) {
              setGeneration((value) => value + 1);
              setReloading(false);
            }
          }}
        >
          Discard edits and reload
        </button>
      </Dialog>
    </Dialog>
  );
}
function WatchlistForm({
  record,
  issueAreas,
  jurisdictions,
  editable,
  backend,
  clientId,
  onClose,
  onReload,
  onBusy,
}: {
  record: Watchlist;
  issueAreas: string[];
  jurisdictions: string[];
  editable: boolean;
  backend: TrackerBackend;
  clientId: string;
  onClose: () => void;
  onReload: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState<WatchlistDraft>(() => ({
    issueAreas: record.issueAreas,
    jurisdictions: record.jurisdictions,
    topics: record.topics.map((topic) => ({
      ...topic,
      key: topic.id ?? crypto.randomUUID(),
      originalLabel: topic.label,
    })),
  }));
  const [version, setVersion] = useState(record.version);
  const [rejections, setRejections] = useState<string[]>([]);
  const save = useSaveWatchlist(
    clientId,
    backend,
    (result) => {
      const messages = [
        ...(result.rejected?.topics.map(
          (entry) => `${entry.label}: ${entry.reason}`,
        ) ?? []),
        ...(result.rejected?.terms.map(
          (entry) => `${entry.topicLabel} / ${entry.value}: ${entry.reason}`,
        ) ?? []),
      ];
      setVersion(result.version);
      setRejections(messages);
      if (!messages.length) onClose();
      else
        setDraft((current) => ({
          ...current,
          topics: current.topics.map((topic) => ({
            ...topic,
            originalLabel: result.topics.some(
              (item) => item.label === topic.label,
            )
              ? topic.label
              : topic.originalLabel,
          })),
        }));
    },
    onBusy,
  );
  const disabled = !editable || save.isPending;
  function toggle(
    field: "issueAreas" | "jurisdictions",
    value: string,
    checked: boolean,
  ) {
    setDraft((current) => ({
      ...current,
      [field]: checked
        ? [...current[field], value]
        : current[field].filter((entry) => entry !== value),
    }));
  }
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (editable) save.mutate({ draft, version });
      }}
    >
      {!editable && (
        <p role="status">
          An administrator can change shared targeting. You can review the
          current watchlist.
        </p>
      )}
      <fieldset className="row" disabled={disabled}>
        <legend>Issue areas</legend>
        {[...new Set([...issueAreas, ...draft.issueAreas])].map((area) => (
          <label className="row" key={area}>
            <input
              type="checkbox"
              checked={draft.issueAreas.includes(area)}
              onChange={(event) =>
                toggle("issueAreas", area, event.target.checked)
              }
            />
            {area}
          </label>
        ))}
      </fieldset>
      {backend === "intelligence" && (
        <fieldset className="row" disabled={disabled}>
          <legend>State coverage</legend>
          {[
            ...new Set([
              ...jurisdictions.filter((key) => key !== "US"),
              ...draft.jurisdictions,
            ]),
          ].map((key) => (
            <label className="row" key={key}>
              <input
                type="checkbox"
                checked={draft.jurisdictions.includes(key)}
                onChange={(event) =>
                  toggle("jurisdictions", key, event.target.checked)
                }
              />
              {key}
            </label>
          ))}
          <small>
            Federal coverage is retained. Add states to extend matching.
          </small>
        </fieldset>
      )}
      {Boolean(
        record.suggestedIssueAreas?.length ||
        record.suggestedJurisdictions?.length,
      ) && (
        <div className="row">
          <p className="muted">
            Profile suggestions:{" "}
            {[
              ...(record.suggestedIssueAreas ?? []),
              ...(record.suggestedJurisdictions ?? []),
            ].join(", ")}
          </p>
          <button
            className="button"
            type="button"
            disabled={disabled}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                issueAreas: [
                  ...new Set([
                    ...current.issueAreas,
                    ...(record.suggestedIssueAreas ?? []),
                  ]),
                ],
                jurisdictions: [
                  ...new Set([
                    ...current.jurisdictions,
                    ...(record.suggestedJurisdictions ?? []),
                  ]),
                ],
              }))
            }
          >
            Use suggestions
          </button>
        </div>
      )}
      <WatchlistTopics
        topics={draft.topics}
        issueAreas={issueAreas}
        backend={backend}
        disabled={disabled}
        onChange={(topics) => setDraft((current) => ({ ...current, topics }))}
      />
      {rejections.length > 0 && (
        <div role="alert">
          <p>
            Some entries were rejected. Other changes were saved. Review the
            retained edits before saving again.
          </p>
          <ul>
            {rejections.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <QueryState error={save.error} />
      <div className="formActions">
        <button
          className="button"
          type="button"
          disabled={save.isPending}
          onClick={onReload}
        >
          Reload saved values
        </button>
        {editable && (
          <button className="button primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save targeting"}
          </button>
        )}
      </div>
    </form>
  );
}

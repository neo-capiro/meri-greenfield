"use client";
import { useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { Dialog } from "@/shared/ui/Dialog";
import { SelectField } from "@/shared/ui/SelectField";
import { QueryState } from "@/shared/ui/QueryState";
import { useCommittees } from "./directory-queries";
import { committeeLabel, type DirectoryKind } from "./directory-contracts";
import { DirectoryResults } from "./DirectoryResults";
import type { GovernmentTarget } from "./target-contracts";
export function AddTargetDialog({
  clientId,
  targets,
  onClose,
  committee = false,
}: {
  clientId: string;
  targets: GovernmentTarget[];
  onClose: () => void;
  committee?: boolean;
}) {
  const [kind, setKind] = useState<DirectoryKind | "all">(
    committee ? "committee" : "all",
  );
  const [query, setQuery] = useState("");
  const [committeeId, setCommitteeId] = useState("");
  const committees = useCommittees(kind === "committee");
  const busy =
    useIsMutating({ mutationKey: ["client-target-write", clientId] }) > 0;
  return (
    <Dialog
      open
      wide
      title="Add relationship"
      description="Search the directory and add a government target for this client."
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(
            String(new FormData(event.currentTarget).get("q") ?? "").trim(),
          );
        }}
      >
        <label>
          Search the directory
          <input name="q" maxLength={200} autoFocus disabled={busy} />
        </label>
        <button className="button" disabled={busy}>
          Search
        </button>
      </form>
      <nav className="row" aria-label="Directory type">
        {(
          [
            ["all", "All"],
            ["congress", "Members"],
            ["staff", "Congressional staff"],
            ["state", "State"],
            ["committee", "Committee staff"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className="button"
            aria-pressed={kind === value}
            disabled={busy}
            onClick={() => setKind(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {kind === "committee" && (
        <>
          <QueryState
            pending={committees.isPending}
            error={committees.error}
            retry={() => void committees.refetch()}
          />
          <SelectField
            label="Committee / subcommittee"
            value={committeeId}
            disabled={busy}
            onChange={(event) => setCommitteeId(event.target.value)}
          >
            <option value="">Select a committee</option>
            {committees.data?.map((row) => (
              <option key={row.id} value={row.id}>
                {committeeLabel(row, committees.data)}
              </option>
            ))}
          </SelectField>
        </>
      )}
      {query || (kind === "committee" && committeeId) ? (
        <div className="stack">
          {(kind === "all"
            ? (["congress", "staff", "state"] as const)
            : [kind]
          ).map((source) => (
            <DirectoryResults
              key={`${source}:${query}:${committeeId}`}
              kind={source}
              query={query}
              clientId={clientId}
              targets={targets}
              committeeId={committeeId || undefined}
            />
          ))}
        </div>
      ) : (
        <p className="empty">
          Type a name to search the directory
          {kind === "committee" && ", or select a committee"}.
        </p>
      )}
      <div className="formActions">
        <button className="button" disabled={busy} onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}

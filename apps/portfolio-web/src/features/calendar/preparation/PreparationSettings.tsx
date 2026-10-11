"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { readBoards, saveBoards } from "./api";
import { parseBoards } from "./editing";
import type { PrepDepth } from "./schema";
import styles from "./preparation.module.css";

export function PreparationSettings({
  meetingId,
  client,
  depth,
  onDepth,
  onClose,
  onGenerate,
  comprehensive,
  canGenerate,
  canWrite,
}: {
  meetingId: string;
  client: { id: string; name: string } | null;
  depth: PrepDepth;
  onDepth: (depth: PrepDepth) => void;
  onClose: () => void;
  onGenerate: () => void;
  comprehensive: boolean;
  canGenerate: boolean;
  canWrite: boolean;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const key = ["meeting-preparation", meetingId, "boards", client?.id];
  const query = useQuery({
    queryKey: key,
    enabled: comprehensive && Boolean(client),
    queryFn: ({ signal }) =>
      readBoards(api, meetingId, client?.id ?? "", signal),
  });
  const [draft, setDraft] = useState<string | null>(null);
  const [validation, setValidation] = useState<string>();
  const [discard, setDiscard] = useState(false);
  const boards = draft ?? query.data?.boardIds.join(", ") ?? "";
  const dirty =
    draft !== null && draft !== (query.data?.boardIds.join(", ") ?? "");
  const save = useMutation({
    retry: false,
    mutationFn: (ids: string[]) =>
      saveBoards(api, meetingId, client?.id ?? "", ids),
    onSuccess: (result) => {
      cache.setQueryData(key, result);
      setDraft(null);
    },
  });
  function close() {
    if (save.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Meeting preparation sources"
      description="Sources and search depth from the current preparation workflow."
      className={styles.dialog}
    >
      <div className={styles.form}>
        {comprehensive && client ? (
          <>
            <QueryState
              pending={query.isPending}
              error={query.error}
              retry={() => void query.refetch()}
            />
            <label>
              Monday.com board IDs for this client
              <input
                value={boards}
                onChange={(event) => {
                  setDraft(event.target.value);
                  save.reset();
                  setValidation(undefined);
                }}
                disabled={
                  !canWrite || !query.data || query.isError || save.isPending
                }
              />
            </label>
            <div>
              <button
                className="button"
                disabled={
                  !canWrite || !dirty || save.isPending || query.isError
                }
                onClick={() => {
                  if (!canWrite || save.isPending) return;
                  try {
                    setValidation(undefined);
                    save.mutate(parseBoards(boards));
                  } catch (error) {
                    setValidation(
                      error instanceof Error
                        ? error.message
                        : "Check the board IDs.",
                    );
                  }
                }}
              >
                {save.isPending ? "Saving…" : "Save board mapping"}
              </button>
            </div>
            <p className="muted">
              Meri reads these boards through your connected Monday.com account.
              Confirm each board belongs to {client.name}. Save changes before
              generating.
            </p>
            {save.isSuccess && <p role="status">Board mapping saved.</p>}
            <QueryState error={save.error} />
          </>
        ) : (
          <p className="muted">
            {client
              ? "Monday.com source mapping requires comprehensive preparation."
              : "Assign this meeting to a client to map Monday.com boards."}
          </p>
        )}
        {validation && <p role="alert">{validation}</p>}
        <label>
          Search depth
          <select
            value={depth}
            disabled={!canWrite || !comprehensive}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "standard" || value === "deep" || value === "max")
                onDepth(value);
            }}
          >
            <option value="standard">Standard</option>
            <option value="deep">Deep</option>
            <option value="max">Max</option>
          </select>
        </label>
        {comprehensive && (
          <p className="muted">
            Standard: 10 meetings / 90 days; 15 email threads / 30 days.
            <br />
            Deep: 25 meetings / 180 days; 100 email threads / 90 days.
            <br />
            Max: 100 meetings / 365 days; 300 email threads / 365 days.
          </p>
        )}
        {discard && (
          <div role="alert" className="status">
            <p>Discard unsaved board settings?</p>
            <div className="row">
              <button className="button" onClick={() => setDiscard(false)}>
                Keep editing
              </button>
              <button className="button" onClick={onClose}>
                Discard changes
              </button>
            </div>
          </div>
        )}
        <footer className="row">
          <button className="button" onClick={close}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={
              !canGenerate ||
              dirty ||
              save.isPending ||
              save.isError ||
              (comprehensive && Boolean(client) && !query.isSuccess)
            }
            onClick={onGenerate}
          >
            Generate with Meri
          </button>
        </footer>
      </div>
    </Dialog>
  );
}

"use client";
import { useRef, useState } from "react";
import { useApi } from "@/shared/api/provider";
import { fetchCandidates, fetchRegistrant, ImportAttemptError } from "./api";
import type { ImportReceipt } from "./contracts";
import { observedSelection } from "./domain";
import { useImportClients } from "./queries";

export interface FrozenImport {
  registrantId: number;
  ids: number[];
}
/** Owns one import attempt and read-only recovery, never the whole intake page. */
export function useImportAttempt({
  canSubmit,
  readable,
  blocked,
  registrantId,
  onImported,
}: {
  canSubmit: boolean;
  readable: boolean;
  blocked: boolean;
  registrantId: number | null;
  onImported?: (receipt: ImportReceipt) => void;
}) {
  const api = useApi();
  const mutation = useImportClients();
  const [receipt, setReceipt] = useState<ImportReceipt>();
  const [frozen, setFrozen] = useState<FrozenImport>();
  const [observed, setObserved] =
    useState<ReturnType<typeof observedSelection>>();
  const [readbackError, setReadbackError] = useState<Error>();
  const [reading, setReading] = useState(false);
  const lock = useRef(false);
  async function apply(selected: number[]) {
    if (
      !canSubmit ||
      registrantId === null ||
      blocked ||
      lock.current ||
      mutation.isPending ||
      frozen ||
      receipt ||
      !selected.length
    )
      return;
    lock.current = true;
    const ids = [...selected];
    let result: ImportReceipt | undefined;
    try {
      const outcome = await mutation.mutateAsync({ registrantId, ids });
      // onSettled waits for read-model refreshes. Recheck after that final await.
      outcome.assertCurrent();
      result = outcome.receipt;
      setReceipt(result);
    } catch (error) {
      if (error instanceof ImportAttemptError && error.uncertain)
        setFrozen({ registrantId, ids });
    } finally {
      lock.current = false;
    }
    if (result) onImported?.(result);
  }
  async function readback() {
    if (!frozen || blocked || lock.current || !readable) return;
    lock.current = true;
    setReading(true);
    setReadbackError(undefined);
    setObserved(undefined);
    try {
      const current = await fetchRegistrant(api);
      if (current.ldaRegistrantId !== frozen.registrantId)
        throw new Error(
          "The linked firm changed. Original import completion cannot be verified from this firm’s candidates.",
        );
      setObserved(
        observedSelection(
          frozen.ids,
          await fetchCandidates(api, frozen.registrantId),
        ),
      );
    } catch (error) {
      setReadbackError(
        error instanceof Error ? error : new Error("Readback failed."),
      );
    } finally {
      setReading(false);
      lock.current = false;
    }
  }
  return {
    receipt,
    frozen,
    observed,
    readbackError,
    reading,
    mutation,
    apply,
    readback,
    isLocked: () => lock.current,
  };
}

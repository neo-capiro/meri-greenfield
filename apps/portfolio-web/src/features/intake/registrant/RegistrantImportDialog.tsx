"use client";
import { useRef, useState, type ComponentProps } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useApi } from "@/shared/api/provider";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { fetchCandidates, fetchRegistrant, ImportAttemptError } from "./api";
import type { ImportReceipt, RegistrantHit } from "./contracts";
import { canReadRegistrant, observedSelection } from "./domain";
import {
  registrantKey,
  useCandidates,
  useImportClients,
  useLinkRegistrant,
  useRegistrant,
} from "./queries";
import { FirmSearch } from "./FirmSearch";
import { CandidateReview } from "./CandidateReview";
import { ImportResult } from "./ImportResult";
import styles from "./registrant.module.css";

export interface RegistrantImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (receipt: ImportReceipt) => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
}
export function RegistrantImportDialog(props: RegistrantImportDialogProps) {
  return props.open ? <RegistrantSession {...props} /> : null;
}
function RegistrantSession({
  open,
  onOpenChange,
  onImported,
  onCloseAutoFocus,
}: RegistrantImportDialogProps) {
  const api = useApi();
  const identity = useIdentity();
  const ready =
    identity.isSuccess &&
    !identity.isFetching &&
    !identity.error &&
    Boolean(identity.data.tenant?.id);
  const readable = ready && canReadRegistrant(identity.data?.role);
  const permitted = ready && canAdminister(identity.data?.role);
  const anchor = useRegistrant(readable);
  const [searching, setSearching] = useState(false);
  const [choice, setChoice] = useState<RegistrantHit>();
  const [selection, setSelection] = useState<{
    registrantId: number | null;
    ids: number[];
  }>({ registrantId: null, ids: [] });
  const [receipt, setReceipt] = useState<ImportReceipt>();
  const [uncertain, setUncertain] = useState<{
    registrantId: number;
    ids: number[];
  }>();
  const [observed, setObserved] =
    useState<ReturnType<typeof observedSelection>>();
  const [readbackError, setReadbackError] = useState<Error>();
  const [reading, setReading] = useState(false);
  const [linkNeedsReadback, setLinkNeedsReadback] = useState(false);
  const lock = useRef(false);
  const link = useLinkRegistrant();
  const importing = useImportClients();
  const sharedWrites = useIsMutating({
    mutationKey: [...registrantKey, "write"],
  });
  const busy =
    link.isPending || importing.isPending || reading || sharedWrites > 0;
  const registrantId = anchor.data?.ldaRegistrantId ?? null;
  const selected = selection.registrantId === registrantId ? selection.ids : [];
  const candidates = useCandidates(
    registrantId,
    readable && !searching && !receipt && !uncertain,
  );
  const showSearch = searching || registrantId === null;
  const close = () => {
    if (!busy && !lock.current) onOpenChange(false);
  };
  async function confirmFirm() {
    if (!permitted || !choice || busy || lock.current || linkNeedsReadback)
      return;
    lock.current = true;
    try {
      await link.mutateAsync(choice.id);
      setChoice(undefined);
      setSelection({ registrantId: choice.id, ids: [] });
      setSearching(false);
    } catch {
      setLinkNeedsReadback(true);
    } finally {
      lock.current = false;
    }
  }
  async function recheckLink() {
    if (busy || lock.current) return;
    lock.current = true;
    setReading(true);
    const result = await anchor.refetch();
    if (result.isSuccess) {
      setLinkNeedsReadback(false);
      link.reset();
      setChoice(undefined);
    }
    setReading(false);
    lock.current = false;
  }
  async function apply() {
    if (
      !permitted ||
      !registrantId ||
      busy ||
      lock.current ||
      uncertain ||
      receipt ||
      !selected.length ||
      candidates.isFetching ||
      candidates.error ||
      anchor.isFetching ||
      anchor.error
    )
      return;
    lock.current = true;
    const ids = [...selected];
    try {
      const result = await importing.mutateAsync({ registrantId, ids });
      setReceipt(result);
      onImported?.(result);
    } catch (error) {
      if (error instanceof ImportAttemptError && error.uncertain)
        setUncertain({ registrantId, ids });
    } finally {
      lock.current = false;
    }
  }
  async function readback() {
    if (!uncertain || busy || lock.current || !readable) return;
    lock.current = true;
    setReading(true);
    setReadbackError(undefined);
    try {
      const current = await fetchRegistrant(api);
      if (current.ldaRegistrantId !== uncertain.registrantId)
        throw new Error(
          "The linked firm changed. Original import completion cannot be verified from this firm’s candidates.",
        );
      setObserved(
        observedSelection(
          uncertain.ids,
          await fetchCandidates(api, uncertain.registrantId),
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
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      title={
        receipt
          ? "LDA import results"
          : showSearch
            ? "Find your firm in LDA filings"
            : "Import with LDA"
      }
      description="Link your firm’s LDA filings and import selected client profiles."
      className={styles.dialog}
    >
      <div className={styles.notice}>
        Firm-wide setup
        {anchor.data?.ldaRegistrantName
          ? ` · Linked firm: ${anchor.data.ldaRegistrantName}`
          : ""}
      </div>
      <QueryState
        pending={identity.isPending || (anchor.isPending && readable)}
        error={identity.error ?? anchor.error}
        retry={() => {
          void identity.refetch();
          void anchor.refetch();
        }}
      />
      {ready && !permitted && (
        <p role="alert" className={styles.notice}>
          Only firm administrators can link a registrant or import clients.
        </p>
      )}
      {readable && anchor.isSuccess && !anchor.error && (
        <>
          {receipt ? (
            <ImportResult receipt={receipt} />
          ) : uncertain ? (
            <section className={styles.body} aria-label="Unconfirmed import">
              <h3>Import completion is unconfirmed</h3>
              <p role="alert">
                Some clients may already have been created. This selection is
                frozen; do not repeat the import. Read back the linked firm’s
                current client state.
              </p>
              <p>Original LDA client IDs: {uncertain.ids.join(", ")}</p>
              <button
                className="button"
                disabled={busy || !readable}
                onClick={() => void readback()}
              >
                {reading ? "Checking…" : "Check current client state"}
              </button>
              <QueryState error={readbackError} />
              {observed && (
                <>
                  <p className="muted">
                    Observed now; this is not the original import receipt. A
                    client not yet observed may still finish importing.
                  </p>
                  <ul className={styles.list}>
                    {observed.map((row) => (
                      <li className={styles.row} key={row.ldaClientId}>
                        LDA client {row.ldaClientId}:{" "}
                        {row.onboardedAs === null
                          ? "Not observed as imported"
                          : `Currently linked to ${row.onboardedAs}`}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ) : showSearch ? (
            <FirmSearch
              permitted={permitted && !linkNeedsReadback && !anchor.isFetching}
              busy={busy}
              enabled={readable}
              onSelect={setChoice}
            />
          ) : (
            <>
              <QueryState
                pending={candidates.isFetching}
                error={candidates.error}
                retry={() => {
                  void anchor.refetch();
                  void candidates.refetch();
                }}
              />
              {candidates.isSuccess && !candidates.error && (
                <CandidateReview
                  data={candidates.data}
                  selected={selected}
                  disabled={
                    busy ||
                    !permitted ||
                    candidates.isFetching ||
                    anchor.isFetching
                  }
                  onToggle={(id) =>
                    setSelection({
                      registrantId,
                      ids: selected.includes(id)
                        ? selected.filter((value) => value !== id)
                        : selected.length < 100
                          ? [...selected, id]
                          : selected,
                    })
                  }
                  onChangeFirm={() => {
                    setChoice(undefined);
                    setSearching(true);
                    importing.reset();
                  }}
                />
              )}
            </>
          )}
          {choice && !receipt && !uncertain && (
            <section
              className={styles.confirm}
              aria-label="Confirm linked firm"
            >
              <h3>Link {choice.name} to this firm?</h3>
              <p>
                This changes the LDA registrant for your entire firm. Existing
                client profiles are not removed.
              </p>
              <div className={styles.toolbar}>
                <button
                  className="button"
                  disabled={busy || linkNeedsReadback}
                  onClick={() => setChoice(undefined)}
                >
                  Keep looking
                </button>
                <button
                  className="button primary"
                  disabled={busy || !permitted || linkNeedsReadback}
                  onClick={() => void confirmFirm()}
                >
                  {link.isPending ? "Linking…" : "Confirm firm link"}
                </button>
              </div>
            </section>
          )}
          <div className={styles.feedback}>
            <QueryState
              error={link.error ?? (!uncertain ? importing.error : null)}
            />
            {linkNeedsReadback && (
              <>
                <p role="alert">
                  The firm link is not confirmed. Read back the current link
                  before choosing again.
                </p>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void recheckLink()}
                >
                  Refresh linked firm
                </button>
              </>
            )}
          </div>
        </>
      )}
      <footer className={styles.footer}>
        <small>
          {receipt
            ? "Review created and skipped clients above."
            : uncertain
              ? "No automatic retry will be sent."
              : "Each imported client is linked to its federal LDA data."}
        </small>
        <button className="button" disabled={busy} onClick={close}>
          {receipt || uncertain ? "Done" : "Cancel"}
        </button>
        {!showSearch && !receipt && !uncertain && (
          <button
            className="button primary"
            disabled={
              !permitted ||
              busy ||
              !selected.length ||
              !candidates.isSuccess ||
              Boolean(candidates.error) ||
              candidates.isFetching ||
              anchor.isFetching ||
              Boolean(anchor.error)
            }
            onClick={() => void apply()}
          >
            {importing.isPending
              ? "Importing…"
              : `Import ${selected.length} client${selected.length === 1 ? "" : "s"}`}
          </button>
        )}
      </footer>
    </Dialog>
  );
}

"use client";
import { useRef, useState, type ComponentProps } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import {
  ProfileCapacityStatus,
  useProfileCapacity,
} from "@/features/billing/public";
import type { ImportReceipt } from "./contracts";
import { canReadRegistrant } from "./domain";
import { registrantKey, useCandidates, useRegistrant } from "./queries";
import { useFirmLink } from "./useFirmLink";
import { useImportAttempt } from "./useImportAttempt";
import { FirmSearch } from "./FirmSearch";
import { CandidateReview } from "./CandidateReview";
import { ImportResult } from "./ImportResult";
import { ImportRecovery } from "./ImportRecovery";
import { FirmLinkConfirmation } from "./FirmLinkConfirmation";
import styles from "./registrant.module.css";

export interface RegistrantImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (receipt: ImportReceipt) => void;
  onBack?: () => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
}
export function RegistrantImportDialog(props: RegistrantImportDialogProps) {
  return props.open ? <RegistrantSession {...props} /> : null;
}
function RegistrantSession({
  open,
  onOpenChange,
  onImported,
  onBack,
  onCloseAutoFocus,
}: RegistrantImportDialogProps) {
  const identity = useIdentity();
  const ready =
    identity.isSuccess &&
    !identity.isFetching &&
    !identity.error &&
    Boolean(identity.data.tenant?.id.trim()) &&
    Boolean(identity.data.user.id.trim());
  const readable = ready && canReadRegistrant(identity.data?.role);
  const permitted = ready && canAdminister(identity.data?.role);
  const anchor = useRegistrant(readable);
  const [searching, setSearching] = useState(false);
  const [selection, setSelection] = useState<{
    registrantId: number | null;
    ids: number[];
  }>({ registrantId: null, ids: [] });
  const sharedWrites = useIsMutating({
    mutationKey: [...registrantKey, "write"],
  });
  const registrantId = anchor.data?.ldaRegistrantId ?? null;
  const selected = selection.registrantId === registrantId ? selection.ids : [];
  const capacity = useProfileCapacity(permitted, Math.max(1, selected.length));
  const candidates = useCandidates(registrantId, readable && !searching);
  const canSubmit =
    permitted &&
    candidates.isSuccess &&
    !candidates.isFetching &&
    !candidates.error &&
    !anchor.isFetching &&
    !anchor.error &&
    capacity.allowed;
  const attempt = useImportAttempt({
    canSubmit,
    readable,
    blocked: sharedWrites > 0,
    registrantId,
    onImported,
  });
  const firm = useFirmLink({
    permitted,
    blocked: sharedWrites > 0 || attempt.reading,
    refetch: anchor.refetch,
    onLinked: (id) => {
      setSelection({ registrantId: id, ids: [] });
      setSearching(false);
    },
  });
  const busy = sharedWrites > 0 || firm.reading || attempt.reading;
  const showSearch = searching || registrantId === null;
  const opener = useRef<HTMLElement | null>(null);
  const close = () => {
    if (!busy && !firm.isLocked() && !attempt.isLocked()) onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
      onOpenAutoFocus={() => {
        opener.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (!event.defaultPrevented && opener.current?.isConnected) {
          event.preventDefault();
          opener.current.focus();
        }
      }}
      title={
        attempt.receipt
          ? "LDA import results"
          : showSearch
            ? "Find your firm in LDA filings"
            : "Import with LDA"
      }
      className={styles.dialog}
    >
      {!attempt.receipt && !attempt.frozen && (
        <button
          type="button"
          className={styles.back}
          disabled={busy}
          onClick={() => {
            if (!busy && !firm.isLocked() && !attempt.isLocked()) {
              if (onBack) onBack();
              else close();
            }
          }}
        >
          ← Back
        </button>
      )}
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
      {identity.isSuccess &&
        !identity.isFetching &&
        !identity.error &&
        !ready && (
          <p role="alert" className={styles.notice}>
            Your firm session could not be verified. Refresh your session before
            importing.
          </p>
        )}
      {ready && !permitted && (
        <p role="alert" className={styles.notice}>
          Only firm administrators can link a registrant or import clients.
        </p>
      )}
      {readable && anchor.isSuccess && !anchor.error && (
        <>
          {attempt.receipt ? (
            <ImportResult receipt={attempt.receipt} />
          ) : attempt.frozen ? (
            <ImportRecovery
              frozen={attempt.frozen}
              observed={attempt.observed}
              error={attempt.readbackError}
              reading={attempt.reading}
              disabled={busy || !readable}
              onReadback={() => void attempt.readback()}
            />
          ) : showSearch ? (
            <FirmSearch
              permitted={permitted && !firm.needsReadback && !anchor.isFetching}
              busy={busy}
              enabled={readable}
              onSelect={firm.setChoice}
            />
          ) : (
            <>
              {permitted && <ProfileCapacityStatus capacity={capacity} />}
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
                    !candidates.isSuccess ||
                    candidates.isFetching ||
                    Boolean(candidates.error) ||
                    anchor.isFetching ||
                    Boolean(anchor.error)
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
                    firm.setChoice(undefined);
                    setSearching(true);
                    attempt.mutation.reset();
                  }}
                />
              )}
            </>
          )}
          {!attempt.receipt && !attempt.frozen && (
            <>
              <FirmLinkConfirmation
                choice={firm.choice}
                needsReadback={firm.needsReadback}
                error={firm.mutation.error}
                pending={firm.mutation.isPending}
                disabled={busy || !permitted}
                onCancel={() => firm.setChoice(undefined)}
                onConfirm={() => void firm.confirm()}
                onRefresh={() => void firm.refresh()}
              />
              <div className={styles.feedback}>
                <QueryState error={attempt.mutation.error} />
                {attempt.mutation.error && (
                  <button
                    className="button"
                    disabled={busy || !readable}
                    onClick={() => {
                      void anchor.refetch();
                      void candidates.refetch();
                    }}
                  >
                    Refresh review
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
      <footer className={styles.footer}>
        <small>
          {attempt.receipt
            ? "Review created and skipped clients above."
            : attempt.frozen
              ? "No automatic retry will be sent."
              : "Each imported client is linked to its federal LDA data."}
        </small>
        <button className="button" disabled={busy} onClick={close}>
          {attempt.receipt || attempt.frozen ? "Done" : "Cancel"}
        </button>
        {!showSearch && !attempt.receipt && !attempt.frozen && (
          <button
            className="button primary"
            disabled={!canSubmit || busy || !selected.length || firm.reading}
            onClick={() => void attempt.apply(selected)}
          >
            {attempt.mutation.isPending
              ? "Importing…"
              : `Import ${selected.length} client${selected.length === 1 ? "" : "s"}`}
          </button>
        )}
      </footer>
    </Dialog>
  );
}

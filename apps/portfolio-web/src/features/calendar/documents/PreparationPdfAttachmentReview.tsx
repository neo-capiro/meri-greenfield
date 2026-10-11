"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { filesKey } from "@/features/files/public";
import { useCalendarCapabilities } from "../access/public";
import { PreparationContent } from "../preparation/PreparationContent";
import type { Preparation } from "../preparation/schema";
import { preparePdfAttachment, PreparationPdfAttemptError } from "./api";
import {
  attachmentCompatibility,
  type DocumentMeeting,
  type PreparationPdfReceipt,
} from "./contracts";
import { useDocumentAuthority } from "./useDocumentAuthority";
import { useSavedDocument } from "./useSavedDocument";
import styles from "./documents.module.css";

export function PreparationPdfAttachmentReview({
  meeting,
  preparation,
  onClose,
  onPrepared,
  open = true,
}: {
  meeting: DocumentMeeting;
  preparation: Preparation;
  onClose: () => void;
  onPrepared: (receipt: PreparationPdfReceipt) => void;
  open?: boolean;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const authority = useDocumentAuthority(
    `${meeting.id}:${meeting.client?.id}:${preparation.id}`,
    true,
    open,
  );
  const capabilities = useCalendarCapabilities();
  const saved = useSavedDocument(
    meeting,
    { kind: "preparation", preparation },
    {
      userId: authority.identity.data?.user.id,
      tenantId: authority.identity.data?.tenant?.id,
      allowed: authority.allowed && open,
    },
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error>();
  const [uncertain, setUncertain] = useState(false);
  const [completed, setCompleted] = useState<PreparationPdfReceipt>();
  const dispatched = useRef(false);
  const prep =
    saved.data?.document.kind === "preparation"
      ? saved.data.document.preparation
      : undefined;
  const compatibility = prep
    ? attachmentCompatibility(prep, saved.data?.meeting.subject)
    : null;
  const ready = Boolean(
    meeting.client &&
    prep &&
    !compatibility &&
    !saved.isFetching &&
    !saved.error &&
    authority.allowed &&
    capabilities.isSuccess &&
    !capabilities.isFetching &&
    capabilities.data.runtime?.externalActionsEnabled === true,
  );
  async function prepare() {
    if (!ready || !prep || dispatched.current) return;
    dispatched.current = true;
    setPending(true);
    setError(undefined);
    let stored = false;
    try {
      const assert = authority.capture();
      const receipt = await preparePdfAttachment(
        api,
        saved.data?.meeting ?? meeting,
        prep,
        assert,
      );
      stored = true;
      assert();
      setCompleted(receipt);
      void cache.invalidateQueries({
        queryKey: filesKey(meeting.client?.id ?? ""),
      });
      try {
        onPrepared(receipt);
      } catch {
        setError(
          new Error(
            "The PDF attachment was created, but the composer could not open. Find the saved attachment in this meeting’s Files.",
          ),
        );
      }
    } catch (failure) {
      const unknown =
        stored ||
        (failure instanceof PreparationPdfAttemptError && failure.uncertain);
      setUncertain(unknown);
      setError(
        stored
          ? new Error(
              "Attachment creation may have completed. Check this meeting’s Files before starting another attempt. This action will not retry automatically.",
            )
          : failure instanceof Error
            ? failure
            : new Error("The PDF attachment could not be prepared."),
      );
      if (!unknown) dispatched.current = false;
    } finally {
      setPending(false);
    }
  }
  function resume() {
    if (!completed || pending || uncertain || !authority.allowed) return;
    try {
      authority.capture()();
      setError(undefined);
      onPrepared(completed);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error("The saved PDF could not be opened for email review."),
      );
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      title="Prepare meeting PDF attachment"
      description="Review the saved preparation before creating a file for email."
      className={styles.dialog}
    >
      <QueryState
        pending={
          saved.isPending ||
          authority.identity.isPending ||
          capabilities.isPending
        }
        error={saved.error ?? authority.identity.error ?? capabilities.error}
        retry={() => {
          void saved.refetch();
          void capabilities.refetch();
        }}
      />
      {!meeting.client && (
        <p role="note">
          Assign this meeting to a client before preparing an email attachment.
        </p>
      )}
      {compatibility && <p role="alert">{compatibility}</p>}
      {!authority.identity.isPending && !authority.allowed && (
        <p role="note">
          The current session or role does not permit preparing this document.
          Reopen it after verifying access.
        </p>
      )}
      {prep && !saved.error && authority.allowed && (
        <PreparationContent prep={prep} />
      )}
      {completed && (
        <p role="status">
          Previously prepared file: {completed.fileName}. This is the original
          saved PDF; later preparation changes are not included. Recheck its
          availability in the email composer before sending.
        </p>
      )}
      <p className="muted">
        Creates a stored PDF in this meeting’s Files. It does not send email.
        The composer will check attachment availability and scan status before
        sending.
      </p>
      <QueryState error={error} />
      <footer className={styles.actions}>
        <button className="button" disabled={pending} onClick={onClose}>
          {uncertain ? "Close and check Files" : completed ? "Close" : "Cancel"}
        </button>
        {completed ? (
          <button
            className="button primary"
            disabled={!authority.allowed || pending || uncertain}
            onClick={resume}
          >
            Review previously prepared PDF
          </button>
        ) : (
          <button
            className="button primary"
            disabled={!ready || pending || uncertain}
            onClick={() => void prepare()}
          >
            {pending ? "Preparing…" : "Prepare attachment"}
          </button>
        )}
      </footer>
    </Dialog>
  );
}

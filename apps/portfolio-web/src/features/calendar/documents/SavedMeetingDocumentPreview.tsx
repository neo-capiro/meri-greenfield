"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { PreparationContent } from "../preparation/PreparationContent";
import {
  documentId,
  type DocumentMeeting,
  type SavedMeetingDocument,
} from "./contracts";
import { useSavedDocument } from "./useSavedDocument";
import { useDocumentAuthority } from "./useDocumentAuthority";
import { printMeetingDocument } from "./print";
import styles from "./documents.module.css";

export function SavedMeetingDocumentPreview({
  meeting,
  document,
  onClose,
}: {
  meeting: DocumentMeeting;
  document: SavedMeetingDocument;
  onClose: () => void;
}) {
  const authority = useDocumentAuthority(
    `${meeting.id}:${meeting.client?.id}:${documentId(document)}`,
  );
  const query = useSavedDocument(meeting, document, {
    userId: authority.identity.data?.user.id,
    tenantId: authority.identity.data?.tenant?.id,
    allowed: authority.allowed,
  });
  const cache = useQueryClient();
  const article = useRef<HTMLElement>(null);
  const [error, setError] = useState<Error>();
  const title =
    document.kind === "preparation"
      ? `Meeting prep — ${query.data?.meeting.subject ?? meeting.subject}`
      : "Meeting debrief · PDF preview";
  const saved = query.data?.document;
  function print() {
    try {
      authority.capture()();
      const state = cache.getQueryState(query.queryKey);
      if (
        !article.current ||
        state?.status !== "success" ||
        state.fetchStatus !== "idle" ||
        state.isInvalidated ||
        state.error
      )
        throw new Error("Refresh the saved document before printing.");
      printMeetingDocument(article.current, title);
      setError(undefined);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error("The print preview could not be opened."),
      );
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={
        document.kind === "preparation"
          ? "Print / Save as PDF"
          : "Export the saved meeting debrief as a PDF."
      }
      className={styles.dialog}
    >
      <QueryState
        pending={query.isPending || authority.identity.isPending}
        error={query.error ?? authority.identity.error}
        retry={() => void query.refetch()}
      />
      {saved && !query.error && authority.allowed && (
        <article ref={article} className={styles.content}>
          {saved.kind === "preparation" ? (
            <PreparationContent prep={saved.preparation} />
          ) : (
            <>
              <section>
                <h3>Selected client meeting</h3>
                <p>
                  {query.data?.meeting.subject}
                  <br />
                  {query.data?.meeting.client?.name ?? "No client"}
                  <br />
                  Saved {saved.debrief.updatedAt}
                </p>
              </section>
              <section>
                <h3>Saved debrief</h3>
                <p>{saved.debrief.body ?? "No content."}</p>
              </section>
            </>
          )}
        </article>
      )}
      <QueryState error={error} />
      {!authority.identity.isPending && !authority.allowed && (
        <p role="note">
          The current session or role does not permit exporting this document.
          Reopen it after verifying access.
        </p>
      )}
      <footer className={styles.actions}>
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button"
          disabled={
            !saved ||
            query.isFetching ||
            Boolean(query.error) ||
            !authority.allowed
          }
          onClick={print}
        >
          Print / Save as PDF
        </button>
        <button className="button primary" onClick={onClose}>
          {document.kind === "preparation" ? "Done" : "Close preview"}
        </button>
      </footer>
    </Dialog>
  );
}

"use client";
import { useState } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import { signedUrl } from "@/features/files/public";
import {
  attachmentSnapshot,
  canReviewAttachment,
  type ReviewMeeting,
} from "./contracts";
import { useAttachmentApproval } from "./useAttachmentApproval";
import styles from "./review.module.css";

export function MeetingAttachmentApprovals({
  meeting,
}: {
  meeting: ReviewMeeting;
}) {
  return (
    <AttachmentReview
      key={`${meeting.id}:${meeting.client?.id ?? "private"}`}
      meeting={meeting}
    />
  );
}
function AttachmentReview({ meeting }: { meeting: ReviewMeeting }) {
  const review = useAttachmentApproval(meeting);
  const [checked, setChecked] = useState<string>();
  return (
    <section
      className={styles.section}
      aria-label="Meeting attachment approvals"
    >
      <h3>Meeting attachments</h3>
      <p className="muted">
        Approval records your review of a file. It does not perform a security
        scan, extract text or share the file.
      </p>
      <QueryState
        pending={
          review.identity.isPending ||
          (review.allowed && review.query.isPending)
        }
        error={review.identity.error ?? review.query.error}
        retry={() => void review.refresh()}
      />
      {!review.identity.isPending && !review.allowed && (
        <p role="status">
          A current authorized meeting session is required. Reopen this meeting
          after verifying access.
        </p>
      )}
      {review.allowed &&
        !review.query.error &&
        review.query.data?.map((file) => (
          <article className={styles.attachment} key={file.id}>
            <strong>{file.fileName}</strong>
            <p className="muted">
              {file.approvedAt
                ? `Approved · ${new Date(file.approvedAt).toLocaleString()}`
                : "Not approved"}{" "}
              · Scan: {file.scanStatus ?? "not reported"}
            </p>
            {file.scanDisclosure && (
              <p className="muted">{file.scanDisclosure}</p>
            )}
            {file.usable && signedUrl(file.downloadUrl) && (
              <a
                className="button"
                href={signedUrl(file.downloadUrl)}
                target="_blank"
                rel="noreferrer"
              >
                Review {file.fileName}
              </a>
            )}
            {file.usable === false && (
              <p role="note">
                File unavailable for review:{" "}
                {file.blockedReason ?? file.lifecycleStatus}.
              </p>
            )}
            {!file.approvedAt &&
              canReviewAttachment(file, review.actor?.userId ?? "") && (
                <>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={checked === attachmentSnapshot(file)}
                      disabled={Boolean(
                        review.pending ||
                        review.uncertain ||
                        review.query.isFetching,
                      )}
                      onChange={(event) =>
                        setChecked(
                          event.target.checked
                            ? attachmentSnapshot(file)
                            : undefined,
                        )
                      }
                    />
                    I have reviewed {file.fileName}
                  </label>
                  <button
                    className="button"
                    disabled={
                      checked !== attachmentSnapshot(file) ||
                      Boolean(
                        review.pending ||
                        review.uncertain ||
                        review.query.isFetching,
                      )
                    }
                    onClick={() => void review.approve(file)}
                  >
                    {review.pending === file.id
                      ? "Recording approval…"
                      : "Approve attachment"}
                  </button>
                </>
              )}
          </article>
        ))}
      {review.allowed &&
        review.query.data?.length === 0 &&
        !review.query.error && (
          <p className="muted">No accessible attachments for this meeting.</p>
        )}
      <QueryState error={review.error} />
      <button
        className="button"
        disabled={
          !review.allowed || Boolean(review.pending || review.query.isFetching)
        }
        onClick={() => {
          setChecked(undefined);
          void review.refresh();
        }}
      >
        Refresh attachment status
      </button>
    </section>
  );
}

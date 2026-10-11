"use client";
import { useState } from "react";
import {
  MailCompose,
  type MailInitialDraft,
} from "@/features/relationships/public";
import {
  PreparationPdfAttachmentReview,
  SavedMeetingDocumentPreview,
  type DocumentMeeting,
} from "../documents/public";
import type { Preparation } from "./schema";

export function PreparationDocumentActions({
  meeting,
  preparation,
  canPrepare,
}: {
  meeting: DocumentMeeting;
  preparation: Preparation;
  canPrepare: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const [review, setReview] = useState<Preparation>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [email, setEmail] = useState<MailInitialDraft>();
  return (
    <>
      <div className="row">
        <button className="button" onClick={() => setPreview(true)}>
          Print / Save as PDF
        </button>
        <button
          className="button"
          disabled={!canPrepare || !meeting.client}
          onClick={() => {
            setReview(preparation);
            setReviewOpen(true);
          }}
        >
          Email PDF
        </button>
      </div>
      {preview && (
        <SavedMeetingDocumentPreview
          meeting={meeting}
          document={{ kind: "preparation", preparation }}
          onClose={() => setPreview(false)}
        />
      )}
      {review && (
        <PreparationPdfAttachmentReview
          meeting={meeting}
          preparation={review}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onPrepared={(attachment) => {
            setReviewOpen(false);
            setEmail({
              subject: `Meeting preparation — ${meeting.subject}`,
              body: "Please review the attached meeting preparation.",
              attachments: [attachment],
            });
          }}
        />
      )}
      {email && meeting.client && (
        <MailCompose
          key={email.attachments?.[0]?.id}
          clientId={meeting.client.id}
          person={{ name: meeting.client.name, title: null, email: null }}
          initialDraft={email}
          onClose={() => setEmail(undefined)}
        />
      )}
    </>
  );
}

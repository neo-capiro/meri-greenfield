import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  SavedMeetingDocumentPreview,
  PreparationPdfAttachmentReview,
} from "@/features/calendar/documents/public";
import { preparationSchema } from "@/features/calendar/preparation/schema";
import { printableMeetingHtml } from "@/features/calendar/documents/print";

const id = "20000000-0000-4000-8000-000000000001";
const meeting = {
  id: "meeting-1",
  subject: "FY27 staff briefing",
  client: { id: "client-1", name: "Synthetic client" },
};
const preparation = preparationSchema.parse({
  id,
  meetingId: meeting.id,
  clientId: "client-1",
  summary: "Saved preparation",
  agenda: ["Saved agenda"],
  talkingPoints: [],
  risks: [],
  followUps: [],
  emailEvidence: [],
  status: "draft",
  createdAt: "2026-10-11T00:00:00Z",
});
const debrief = {
  id,
  body: "Saved debrief",
  restricted: false,
  confidential: false,
  createdAt: "2026-10-11T00:00:00Z",
  updatedAt: "2026-10-11T00:00:00Z",
};
declare global {
  interface Window {
    __documentInvalidate?: (kind: "identity" | "capabilities") => Promise<void>;
    __documentUnmount?: () => void;
    __documentRefetchIdentity?: () => Promise<void>;
    __documentClose?: () => void;
    __documentReopen?: () => void;
    __documentRemount?: () => void;
    __documentSanitize?: () => string;
  }
}
export function MeetingDocumentsHarness() {
  const [open, setOpen] = useState<"preparation" | "debrief" | "attachment">();
  const [receipt, setReceipt] = useState<string>();
  const [visible, setVisible] = useState(true);
  const [generation, setGeneration] = useState(0);
  const cache = useQueryClient();
  useEffect(() => {
    window.__documentInvalidate = async (kind) => {
      await cache.invalidateQueries({
        queryKey:
          kind === "identity"
            ? ["identity"]
            : ["meeting-preparation", "capabilities"],
        refetchType: "none",
      });
    };
    window.__documentUnmount = () => setOpen(undefined);
    window.__documentClose = () => setVisible(false);
    window.__documentReopen = () => setVisible(true);
    window.__documentRemount = () => setGeneration((value) => value + 1);
    window.__documentRefetchIdentity = async () => {
      await cache.refetchQueries({ queryKey: ["identity"] });
    };
    window.__documentSanitize = () => {
      const article = document.createElement("article");
      article.innerHTML =
        '<p onclick="evil()">東京 &amp; résumé 🚀<br>Second line</p><script>evil()</script><img src="https://example.test/x"><a href="javascript:evil()">Unsafe link</a><a href="https://example.test/?q=&quot;x&quot;">Source</a><svg onload="evil()"></svg>';
      return printableMeetingHtml(article, 'Title <script> & "quote"');
    };
    return () => {
      delete window.__documentInvalidate;
      delete window.__documentUnmount;
      delete window.__documentRefetchIdentity;
      delete window.__documentClose;
      delete window.__documentReopen;
      delete window.__documentRemount;
      delete window.__documentSanitize;
    };
  }, [cache]);
  return (
    <main style={{ padding: 32 }}>
      <h1>Saved meeting documents</h1>
      <p>Synthetic document review. No PDF storage or provider calls.</p>
      <div className="row">
        <button className="button" onClick={() => setOpen("preparation")}>
          Preview preparation
        </button>
        <button className="button" onClick={() => setOpen("debrief")}>
          Preview debrief
        </button>
        <button
          className="button"
          onClick={() => {
            setOpen("attachment");
            setVisible(true);
          }}
        >
          Email PDF
        </button>
      </div>
      {receipt && <p role="status">Stored receipt {receipt}</p>}
      {open === "preparation" && (
        <SavedMeetingDocumentPreview
          key={generation}
          meeting={meeting}
          document={{ kind: "preparation", preparation }}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open === "debrief" && (
        <SavedMeetingDocumentPreview
          key={generation}
          meeting={meeting}
          document={{ kind: "debrief", debrief }}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open === "attachment" && (
        <PreparationPdfAttachmentReview
          key={generation}
          open={visible}
          meeting={meeting}
          preparation={preparation}
          onClose={() => setVisible(false)}
          onPrepared={(value) => setReceipt(value.fileName)}
        />
      )}
    </main>
  );
}

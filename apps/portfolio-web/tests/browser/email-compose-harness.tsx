import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MailCompose } from "@/features/relationships/MailCompose";
const clientId = "10000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
declare global {
  interface Window {
    __mailRecheck?: () => Promise<void>;
    __mailUnmount?: () => void;
    __mailInvalidate?: () => Promise<{
      status?: string;
      fetchStatus?: string;
      isInvalidated?: boolean;
    }>;
  }
}
export function EmailComposeHarness() {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const cache = useQueryClient();
  useEffect(() => {
    window.__mailRecheck = () =>
      cache.invalidateQueries({ queryKey: ["identity"] });
    window.__mailUnmount = () => setOpen(false);
    window.__mailInvalidate = async () => {
      await cache.invalidateQueries({
        queryKey: ["identity"],
        refetchType: "none",
      });
      const state = cache.getQueryState(["identity"]);
      return {
        status: state?.status,
        fetchStatus: state?.fetchStatus,
        isInvalidated: state?.isInvalidated,
      };
    };
    return () => {
      delete window.__mailRecheck;
      delete window.__mailUnmount;
      delete window.__mailInvalidate;
    };
  }, [cache]);
  return (
    <main style={{ padding: 32 }}>
      <h1>Relationships</h1>
      <p>Synthetic mailbox acceptance; no provider delivery.</p>
      <button
        className="button"
        onClick={() => {
          setReply(false);
          setPrepared(false);
          setOpen(true);
        }}
      >
        Mail contact
      </button>
      <button
        className="button"
        onClick={() => {
          setReply(true);
          setPrepared(false);
          setOpen(true);
        }}
      >
        Reply to thread
      </button>
      <button
        className="button"
        onClick={() => {
          setReply(false);
          setPrepared(true);
          setOpen(true);
        }}
      >
        Email prepared document
      </button>
      {open && (
        <MailCompose
          clientId={clientId}
          person={{
            personId: prepared ? undefined : id,
            name: prepared ? "" : "Taylor Test",
            title: "Director",
            email: prepared ? null : "taylor@example.test",
          }}
          thread={reply ? { id, subject: "Previous review" } : undefined}
          initialDraft={
            prepared
              ? {
                  subject: "Prepared review",
                  body: "Prepared document for your review.",
                  attachments: [{ id, fileName: "brief.pdf" }],
                }
              : undefined
          }
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}

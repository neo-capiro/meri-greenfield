import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { VoiceMemoSource } from "@/features/calendar/debrief/voice/VoiceMemoSource";
import { voiceMeeting } from "./voice-meeting";
declare global {
  interface Window {
    __voiceInvalidate?: () => Promise<void>;
    __voiceRefetchIdentity?: () => Promise<void>;
    __voiceChangeActor?: () => void;
    __voiceUrls?: { created: string[]; revoked: string[] };
  }
}
export function VoiceHarness() {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reviewed, setReviewed] = useState("");
  useEffect(() => {
    window.__voiceInvalidate = () =>
      cache.invalidateQueries({ queryKey: ["identity"], refetchType: "none" });
    window.__voiceRefetchIdentity = () =>
      cache.refetchQueries({ queryKey: ["identity"] });
    window.__voiceChangeActor = () =>
      cache.setQueryData(["identity"], {
        user: { id: "other-user", email: "synthetic@example.test" },
        tenant: { id: "other-tenant", name: "Synthetic other tenant" },
        role: "user_admin",
      });
    return () => {
      delete window.__voiceInvalidate;
      delete window.__voiceRefetchIdentity;
      delete window.__voiceChangeActor;
    };
  }, [cache]);
  return (
    <main>
      <button className="button" onClick={() => setOpen(true)}>
        Open voice memo
      </button>
      <button className="button" onClick={() => setVisible(false)}>
        Unmount voice source
      </button>
      <output aria-label="Reviewed voice source">{reviewed}</output>
      {visible && (
        <VoiceMemoSource
          meeting={voiceMeeting}
          open={open}
          onOpenChange={setOpen}
          onGenerate={(source) => {
            setReviewed(JSON.stringify(source));
            return true;
          }}
        />
      )}
    </main>
  );
}

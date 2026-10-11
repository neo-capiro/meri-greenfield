"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { Meeting } from "../contracts";
import { formatInstant, type CalendarZone } from "../range";
import { AttendanceUncertain, sendMeri } from "./api";
import { consentCopy, dispatchSchema, type BotSession } from "./contracts";
import { ConsentFields, type ConsentState } from "./ConsentFields";
import styles from "./attendance.module.css";

export function SendMeriDialog({
  meeting,
  zone,
  open,
  onOpenChange,
  allowed,
  guard,
  onSaved,
  onRefresh,
  onUncertain,
}: {
  meeting: Meeting;
  zone: CalendarZone;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowed: boolean;
  guard: () => void;
  onSaved: (session: BotSession) => void;
  onRefresh: () => Promise<unknown>;
  onUncertain: () => void;
}) {
  const api = useApi(),
    cache = useQueryClient();
  const [meetingUrl, setMeetingUrl] = useState(meeting.joinLink ?? "");
  const [consent, setConsent] = useState<ConsentState>({
    authorizedToRecord: false,
    allPartiesWillBeNotified: false,
  });
  const [uncertain, setUncertain] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const parsed = dispatchSchema.safeParse({ meetingUrl, ...consent });
  const scheduled = Date.parse(meeting.startsAt) > openedAt;
  const mutation = useMutation({
    mutationFn: async () => {
      guard();
      if (!parsed.success)
        throw new Error(
          parsed.error.issues[0]?.message ??
            "Review the recording confirmations.",
        );
      return sendMeri(api, meeting, parsed.data, guard);
    },
    onSuccess: async (session) => {
      guard();
      onSaved(session);
      await cache.invalidateQueries({ queryKey: ["meeting", meeting.id] });
      guard();
      onOpenChange(false);
    },
    onError: (error) => {
      try {
        guard();
      } catch {
        return;
      }
      if (error instanceof AttendanceUncertain) {
        setUncertain(true);
        onUncertain();
      }
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
      title="Send Meri to take notes"
      description={meeting.subject}
      className={styles.dialog}
    >
      <form
        className={styles.body}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="muted">{consentCopy.intro}</p>
        <label>
          Meeting join URL
          <input
            aria-label="Meeting join URL"
            type="url"
            value={meetingUrl}
            maxLength={2000}
            placeholder="Paste the Zoom, Teams, Google Meet, Webex, GoTo or Slack URL."
            disabled={mutation.isPending || uncertain}
            onChange={(event) => setMeetingUrl(event.target.value)}
          />
        </label>
        <ConsentFields
          value={consent}
          onChange={setConsent}
          disabled={mutation.isPending || uncertain}
        />
        <p className="muted">
          {scheduled
            ? `Join requested for ${formatInstant(meeting.startsAt, zone)}. Scheduling does not confirm attendance.`
            : "Meri will be asked to join now. Attendance depends on the meeting provider."}{" "}
          Transcript-only storage; audio retention is not offered.
        </p>
        {!allowed && !uncertain && (
          <p role="alert">
            Sending Meri is unavailable while the session, permissions or
            external-action capability is unavailable.
          </p>
        )}
        <QueryState error={mutation.error} />
        {mutation.error && (
          <button
            className="button"
            type="button"
            disabled={mutation.isPending}
            onClick={() => void onRefresh()}
          >
            Refresh Meri status
          </button>
        )}
        {uncertain && (
          <p role="status">
            This form will not send another request. Review the current session
            from the meeting panel before deciding whether another attempt is
            appropriate.
          </p>
        )}
        <div className="row">
          <button
            className="button"
            type="button"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={
              !allowed || !parsed.success || mutation.isPending || uncertain
            }
          >
            {mutation.isPending ? "Sending…" : "Send Meri"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

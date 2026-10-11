"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { Meeting } from "../contracts";
import type { CalendarZone } from "../range";
import { AttendanceUncertain, removeMeri } from "./api";
import { progressing, removable, sessionLabel } from "./contracts";
import {
  useAttendanceAccess,
  useAttendanceSession,
  sessionKey,
} from "./queries";
import { SendMeriDialog } from "./SendMeriDialog";
import styles from "./attendance.module.css";

export function MeetingAttendance({
  meeting,
  zone,
}: {
  meeting: Meeting;
  zone: CalendarZone;
}) {
  const identity = useIdentity();
  return (
    <AttendancePanel
      key={`${meeting.id}:${meeting.client?.id}:${meeting.startsAt}:${meeting.joinLink}:${meeting.status}:${identity.data?.tenant?.id}:${identity.data?.user.id}`}
      meeting={meeting}
      zone={zone}
    />
  );
}
function AttendancePanel({
  meeting,
  zone,
}: {
  meeting: Meeting;
  zone: CalendarZone;
}) {
  const api = useApi(),
    cache = useQueryClient(),
    access = useAttendanceAccess();
  const query = useAttendanceSession(
    meeting.id,
    access.scope,
    access.readAllowed,
  );
  const [sending, setSending] = useState(false),
    [removing, setRemoving] = useState(false);
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      access.guard();
      if (!query.data)
        throw new Error(
          "Refresh the current Meri session before requesting removal.",
        );
      return removeMeri(api, meeting.id, query.data, access.guard);
    },
    onSuccess: async (session) => {
      access.guard();
      cache.setQueryData(sessionKey(access.scope, meeting.id), session);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["meeting", meeting.id] }),
        cache.invalidateQueries({ queryKey: ["calendar", "meetings"] }),
      ]);
      access.guard();
      setRemoving(false);
    },
    onError: (error) => {
      try {
        access.guard();
      } catch {
        return;
      }
      if (error instanceof AttendanceUncertain) setNeedsReconcile(true);
    },
  });
  const ready =
    access.allowed && query.isSuccess && !query.isFetching && !query.error;
  async function refresh() {
    const [result] = await Promise.all([
      query.refetch(),
      cache.invalidateQueries({ queryKey: ["meeting", meeting.id] }),
    ]);
    if (result.isSuccess) setNeedsReconcile(false);
  }
  const error =
    access.identity.error ?? access.capabilities.error ?? query.error;
  return (
    <section aria-label="Meri meeting attendance" className={styles.panel}>
      <h3>Meri attendance</h3>
      <QueryState
        pending={
          access.identity.isPending || (access.readAllowed && query.isPending)
        }
        error={error}
        retry={() =>
          void (access.identity.error
            ? access.identity.refetch()
            : access.capabilities.error
              ? access.capabilities.refetch()
              : query.refetch())
        }
      />
      {access.readAllowed && !query.error && query.isSuccess && (
        <>
          <p role="status">{sessionLabel(query.data)}</p>
          {query.data?.error && <p role="alert">{query.data.error}</p>}
          <div className="row">
            <button
              className="button"
              disabled={
                !ready ||
                needsReconcile ||
                progressing(query.data) ||
                ["cancelled", "canceled", "deleted"].includes(
                  meeting.status.trim().toLowerCase(),
                )
              }
              onClick={() => setSending(true)}
            >
              Send Meri to take notes
            </button>
            {removable(query.data) && (
              <button
                className="button"
                disabled={!ready || mutation.isPending}
                onClick={() => {
                  mutation.reset();
                  setRemoving(true);
                }}
              >
                Cancel Meri attendance
              </button>
            )}
            <button
              className="button ghost"
              disabled={query.isFetching || mutation.isPending}
              onClick={() => void refresh()}
            >
              Refresh Meri status
            </button>
          </div>
        </>
      )}
      {!access.readAllowed &&
        access.identity.isSuccess &&
        !access.identity.isFetching && (
          <p role="alert">
            Your current role or session cannot access meeting attendance.
          </p>
        )}
      {access.readAllowed &&
        !access.capabilities.isPending &&
        !access.allowed &&
        !error && (
          <p className="muted">
            Attendance actions are disabled in this environment. Existing status
            remains visible.
          </p>
        )}
      {needsReconcile && (
        <p role="alert">
          An attendance request has an uncertain result. Refresh the current
          Meri status before another request.
        </p>
      )}
      <SendMeriDialog
        key={`${sending}`}
        meeting={meeting}
        zone={zone}
        open={sending}
        onOpenChange={setSending}
        allowed={ready && !needsReconcile}
        guard={access.guard}
        onSaved={(session) =>
          cache.setQueryData(sessionKey(access.scope, meeting.id), session)
        }
        onRefresh={refresh}
        onUncertain={() => setNeedsReconcile(true)}
      />
      <Dialog
        open={removing}
        onOpenChange={(value) => {
          if (!mutation.isPending) setRemoving(value);
        }}
        title="Cancel Meri attendance"
        description={meeting.subject}
        className={styles.dialog}
      >
        <div className={styles.body}>
          <p>
            Ask Meri to leave this meeting or cancel its scheduled join. Notes
            or transcripts already captured are retained under the existing
            service policy. Cancelling does not delete them.
          </p>
          <QueryState error={mutation.error} />
          {mutation.error && (
            <button
              className="button"
              disabled={mutation.isPending || query.isFetching}
              onClick={() => void refresh()}
            >
              Refresh Meri status
            </button>
          )}
          <div className="row">
            <button
              className="button"
              disabled={mutation.isPending}
              onClick={() => setRemoving(false)}
            >
              Keep attendance
            </button>
            <button
              className="button primary"
              disabled={
                !ready ||
                needsReconcile ||
                mutation.isPending ||
                !removable(query.data)
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Requesting removal…" : "Remove Meri"}
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

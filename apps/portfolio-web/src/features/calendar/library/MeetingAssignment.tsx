"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { ApiError } from "@/shared/api/http";
import { useClients } from "@/features/portfolio/public";
import { filesKey } from "@/features/files/public";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { Meeting } from "../contracts";
import { AssignmentConflict, assignMeeting } from "./api";
import { useDispatchGuard } from "../access/public";
import styles from "./library.module.css";

export function MeetingAssignment({
  meeting,
  open,
  onOpenChange,
  onAssigned,
}: {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: (meeting: Meeting) => void;
}) {
  const identity = useIdentity();
  return (
    <AssignmentForm
      key={`${open}:${meeting.id}:${identity.data?.tenant?.id}:${identity.data?.user.id}`}
      meeting={meeting}
      open={open}
      onOpenChange={onOpenChange}
      onAssigned={onAssigned}
    />
  );
}
function AssignmentForm({
  meeting,
  open,
  onOpenChange,
  onAssigned,
}: {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: (meeting: Meeting) => void;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const clients = useClients();
  const guard = useDispatchGuard(
    identity.data?.user.id,
    identity.data?.tenant?.id,
  );
  const [reviewed, setReviewed] = useState(meeting);
  const [clientId, setClientId] = useState(meeting.client?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const allowed = Boolean(
    identity.data &&
    identity.data.user.id &&
    identity.data.tenant?.id &&
    !identity.isPending &&
    !identity.isFetching &&
    !identity.error &&
    (identity.data.role === "standard_user" ||
      canAdminister(identity.data.role)),
  );
  const changed = clientId !== (reviewed.client?.id ?? "");
  const mutation = useMutation({
    mutationFn: async () => {
      guard();
      if (!allowed)
        throw new ApiError(403, "Assignment is unavailable for this role.");
      if (
        !changed ||
        !confirmed ||
        (clientId && !clients.data?.some((client) => client.id === clientId))
      )
        throw new ApiError(
          422,
          "Select an accessible client and review the association change.",
        );
      return assignMeeting(api, reviewed, clientId || null, guard);
    },
    onSuccess: async (saved) => {
      guard();
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["calendar"] }),
        cache.invalidateQueries({ queryKey: ["meeting", meeting.id] }),
        ...[reviewed.client?.id, saved.client?.id].flatMap((id) =>
          id ? [cache.invalidateQueries({ queryKey: filesKey(id) })] : [],
        ),
      ]);
      guard();
      onAssigned?.(saved);
      onOpenChange(false);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
      title="Client assignment"
      description="Associate this meeting with the client whose context and artifacts should receive it."
      className={styles.assignment}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <QueryState
          pending={
            identity.isPending || identity.isFetching || clients.isPending
          }
          error={identity.error ?? clients.error}
          retry={() =>
            void (identity.error ? identity.refetch() : clients.refetch())
          }
        />
        <label>
          Client
          <select
            aria-label="Assignment client"
            value={clientId}
            disabled={mutation.isPending || !allowed || !clients.isSuccess}
            onChange={(event) => {
              setClientId(event.target.value);
              setConfirmed(false);
              mutation.reset();
            }}
          >
            <option value="">No client</option>
            {clients.data?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
            {clientId &&
              !clients.data?.some((client) => client.id === clientId) && (
                <option value={clientId}>Current client unavailable</option>
              )}
          </select>
        </label>
        <small className="muted">
          Sharing requires a client. Meetings may remain unassigned.
        </small>
        {changed && (
          <label className="row">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={mutation.isPending}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              Move this meeting&apos;s preparation, notes, debriefs and
              attachments to{" "}
              {clients.data?.find((client) => client.id === clientId)?.name ??
                "no client"}
              . Revoke existing sharing; approved content stays approved and
              private until explicitly shared again.
            </span>
          </label>
        )}
        {!allowed && identity.isSuccess && (
          <p role="alert">
            You do not have permission to change this assignment.
          </p>
        )}
        <QueryState error={mutation.error} />
        {mutation.error instanceof AssignmentConflict && (
          <div className="stack">
            <p>
              Current client:{" "}
              {mutation.error.current.client?.name ?? "No client"} ·{" "}
              {mutation.error.current.visibility}
            </p>
            <button
              className="button"
              type="button"
              onClick={() => {
                if (mutation.error instanceof AssignmentConflict)
                  setReviewed(mutation.error.current);
                setConfirmed(false);
                mutation.reset();
              }}
            >
              Review current assignment
            </button>
          </div>
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
              !allowed ||
              !clients.isSuccess ||
              mutation.isPending ||
              !changed ||
              !confirmed
            }
          >
            {mutation.isPending ? "Saving assignment…" : "Save assignment"}
          </button>
        </div>
        <small className="muted">
          This changes the Capiro association, not the calendar provider event.
          A fresh check detects earlier changes; this API does not support a
          revision guard against simultaneous saves.
        </small>
      </form>
    </Dialog>
  );
}

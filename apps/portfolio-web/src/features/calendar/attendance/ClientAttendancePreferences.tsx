"use client";
import { useState, type ComponentProps } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { AttendanceUncertain, changePreference } from "./api";
import { recordingConsentSchema, consentCopy } from "./contracts";
import { ConsentFields, type ConsentState } from "./ConsentFields";
import {
  useAttendanceAccess,
  useAttendancePreference,
  preferenceKey,
} from "./queries";
import styles from "./attendance.module.css";

interface Props {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
}
export function ClientAttendancePreferences(props: Props) {
  const identity = useIdentity();
  return (
    <PreferenceForm
      key={`${props.open}:${props.clientId}:${identity.data?.tenant?.id}:${identity.data?.user.id}`}
      {...props}
    />
  );
}
function PreferenceForm({
  clientId,
  clientName,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: Props) {
  const api = useApi(),
    cache = useQueryClient(),
    access = useAttendanceAccess();
  const query = useAttendancePreference(
    clientId,
    access.scope,
    open && access.readAllowed,
  );
  const [consent, setConsent] = useState<ConsentState>({
    authorizedToRecord: false,
    allPartiesWillBeNotified: false,
  });
  const [uncertain, setUncertain] = useState(false);
  const enabled = query.data?.enabled === true;
  const parsed = recordingConsentSchema.safeParse(consent);
  const mutation = useMutation({
    mutationFn: async () => {
      access.guard();
      if (!query.data)
        throw new Error("Refresh the current attendance setting.");
      return changePreference(
        api,
        clientId,
        query.data,
        query.data.stopping ? false : !enabled,
        parsed.success ? parsed.data : undefined,
        access.guard,
      );
    },
    onSuccess: async (value) => {
      access.guard();
      cache.setQueryData(preferenceKey(access.scope, clientId), value);
      await cache.invalidateQueries({ queryKey: ["calendar", "meetings"] });
      access.guard();
      setConsent({
        authorizedToRecord: false,
        allPartiesWillBeNotified: false,
      });
    },
    onError: (error) => {
      try {
        access.guard();
      } catch {
        return;
      }
      if (error instanceof AttendanceUncertain) setUncertain(true);
    },
  });
  const ready =
    access.allowed && query.isSuccess && !query.isFetching && !query.error;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      title="Automatic Meri attendance"
      description={clientName}
      className={styles.dialog}
    >
      <div className={styles.body}>
        <QueryState
          pending={
            access.identity.isPending ||
            (open && access.readAllowed && query.isPending)
          }
          error={
            access.identity.error ?? access.capabilities.error ?? query.error
          }
          retry={() =>
            void (access.identity.error
              ? access.identity.refetch()
              : access.capabilities.error
                ? access.capabilities.refetch()
                : query.refetch())
          }
        />
        {access.readAllowed && query.isSuccess && !query.error && (
          <>
            <p role="status">
              {query.data.enabled
                ? "On · Automatic attendance is enabled for your meetings with this client."
                : query.data.stopping
                  ? "Off · Meri is still leaving a meeting. Removal is not yet confirmed."
                  : "Off · Automatic attendance is disabled."}
            </p>
            {enabled ? (
              <p>
                Turning this off stops future automatic joins and asks Meri to
                leave meetings joined through this setting. A stopping state may
                remain until removal finishes.
              </p>
            ) : (
              <>
                <p>
                  This applies to your current and future meetings associated
                  with {clientName}, until turned off. Meri joins around the
                  start time when the service is running and a supported link is
                  available; enabling does not confirm attendance. It does not
                  grant access to teammates&apos; private calendars.
                </p>
                <p className="muted">{consentCopy.intro}</p>
                <ConsentFields
                  value={consent}
                  onChange={setConsent}
                  disabled={
                    mutation.isPending || uncertain || query.data.stopping
                  }
                />
              </>
            )}
          </>
        )}
        {!access.allowed &&
          access.identity.isSuccess &&
          !access.identity.isFetching && (
            <p role="alert">
              Attendance changes are unavailable for the current role, session
              or external-action capability.
            </p>
          )}
        <QueryState error={mutation.error} />
        {(mutation.error || query.data?.stopping) && (
          <button
            className="button"
            disabled={mutation.isPending || query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh attendance setting
          </button>
        )}
        {uncertain && (
          <p role="status">
            Review the latest setting before closing. This form will not repeat
            an uncertain request automatically.
          </p>
        )}
        <div className="row">
          <button
            className="button"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Close
          </button>
          {query.data?.stopping ? (
            <button
              className="button primary"
              disabled={!ready || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Stopping…" : "Retry stopping Meri"}
            </button>
          ) : (
            <button
              className="button primary"
              disabled={
                !ready ||
                mutation.isPending ||
                uncertain ||
                (!enabled && !parsed.success)
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? "Saving…"
                : enabled
                  ? "Turn off automatic attendance"
                  : "Enable automatic attendance"}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

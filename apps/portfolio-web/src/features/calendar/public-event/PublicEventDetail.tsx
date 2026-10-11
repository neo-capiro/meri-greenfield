"use client";
import { useRef } from "react";
import type { Destinations } from "@/shared/config/config";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { usePublicEvent } from "./usePublicEvent";
import { attendanceLabel, eventWhen, publicEventHref } from "./presentation";
import styles from "./public-event.module.css";

const kindAsset = new URL("./assets/hearing-kind.svg", import.meta.url).href;
const openAsset = new URL("./assets/open-legiwatch.svg", import.meta.url).href;
export interface PublicEventDetailProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinations: Destinations;
  clientId?: string;
}
export function PublicEventDetail({
  eventId,
  open,
  onOpenChange,
  destinations,
  clientId,
}: PublicEventDetailProps) {
  const { query, identity, allowed } = usePublicEvent(eventId, clientId, open);
  const opener = useRef<HTMLElement | null>(null);
  const detail =
    allowed && query.isSuccess && !query.error && !query.isFetching
      ? query.data
      : undefined;
  const when = detail ? eventWhen(detail.hearing) : undefined;
  const href = detail
    ? publicEventHref(destinations.existingApp, detail.hearing.id)
    : undefined;
  const relevant = detail?.clients?.filter((client) =>
    ["HIGH", "MEDIUM", "LOW"].includes(client.band),
  );
  const insufficient = detail?.clients?.filter(
    (client) => client.band === "INSUFFICIENT_EVIDENCE",
  );
  const insufficientCount = insufficient?.length ?? 0;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={detail?.hearing.title ?? "Public proceeding"}
      className={styles.dialog}
      onOpenAutoFocus={() => {
        opener.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }}
      onCloseAutoFocus={(event) => {
        if (opener.current?.isConnected) {
          event.preventDefault();
          opener.current.focus();
        }
      }}
    >
      <div className={styles.kind}>
        <img src={kindAsset} alt="" width={8} height={8} />
        <span>
          Hearings
          {detail?.hearing.eventType ? ` · ${detail.hearing.eventType}` : ""}
        </span>
      </div>
      <QueryState
        pending={
          identity.isPending ||
          identity.isFetching ||
          (allowed && (query.isPending || query.isFetching))
        }
        error={identity.error ?? query.error}
        retry={() =>
          void (identity.error ? identity.refetch() : query.refetch())
        }
      />
      {!identity.isPending && !allowed && open && (
        <p role="status">
          A current authorized session is required to view proceeding and client
          relevance details.
        </p>
      )}
      {detail && when && (
        <>
          <dl className={styles.facts}>
            <div>
              <dt>When</dt>
              <dd>
                <time dateTime={detail.hearing.calendarDate ?? undefined}>
                  {when.date}
                </time>
                <br />
                {when.time}
              </dd>
            </div>
            <div>
              <dt>Committee</dt>
              <dd>{detail.hearing.committeeName ?? "Not reported"}</dd>
            </div>
            <div>
              <dt>Event status</dt>
              <dd>
                {detail.hearing.eventStatus.replaceAll("_", " ") ||
                  "Not reported"}
              </dd>
            </div>
            <div>
              <dt>Relevant clients</dt>
              <dd>
                {detail.clients === null
                  ? "Client relevance unavailable"
                  : relevant?.length
                    ? relevant
                        .map(
                          (client) => client.clientName ?? "Name unavailable",
                        )
                        .join(", ")
                    : "No verified relevant clients"}
              </dd>
            </div>
            <div>
              <dt>Capture</dt>
              <dd>
                {detail.attendance
                  ? attendanceLabel(detail.attendance.state)
                  : "Capture state unavailable"}
              </dd>
            </div>
          </dl>
          {when.warning && <small role="note">{when.warning}</small>}
          {insufficientCount > 0 && (
            <small role="note">
              Relevance needs additional evidence for {insufficientCount}{" "}
              {insufficientCount === 1 ? "client" : "clients"} in this tenant.
            </small>
          )}
          {detail.attendance && (
            <small role="status">{detail.attendance.message}</small>
          )}
          <small className="muted">
            Public committee record · client relevance in this organization
            {clientId ? " for the selected client" : ""}.
          </small>
          <div className={styles.actions}>
            <span className="button" aria-label="Following status">
              {detail.follow
                ? detail.follow.following
                  ? "Following"
                  : "Not following"
                : "Follow state unavailable"}
            </span>
            {href ? (
              <a
                className="button primary"
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                <img src={openAsset} alt="" width={16} height={16} />
                Open in LegiWatch
              </a>
            ) : (
              <span role="status">
                Configure the existing application destination to open
                LegiWatch.
              </span>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}

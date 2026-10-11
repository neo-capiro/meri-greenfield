"use client";
import { useState } from "react";
import { MapPin, Video, Users } from "lucide-react";
import type { Destinations } from "@/shared/config/config";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { safeWebsite } from "@/features/portfolio/public";
import { useMeeting } from "./queries";
import { MeetingArtifacts } from "./MeetingArtifacts";
import { MeetingForm } from "./MeetingForm";
import { MeetingPreparation } from "./preparation/public";
import { MeetingAssignment } from "./library/public";
import { MeetingAttendance } from "./attendance/public";
import { MeetingAttachmentApprovals } from "./review/public";
import { useIdentity } from "@/shared/auth/identity";
import { formatInstant, type CalendarZone } from "./range";
import styles from "./calendar.module.css";
export function MeetingDetail({
  id,
  onClose,
  zone,
  clientId,
}: {
  id: string | null;
  onClose: () => void;
  zone: CalendarZone;
  destinations: Destinations;
  clientId?: string;
}) {
  const query = useMeeting(id);
  const identity = useIdentity();
  const [tab, setTab] = useState<
    "information" | "preparation" | "notes" | "debriefs"
  >("information");
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const meeting = query.data;
  const inScope = !clientId || meeting?.client?.id === clientId;
  return (
    <Dialog
      open={Boolean(id)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={inScope ? (meeting?.subject ?? "Meeting") : "Meeting unavailable"}
      drawer
      className={styles.meetingDrawer}
    >
      <QueryState
        pending={query.isPending}
        error={query.error ?? identity.error}
        retry={() =>
          void (identity.error ? identity.refetch() : query.refetch())
        }
      />
      {meeting && !inScope && (
        <p role="alert">
          This meeting is not associated with the selected client.
        </p>
      )}
      {meeting && inScope && !query.error && !identity.error && (
        <>
          <div className="row">
            <span className="chip">{meeting.visibility}</span>
            <small>
              {meeting.client?.name ?? "No client"}
              {meeting.meri && ` · Meri ${meeting.meri}`}
            </small>
          </div>
          <nav className="row" aria-label="Meeting sections">
            {(["information", "preparation", "notes", "debriefs"] as const).map(
              (value) => (
                <button
                  className={`button ${tab === value ? "primary" : ""}`}
                  key={value}
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                >
                  {value[0]?.toUpperCase()}
                  {value.slice(1)}
                </button>
              ),
            )}
          </nav>
          {tab === "information" && (
            <div className="stack">
              <p>
                {formatInstant(meeting.startsAt, zone)} –{" "}
                {formatInstant(meeting.endsAt, zone)}
              </p>
              {meeting.location && (
                <p className="row">
                  <MapPin size={16} />
                  {meeting.location}
                </p>
              )}
              {safeWebsite(meeting.joinLink) && (
                <a
                  className="button"
                  href={safeWebsite(meeting.joinLink)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Video size={16} />
                  Join meeting
                </a>
              )}
              <MeetingAttendance meeting={meeting} zone={zone} />
              <p>{meeting.description ?? "No description."}</p>
              <h3 className="row">
                <Users size={16} />
                Attendees
              </h3>
              <ul>
                {meeting.attendees.map((attendee) => (
                  <li key={attendee.id}>
                    {attendee.name ?? attendee.email ?? "Unnamed attendee"}
                    {attendee.role && ` · ${attendee.role}`}
                  </li>
                ))}
              </ul>
              <button className="button" onClick={() => setEditing(true)}>
                Edit meeting
              </button>
              <button className="button" onClick={() => setAssigning(true)}>
                Client assignment
              </button>
            </div>
          )}
          {tab === "preparation" && (
            <>
              <MeetingPreparation meeting={meeting} />
              <MeetingAttachmentApprovals meeting={meeting} />
            </>
          )}
          {(tab === "notes" || tab === "debriefs") && (
            <MeetingArtifacts
              key={`${tab}:${identity.data?.tenant?.id}:${identity.data?.user.id}:${meeting.client?.id}`}
              meeting={meeting}
              kind={tab}
            />
          )}
          <MeetingForm
            key={editing ? "editing" : "closed"}
            meeting={meeting}
            open={editing}
            onOpenChange={setEditing}
            zone={zone}
            clientId={clientId}
          />
          <MeetingAssignment
            meeting={meeting}
            open={assigning}
            onOpenChange={setAssigning}
            onAssigned={(saved) => {
              if (clientId && saved.client?.id !== clientId) onClose();
            }}
          />
        </>
      )}
    </Dialog>
  );
}

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
import { formatInstant, type CalendarZone } from "./range";
export function MeetingDetail({
  id,
  onClose,
  zone,
  destinations,
  clientId,
}: {
  id: string | null;
  onClose: () => void;
  zone: CalendarZone;
  destinations: Destinations;
  clientId?: string;
}) {
  const query = useMeeting(id);
  const [tab, setTab] = useState<
    "information" | "preparation" | "notes" | "debriefs"
  >("information");
  const [editing, setEditing] = useState(false);
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
    >
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {meeting && !inScope && (
        <p role="alert">
          This meeting is not associated with the selected client.
        </p>
      )}
      {meeting && inScope && (
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
            </div>
          )}
          {tab === "preparation" && (
            <div className="stack">
              {meeting.preps.map((prep) => (
                <article className="card stack" key={prep.id}>
                  <span className="chip">{prep.status}</span>
                  {prep.summary && <p>{prep.summary}</p>}
                  {(
                    ["agenda", "talkingPoints", "risks", "followUps"] as const
                  ).map((section) => (
                    <div key={section}>
                      <h3>
                        {section === "talkingPoints"
                          ? "Talking points"
                          : section === "followUps"
                            ? "Follow-ups"
                            : section[0]?.toUpperCase() + section.slice(1)}
                      </h3>
                      <ul>
                        {prep[section].map((value, index) => (
                          <li key={index}>
                            {typeof value === "string" ? (
                              value
                            ) : "text" in value ? (
                              value.text
                            ) : (
                              <>
                                <strong>{value.title}</strong>
                                {value.description && (
                                  <p>{value.description}</p>
                                )}
                                {value.dueDate && (
                                  <span>Due {value.dueDate}</span>
                                )}
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
              {meeting.preps.length === 0 && (
                <p className="empty">No preparation yet.</p>
              )}
              {destinations.existingApp ? (
                <a
                  className="button"
                  href={`${destinations.existingApp}/engagement/meetings?meeting=${encodeURIComponent(meeting.id)}`}
                >
                  Open meeting preparation in Modules ↗
                </a>
              ) : (
                <p className="muted">
                  Configure the existing Modules destination to generate and
                  edit preparation.
                </p>
              )}
            </div>
          )}
          {(tab === "notes" || tab === "debriefs") && (
            <MeetingArtifacts meeting={meeting} kind={tab} />
          )}
          <MeetingForm
            key={editing ? "editing" : "closed"}
            meeting={meeting}
            open={editing}
            onOpenChange={setEditing}
            zone={zone}
            clientId={clientId}
          />
        </>
      )}
    </Dialog>
  );
}

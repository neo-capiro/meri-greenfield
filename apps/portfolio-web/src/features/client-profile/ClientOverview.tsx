"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowUpRight, NotebookPen, Users } from "lucide-react";
import {
  useClient,
  initials,
  safeWebsite,
  memberName,
} from "@/features/portfolio/public";
import { ObjectiveSummary } from "@/features/objectives/public";
import { QueryState } from "@/shared/ui/QueryState";
import { ActivityTimeline } from "./ActivityTimeline";
import { FacilitiesCard } from "./FacilitiesCard";
import { TeamDialog } from "./TeamDialog";
import { NotesDialog } from "./NotesDialog";
import { QuickLog } from "./QuickLog";
import { FocusTags } from "./tags/public";
import { useTeam, useActivity } from "./queries";
import styles from "./overview.module.css";
export function ClientOverview({ clientId }: { clientId: string }) {
  const client = useClient(clientId);
  const team = useTeam(clientId);
  const activity = useActivity(clientId);
  const params = useSearchParams();
  const router = useRouter();
  const [showTeam, setShowTeam] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  if (!client.data)
    return <QueryState pending={client.isPending} error={client.error} />;
  const value = client.data;
  const website = safeWebsite(value.website);
  const owner = team.data?.find((m) => m.isOwner);
  return (
    <div className="page">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Client profile</p>
          <h1>Overview</h1>
        </div>
        <div className="row">
          <button className="button" onClick={() => setShowNotes(true)}>
            <NotebookPen size={16} />
            Notes
          </button>
          <Link
            className="button"
            href={`/portfolio/${clientId}/objectives?new=1`}
          >
            New objective
          </Link>
        </div>
      </header>
      <div className={styles.layout}>
        <div className={styles.column}>
          <section className="card stack">
            <div className={styles.identity}>
              <span className="monogram">
                {value.logoUrl ? (
                  <img src={value.logoUrl} width={44} height={44} alt="" />
                ) : (
                  initials(value.name)
                )}
              </span>
              <div>
                <div className="row">
                  <h1>{value.name}</h1>
                  <span className="chip">{value.profileStatus}</span>
                </div>
                <small>
                  {value.sectorTag ?? "Sector not specified"}
                  {website && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={website} target="_blank" rel="noreferrer">
                        {value.website}
                      </a>
                    </>
                  )}
                </small>
              </div>
            </div>
            <p className="muted">
              {value.description ?? "No organization description yet."}
            </p>
            <FocusTags clientId={clientId} />
            <div className={styles.profileMeta}>
              <span>
                <span className="eyebrow">Owner </span>
                {owner
                  ? memberName({ ...owner, id: owner.userId })
                  : team.isSuccess
                    ? "Unassigned"
                    : "—"}
              </span>
              <button
                className="button ghost"
                onClick={() => setShowTeam(true)}
              >
                <Users size={14} />
                Account team{team.data && ` · ${team.data.length}`}
              </button>
            </div>
          </section>
          <section
            className={`card ${styles.pulse}`}
            aria-label="Engagement pulse"
          >
            <header className="row between">
              <h2>Engagement pulse</h2>
              <a href="#activity-timeline">Open timeline →</a>
            </header>
            <div className={styles.pulseGrid}>
              <div>
                <strong>{activity.data?.length ?? "—"}</strong>
                <p>
                  <small>Recent activity items</small>
                </p>
              </div>
              <div>
                <strong>{team.data?.length ?? "—"}</strong>
                <p>
                  <small>Account team</small>
                </p>
              </div>
              <div>
                <strong>—</strong>
                <p>
                  <small>Objective coverage unavailable</small>
                </p>
              </div>
            </div>
          </section>
          <ObjectiveSummary clientId={clientId} />
        </div>
        <div className={styles.column}>
          <FacilitiesCard clientId={clientId} clientName={value.name} />
          <section className="card stack">
            <div className="row between">
              <h2>Client calendar</h2>
              <Link
                className="button ghost iconButton"
                href={`/portfolio/${clientId}/calendar`}
                aria-label="Open client calendar"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <p className="muted">
              Meetings, preparation, notes and debriefs for this client.
            </p>
            <Link className="button" href={`/portfolio/${clientId}/calendar`}>
              Open calendar
            </Link>
          </section>
        </div>
      </div>
      <ActivityTimeline clientId={clientId} />
      <TeamDialog
        clientId={clientId}
        open={showTeam}
        onOpenChange={setShowTeam}
      />
      <NotesDialog
        key={showNotes ? "open" : "closed"}
        clientId={clientId}
        open={showNotes || params.has("notes")}
        onOpenChange={(open) => {
          setShowNotes(open);
          if (!open && params.has("notes")) {
            const next = new URLSearchParams(params);
            next.delete("notes");
            router.replace(`/portfolio/${clientId}?${next}`, { scroll: false });
          }
        }}
      />
      <QuickLog
        clientId={clientId}
        clientName={value.name}
        open={params.has("log")}
        onOpenChange={(open) => {
          if (!open) {
            const next = new URLSearchParams(params);
            next.delete("log");
            router.replace(`/portfolio/${clientId}?${next}`, { scroll: false });
          }
        }}
      />
    </div>
  );
}

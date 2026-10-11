import type { Preparation } from "./schema";
import { Dialog } from "@/shared/ui/Dialog";
import { prepFields } from "./editing";
import styles from "./preparation.module.css";
import type { Meeting } from "../contracts";
import { emailEvidenceSourceUrl, type EmailEvidence } from "./email-evidence";

function EmailEvidenceContent({ item }: { item: EmailEvidence }) {
  if (typeof item === "string") return item;
  const href = emailEvidenceSourceUrl(item.sourceUrl);
  return (
    <>
      <p>{item.summary}</p>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          Source {item.sourceId}
        </a>
      ) : (
        <span>Source {item.sourceId}</span>
      )}
    </>
  );
}

const sectionLabels: Record<string, string> = {
  recentDevelopments: "Recent developments",
  importantEmails: "Important email exchanges",
  previousConversations: "Previous meetings and conversations",
  decisions: "Decisions already made",
  unresolvedIssues: "Outstanding questions and unresolved issues",
  upcomingDevelopments:
    "Upcoming deadlines, meetings and legislative developments",
  commitments: "What we committed to doing",
};
export function PreparationContent({ prep }: { prep: Preparation }) {
  const briefing = !prep.generatedFrom?.grounding?.contentEdited
    ? prep.generatedFrom?.briefing
    : undefined;
  if (briefing && typeof briefing === "object")
    return (
      <div className={styles.content}>
        <section>
          <h3>Key takeaways</h3>
          <ul>
            {briefing.takeaways.map((item, index) => (
              <li key={index}>{item.text}</li>
            ))}
          </ul>
        </section>
        {Object.entries(briefing.sections).map(([key, section]) => (
          <section key={key}>
            <h3>{sectionLabels[key] ?? key}</h3>
            <ul>
              {section.items.map((item, index) => (
                <li key={index}>{item.text}</li>
              ))}
            </ul>
            {section.gap && <p>{section.gap}</p>}
          </section>
        ))}
        <p role="note">
          {briefing.coverage.partial
            ? "Partial source coverage."
            : "Searched-source coverage complete."}{" "}
          {briefing.coverage.reviewedFactCount} extracted facts checked. This
          does not establish that every possible source was available.
        </p>
        {briefing.limitations.map((value, index) => (
          <p role="note" key={index}>
            {value}
          </p>
        ))}
      </div>
    );
  return (
    <div className={styles.content}>
      <section>
        <h3>Summary</h3>
        <p>{prep.summary || "No summary."}</p>
      </section>
      {(
        [
          "agenda",
          "talkingPoints",
          "risks",
          "followUps",
          "emailEvidence",
        ] as const
      ).map((section) => (
        <section key={section}>
          <h3>{prepFields[section]}</h3>
          {prep[section].length ? (
            <ul>
              {prep[section].map((item, index) => (
                <li key={index}>
                  {typeof item === "string" ? (
                    item
                  ) : "summary" in item ? (
                    <EmailEvidenceContent item={item} />
                  ) : "text" in item ? (
                    item.text
                  ) : (
                    <>
                      <strong>{item.title}</strong>
                      {item.description && <p>{item.description}</p>}
                      {item.dueDate && <span>Due {item.dueDate}</span>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No {prepFields[section].toLowerCase()}.</p>
          )}
        </section>
      ))}
    </div>
  );
}
export function PreparationSources({
  prep,
  meeting,
  onClose,
}: {
  prep: Preparation;
  meeting: Pick<Meeting, "subject" | "client" | "attendees">;
  onClose: () => void;
}) {
  const grounding = prep.generatedFrom?.grounding;
  const briefing = prep.generatedFrom?.briefing;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Preparation sources and citations"
      description="The evidence used for this meeting’s prep."
      className={styles.dialog}
    >
      <section className={styles.content}>
        <h3>Meeting context</h3>
        <p>
          Client: {meeting.client?.name ?? "No client"} ·{" "}
          {meeting.attendees.length} attendees · {meeting.subject}
        </p>
      </section>
      {grounding?.contentEdited && (
        <p role="note">
          Preparation text has been edited. Saved evidence describes the
          original generated briefing; it does not independently verify edits.
        </p>
      )}
      <div className={styles.content}>
        <h3>Recent client activity</h3>
      </div>
      {grounding?.sources.length ? (
        grounding.sources.map((source) => (
          <article className={styles.source} key={source.id}>
            <h3>{source.title}</h3>
            <small>
              {source.kind}
              {source.observedAt && ` · ${source.observedAt}`}
            </small>
            <p>{source.excerpt}</p>
            {grounding.references
              .filter((reference) => reference.sourceIds.includes(source.id))
              .map((reference, index) => (
                <small key={index}>
                  Referenced in{" "}
                  {sectionLabels[reference.section] ??
                    Object.entries(prepFields).find(
                      ([field]) => field === reference.section,
                    )?.[1] ??
                    reference.section}
                  , item {reference.itemIndex + 1}
                </small>
              ))}
            {briefing &&
              typeof briefing === "object" &&
              briefing.facts
                .filter((fact) => fact.sourceId === source.id)
                .map((fact) => (
                  <blockquote key={fact.id}>{fact.quote}</blockquote>
                ))}
          </article>
        ))
      ) : (
        <p>No additional generated-source metadata is available.</p>
      )}
      {prep.emailEvidence.length > 0 && (
        <section className={styles.content}>
          <h3>Email evidence</h3>
          <ul>
            {prep.emailEvidence.map((item, index) => (
              <li key={index}>
                <EmailEvidenceContent item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {grounding?.limitations.map((value, index) => (
        <p role="note" key={index}>
          {value}
        </p>
      ))}
      <p className="muted">
        Review the saved evidence and any coverage limitations before relying on
        the briefing.
      </p>
      <footer>
        <button className="button" onClick={onClose}>
          Cancel
        </button>
      </footer>
    </Dialog>
  );
}

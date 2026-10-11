import type { Preparation } from "./schema";
import { Dialog } from "@/shared/ui/Dialog";
import { prepFields } from "./editing";
import styles from "./preparation.module.css";

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
  if (briefing)
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
  onClose,
}: {
  prep: Preparation;
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
      description="Source evidence saved with this preparation."
    >
      {grounding?.contentEdited && (
        <p role="note">
          Preparation text has been edited. Saved evidence describes the
          original generated briefing; it does not independently verify edits.
        </p>
      )}
      {grounding?.sources.length ? (
        grounding.sources.map((source) => (
          <article className={styles.source} key={source.id}>
            <h3>{source.title}</h3>
            <small>
              {source.kind}
              {source.observedAt && ` · ${source.observedAt}`}
            </small>
            <p>{source.excerpt}</p>
            {briefing?.facts
              .filter((fact) => fact.sourceId === source.id)
              .map((fact) => (
                <blockquote key={fact.id}>{fact.quote}</blockquote>
              ))}
          </article>
        ))
      ) : (
        <p>No saved source metadata is available for this preparation.</p>
      )}
      {grounding?.limitations.map((value, index) => (
        <p role="note" key={index}>
          {value}
        </p>
      ))}
    </Dialog>
  );
}

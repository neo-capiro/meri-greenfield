import type { BriefVersion } from "./contracts";
import { sectionKeys, sectionLabels } from "./contracts";
import styles from "./brief.module.css";

export function BriefDocument({
  title,
  version,
  onSource,
}: {
  title: string;
  version: BriefVersion;
  onSource: (index: number) => void;
}) {
  return (
    <article
      className={styles.document}
      aria-label={`Saved brief version ${version.versionNumber}`}
    >
      <p className={styles.notice}>
        Saved prospect brief from authorized dossier evidence. Candidate
        objectives, budget plans and Workspace filing are not established by
        this brief.
      </p>
      <p className="eyebrow">
        Federal strategy brief · Version {version.versionNumber} ·{" "}
        <time dateTime={version.createdAt}>{version.createdAt}</time>
      </p>
      <h2>{title}</h2>
      {sectionKeys.map((key) => (
        <section key={key}>
          <div className="row between">
            <h3>{sectionLabels[key]}</h3>
            <small>{version.sections[key].provenance}</small>
          </div>
          <p className={styles.sectionText}>{version.sections[key].text}</p>
          <div className="row">
            {version.sections[key].citationIndexes.map((index, position) => (
              <button
                key={`${index}:${position}`}
                className="button ghost"
                onClick={() => onSource(index)}
              >
                Source {index + 1}
              </button>
            ))}
          </div>
        </section>
      ))}
      {!version.citations.length && (
        <p className="muted">
          No citations were saved with this version. This does not establish an
          absence of relevant evidence.
        </p>
      )}
    </article>
  );
}

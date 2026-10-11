import type { ProgramPage } from "./contracts";
import styles from "./opportunities.module.css";
export function RelevantPrograms({
  data,
  base,
}: {
  data: ProgramPage;
  base?: string;
}) {
  return (
    <>
      {data.data.map((program) => (
        <article className={styles.item} key={program.peCode}>
          <div className="row">
            <code>{program.peCode}</code>
            <h3>{program.title ?? "Program title not available"}</h3>
          </div>
          <div className="row between">
            <span className="eyebrow">Relevance</span>
            <strong>{Math.round(program.score * 100)}%</strong>
          </div>
          {base && (
            <a
              href={`${base}/program-elements/${encodeURIComponent(program.peCode)}`}
            >
              Open PE →
            </a>
          )}
          {program.paths.length > 0 && (
            <details>
              <summary>Match evidence</summary>
              {program.paths.map((path) => (
                <div key={path.path}>
                  <p>{path.path.replaceAll("_", " ")}</p>
                  <ul>
                    {path.evidence.map((evidence, index) => (
                      <li key={index}>{evidence}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          )}
        </article>
      ))}
      {data.data.length === 0 && (
        <p className="empty">No relevant budget programs on this page.</p>
      )}
    </>
  );
}

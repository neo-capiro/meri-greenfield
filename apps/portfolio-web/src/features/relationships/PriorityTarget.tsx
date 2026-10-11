import { initials } from "@/features/portfolio/public";
import { targetKind, type GovernmentTarget } from "./target-contracts";
import styles from "./targets.module.css";
export function PriorityTarget({
  target,
  index,
  onOpen,
}: {
  target: GovernmentTarget;
  index: number;
  onOpen: (id: string) => void;
}) {
  const facilities = target.representedFacilities;
  const context =
    target.sourceDirectory === "staff"
      ? (target.committee ?? "Office unavailable")
      : facilities == null
        ? "Representation unavailable"
        : facilities.length
          ? facilities.map((facility) => facility.name).join(", ")
          : "No client facility represented";
  return (
    <article className={styles.priorityCard}>
      <span className="eyebrow">
        Target {String(index + 1).padStart(2, "0")}
      </span>
      <div className={styles.targetIdentity}>
        <span className={styles.avatar}>
          {initials(target.memberName ?? target.memberId)}
        </span>
        <div>
          <span className="eyebrow">{targetKind(target)}</span>
          <h3>{target.memberName ?? target.memberId}</h3>
          <p className="muted">
            {[target.chamber, target.committee].filter(Boolean).join(" · ") ||
              "Office unavailable"}
          </p>
          <p className="muted">
            {[target.party, target.state].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={styles.tier}>Tier {target.tier}</span>
      </div>
      <dl className={styles.targetMeta}>
        <div>
          <dt className="eyebrow">
            {target.sourceDirectory === "staff" ? "Office" : "Represents"}
          </dt>
          <dd>{context}</dd>
        </div>
        <div>
          <dt className="eyebrow">Added</dt>
          <dd>
            {target.source} · {new Date(target.addedAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>
      <button
        className={`button ghost ${styles.openTarget}`}
        onClick={() => onOpen(target.memberId)}
      >
        Open target →
      </button>
    </article>
  );
}

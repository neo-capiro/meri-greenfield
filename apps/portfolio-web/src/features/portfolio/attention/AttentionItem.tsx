import Link from "next/link";
import type { PortfolioAlert } from "./contracts";
import { alertCategory, alertClientHref, alertTiming } from "./model";
import styles from "./attention.module.css";

export function AttentionItem({ alert }: { alert: PortfolioAlert }) {
  const timing = alertTiming(alert);
  const incomplete =
    alert.canonicalComplete === false ||
    Boolean(alert.canonicalMissingFields?.length);
  return (
    <li className={styles.item}>
      <Link
        href={alertClientHref(alert.clientId)}
        className={styles.link}
        aria-label={`${alert.title || "Untitled alert"} — open ${alert.clientName}`}
      >
        <div className={styles.meta}>
          <span
            className={styles.severity}
            data-critical={alert.severity.toLowerCase() === "critical"}
          >
            {alert.severity || "Unspecified severity"}
          </span>
          {timing ? (
            <span className={styles.timing} title={alert.when}>
              {timing}
            </span>
          ) : (
            <time dateTime={alert.when} title={alert.when}>
              {new Date(alert.when).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}{" "}
              UTC
            </time>
          )}
        </div>
        <p className={styles.title}>{alert.title || "Untitled alert"}</p>
        {alert.subtitle && <p className={styles.subtitle}>{alert.subtitle}</p>}
        <div className={styles.client}>
          <span>
            {alert.clientName} · {alertCategory(alert.type)}
          </span>
          <span className={styles.open}>Open ↗</span>
        </div>
        {(incomplete || alert.state === "acknowledged") && (
          <p className={styles.note}>
            {incomplete && "Source details incomplete"}
            {incomplete && alert.state === "acknowledged" && " · "}
            {alert.state === "acknowledged" && "Acknowledged"}
          </p>
        )}
      </Link>
    </li>
  );
}

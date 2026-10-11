import type { AttentionClient, PortfolioAlert } from "./contracts";

const categoryLabels: Readonly<Record<string, string>> = {
  comment_deadline: "Comment deadline",
  comment_overdue: "Comment closed",
  competitor_filing: "Competitor filing",
  contract_award: "Contract award",
  hearing: "Hearing",
  bill_movement: "Bill movement",
};

export function accessibleAlerts(
  alerts: readonly PortfolioAlert[],
  clients: readonly AttentionClient[],
) {
  const names = new Map(clients.map((client) => [client.id, client.name]));
  return alerts.flatMap((alert) => {
    const name = names.get(alert.clientId);
    return name === undefined ? [] : [{ ...alert, clientName: name }];
  });
}

export function alertCategory(type: string) {
  return categoryLabels[type] ?? (type || "Unclassified alert");
}

export function alertClientHref(clientId: string) {
  return `/portfolio/${encodeURIComponent(clientId)}`;
}

export function alertTiming(alert: PortfolioAlert) {
  // The server label can describe recency as well as a countdown. The event
  // timestamp alone never establishes a deadline or an overdue state.
  return alert.countdownLabel || undefined;
}

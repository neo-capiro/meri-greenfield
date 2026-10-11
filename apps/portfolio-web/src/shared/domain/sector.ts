/** Sector choices persisted by the client intake wizard. */
export const sectors = [
  ["DEFENSE", "Defense"],
  ["HEALTH", "Health & Pharma"],
  ["ENERGY", "Energy"],
  ["TRANSPORTATION", "Transportation"],
  ["AGRICULTURE", "Agriculture"],
  ["HOMELAND_SECURITY", "Homeland Security"],
  ["ENVIRONMENT_WATER", "Environment / Water"],
  ["COMMERCE_TECH", "Commerce / Tech"],
  ["EDUCATION", "Education"],
  ["FINANCIAL_SERVICES", "Financial Services"],
  ["OTHER", "Other"],
] as const;

const labels = new Map<string, string>(sectors);
export const sectorLabel = (value: string) => labels.get(value) ?? value;

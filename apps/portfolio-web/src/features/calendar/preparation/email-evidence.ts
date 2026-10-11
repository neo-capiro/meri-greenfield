import type { Preparation } from "./schema";

export type EmailEvidence = Preparation["emailEvidence"][number];

export function emailEvidenceText(item: EmailEvidence) {
  return typeof item === "string" ? item : item.summary;
}

export function emailEvidenceSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    // Invalid saved URLs retain their source ID as plain text.
  }
  return undefined;
}

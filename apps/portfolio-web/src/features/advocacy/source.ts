import type { AdvocacyRecord } from "./contracts";

export function advocacySourceUrl(record: AdvocacyRecord) {
  for (const value of [record.sourceUrl, record.metadata?.sourceUrl]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      )
        return url.href;
    } catch {
      /* A malformed supplied link has no navigation action. */
    }
  }
  return undefined;
}

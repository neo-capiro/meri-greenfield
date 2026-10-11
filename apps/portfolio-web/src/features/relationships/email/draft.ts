import type { Recipient } from "./recipients";
/** Consumed once on mount; key the composer for a new draft. Prepared references require a canonical Files readiness read. */
export interface MailInitialDraft {
  to?: Recipient[];
  cc?: Recipient[];
  subject?: string;
  body?: string;
  attachments?: Array<{ id: string; fileName: string }>;
}

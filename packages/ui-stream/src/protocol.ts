import type { UIMessage } from 'ai';
import type { UIEvent } from '@capiro/meri-contracts';
import type { NativeBillTextSourceEvent, NativeHearingSourceEvent } from '@capiro/meri-contracts/conversation-sources';
import type { BrowserReceiptEvent } from '@capiro/meri-contracts/conversation-application';
/** Additive durable browser receipt. An observation receipt is NOT proof of a remote website commit, a new
 * permission or a completed browser execution; the frozen UIEvent stays unchanged. */
export type MeriUIEvent = UIEvent | NativeBillTextSourceEvent | NativeHearingSourceEvent | BrowserReceiptEvent;

/** AI SDK prefixes the unprefixed schema key in the stream chunk type. */
export const MERI_EVENT_SCHEMA_KEY = 'meri-event';
export const MERI_EVENT_DATA_PART = 'data-meri-event';
export type MeriUIMessage = UIMessage<unknown, { 'meri-event': MeriUIEvent }>;

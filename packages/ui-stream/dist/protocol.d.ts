import type { UIMessage } from 'ai';
import type { UIEvent } from '@capiro/meri-contracts';
import type { NativeBillTextSourceEvent } from '@capiro/meri-contracts/conversation-sources';
export type MeriUIEvent = UIEvent | NativeBillTextSourceEvent;
/** AI SDK prefixes the unprefixed schema key in the stream chunk type. */
export declare const MERI_EVENT_SCHEMA_KEY = "meri-event";
export declare const MERI_EVENT_DATA_PART = "data-meri-event";
export type MeriUIMessage = UIMessage<unknown, {
    'meri-event': MeriUIEvent;
}>;

import type { UIMessage } from 'ai';
import type { UIEvent } from '@capiro/meri-contracts';

/** AI SDK prefixes the unprefixed schema key in the stream chunk type. */
export const MERI_EVENT_SCHEMA_KEY = 'meri-event';
export const MERI_EVENT_DATA_PART = 'data-meri-event';
export type MeriUIMessage = UIMessage<unknown, { 'meri-event': UIEvent }>;

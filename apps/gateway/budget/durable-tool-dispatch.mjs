/** Existing durable entry; private producer ports remain inside canonical composition. */
import { createPostgresToolDispatch } from './postgres-tool-budget.mjs';
export function createDurableToolDispatch(options) { return createPostgresToolDispatch(options); }

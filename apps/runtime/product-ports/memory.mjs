/** Memory family (lane 5): deliberately composes NO port.
 *
 * The governed producer (`apps/control/memory/*`: candidate, producer, Core review client, PostgreSQL journal, routes) is source
 * complete, but mounting it now would only answer 503s and would claim a surface that cannot work:
 *  - M2: Core's producer routes (`/clio/memory/review/submit` and `/status`, plus the correction target read) are unpublished, so
 *    `core-review.mjs` has no endpoint to submit to; Core's published PR40 review APIs are consumer APIs, not the writer contract.
 *  - Core memory-review parser publication (`87e140a0`) is denied pending the owner's renewed authorization (dot/Core).
 *  - Migration: `apps/control/memory/migrations/0001_memory_candidates.sql` is a CANDIDATE (no owner-allocated ID; not in the Stage 1
 *    plan or the `meri_grants` phase), so `meri_memory.candidates` does not exist in any database.
 *  - Allowlist: there is no memory key in `captureRuntimePorts` and no `/api/memory/*` path on the public route boundary.
 * Readiness therefore cannot name memory from a port; the composer adds a constant `memory.producer: unavailable` census row.
 * When all four close: build the producer over `createPostgresMemoryJournal({pool})`, the Core review client and the canonical
 * membership gate, mount `createMemoryRoutes` through `createProductApplication`, default off behind a control opt-in. */
export const MEMORY_COMPOSITION_GAPS=Object.freeze([
 Object.freeze({gap:'core.m2Routes',owner:'Core (dot)',detail:'producer submit/status/read-target routes unpublished'}),
 Object.freeze({gap:'core.reviewParser',owner:'Core (dot)',detail:'parser 87e140a0 publication denied, renewed authorization pending'}),
 Object.freeze({gap:'migration.memoryCandidates',owner:'Neo / dot',detail:'candidate 0001_memory_candidates.sql needs an allocated ID, plan entry and grants'}),
 Object.freeze({gap:'composer.allowlist',owner:'composer (R0)',detail:'no memory port key and no /api/memory/* public path'}),
]);
/** `[name, factory]` family factory: no port, no inspection of the context. */
export function createMemoryFamily(){return {ports:{}};}

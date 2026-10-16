# Proposals and migration request: memory producer, settings, membership (Fable, 16 October 2026)

Lane: `fable/live-memory-settings-20261016` from `fable/live-base-20261016 @ 48a27c8d`. Nothing here is applied, deployed, allocated or
frozen. Each item names its owner and what it needs. Lane report: [FABLE-MEMORY-SETTINGS-20261016.md](../reports/FABLE-MEMORY-SETTINGS-20261016.md).

## M1 Migration request: `meri_memory` and `meri_settings` (dot/Codex allocate)

Proposed DDL: [memory-settings-20261016/proposed-memory-settings.sql](memory-settings-20261016/proposed-memory-settings.sql). No
migration ID is allocated; the source never executes it. Please allocate an ID and confirm the namespace (two new schemas are proposed so
neither touches the product-budget or conversation families).

- `meri_memory.candidates`: the producer outbox (`apps/control/memory/postgres-journal.mjs`). Insert-once per
  `(tenant, proposer, idempotency key)`; candidate, hash and identity columns are immutable (trigger); only
  `submission_state PREPARED → SUBMITTED | SUBMISSION_UNKNOWN → SUBMITTED` and `review_id` move. Review state is never stored here.
- `meri_settings.user_preferences`, `meri_settings.tenant_settings`: one revisioned document each
  (`apps/control/settings/postgres-store.mjs`); compare-and-set on `revision`.
- `meri_settings.settings_audit`: one row per save in the same transaction; paths and hashes only, never values; rows cannot be updated.
  DELETE stays available for the retention/deletion owner.
- Access pattern: each operation is one transaction with `statement_timeout 5s` / `lock_timeout 2s`
  (`apps/control/product-persistence/transaction.mjs`). Settings saves `SELECT … FOR UPDATE` the document row, then UPDATE/INSERT and the
  audit INSERT. Listing uses `(tenant_id, proposer_actor_id, created_at DESC, candidate_id DESC)` and `(tenant_id, sequence DESC)`.
- Not requested: roles, grants, seed rows, changes to any existing migration, or execution. Retention: these are new data classes for
  the retention inventory (candidates are private user content until Core review; settings are configuration).

## M2 Core routes for canonical memory review (dot / Core)

Meri needs four fixed internal routes on Core (same credential broker pattern as the existing `/clio/tools/*` routes). Core remains the
only review and publication authority; none of these routes approve or publish.

| Route | Request | Answer |
|---|---|---|
| `POST /clio/memory/review/submit` | `{candidate, candidateSha256}` (candidate = `meri.memory-candidate.v1`) | `{candidateId, candidateSha256, reviewId, accepted:true}`. Must deduplicate by `(candidateId, candidateSha256)` and refuse a known id with a different hash. Personal candidates must stay pending (no auto-commit). |
| `POST /clio/memory/review/status` | `{candidates:[{candidateId, candidateSha256}]}` for the authenticated proposer | `{checkedAt, reviews:[{candidateId, candidateSha256, status:'pending'\|'approved'\|'rejected'\|'expired'\|'withdrawn'\|'not_found', reviewId, decidedAt, publishedMemoryId}]}`, one per requested candidate. |
| `POST /clio/memory/read_target` | `{memoryId}` | `{memory: {tenantId, memoryId, memorySha256, scope, clientId, ownerActorId, key, state:'active'\|'superseded'\|'forgotten'\|'expired'} \| null}` |
| `POST /clio/memory/find_by_key` | `{scope, clientId, key}` | same `{memory}` (the committed memory a keyed proposal would replace, or null) |

`memorySha256` must be a stable hash of the committed memory content Core will compare when it applies an approved correction (so a
correction proposed against stale content can be rejected at review).

## M3 Membership source port (dot / Core)

`readMembership({tenantId, actorId, signal, deadlineMs})` → `{tenantId, actorId, status:'active'|'suspended'|'removed', role,
permissions:[…], clientIds:[uuid…], membershipRevision, checkedAtMs, expiresAtMs}` from Core's authoritative membership, current at read
time (no cache), with `removed`/`suspended` as explicit facts. Permissions used by this lane: `tenant.settings.manage`,
`memory.propose.firm`. The role must be one of the platform record's role-ceiling names (`ROLE_NAME`).

## M4 Platform capability record port (Capiro platform owner)

`readPlatformLimits({signal})` → `{maximum, defaults, roleCeilings}` validated by `assertPlatformCapabilityLimits`. The tenant save audit
records its canonical SHA-256 so each tenant revision names the platform record it was checked against.

## M5 Local wire shapes (frontend lane / dot review)

The memory-surface and settings shapes in [apps/control/product-access/ROUTES.md](../../../apps/control/product-access/ROUTES.md) are local
proposals at `0.1-proposal`. They are not added to `packages/contracts`; freezing them is a separate coordinator decision.

## M6 Command composition note (lane B / dot)

`createPostgresCommandExecutor` now admits a personal `memory.propose` only when its source declares `personalPending: true`
(`createMemoryCommandSource`). The legacy `save_memory` route source is unchanged and still refuses personal scope before any effect.
Recommended composition: the `memory.propose` executor uses the governed producer source for every scope, so one producer owns all
memory candidates. The frozen `MemoryProposeArguments` contract is unchanged; conversational corrections use the existing `key`.

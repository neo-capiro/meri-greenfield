# G1 runtime-owner continuation — 12 October 2026

Base: `1e6d430cf9c239caca4198aea42a762f13021cd5` (preserved PR14).
Branch/worktree: `task/meri-g1-runtime-owner-20261012`, `/workspace/meri-g1-runtime-owner-20261012`.
Author: gateway_author; independent reviewer: gateway_reviewer; allocation/acceptance: root.

Initial allocation is discovery/docs only, bounded15 minutes. Read AGENTS.md, implementation standards, adopted R2, existing fixture control/owner/phase-driver/Temporal source and relevant tests. No repository `.agents` directory or applicable local skill was found. Preserve SDK-only model orchestration, Temporal durability ownership, selected Aurora and source-disabled production behavior. The inert Temporal package's old database example does not supersede the current Aurora decision.

## Proposed implementation outline (awaiting exact allocation)

The concrete existing control-owner boundary is `createFixtureControl`, not the evidence publisher or the inert Temporal workflow. Integrate the reviewed canonical `FixtureRegistry.revokeRun` there. Proposed paths: existing service/control.mjs, new cohesive service/run-stop.mjs and service/test/run-stop.test.mjs, existing service/README.md. No contracts, migrations, locks, budget/gateway adapters or model loop changes.

Proposed `control.stopRun({context, peer})` accepts only trusted owner context/peer, snapshots canonical inert full binding before waits, closes local admission for that exact binding and aborts only its tracked handlers before awaiting the canonical persisted revocation. Coalesce the current stop attempt; unknown acknowledgement is not rollback or permission to retry. Bound pending operation settlement by original cleanup lifetime and a fixed ceiling. No native/task-stop claim follows from local abort or database state. Existing control tracking must preserve content-free uncertain publication liability instead of dropping it when a handler settles.

Root must select shutdown scope before edits: explicit per-run stop preserves raw registry compatibility but cannot claim close() enumerates every admitted run; an owner facade around existing admit/replace entrypoints can preserve their delegation to the sole canonical registry while recording bindings for close(). Observed incoming requests alone are insufficient for pre-checkpoint cancellation. Any uncertain admission/replacement/revocation/publication must remain an unresolved owner obligation, including across source API responses; no new in-memory ledger may be presented as durable recovery.

Review criteria must freeze before production edits. Verify canonical registry plus scripted transaction boundaries and existing source owner composition, not only a revoke mock. Controls should include wrong/stale binding, mutation across waits, no later operations after stop begins, isolated unrelated run, expiry, parked revocation/handler, lost acknowledgement, publication uncertainty, bounded shutdown and no false cleanup/recovery acceptance. Real PostgreSQL, native task stop, credential issuance, Temporal execution, cloud resources, paid/provider/model work and frontend/capirov2 changes are prohibited and remain unrun.

# Meri package four: core source review — 16 October 2026

## Disposition and scope

**Package-four core integration: HOLD.**

- Reviewed package: `fable/repair-package-4-20261016` at **eca78d458acb46cbfd54a94cf870841d999ef6b1**.
- Prior audit: `dot/meri-comprehensive-audit-20261015` at **f8d1816eda48347eeca4c0c25308870f2885c1f5**.
- Package four is 28 commits ahead of live base **48a27c8d0e09f8eb6501e13f0d137458460e163e**, with that base as its merge base.
- This review owns dependency/recipe changes, intents, memory/tasks/settings, and the merged activity/options seams. It also records the filing/command interaction traced jointly with the artifacts review.
- Method: read-only GitHub source/test/report inspection and semantic comparison of fetched lockfiles. No repository tests, package installation, migration, model/provider call, deployment or user-machine execution was performed.
- The findings below describe the pinned package-four source. A separately pinned successor closes CORE-2 only; see the addendum.

Source presence and synthetic author evidence are not production-composition or live-release acceptance. All prior P2b, startup/history, durable reads, scheduling, Planner, budget-grant, live-browser, native-output and release holds remain in force except where an exact, separately reviewed repair explicitly closes one.

## Scoped source acceptances

### Dependencies and qualification recipe

**ACCEPT the approved declarations and minimal lock updates.** Compared all four changed locks with package-three commit `81e20025b7a805ac28a44f2044df87b0ebab905b`:

- Root adds exactly 27 package entries; conversations adds 14.
- Every added entry matches an already-present runtime or worker-qualification lock entry's version, resolved URL and integrity.
- No existing version, resolved URL or integrity changes; no entries are removed.
- Worker-conversation adds no package entry and changes only peer flags outside its root declaration.
- Worker-qualification changes its root declaration only.
- The declared pins are the prior coordinator-approved pins: root pg 8.23.1/jszip 3.10.2; conversations pg 8.23.1/@temporalio/common 1.24.0; worker-conversation zod 4.6.7/@modelcontextprotocol/sdk 1.32.1; qualification zod 4.6.5.
- The schedules harness retains its conversations-anchored Temporal client, without a duplicate root declaration. The ownership guard preserves the scoped type-only exception.

Sources: [root lock](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/package-lock.json), [conversations lock](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/conversations/package-lock.json), [worker-conversation lock](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/package-lock.json), [qualification lock](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/qualification/package-lock.json), [ownership guard](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/scripts/qualification/local-baseline/dependency-ownership.test.mjs).

**ACCEPT the bounded inventory/receipt source improvements.** Browser, reads, telemetry, intents and product-surface test files are now represented. Per-suite receipts capture invocation, source provenance, selectors, outcomes and output hashes outside the checkout. This is not an independently executed all-suite pass, and the lexical dependency/inventory guards remain bounded checks rather than complete runtime-resolution proofs.

Sources: [suite inventory](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/scripts/qualification/local-baseline/suites.json), [inventory implementation](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/scripts/qualification/local-baseline/inventory.mjs), [runner](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/scripts/qualification/local-baseline/run-suites.mjs), [receipt implementation](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/scripts/qualification/local-baseline/receipt.mjs).

### Intent and product-surface foundations

Bounded source acceptances:

- Default-off governed-intent gating, exclusion catalog and prepare-only dispatch separation.
- The intent journal's PENDING/UNKNOWN no-redispatch barrier, immutable delivery correlation and changed-input conflict behavior.
- Membership-based read/release narrowing and reuse of the canonical capability-policy resolver.
- The merged options signature correctly places browser composition in the eighth argument and applies browser-owned permission routing last.

These acceptances do not close the replay-release, effect uncertainty, cleanup or production-composition holds below.

Sources: [intent runtime](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/intents/runtime.mjs), [intent server](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/intents/server.mjs), [intent journal](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/intents/journal.mjs), [membership gate](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/product-access/membership.mjs), [settings service](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/settings/service.mjs), [merged options](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/options.mjs), [browser option routing](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/browser/options.mjs).

## Findings

### CORE-1 — P1 HOLD: retained intent results bypass current release authority

The [mount at lines 50–65](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/intents/mount.mjs#L50-L65) returns a PREPARED replay before invoking any canonical preparer/current-authority check. Its delivery identity intentionally survives run and attempt changes.

[Worker result admission](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/intents/prepared.mjs#L19-L42) checks tenant/actor/conversation and tenant-only scopes. It does not check current allowed client scopes or original authority expiry. The [runtime](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/intents/runtime.mjs) validates supplied scopes but does not pass them to result admission. Availability is explicitly only a listing fact.

Thus this source path can return an earlier client-scoped proposal/draft without re-establishing current release authorization after a grant is withdrawn. Existing tests cover revocation before execution, not before replayed-result release. Production transport is not yet implemented and cannot be assumed to supply this missing protection.

**Required repair:** preserve the original delivery key and no-redispatch barrier; add canonical current release authorization, scope narrowing and original-expiry checks for fresh and replayed results. Add revoked-client, expired-authority and changed-policy replay negatives. Do not fix this by changing the key to permit a new preparation.

### CORE-2 — P1 HOLD at package-four pin: deadline/cancellation loses effect uncertainty

[Product HTTP lines 49–58](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/product-access/http.mjs#L49-L58) sets `handled` only after the route finishes. If the lifetime wins while settings COMMIT or Core submission is underway, the HTTP response is plain DEADLINE/CANCELLED without UNKNOWN. The operation may still commit. RESULT_NOT_RELEASED covers only acknowledged route results.

**Required repair:** distinguish effect-started, acknowledged and definite-no-effect states. Preserve UNKNOWN when an invoked effect's result is unresolved. Exercise delayed COMMIT, delayed Core submit and cancellation through the actual HTTP application.

**Successor status:** source repair ACCEPT at `b93abfddfbf0c0fe908820825fbf889b6fd78ba3`, strictly for this finding. See the addendum; this does not change the original package-four pin or other findings.

### CORE-3 — P1 HOLD: merged cleanup can skip or indefinitely postpone browser settlement

[Activity lines 93–95](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/activity.mjs#L93-L95) puts skill/read/intent closes, lifecycle finish and query close in one unbounded try.

- An early rejection skips later closes, including query close, before browser settlement.
- A never-settling close prevents browser revocation/settlement entirely.

The short-circuit already existed for skills/reads in the live base. Package four adds intents and makes its new browser cleanup depend on that chain. This contradicts the browser report's guarantee that cleanup runs after query closure. The [activity-browser tests](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/test/activity-browser.test.mjs) do not inject another runtime's throwing or hanging close.

**Required repair:** independently attempted bounded cleanup, a guaranteed query-close attempt, and browser settlement despite earlier cleanup failures. Test throwing and never-settling skill/read/intent/query closes in full activity composition. Preserve existing L1 terminal-publication acceptance; this is a separate cleanup finding.

### CORE-4 — P1 HOLD, cross-lane: filing uploads before durable command exclusion

The new filing resolver makes a previously preparatory seam effectful:

1. [Command executor lines 45–59](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/commands/executor.mjs#L45-L59) invokes `source.prepare` after initial approval, but before `journal.claim` and budget reservation.
2. [HTTP command source lines 29–44](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/commands/source-http.mjs#L29-L44) invokes `resolveAttachments` there.
3. The new [filing resolver lines 33–51](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/artifacts/filing.mjs#L33-L51) registers/uploads bytes through `attachments.register`.

A repeated completed/UNKNOWN command can therefore upload again before discovering its retained journal result. The proposed broker contract supplies no idempotency key. Initial approval exists, but durable exclusion and accounting do not yet cover this effect.

The resolver's generic `ARTIFACT_EFFECT_UNKNOWN` is also converted by [the canonical boundary's `safe(error)`](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/packages/contracts/commands-0.2/execution-boundary.mjs) to `COMMAND_REFUSED` before any command claim; no command UNKNOWN barrier is recorded.

**Required repair:** move registration beneath durable exclusion/current-effect authority and accounting, or supply a dedicated durable idempotent preparation owner. Preserve uncertainty across the boundary. Test completed replay, concurrent invocation, lost registration ACK and intervening revocation. The artifacts review also owns this cross-lane finding.

### CORE-5 — P2 HOLD: correction replay requires the mutable target to remain active

[Memory producer lines 57–64](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/memory/producer.mjs#L57-L64) rereads and checks the target before reaching the idempotency journal. After an accepted correction supersedes that target, an identical-request replay returns TARGET_INELIGIBLE/NOT_FOUND instead of the retained proposal/current review state promised in [ROUTES.md](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/product-access/ROUTES.md).

**Required repair:** look up an existing immutable request by proposer/idempotency key first, recheck current visibility, and resolve mutable correction targets only for genuinely new requests. Test lost ACK followed by target supersession and same-key replay.

## Pending contracts, owners and migrations

### Governed intents

The [P-INT proposals](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/proposals/FABLE-INTENTS-PROPOSALS-20261016.md) remain local proposals:

- **P-INT-1–4:** review prepare-only results/errors, availability, the default-off flag, exact prompt sentence and eight-call ceiling. Add the missing current-release authorization contract from CORE-1.
- **P-INT-5–7:** choose the schedule-list read route; supply the durable trusted schedule-context/proposal owner; implement metadata owners for task.update, memory.propose and artifact.file. P-INT-7's personal-memory-unavailable wording is stale relative to the merged governed producer and must be reconciled.
- **P-INT-8–9:** provide durable run-scoped proposal/draft discovery for approval UI, authenticated task-bound transport, and startup composition. Do not silently edit frozen UIEvent or Run contracts.
- **P-INT-M1:** allocate and implement the real PostgreSQL journal, not only the SQL sketch. Require atomic claim/settle, immutable request identity/record, valid state/outcome invariants, UNKNOWN preservation and retention mapping. Current source has a store port and synthetic store, not a production journal adapter.

### Memory, settings and tasks

The [M1–M6 proposals](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/proposals/FABLE-MEMORY-SETTINGS-PROPOSALS-20261016.md) need these exact dispositions:

- **M1:** allocate `meri_memory.candidates`, `meri_settings.user_preferences`, `meri_settings.tenant_settings` and `meri_settings.settings_audit`, with engine-backed transaction/concurrency qualification. [Proposed DDL](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql) is unapplied.
- Test simultaneous first settings saves. [The current store](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/settings/postgres-store.mjs) SELECTs FOR UPDATE before first INSERT; an absent row is not locked. The losing unique violation is not mapped to SETTINGS_REVISION_CONFLICT. This is a source-derived concurrency concern, not a real-PostgreSQL reproduction.
- **M2:** Core must implement submit/status/read_target/find_by_key and exact candidate-id/hash deduplication before the producer's unacknowledged-submission retry is admitted. That safety property is currently a proposed contract exercised only by doubles.
- **M3–M4:** supply actual current-membership and platform-record owners. Run-policy issuance must consume persisted tenant settings and current member roles.
- **M5–M6:** review the proposed wire shapes; mount the product application and operational-read gateway; bind the governed memory command source to the canonical executor. Stored notification preferences are not consumed, and committed-memory browsing remains incomplete.
- Keep direct canonical memory publication excluded. The new personalPending source flag must remain scoped to the governed pending-candidate producer; it does not authorize the legacy auto-commit source.

### Cross-lane retention

Local intent preparations, memory candidates, settings/audit, and preview rows/objects need explicit inventory, subject and deletion mappings. The existing external `memoryProposals` class does not cover these new local tables. Their proposed/unapplied status means they are not evidence of a deployed purge leak, but adoption must not silently omit them.

Sources: [retention registry](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/retention/data-classes.mjs), [memory/settings DDL](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql), [intent journal proposal](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/proposals/FABLE-INTENTS-PROPOSALS-20261016.md#p-int-m1-migration-request--intent-preparation-journal).

## Image, evidence and report corrections

The [frozen Docker selector](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/scripts/qualification/assembled-image/frozen-candidate.mjs) still pins candidate f while source proof selects h. The selector implementation corrects the old historical-hash comparison, but current aggregate selection stays held until the exact successor is reviewed and both consumers agree.

Docker build/COPY execution, final compiler checks, real PostgreSQL and worker-provenance refresh are not established by this review. The proposed omit-dev Dockerfile changes remain a separate image-recipe decision. No candidate pin was changed here.

The package-four report's blanket “no lockfile change” statement is inaccurate: four approved minimal lock updates are present. This is a report correction, not a finding that those approved updates were unauthorized.

Author suite counts and reverted-fix results remain author evidence. No raw final aggregate receipts were independently executed here. Preserve failed, skipped and unrun distinctions.

## Narrow successor addendum: CORE-2 source repair

**Scoped ACCEPT** at **b93abfddfbf0c0fe908820825fbf889b6fd78ba3**, branch `dot/meri-startup-history-20261016`.

The commit is exactly one commit ahead of the reviewed package-four pin. Its delta is the HTTP source, seven targeted tests, and a report. No other package-four finding is changed.

[Repaired HTTP source](https://github.com/neo-capiro/meri-greenfield/blob/b93abfddfbf0c0fe908820825fbf889b6fd78ba3/apps/control/product-access/http.mjs):

- Marks route start inside the operation-lifetime callback, after the lifetime's cancellation check.
- Records route completion inside the awaited handler, before the outer race returns.
- Returns UNKNOWN for deadline/cancellation while an invoked effect is unresolved.
- Keeps pre-dispatch admission cancellation unmarked.
- Preserves explicit domain outcomes and completed-result withholding.
- Does not infer rollback, physical stop or safe redispatch from timeout.

The [seven new tests](https://github.com/neo-capiro/meri-greenfield/blob/b93abfddfbf0c0fe908820825fbf889b6fd78ba3/apps/control/product-access/test/effect-uncertainty.test.mjs) exercise actual Fetch/settings transaction and memory producer/review paths over scripted SQL/Core boundaries: delayed COMMIT and memory propose/correct submission, deadline/cancel, observed late success, and admission cancellation with zero route calls.

The [repair report](https://github.com/neo-capiro/meri-greenfield/blob/b93abfddfbf0c0fe908820825fbf889b6fd78ba3/docs/coordination/reports/DOT-PRODUCT-EFFECT-UNCERTAINTY-20261016.md) records 13/13 synthetic tests passing and a reverted-fix result of six failures/one pass. These counts are inspected author claims, not independently rerun evidence. Real PostgreSQL/Core, compiler and broad suites remain unrun in this review.

CORE-1, CORE-3, CORE-4 and CORE-5, plus all stated contract/composition/live gates, remain open.

## Review inputs

- [Package-four handover](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/reports/FABLE-REPAIR-PACKAGE-4-20261016.md)
- [Dependency/recipe lane](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/reports/FABLE-R4-DEPS-RECIPE-20261015.md)
- [Intents lane](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/reports/FABLE-INTENTS-20261016.md)
- [Memory/settings lane](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/reports/FABLE-MEMORY-SETTINGS-20261016.md)
- [Retention lane](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/reports/FABLE-RETENTION-20261016.md)
- [Documents lane](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/reports/FABLE-DOCUMENTS-20261016.md)
- [Browser-composition lane](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/docs/coordination/reports/FABLE-BROWSER-COMPOSITION-20261016.md)
- [Prior package-three review](https://github.com/neo-capiro/meri-greenfield/blob/f8d1816eda48347eeca4c0c25308870f2885c1f5/docs/coordination/audits/meri-comprehensive-20261015/PACKAGE3-REVIEW-20261015.md)
- [Prior integration review](https://github.com/neo-capiro/meri-greenfield/blob/f8d1816eda48347eeca4c0c25308870f2885c1f5/docs/coordination/audits/meri-comprehensive-20261015/PACKAGE3-INTEGRATION-REVIEW.md)


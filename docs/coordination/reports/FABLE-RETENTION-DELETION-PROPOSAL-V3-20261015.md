# Retention and deletion, revision 3: dot's corrections applied and the implementation outline

Base `9430eed2acb7eaa86f6459158d0000cbef433fe1` (lane 1 head on `fable/meri-complete-20261015`). Author: Fable. Status: design accepted in principle by dot on 15 October (suppression separated from purge, exact-version targeting, complete reference inventory, restore reconciliation); this revision corrects the two defects dot named, applies decisions 1 to 8, and records the implementation outline for the bounded source work that follows (policy-configured suppression, reference enumeration, reconciliation, purge planning and recovery controls, with physical purge disabled). No migration ID is assigned, no SQL migration is executed, no AWS binding is fabricated.

## 1. Defect 1: a backup that predates a suppression-only decision

Revision 2 replayed purge receipts only. A restore to a point before a suppression, with no purge yet, would revive access. Correction:

- An ordered **retention ledger** holds every transition (`SUPPRESSED`, `RELEASED`, `PURGE_PLANNED`, `PURGE_BLOCKED`, `PURGE_UNKNOWN`, `PURGE_EXECUTED`) for every subject, outside the restored database's rollback boundary. It is a port: the product binding is the evidence bucket or an equivalent write-once store supplied by the shipping owner (decision 4); until then an in-memory sink proves the contract.
- Every transition is appended to the ledger and **durably acknowledged** (sequence and receipt hash returned) before the database journal row is written. If the journal write then fails, the ledger already shows the decision and reconciliation re-applies it; the reverse order is never used.
- **Recovery barrier**: after any restore, serving is disabled; the reconciler replays the ledger in order and re-applies the latest state of each subject to the journal; serving is re-enabled only when every subject has been reconciled. A subject whose purge verification is `UNKNOWN` stays suppressed, which is the safe state, and does not hold the barrier open.
- Control (`reconciliation.test.mjs`): a journal restored to a point before a suppression, with no purge receipt anywhere, is re-suppressed from the ledger before serving resumes; reads during the barrier are refused.

## 2. Defect 2: version-specific absence is not an S3 exception name

HEAD on S3 returns generic errors (no body), and a 403 can mask a 404 when `s3:ListBucket` is not granted. Correction, in the storage port:

| Response to `HeadObject` with `VersionId` | Classification | Reasoning |
|---|---|---|
| 200 with the same `VersionId` and `DeleteMarker` absent | `PRESENT` | the exact version still exists |
| 404 (`NotFound` / `NoSuchVersion`) | `ABSENT` only when the caller holds `s3:GetObjectVersion` and `s3:ListBucketVersions` on the key (recorded permission assumption); otherwise `UNKNOWN` | without list permission S3 may answer 403 for a missing key and 404 is still not guaranteed to mean "this version was erased" |
| 405 `MethodNotAllowed`, or 200/404 with `x-amz-delete-marker: true` | `UNKNOWN` for the historical version; a delete marker is not proof that any particular version was erased | the marker only hides the current view |
| 403, 400, 5xx, timeout, abort, mismatched `VersionId` | `UNKNOWN` | ambiguity is never proof of deletion |

`DeleteObjectVersion` success is recorded (version id, request id, `DeleteMarker` flag) but a purge row moves to `EXECUTED` only after a readback classified `ABSENT`; a `DeleteMarker: true` response to a version-specific delete fails the step.

## 3. Further corrections

- **BLOCKED after restore**: `PURGE_BLOCKED` rows (object lock, legal hold, unresolved liability, shared reference) are re-evaluated by the reconciler against the current hold and liability facts; a block that no longer applies returns the subject to `PURGE_PLANNED`, never straight to execution.
- **Shared references**: a fork copies the checkpoint's object references into another conversation. The reference inventory cross-indexes `objectId` and `versionId` across subjects; a version still referenced by a non-suppressed subject is excluded from the purge plan and the plan is `BLOCKED` with the referencing subjects named. Physical deletion of a shared version requires every referencing subject to be suppressed and purge-eligible.
- **What suppression can and cannot revoke**: it refuses every future read, replay, restore, continuation, reservation and allocation claim for the subject through the owners' read paths; it asks the conversation owner to cancel in-flight tasks through the existing authenticated cancellation (a worker already running keeps its workspace until its own cleanup); already-issued signed URLs cannot be recalled and expire at their TTL, so the suppression receipt records `outstandingAccess` with the latest expiry and the in-flight run bindings. The product never claims immediate erasure of outstanding access.

## 4. Decisions 1 to 8 as applied

1. Cooling period is a required field of the versioned policy; a missing policy blocks purge (`RETENTION_POLICY_REQUIRED`) and never blocks authorized suppression.
2. Per-class retention and the policy id are explicit required configuration; the fixed class set is refused when incomplete; no default values exist in source.
3. Suppression uses the existing ownership semantics: the authenticated principal must be the subject's owner (`tenantId` and `actorId`), otherwise `RETENTION_AUTHORIZATION_REFUSED`; administrative or cross-user suppression requires an owner-mediated receipt port that defaults to refusal.
4. The ledger sink and evidence binding are ports with contract tests; no bucket, prefix or write-once policy is assumed.
5. Holds are explicit facts supplied per version (`objectLockRetainUntil`, `legalHold`); any unresolved hold blocks purge; nothing lifts a hold.
6. Logs are a separate class with policy-configured retention and redacted identifiers; the inventory lists them as not erasable by the product and no log erasure is claimed.
7. Schema prepared as `apps/control/retention/schema/retention.draft.sql` with no migration number; nothing under `migrations/`; `0009` untouched; the draft is applied only to a test-scoped schema in the local cluster.
8. Purge workflow identity is deterministic: `sha256(tenant, class, objectId, versionId, policyVersion)`; duplicate plans coalesce to the same identity; a bounded sweep schedule and Temporal binding remain shipping-owned and are not created.

## 5. Implementation outline (bounded source work, purge disabled)

| Responsibility | Module (`apps/control/retention/`) | Public interface | Owner of state and failure |
|---|---|---|---|
| Policy validation | `policy.mjs` | `parseRetentionPolicy(value)`, `requirePurgePolicy(policy)` | configuration; refusals `RETENTION_POLICY_REQUIRED`, `RETENTION_POLICY_INVALID` |
| Data classes and reference enumeration | `inventory.mjs` | `classes`, `enumerateReferences(snapshot)`, `sharedReferences(references, index)` | pure; input is the canonical record snapshot the owners already produce |
| Ordered transition history | `ledger.mjs` | `createRetentionLedger({sink, now})` → `append`, `replay`, `latest` | sink port (durable ack required); `RETENTION_LEDGER_UNACKNOWLEDGED` |
| Suppression and release | `suppression.mjs` | `createSuppressionOwner({ledger, journal, authorization, now})` → `suppress`, `release`, `isSuppressed` | ledger first, journal second; authorization by ownership |
| Storage absence semantics | `storage-port.mjs` | `classifyHeadOutcome`, `createVersionStorage({send, bucket, expectedBucketOwner, permissions, now, maxRequestMs})` → `headVersion`, `deleteVersion` | injected S3 `send`; no SDK import; `UNKNOWN` on ambiguity |
| Purge planning and execution gate | `purge.mjs` | `planPurge({...})`, `createPurgeExecutor({storage, ledger, journal, enabled:false})` | fail-closed `RETENTION_PURGE_DISABLED`; deterministic workflow identity |
| Recovery reconciliation | `reconciliation.mjs` | `createRecoveryReconciler({ledger, journal, storage, serving, holds, liabilities})` → `reconcile()` | barrier on `serving`; idempotent |
| Journal port (until allocation) | `memory-journal.mjs` | `createMemoryRetentionJournal()` | test and contract only; PostgreSQL adapter follows the migration allocation |
| Draft schema | `schema/retention.draft.sql` | — | unallocated draft |
| Composition | `index.mjs` | re-exports | — |

Dependency direction: `index` → owners → ports; owners import only `policy`, `inventory`, `ledger` and the contracts validators; no import from `conversations` private modules; the conversations owners will call `isSuppressed` through their service layer in a later slice (not in this one, to keep the proof rows untouched).

Reuse: `canonicalSha256` and `validateShape` from `packages/contracts/validate.mjs`; `own` and `data` from the commands execution boundary; the local-baseline runner gains a `control-retention` suite.

Verification: `apps/control/retention/test/*.test.mjs` covering policy refusals, inventory and shared-fork exclusion, ledger ordering and unacknowledged append, ownership authorization and the owner-mediated default refusal, storage classification (403 and 405 and delete markers are `UNKNOWN`, 404 is `ABSENT` only with the recorded permissions), purge planning refusals and identity coalescing, executor disabled by default, reconciliation of a restore predating suppression with no purge receipt, `BLOCKED` re-evaluation and repeated reconciliation idempotency.

## 6. Still owner-held

Migration allocation (`0010`, artifacts `0002`) and the PostgreSQL journal adapter; the evidence sink binding; the product bucket's lock and hold configuration; the Temporal sweep schedule; the legal retention values; wiring `isSuppressed` into the conversations and artifacts read paths (touches proof rows; separate slice after dot's review).

# Package-four artifact safety repair outline

Base: `eca78d458acb46cbfd54a94cf870841d999ef6b1`, isolated branch
`dot/meri-artifact-safety-20261016`. Qualification transferred the provisional
claims without edits. Budget/planner cleared the command executor seam.

Canonical owners and implementation order:

1. Retention's acknowledged ledger and watermarked journal verify the persisted
   watermark before ordinary mutations. Recovery alone bypasses the serving
   check under its existing exclusive lock, including recovery replan appends.
2. Browser page context invalidates all overlapping calls and retains a stable
   operation generation. Permission release checks the same generation after
   approval; invalidation cancels pending approval waits.
3. Command execution retains the durable journal claim, budget reservation and
   current-authority gate as the effect boundary. HTTP source preparation reads
   credentials/metadata only; completed and UNKNOWN replays perform no attachment
   registration or source effect.
4. Preview publication requires a durable claim before render/write, a retained
   allocated object identity, and recovery without duplicate writes. Any missing
   deployed store/schema contract is proposed explicitly to qualification;
   no migration IDs are invented.

Verification uses production modules and bounded synthetic ports only. Each
confirmed finding gets a negative regression against unchanged base source.
No compiler, actual browser, renderer, DB, external upload/provider or P2b retry.
Historical manifests and candidate h HOLD remain unchanged; changed hashed rows
will be reported. Real integration and source acceptance remain separate gates.

## R4-RET-1 implemented, pending independent review

Ordinary ledger appends and projection writes first verify the persisted
watermark. Advancement also carries the process's minimum known sequence;
both the memory adapter and PostgreSQL adapter compare that floor atomically
with the advance. PostgreSQL uses the existing bounded transaction/recovery-lock
owner plus a watermark advisory/row lock; no schema changes. This closes a
restore between guard read and advancement. Recovery explicitly bypasses the
serving check under its existing exclusive lock, including replan appends.

Synthetic verification on Node 24.19.0, one process, 128 MiB heap, no DB:

- Eleven retention source-control files (all except real-PostgreSQL
  `postgres-journal-pg.test.mjs`): **51 pass, 0 fail, 0 skip**, exit 0.
- Focused startup/watermark files: **16/16 pass**. Exact-base production source
  restored temporarily: **11 pass, 5 fail**, all five safety negatives; fixed
  source restored afterward. Exclusive recovery replan passes in both cases.
- Cases: restore→new suppression→read, release as first post-restore write,
  restore after durable ledger ACK, restore during guard read, and guarded SQL
  advance on a restored row. Prior UNKNOWN/lease/purge safety checks pass.

The local watermark port's `minimumSequence` option is an intentional internal
adapter change. Real PostgreSQL and multi-process restore orchestration remain
UNRUN, pending a bounded heavy-test slot and the unapplied watermark schema.

## R4-BRW-1 implemented, pending independent review

Page context now owns one active operation generation and an internal identity
token/AbortSignal. A competing or duplicate operation invalidates the first and
is itself refused by PreToolUse. This also fences navigation while an already
approved operation is executing. Approval waits are cancelled on invalidation;
the gate rechecks the exact captured token immediately before allowing execution.
Invalidated cancellation/completion never restores the stale origin. Fresh page
observation is required afterward. Tool-use tracking is bounded at 4096 per run.

Synthetic permission/page-generation/egress-control checks: **22 pass, 0 fail,
0 skip**, exit 0. Five focused safety tests against exact-base page-context and
permission source: **0 pass, 5 fail**; restored source: **5/5 pass**. These cover
both interactions in overlap, navigation during pending approval, duplicate IDs,
tab changes during approved execution, and reentrant invalidation during receipt
validation. The existing scripted SDK helper now
uses unique default tool-use IDs; its prior competing-call expectation changes
to an explicit denial. An initial missing-saxes import was resolved by reusing
the pinned installed library; no npm install. One baseline attempt was cancelled
because an early test assertion left the old approval timer pending; the test
now settles its synthetic port before asserting, and the recorded negative exits
in 178 ms. No real browser, SDK query, activation-gate change or P2b retry.

## R4-DOC-1 implemented, pending independent review

`source-http.prepare` reads credentials/metadata and returns a one-use private
token. The effectful artifact resolver now runs in `source-http.execute`, reached
only after the unchanged command executor has durably claimed the canonical
payload, reserved budget and rechecked authority/approval. Attachment broker
UNKNOWN is translated explicitly to COMMAND_OUTCOME_UNKNOWN; the command owner
records UNKNOWN and budget liability. Completed/UNKNOWN/claim-ACK-loss replay
never registers again. No new broker retry or endpoint is introduced.

Synthetic production pipeline checks: **50 pass, 0 fail, 0 skip**, exit 0
(`commands-filing-custody`, `commands-execution`,
`commands-independent-transport-budget`). The four new custody regressions fail
exact-base source-http: **0 pass, 4 fail**. They use the actual artifact resolver,
canonical validators, real command owners over scripted SQL, and synthetic
artifact-read/register/HTTP ports. Assertions cover pure preparation, completed
and concurrent replay, lost registration ACK, lost claim ACK, budget failure,
and current-authority revocation before registration.

The existing mismatched-attachment test now expects durable UNKNOWN after claim
instead of pre-claim refusal, while still proving zero final source save. The
real host broker, external upload and actual filing route remain UNRUN/unwired.

## R4-DOC-2 source-local repair, deployed design remains held

Preview publication now requires an atomic durable claim before rendering/put,
and persists exact returned object-version custody before immutable publication.
Concurrent service instances cannot put twice. Reopen retains the original
allocation; UNKNOWN never dispatches again. Lost publication ACK recovers the
committed record through current artifact authority. Potential orphans retain
their logical object ID before put; known orphans retain the exact ObjectReference.
`custody()` exposes both to the trusted retention/recovery owner. It is not yet
consumed by a deployed retention inventory. No claimed or orphan state expires
into an automatic retry. Existing records remain behind canonical artifact reads.

The local store uses exclusive directories, synced temporary files and rename;
borrowed reopened roots are preserved on dispose. Both document and runtime
preview wrappers retain the new claim/object methods under their existing
current-owner checks. Legacy record-only configurations fail closed. The new
claim packet/port is explicitly a local proposal, never a frozen wire contract.

Synthetic PDF/artifact/object ports, real source-local store, and method-plumbing
controls: **7 pass, 0 fail, 0 skip**, exit 0. Exact-base service+local store
negative: **0 pass, 1 fail**, because concurrent publications put **2 objects
instead of 1**, before their conflicting commits. The fixed test puts one.
Other cases: lost put ACK/reopen, exact known-orphan version, commit ACK recovery,
revoked replay, revocation during claim, and refusal of record-only ports.
No generator or actual renderer ran. All fixture directories were removed.

Windows sandbox Temp denied hard links and rename during initial local-store
verification. Atomic directory exclusion supports Windows without hard links;
owned workspace fixtures then passed. A method-configuration test initially
expected a public error property instead of the existing private error/message
boundary; only its assertion was corrected.

The older generator/native preview suite was adapted for claim/UNKNOWN semantics
but is **UNRUN** under the current source-only admission. A failed render now
retains an uncertain durable claim and its original cause; it does not retry.
Its prior unsafe retry-after-post-write-failure assertion now refuses the held
attempt and uses a separate fresh version for record-corruption checks.

Exact store/schema/retention mapping proposal:
`docs/coordination/proposals/DOT-PREVIEW-CUSTODY-20261016.md`.
Artifacts migration 0003 remains AUTHORING HOLD, as do conversation row-target
0014 and receipt-retention changes. No SQL for those paths was authored.

## Final retention completeness and reserved 0013 source

A second already-running owner may not have observed another owner's later
suppression before a restore. Ordinary advancement therefore requires at least
`max(processHighWater, projectedSequence - 1)` in the persisted watermark. It
cannot skip an acknowledged predecessor, even when this process's prior floor
was zero. Out-of-order concurrent projections or sparse ledger sequences close
the serving fence and require reconciliation; they never certify completeness
of unrelated rows. Recovery retains its exclusive rebuild exception. A verified
persisted position from another writer becomes a known process floor too.

Final retention source controls: **53 pass, 0 fail, 0 skip**, exit 0, including
the new two-owner restore regression and migration-source check. Final focused
exact-base negative: **11 pass, 6 fail**; fixed source restored. This supersedes
the initial 51-test count above and preserves it as earlier evidence.

Central numbering record: `dot/meri-package4-allocations-20261016` at
`641f298025c4c9f344d9d16f852cb6eb62b21906`,
`docs/coordination/tasks/CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md`.
Only `apps/control/conversations/migrations/0013_retention_recovery_watermark.sql`
was authored: singleton, safe nonnegative sequence, nullable canonical head hash,
no seed, roles, grants or unrelated mutation. It remains source-review pending.
The static SQL contract check is not PostgreSQL syntax or migration execution.
No held schema path was authored, and no migration ran.

## Retention follow-up: two restore windows reproduced at 338a04ec

The earlier floor-only completeness claim above was incomplete. Independent
review reopened two windows at `338a04ec82626382045f8b944a4b7ed4dd48ab27`:
restore after projection ACK but before advancement could certify a missing
projection; restore between the read gate's watermark check and projection read
could release the first observation. The two focused regressions both fail that
unchanged production source (**0 pass, 2 fail**). The separate initial after-set
negative also failed (**0 pass, 1 fail**); it is the same first regression, not an
additional distinct case. Evidence remains in `task-9/evidence` as
`retention-windows-338a04ec-negative.tap` and
`retention-after-set-338a04ec-negative.tap`.

The internal port now requires
`advanceProjection({key,projectionSha256,sequence,minimumSequence},{exclusive})`.
Legacy blind sequence-only ports fail configuration closed. The PostgreSQL
adapter proves that exact key/hash/sequence under the subject advisory lock and
row lock, then advances the watermark within that same canonical journal
transaction. Missing, altered or wrong-sequence rows cannot advance. A lost
COMMIT keeps the existing UNKNOWN/retired-lease behavior. The memory adapter
performs its synchronous exact-row proof and advance without yielding.

Ordinary tracked reads bracket the projection read with persisted-watermark
checks and require the same position/hash. A stale observation closes the fence;
a concurrent healthy position change refuses that observation without disabling
serving. Exclusive reconciliation retains its bypass, including ledger-only
rebuild and replan append. Migration0013 and frozen contracts are unchanged.
Qualification explicitly confirmed this internal correction is in the existing
exclusive repair scope; independent source review/integration remains required.

Focused fixed batch: **22 pass, 0 fail, 0 skip**, exit 0, **225 ms**. Exact argv:

```
node --max-old-space-size=128 --test --test-isolation=none apps/control/retention/test/startup-restore.test.mjs apps/control/retention/test/postgres-watermark.test.mjs
```

Evidence: `task-9/evidence/retention-coherence-batch.tap`. This batch supersedes
the earlier two-file count; the historical broad counts below describe their
earlier exact source, not a rerun on this follow-up. No real DB, driver, child
test process or migration execution. Terminal process exit was observed, and
further test launches are held for Shipping's READS stage. Retention remains
**HOLD** until the exact follow-up source is independently reviewed.

## Proof and remaining gates

The candidate-h source proof passes **5/5**. **Zero of its 45 rows changed**;
all repair dependencies are outside that finite proof map. There are no old/new
proof-row hashes to repin. Historical manifests, the frozen f pin and h HOLD are
unchanged. Hash agreement does not qualify this dependency closure.

Final distinct checks: **132 synthetic source controls + 5 static proof checks**,
all pass. Runs used Node 24.19.0, `--max-old-space-size=128 --test
--test-isolation=none`, sequential single processes, each under 3 seconds.
Exact logs and baseline-negative evidence are retained in task-9/evidence;
normal process exits were observed and preview fixture cleanup completed.
Windows denied CIM process enumeration, so no host-wide absence claim is made.

Independent report input is retained outside Git at
`task-9/artifact-independent-review-input.md`, SHA-256
`e2917b2b12b941d8c2ef7df92e3e2e1bed613542954060fdbec35adb10a9ad06`.
Transport entities were decoded to reconstruct the exact supplied hash.
The published review is at audit commit
`2e8419a0766476b41e63a03364f21cad3c65eee4`.

UNRUN/held: compiler/typechecks and full repository suites; real PostgreSQL,
Temporal, object store/broker/filing, actual browser/SDK, native renderer/quality,
image builds/cloud/deployment, migration execution and purge. Generator/native
preview checks await their separate authorized profile. Package-four's seven
runtime failures and three frozen-candidate failures remain open; this lane did
not relabel or rerun them. Every returned source commit needs independent review;
none is automatically integrated or accepted.

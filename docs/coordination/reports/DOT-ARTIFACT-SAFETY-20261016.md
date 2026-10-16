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

## Released preview0003 source authoring

Later central disposition supersedes the earlier authoring HOLD above:
`dot/meri-package4-allocations-20261016` at
`0b0b7abd536a27a74e3b1077ae71eed6e0ba275b`, tree
`79e4989d27d9a0c3079ca1b795751813a01128dd`, includes the explicit parent release
at `e5b1116fc15a5a19bd23e175f3153bd0400632dc`. The original local proposal and
historical allocation/proof records remain unchanged. Source ownership is
exclusively this artifact-safety lane; no other held migration was authored.

Implementation outline and result: extend canonical artifacts storage additively
with tenant/conversation/artifact/source-version foreign keys; retain immutable
original claim/binding/deadline/allocation; permit only null-to-one known physical
ObjectReference custody; require matching known custody for immutable publication.
Derive UNKNOWN and potential-orphan inventory without expiry or claim takeover.
The storage envelope's `record_sha256` is **not** the hash of ArtifactVersion;
the schema never conflates them. Canonical source/claim/receipt hashing and full
packet validation remain the trusted adapter's responsibility. Current authority
on replay stays in the existing preview service; SQL establishes no user access.

`apps/artifacts/migrations/0003_previews.sql` now contains those source guards.
Claim and record deletion are refused; foreign keys also prevent deleting their
source version. No tombstone is erased or UNKNOWN disposition retried. A future
retention amendment requires separately accepted exact identities, durable
restore tombstones and potential-orphan resolution. There is no deployed adapter
or activation. A database restore before claim insertion can still remove this
database projection: activation must remain blocked until durable decision/custody
evidence outside that rollback boundary is replayed under the canonical restore
barrier. This source-only table is not proof of that recovery owner.

Three **static SQL source assertions pass**, exit 0, Node-reported 17 ms:

```
node --max-old-space-size=128 --test --test-isolation=none apps/artifacts/test/preview-migration-source.test.mjs
```

No SQL parser or PostgreSQL executed. The single hidden controlled process had a
120-second hard stop and a fresh available-memory guard; 128 MiB is its V8 heap
limit, not measured RSS. Peak RSS was not retained by the host console. The
Windows performance counter was unavailable; the read-only VisualBasic memory
API worked (12.30 GB free at the initial check; 12.44 GB after). Exit and zero
remaining Node processes were observed; no fixture directories were created.
Evidence: `task-9/evidence/preview-migration-source.stdout.tap`, empty stderr and
`preview-migration-source-process.json`. DB syntax/constraints, real concurrent
transactions, restore replay and deployed retention inventory remain UNRUN/HOLD.

Qualification relayed parent acceptance of exact browser `769848f1`, filing
`805e55a6`, preview `d56f07f9` paths and the narrow0013 table shape. That does not
accept held retention behavior (`338a04ec` / follow-up `c5ebb14f`) or this new
preview0003 source. Candidate h remains HOLD.

## ABA follow-up: c5ebb14f split reads were insufficient

Independent re-review demonstrated a third restore window: a row read captured
null after restore; another recovery pass then reapplied the subject and returned
to exactly the previous recovered sequence **and entry hash** before the second
watermark observation. The first read served that null; the next correctly
suppressed. Thus the paired-read equality claim at c5ebb14f above was insufficient.
A process-local fence generation would also miss a separate recovery owner.

Before production edits, `atomic-read.test.mjs` reproduced both reading-owner and
separate-owner variants on unchanged `eb52ed44f688403306c70269c29508d39a4c2184`
(its retention source is c5ebb14f): **0 pass, 2 fail**, both missing the expected
refusal. The original one-owner negative also failed separately; it is the same
case, not a third distinct negative. The supplied reviewer probe's restore,
null capture, same-head recovery and following suppression are preserved. New
port injection also proves the restored null was actually captured before
recovery; the passing result does not merely bypass the old `get` hook.

The required internal read contract is now
`watermark.readProjection(key) -> {projection,watermark}`: one canonical-store
snapshot under the recovery exclusion shared by all owners. Split-read ports
are refused at construction; no fallback or local generation is used.

- Memory: the backing journal holds its shared recovery lock and copies the
  projection and watermark in the same synchronous step, without an await.
- PostgreSQL: the existing bounded transaction explicitly starts at **READ
  COMMITTED**, acquires the shared recovery advisory lock, then reads projection
  and watermark with **one joined data statement**. A borrowed session's default
  isolation cannot retain a snapshot created before waiting on recovery. There
  is no separate row/watermark SELECT or repeatable-read snapshot before the lock.
- The serving fence verifies the position carried by that snapshot. A row ahead
  of its certified position is refused until advancement is acknowledged. A JSON
  null projection on an existing subject is corruption, not absence. Snapshot
  errors keep the prior WATERMARK_UNVERIFIED diagnostic and public recovery
  barrier. Unknown COMMIT still retires its lease and releases no snapshot.

Existing write-side exact-row advancement and predecessor floor are preserved.
Exclusive reconciliation bypasses ordinary read gating as before; no recovery
lock reentry, new ledger decision, DDL, frozen wire or deployed component change.
The earlier read-gap test now injects restore at the atomic port boundary. The
healthy-concurrent-advance test now verifies a completed snapshot's captured
position: a later healthy advance does not invalidate a coherent earlier read.
This intentionally replaces the old conservative two-observation mismatch rule.

Final focused batch: **31 pass, 0 fail, 0 skip**, exit 0; Node reported **220 ms**,
controlled wall **328 ms**, sampled peak working set **67,837,952 bytes**. The
heap limit was 128 MiB; sampled working set is the measured Windows process
counter, not a claim about total machine usage. Fresh available physical memory
was 11,808,673,792 bytes. One process, no test child; 120-second hard wall and
pressure stop were installed. Exit was observed and no Node process remained.

```
node --max-old-space-size=128 --test --test-isolation=none apps/control/retention/test/atomic-read.test.mjs apps/control/retention/test/startup-restore.test.mjs apps/control/retention/test/postgres-watermark.test.mjs
```

Evidence in `task-9/evidence`: `retention-aba-two-owner-eb52-negative.tap` and its
process JSON; `retention-atomic-snapshot-fixed.tap`, empty stderr and
`retention-atomic-snapshot-process.json`. The first fixed batch was **30/31**:
all safety controls passed but an existing diagnostic assertion caught a changed
reason. Its log/process JSON are preserved as `retention-atomic-snapshot-first*`;
production now preserves the prior reason. An intermediate 31/31 pass is retained
as `retention-atomic-snapshot-pre-null-guard*`; the final rerun added the existing
JSON-null-row corruption assertion to the SQL failure case. No failure is hidden.

These are synthetic production-source controls and scripted SQL, not PostgreSQL
execution, cross-process host recovery, or release acceptance. The parent's
scoped integration candidate `b2d37130343a3a015a5d886bdec4392715c9cdec` excludes
held retention behavior and preview0003; this lane does not alter it. The new
follow-up depends on the held retention source and needs exact independent
review before integration. Retention and candidate h remain **HOLD**; preview
activation/restore-custody and all migration/purge holds remain as above.

## Current durable head follow-up: unseen serving owners

The parent independently **ACCEPTED the atomic snapshot source at
`2124306473aa84054158e9fe1f0fdff01c9357ba`** and its 31 focused controls, while
keeping overall restore safety HOLD. A reader opened at position zero can miss
another owner's acknowledged suppression at one, then atomically read null/zero
after restore: its local floor never learned one. This is a separate authoritative
freshness gap, not a failure of the accepted snapshot implementation.

Sealed212430 and its repair branch are preserved. The new isolated source branch
is `dot/meri-retention-current-head-20261016`. Preview adapter source had not been
edited when the parent prioritized this fix; `dot/meri-preview-store-20261016`
still points to sealed212430. Startup confirmed the canonical runtime composition
already injects the trusted `retentionLedgerSink.append/read` into this startup
owner, so no shared runtime composition file or new external port is needed.

Before production edits, three focused regressions failed unchanged212430:
**0 pass, 3 fail** for serving, readiness, and a new decision before recovery.
The parent's pasted portable probe also printed `suppressedSubjectServable:true`,
ledger1/watermark0, reader floor0, writer floor1, exit0. Its LF source retained at
`task-9/evidence/retention-unseen-reader-probe.mjs.txt` hashes to
`4f125fc31cb5761ac4627f778e84d03674449c12b1e10c01d9f167304f757f29` after decoding
transport arrows. This differs from the supplied `bd83f41f...` pin; no byte-exact
identity is claimed. The executed semantics are unchanged and the exact output
is retained. The temporary candidate-root probe was removed after exit.

The canonical ledger now supplies `head()` through a fresh, integrity-verified
replay of its existing sink read. It is never cached or derived from the restored
database. A current, complete committed sink view outside the rollback boundary
is required; an eventually consistent listing is not this contract. Head reads
use the existing operation-lifetime owner, default10seconds, configurable up to
60seconds, and retire their owned timer on completion/failure. A late read cannot
release a timed-out caller; no physical cancellation of the borrowed sink is
claimed. This favors correctness over a new unreviewed optimized head endpoint.

Every ordinary snapshot release, readiness proof and pre-append check now compares
its DB observation against that current verified head. Unseen decisions close the
fence; a database position ahead of the ledger or a conflicting recovered hash is
not proof. Missing/corrupt/unavailable heads refuse serving. Startup orders the
existing ledger and tracked journal so all serving owners receive this guard.
The accepted atomic store snapshot, exclusive reconciliation, exact-row advancement
and UNKNOWN behavior are preserved. Projection writes after an acknowledged
decision still use their predecessor proof rather than requiring the new decision
to be projected before writing it.

The stronger guard exposed purge completion's read-after-own-append ordering.
Its completion and best-effort UNKNOWN paths now read the CAS row before appending
their decision, then project with that same CAS token, as suppression/release do.
The durable EFFECTS_STARTED marker remains before effects, and a stale CAS still
closes serving. The old two-owner test is strengthened to refuse before a second
decision is appended. The concurrent-read test now supplies a real other-owner
decision and requires current-head refusal of the older completed snapshot.

Final focused source batch: **47 pass, 0 fail, 0 skip**, exit0; Node523ms,
controlled wall659ms, sampled peak working set76,296,192bytes with128MiB V8 heap
cap. Fresh available memory11,948,355,584bytes. One controlled process,120second
hard wall, no test child or remaining owned process. Exact argv:

```
node --max-old-space-size=128 --test --test-isolation=none apps/control/retention/test/current-head.test.mjs apps/control/retention/test/atomic-read.test.mjs apps/control/retention/test/startup-restore.test.mjs apps/control/retention/test/postgres-watermark.test.mjs apps/control/retention/test/ledger-suppression.test.mjs apps/control/retention/test/planning-execution-recovery.test.mjs
```

Evidence: `retention-current-head-212430-negative*`,
`retention-unseen-reader-parent-212430*`, `retention-current-head-fixed.tap`, empty
stderr and `retention-current-head-process.json` under `task-9/evidence`.
The first fixed batch **37/39** is retained as `retention-current-head-first*`:
the earlier-refusal expectation and purge self-pending read described above were
corrected; existing planning/execution/recovery controls were added for that
narrow ordering change. These are synthetic ports/scripted SQL only. No real
DB, migration, provider, purge, P2b retry or heavy suite ran. This follow-up needs
exact independent review; overall restore safety and candidate h remain HOLD.

## Proof and remaining gates

The candidate-h source proof passes **5/5**. **Zero of its 45 rows changed**;
all repair dependencies are outside that finite proof map. There are no old/new
proof-row hashes to repin. Historical manifests, the frozen f pin and h HOLD are
unchanged. Hash agreement does not qualify this dependency closure.

Original handoff distinct checks: **132 synthetic source controls + 5 static proof checks**,
all pass at their recorded source. Runs used Node 24.19.0, `--max-old-space-size=128 --test
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
not relabel or rerun them. Later exact-path acceptance is recorded above; neither
the retention follow-up nor preview0003 is accepted by this report. This lane
has not automatically integrated source or changed any release gate.

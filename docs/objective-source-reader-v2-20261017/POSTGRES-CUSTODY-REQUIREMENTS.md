# Objective PostgreSQL custody requirements

**SOURCE_RESERVED; EXECUTION HOLD.** The Meri central migration owner reserved
the exact namespace, table and migration path below in
[the immutable central allocation ledger](https://github.com/neo-capiro/meri-greenfield/blob/93838193c46a13b2fdda9dee9c142d1af0e60cba/docs/coordination/tasks/CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md),
commit `93838193c46a13b2fdda9dee9c142d1af0e60cba`, ledger blob
`03ad26a0c11e0a34fcc577ed568a8c8b5990cd7d`. The reservation permits source
authoring only. Database execution, credentials, grants, mounting, deployment
and activation remain held. This requirements document contains no migration
statements and does not establish adapter or database qualification.

Source base: `affcb184d731e6b1aa0b31cdbd7ca4691233f3ba`, branch
`feat/objective-source-custody-postgres-20261017`. The reviewed source contracts
are [Meri PR127](https://github.com/neo-capiro/meri-greenfield/pull/127), exact
`d1512708859f97b6aa7369dfcc8dd9f6448de911`, and the published portable shared
splice proposal in [PR129](https://github.com/neo-capiro/meri-greenfield/pull/129).
The frozen Objective reader v2 wire is unchanged.

## Reserved source allocation

The reservation assigns the independent schema `meri_objective_source`,
canonical table `custody`, and exclusive migration source path
`apps/runtime/objective-source/migrations/0001_objective_custody.sql` to this
Objective lane. This is a separate migration family; it does not reserve or
consume a conversations-family number, including `0018`.

The source implementation allocation is the new migration, a cohesive
`apps/runtime/objective-source/postgres-custody.mjs` adapter and its focused
`postgres-custody.test.mjs`, with an explicitly synthetic pool-protocol fixture
if needed. The implementation must reuse the existing custody-record validator
and canonical hash functions. No existing migration, issuer, first-chat file,
shipping recipe, role or shared retention file is included.

## Canonical row and immutable keys

The table has one global `generation_job_id` primary key. The key must not be
partitioned by tenant: a second tenant cannot reuse the same job UUID to obtain
a different source mapping. A unique `issuance_key` supplies the reverse lookup
and prevents one already-issued original run from acquiring another Objective
job or pair. In this initial-generation contract, one canonical accepted request
and one immutable whole-facts receipt own one Objective source.

Required persistent columns are:

- `generation_job_id`, `tenant_id`, `conversation_id` and `run_id` as the fixed
  global key and tenant-qualified canonical run locator.
- The exact seven-field `binding`, `binding_sha256`, `issuance_key`,
  `source_admission_sha256`, `source_request_sha256`, `facts_sha256`,
  `record_sha256` and `original_expires_at_ms`.
- The closed private `record` already defined by
  `assertObjectiveCustodyRecord`: schema version, job/admission selector,
  binding, original accepted request, immutable run identity and complete
  nonsecret issued facts, including the protected Objective pair and sanitized
  issuance receipt.
- Lifecycle `state`, immutable `claim_fence`, `version`, immutable `claimed_at`
  and a single `committed_at` recorded only on finalization.

The accepted request includes its private prompt. The record is control-local
persistence, not an HTTP response or a browser DTO. It must never include raw
prepared-run configuration, proxy credentials, capability material,
`materialRef`, or output from `resolveFacts`.

All locator, digest and payload fields are non-null and have explicit shape and
size bounds. Digests use their existing lowercase SHA-256 domain. Original
expiry and numeric versions remain exact safe integers. The binding has exactly
`tenantId`, `actorId`, `conversationId`, `runId`, `attemptId`, `workerId` and
`writerFence`; each duplicated column must equal its corresponding record
value. The binding digest equals the issuance key. Job, admission, request,
facts, receipt and original-expiry columns must agree with their exact nested
record fields, including both copies of the original binding.

Reference the existing issuance key in
`meri_conversations.run_issuances` and the exact tenant/conversation/run tuple
in `meri_conversations.runs`, without cascading mutation or deletion and
without changing either existing table. The global primary key and unique
issuance key are sufficient indexes for these bounded lookups. An additional
reverse index is unnecessary unless a measured access pattern requires it.

Database checks enforce non-null shape, duplicated-field agreement and
immutability. The adapter must still decode the complete record and recompute
its existing canonical record and whole-facts hashes on writes and reads.
PostgreSQL's textual representation of a JSON value is not Meri's canonical
hash convention; no replacement hash domain or new crypto extension is implied.

## Accepted-run and ISSUED persistence comparisons

Before both the durable claim and final commit, compare the proposed record
against the actual canonical run and issuance rows under the source locks
described below. Require the entire accepted request and its stored/recomputed
hash, complete seven-field binding, scopes, creation time, policy revision and
runtime versions to match. The job/admission selector comes from the validated
protected facts, never from an independent caller assertion.

The issuance row must already be `ISSUED`. Compare issuance key, complete
binding, accepted-request hash, original expiry, grant ID, capability digest
and immutable facts digest with the sanitized receipt and complete record.
The existing Objective validator must also validate the typed request,
execution context, explicit Strategy type and whole-facts digest. A matching
hash alone does not establish genuine issuance or canonical acceptance.

These are database persistence comparisons. They are not fresh native
authorization. The current native authority owner remains outside the database
transaction and must run before and after publication and every authorized
read/replay. No native HTTP, model, task, capability generation, material
resolution or Core network call belongs inside either write transaction.

Claim and finalization are active writes: they retain the original execution
expiry and must not proceed once it has expired or the accepted run is outside
the active states. Historical and cleanup metadata reads do not impose a new
unexpired-execution requirement, renew that expiry, or acquire fresh execution
authority. Their actual caller's current authority and purpose-specific checks
remain separate.

## Two-phase publication and uncertainty

First persist the complete immutable intent and record as `CLAIMED`, version
one, with a new claim fence, and durably finish that transaction. Only after
that claim is confirmed may a second bounded transaction repeat the canonical
source comparisons and conditionally transition that exact claim to
`COMMITTED`, version two, with its one committed timestamp.

A `CLAIMED` row reads as `UNKNOWN`. It confers no source, pair, read or execution
authority and must not expose the private record or pair through the store
read port. A `COMMITTED` row yields only the exact validated immutable record.
Committed identical replay returns that record without rewriting it. A changed
job, tenant, binding, admission, issuance, request, facts or payload is a generic
conflict, with no foreign metadata in the error.

There is no lease expiry, reclaim, replacement issuance, read-side completion
or automatic finalization of a stranded claim. The existing custody owner
refuses `UNKNOWN`; later reconciliation requires a separately reviewed owner
and cannot infer source authority from a claim. Reverse lookup exposes no pair
from an unknown or uncertain row.

An ambiguous transaction commit must poison or discard that borrowed database
client and report `OBJECTIVE_CUSTODY_ACK_UNKNOWN`. An independent authoritative
read can recover success only from the exact `COMMITTED` record. A durable
`CLAIMED` row survives process restart and remains unknown. Query, connection,
lock or release failures must never become an `ABSENT` answer.

The same custody-owner instance also remembers uncertainty and refuses a later
`ABSENT` answer as permission for another write. A claim whose transaction
truly rolled back and never persisted was never a durable claim; do not invent
a tombstone or authority for it. An authoritative absence result requires a
successful serialized database read after competing transactions have settled,
not a missing reply or an optimistic read during an unresolved commit.

## Transactions, locks and triggers

Use bounded read-committed transactions and the existing conversation lock
convention. Both write phases acquire locks in this fixed order: canonical
conversation advisory lock, canonical run row, existing issuance row, then the
Objective global-job advisory fence and custody row. The global-job fence has
an Objective-specific fixed namespace. An adapter must not be invoked while a
caller already holds the issuance transaction in the reverse order.

The global fence serializes absence, collisions, claim/finalization and exact
readback. A store read that takes that fence touches only its Objective row;
it must not subsequently acquire canonical run or issuance locks in reverse
order. A colliding foreign job is refused without locking or exposing foreign
source rows. Lock timeout and deadlock remain bounded failures, not absence or
permission to bypass the fence.

New-table triggers must reject deletion and truncation, and reject all changes
to identity, payload, digests, original expiry, claim fence and claim timestamp.
The only update is the exact fenced/versioned `CLAIMED` to `COMMITTED`
transition and its one committed timestamp. All updates to a committed row are
refused. Source-agreement checks are a backstop to the adapter's locked
canonical comparisons; trigger implementation must preserve the same lock
order rather than introduce reverse source locks.

Use fixed schema-qualified objects and invoker permissions. No security-definer
privilege expansion, configurable table name, caller-selected schema or generic
SQL callback is part of this adapter.

## Tenant, role and retention boundaries

The preferred adapter instance is bound to a trusted server-owned tenant ID.
Job reads and the reverse lookup must include that tenant. Reverse lookup also
requires the exact issuance key, complete binding and facts digest and compares
them with canonical ISSUED metadata before releasing a committed protected
pair. Digest-only or partial-binding lookup is unavailable.

A future multi-tenant mount needs a separately private trusted job-to-tenant
resolution step, never caller JSON or a public global index. Database existence
does not establish native client access. Fresh current-owner checks remain
mandatory before any result reaches an authorized transport. Existing source
does not supply row-level-security policies; explicit tenant predicates must
not be described as an already installed RLS boundary.

The migration must not create or alter roles, grant privileges, insert seeds or
apply itself. Future separately reviewed control-role permissions are limited
to reads, insertion and the lifecycle columns needed for the sole finalization
transition. No deletion, truncation, table ownership or schema-DDL privileges
are implied. Canonical source-row locking rights must already be authorized;
missing rights keep the adapter unavailable rather than prompting invented
grants.

The new record retains accepted prompt/context and protected facts. Before live
use, the retention owner must allocate its data class, suppression behavior and
reviewed purge/recovery handling. This lane does not amend first-chat retention
registries or add a deletion exception. The immutable-row constraint and that
retention dependency remain explicit activation holds.

## Verification and remaining holds

Later focused tests must cover exact and conflicting replay, global cross-tenant
collisions, full-binding and facts drift, unissued or mismatched canonical
sources, each claim/commit interruption, ambiguous acknowledgements, restart
with a durable claim, denied read-side completion and reverse lookup, cleanup
and historical expiry semantics, transaction cleanup and borrowed-client
release. Synthetic pool fixtures qualify protocol behavior only.

No PostgreSQL durability, concurrency, migration execution or database-role
qualification is established by this requirements document or a fake pool.
Source allocation is reserved; independent source review, real-engine
qualification and any later live authorization remain separate gates. Historical Core RS256,
Meri's existing strict gate, first-chat pins and the disabled-delegation
production constraint remain unchanged.

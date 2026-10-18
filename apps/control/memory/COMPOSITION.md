# Memory family composition (lane M, 18 October 2026)

Status: source only. D016 #6 (`docs/coordination/DECISIONS.md`): memory is **review-only and in scope**. Nothing here applies a
migration or opens a listener. Earlier composer diffs below record the integration contract. The dedicated 18 October memory
composition continuation receives pin `6cd19f2a` and implements the late retention bind and readiness correction in source.

## What the family composes (`apps/runtime/product-ports/memory.mjs`)

Composed only when `configuration.memory.enabled === true` (with `origin` and `serviceSecretFile`),
`configuration.retention.enabled === true`, AND the prepared candidate supplies `conversationMembership`. Otherwise no port: the
mount answers `503 MEMORY_UNAVAILABLE / NOT_DISPATCHED`, readiness `memory.producer: unavailable`. A composed port also returns 503
until control binds the canonical retention gate; shared readiness must not report serving before that bind.

- Port `memoryApplication` (`apps/control/memory/application.mjs`): `MEMORY_PATHS` of `apps/control/memory/protocol.mjs`
  - `/api/memory/proposals/{list,status,propose,correct}` — the governed producer surface (unchanged wire, `wire.mjs`). New
    surface-origin propose/correct is held at `503 MEMORY_RETENTION_SUBJECT_UNAVAILABLE` pending retention ownership.
  - `/api/memory/review/list` `{cursor?,limit?,clientId?}` → `{proposals:[PENDING own candidates], nextCursor,
    reviewAvailability:{state:'available'|'partial'|'unavailable',unresolvedCount}}`. Availability is page-local; callers drain
    `nextCursor` to determine the whole inbox's state. A Core status outage cannot masquerade as an empty inbox.
  - `/api/memory/review/approve` `{candidateId}` / `/api/memory/review/reject` `{candidateId, reason}` → `{proposal, decision:{decision,
    outcome}}`; forwarded to Core's owner-decision route (additions, personal own only) or version-candidate routes (corrections).
    Effect routes: `MEMORY_DECISION_UNCERTAIN` carries `outcome:'UNKNOWN'`.
- Credentials (`apps/runtime/native-authority/memory-credentials.mjs`): the member's own native bearer. Surface: the request's admitted
  bearer, held per request by `bearer-custody.mjs` (a request-private principal copy keyed in a WeakMap; released with the request).
  Run (`memory.propose` from a conversation): the live action-session credential through the reads relay (`read-credential-relay.mjs`)
  — `createMemoryFamilyWith({nativeCredentials: relay.port})`. Service secret: `memory.serviceSecretFile`, re-read per call, never a
  candidate credential file (digests compared, as the reads broker).
- `memoryComposition(context).commandSourceFor({binding, selectedClientId | scopes})` → `createMemoryCommandSource({producer,binding,selectedClientId})` bound
  to that run (lane X's execution owner plugs it as the `memory.propose` source; `null` without the relay).
- Tables: `MEMORY_TABLES = ['meri_memory.candidates']`.

## Composer diffs (files lane M does not own)

### `apps/runtime/config.mjs`

```diff
 import {compileIntentsConfiguration} from './product-ports/intents.mjs';
+import {compileMemoryConfiguration} from './product-ports/memory.mjs';
...
- own(c,[...common,...(role==='control'?[...]:...)],role==='conversation-runner'?[...]:role==='control'?['nativeCandidate','retention','telemetry','downloadLinks','privateHttp','taskRouter','userPreferences','tenantSettings','capabilityPlatform','routines','artifacts','intents','reads','objectiveGeneration']:...);
+ own(c,[...common,...(role==='control'?[...]:...)],role==='conversation-runner'?[...]:role==='control'?['nativeCandidate','retention','telemetry','downloadLinks','privateHttp','taskRouter','userPreferences','tenantSettings','capabilityPlatform','routines','artifacts','intents','reads','objectiveGeneration','memory']:...);
...
 if(c.intents!==undefined){requireValue(role==='control','INTENTS_CONFIGURATION');compileIntentsConfiguration(c);}
+// Memory (lane M, product-ports/memory.mjs): a closed control opt-in `{enabled, origin?, serviceSecretFile?}`; absent means disabled.
+// `enabled:true` requires Core's https origin and the absolute service-secret file; `enabled:false` allows neither.
+if(c.memory!==undefined){requireValue(role==='control','MEMORY_CONFIGURATION');compileMemoryConfiguration(c);if(c.memory.enabled)file(c.memory.serviceSecretFile);}
```

### `apps/runtime/product-applications.mjs`

```diff
 import {TENANT_SETTINGS_PATHS} from '../control/settings/tenant-application/protocol.mjs';
+import {MEMORY_PATHS,memoryUnavailable} from '../control/memory/protocol.mjs';
...
- const c=own(value,[],[...,'intentApplication','settingsApplication']);
+ const c=own(value,[],[...,'intentApplication','settingsApplication','memoryApplication']);
...
   ...(c.settingsApplication===undefined?{}:{settingsApplication:methods(c.settingsApplication,['handle'])}),
+  // Memory review-only surface (lane M): one public application composed by the family.
+  ...(c.memoryApplication===undefined?{}:{memoryApplication:methods(c.memoryApplication,['handle'])}),
...
   if(Object.values(TENANT_SETTINGS_PATHS).includes(path))return ports.settingsApplication?...;
+  if(Object.values(MEMORY_PATHS).includes(path))return ports.memoryApplication?ports.memoryApplication.handle(request):memoryUnavailable();
```

### `apps/runtime/control-route-boundary.mjs` (allowlist entry)

```diff
 import {TENANT_SETTINGS_PATHS} from '../control/settings/tenant-application/protocol.mjs';
+import {MEMORY_PATHS} from '../control/memory/protocol.mjs';
-const publicPath=path=>...||Object.values(TENANT_SETTINGS_PATHS).includes(path)||path.startsWith('/api/documents/');
+const publicPath=path=>...||Object.values(TENANT_SETTINGS_PATHS).includes(path)||Object.values(MEMORY_PATHS).includes(path)||path.startsWith('/api/documents/');
```

### `apps/runtime/control.mjs` (bind retention and require the journal table when composed)

```diff
 // After retentionGate(...) creates the exact canonical gate, before products can serve:
 if(productContext && retention)bindMemoryRetention(productContext,retention.gate);
 const intentTables=Object.freeze(ports.intentApplication?[...]:[]);
+// Composed memory needs its candidate journal (lane M); a disabled family adds no table.
+const memoryTables=Object.freeze(ports.memoryApplication?['meri_memory.candidates']:[]);
- return Object.freeze({service,store,sessions,retention,userPreferences,intentTables,productReadiness:...
+ return Object.freeze({service,store,sessions,retention,userPreferences,intentTables,memoryTables,productReadiness:...
...
   if(assembly.intentTables?.length){...INTENTS_SCHEMA_UNAVAILABLE...}
+  if(assembly.memoryTables?.length){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[assembly.memoryTables]);if(r.rows.length!==assembly.memoryTables.length||r.rows.some(row=>row.relation===null))throw fault('MEMORY_SCHEMA_UNAVAILABLE');}
```

`control.mjs` now imports `bindMemoryRetention` and records its successful bind in `memoryRetentionBound` for product readiness.
The bind succeeds only for the enabled memoized family; a disabled, missing or unbound family cannot report composed. The bound
gate is `retention.gate`, already used by conversation serving. The existing startup readiness still requires ledger recovery;
a successful in-process bind alone cannot open the serving fence.

### `apps/runtime/product-readiness.mjs` (+ `apps/runtime/test/product-readiness.test.mjs`)

```diff
- for(const [name,port] of [...,['intents.application','intentApplication'],['settings.tenant','settingsApplication']])
+ for(const [name,port] of [...,['intents.application','intentApplication'],['settings.tenant','settingsApplication'],['memory.producer','memoryApplication']])
...
-  // Memory composes no port until Core M2 routes, the parser and an allocated migration exist (product-ports/memory.mjs).
-  {name:'memory.producer',state:'unavailable'},
```
Test line 14: `missingOwners` of the "composed owners" case becomes `['tasks.commands','schedules.application','schedules.inbox','sources.currentInstallation','proxy.modelGrants','memory.producer','schedules.dispatchWorker']` only while `memoryApplication` is not in `configuredOwners` (unchanged list); add `'memoryApplication'` to that case's `configuredOwners` and drop `'memory.producer'` from the expectation.

`product-readiness.mjs` now requires both a captured `memoryApplication` and `memoryRetentionBound === true`. This prevents
readiness from declaring an unbound 503 route composed. Presence is a composition fact, not full memory activation evidence.

### `apps/runtime/cli.mjs` (run path: give the family the relay)

```diff
-  productPorts={productPortsFactory:createProductPortsFactory({families:PRODUCT_FAMILIES.map(([name,factory])=>[name,name==='documents'?documents.family:name==='intents'?execution.family:factory])}),intentMountFor:execution.intentMountFor};
+  // Memory (lane M): the run path's bearer is the live action session, through the same relay the reads use.
+  const {createMemoryFamilyWith}=await import('./product-ports/memory.mjs');
+  const memoryFamily=createMemoryFamilyWith(relay?{nativeCredentials:relay.port}:{});
+  productPorts={productPortsFactory:createProductPortsFactory({families:PRODUCT_FAMILIES.map(([name,factory])=>[name,name==='documents'?documents.family:name==='intents'?execution.family:name==='memory'?memoryFamily:factory])}),intentMountFor:execution.intentMountFor};
```
with `const relay=(c.reads?.enabled===true||c.memory?.enabled===true)?createReadCredentialRelay():null;` hoisted above the control
branch (today the relay is created only inside the `reads.enabled` block) and `readCredentialRelay:relay` passed whenever it exists.

### Lane X seam (`apps/runtime/native-authority/execution-composition.mjs`)

For a `memory.propose` proposal: `const {commandSourceFor}=memoryComposition(context); const source=commandSourceFor?.({binding:
run.binding, scopes: run scopes})` and pass it as the durable executor's `source` (it carries `personalPending:true`, which
`durable-executor.mjs` requires for personal scope). Without the relay `commandSourceFor` is `null`: keep `PENDING_PRODUCER_UNAVAILABLE`.

## Migration plan line and grants (`infra/**`, not edited)

`infra/product-preview/first-chat-migrate.mjs`, stage `integration`, BEFORE the `phase:integration_grants` entry (the grants need the
relation); dot's central reservation decides the ordinal:

```js
 ['migration','apps/control/memory/migrations/0001_memory_candidates.sql','d925ec36d5e4fa98efeb123fb86f602608dbf82b2caa59bd093366e1eb33067d','integration'],
```

`infra/product-preview/first-chat-database-integration.sql` (same rules: USAGE, SELECT/INSERT, column UPDATE derived from
`postgres-journal.mjs`; the `candidates_immutable` trigger already rejects every other column). Its plan sha256 (`d01b7400…`) changes
with this edit:

```sql
-- schema/relation preflight: add 'meri_memory' to the schema array and 'meri_memory.candidates' to the relation array.
REVOKE ALL ON SCHEMA meri_memory FROM PUBLIC;
GRANT USAGE ON SCHEMA meri_memory TO meri_control_runtime;
-- Control: memory candidate journal (producer outbox). Rows are immutable except the submission columns (trigger-enforced).
GRANT SELECT, INSERT ON TABLE meri_memory.candidates TO meri_control_runtime;
GRANT UPDATE (submission_state,review_id,submitted_at) ON meri_memory.candidates TO meri_control_runtime;
-- readback: add 'meri_memory' to both nspname arrays (excess-privilege scan and cross-schema USAGE check).
```

## Core receiver reconciliation (capiro-backend #84 head `0304b0ef`; golden fake `test/core-golden.mjs`)

| Finding | Meri now |
|---|---|
| Scoped ids `clio:<uuid>` / `item:<uuid>`, never bare UUIDs | carried opaquely (`MEMORY_ID` documents the form); a bare UUID target is Core's `null` → `MEMORY_TARGET_NOT_FOUND`; `publishedMemoryId` is `clio:` for additions, `item:` for corrections |
| Distinct hash domains (`capiro.clio-memory.v1` vs `capiro.memory-item.v1`) | pinned and echoed unchanged; the golden tests recompute both |
| Correction with `ttlDays` → 409 | `candidate.mjs` refuses locally; `proposeFromCommand` drops the ttl when a keyed proposal becomes a correction |
| Logical-null keys need proven lineage; reserved `meri:<uuid>` key → 400 | `wire.mjs`/`candidate.mjs` refuse the reserved form before any Core call |
| 409/400/403 are definite (nothing recorded) | `MEMORY_SUBMISSION_REFUSED` (409 to the client); the journal row stays PREPARED, a replay is refused again. Previously every failure became `submission_unknown` and was resubmitted for ever |
| 503 until `MEMORY_GOVERNANCE_LIFECYCLE=enforce` | uncertainty: `submission_unknown` (resubmitted once enforced); a decision answers `MEMORY_DECISION_UNCERTAIN` with `outcome:'UNKNOWN'` |
| Decision routes are bearer-only standard-user routes | the transport sends the service secret only to the four receiving routes |
| D25: Core membership carries `permissions:[]` | unchanged: when surface writes acquire retention ownership, firm proposals also need `memory.propose.firm`, which no Core fact currently grants. No scope is added here |

Known limit: the command executor folds every post-claim source failure into `COMMAND_OUTCOME_UNKNOWN`, so a definite Core refusal of a
run-originated candidate leaves the command indeterminate and the candidate PREPARED (visible as `submission_unknown`).

## PR #121 memory audit repair outline (source only)

### Conversational command owner follow-up

The existing command executor keeps approval, current authority, budget and execution custody. The memory family keeps Core
candidate submission and the exact conversation retention gate. `command-options.mjs` supplies the `save_memory`
descriptor, `MemoryProposeContext`, an immutable approval-metadata owner and the existing command tool validators to the shared
intent composer. The metadata owner will use the existing `meri_commands.approval_metadata` relation through a memory-owned codec;
no parallel proposal table or model execution loop is introduced. Preparation and read recheck the canonical conversation
retention gate. The producer rechecks it again before a Core lookup or submission. The shared execution composer must bind the
run's live credential relay, select the memory source for `memory.propose`, and refuse a missing source. Focused tests cover
immutable prepare/read, suppression, selected-client pinning, and no-execution preparation; live Core and DB acceptance remain
separate gates.

The producer owns candidate visibility and submission. The late-bound canonical retention read gate checks the trusted conversation
identity in a conversation-origin candidate before a Core target lookup, write, resubmission, listing, status read or decision.
A suppressed conversation's candidate is hidden; an unavailable gate fails the request closed. The memory application returns 503
while unbound. The shared control composer must call `bindMemoryRetention(productContext,retention.gate)` after `retentionGate`
exists. A conversation-origin journal INSERT also takes the canonical shared recovery lock and subject advisory lock, then reads
`meri_conversations.retention_subjects` under READ COMMITTED in the same transaction before writing. This serializes with **PostgreSQL projection**,
but the external ledger append precedes that projection and is not covered by this lock. The central retention owner must close
that gap before claiming atomic write suppression. The runtime grant owner must allow the journal's SELECT/row lock on
`meri_conversations.retention_subjects` (absent from the currently reviewed integration grants).

Surface-origin candidates have no conversation subject. In the production memory family, NEW surface proposals and corrections
answer `503 MEMORY_RETENTION_SUBJECT_UNAVAILABLE` before a journal or Core read/write. Existing candidates remain visible to their
authorized proposer for status/review. The actor/client subject, suppression and deletion policy is a central decision; this source
does not infer one from citations or client IDs. The current conversation gate does not cover those existing surface rows.

The local `meri_memory.candidates` payload is separate from Core's canonical memory proposal. Its row owner can enumerate exact
conversation-origin candidate IDs for retention inventory. The central retention registry, purge row owner, and migration/grants
owner must add the local class and guarded content redaction under the same suppression generation before any purge can claim coverage.
Core remains responsible for its received candidate copy and publication. Approved canonical Core memory is independent of
source-conversation erasure; only the pending candidate/source payload belongs to this conversation inventory. Focused
verification covers gate denials, gate outages, and the review inbox's partial/unavailable status without a live migration or purge.

Exact shared-owner work: register a distinct `meriMemoryCandidates` conversation row class (do not conflate it with Core's external
`memoryProposals`); drain `listConversationCandidateIds` to exhaustion during inventory; route, preflight, plan, redact and reverify
`{tenantId,conversationId,candidateId}` under the canonical suppression generation. The central target amendment is assigned
`meri_conversations/0018_memory_candidate_targets.sql`; the memory content-tombstone amendment is assigned
`meri_memory/0002_candidate_retention_delete.sql` (the allocation name is historical; the SQL must not DELETE the row).
The current retention PG row port accepts only `sdkSession` and `artifactVersions`, and runtime purge remains disabled.

### Memory-owned payload port, follow-up source checkpoint

`retention-payload-owner.mjs` now exposes `createMemoryCandidateRetentionPayloadOwner({pool})` with the distinct class
`meriMemoryCandidates`. Its `inventoryPage({subject,afterCandidateId,limit})` uses the journal's bounded keyset; the shared retention
inventory owner must drain pages to exhaustion. `present({subject,candidateId})` reads exact tenant, conversation origin and candidate
identity without returning payload content. `purgeInTransaction({client,plan,workflowId})` runs only inside the shared row owner's
READ COMMITTED transaction after its exact `planRows`: it validates the plan digest, locks the recovery and subject keys, reads the
current SUPPRESSED projection, owner and generation, requires a matching PLANNED target inserted in this transaction, then sets
`candidate=NULL,candidate_purged_at=clock_timestamp()` and rereads the tombstone. It preserves candidate ID, idempotency key,
request/candidate hashes and review state. The forward SQL trigger independently enforces the same-target rule; source tests
simulate the required SQL, not a live database trigger.

`meri_memory/0001` remains the pinned CREATE-only producer outbox. The central ledger assigned the successor `0002` and
conversations `0018` after collision checks against authored maxima and reserved held IDs; `0012` and `0014` remain held for other
owners. Neither source migration is applied here. Deployment history and integration-plan hash must be checked by the central
migration owner before any application. The shared owner must add class policy/inventory, exact target plan/record/update/readback,
recovery behavior and restricted column grants before binding this port. Surface-origin candidates still lack an actor/client
retention subject and remain held for new writes. The existing `retention/data-classes.mjs` `memoryProposals` class describes Core's
external conversation payload, not this Meri candidate outbox. `retention/policy.mjs` requires explicit `retentionMs`; it sets no
default. Choosing actor/client subject and policy for surface candidates remains a central decision.

### Command payload chain and activation

`approval-metadata-store.mjs` retains the raw memory request and content in `meri_commands.approval_metadata.payload` under an
immutable `memory_conversation_id`; the metadata row owner inventories it by proposal ID and tombstones `payload` while preserving
unique proposal/command/idempotency identities and hash. Its forward schema needs nullable `payload`, `payload_purged_at`, immutable
conversation locator, a partial live-payload index, guarded UPDATE trigger and restricted column grants. A metadata read returns
no prepared command after tombstone. Existing Core approval reception is task.create-only, so Core's shared owner must qualify
`memory.propose` before approval is executable.

The same conversation can retain memory content in `meri_memory.candidates`, `meri_commands.command_journal`, and
`meri_intents.preparations.outcome.result.proposal`. Central retention must register all four exact classes
`meriMemoryCandidates` (`candidate_id`), `meriMemoryApprovalMetadata` (`proposal_id`), `meriMemoryCommandJournal` (`command_id`),
and `meriMemoryIntentPreparations` (`delivery_id`). The latter two need immutable conversation locators and guarded content
tombstones preserving idempotency/delivery replay fences; command history, readOutcome and preparation replay must withhold
tombstoned content. `bindMemoryCommandRetention` requires a central bundle asserting registry, target schema, grants, recovery,
policy and all four classes. No shared composition currently supplies that bundle, so `commandOptionsFor` and `commandSourceFor`
remain unbound. Personal memory within a selected-client run uses that run's selected-client UUID for live credential lookup while
the personal command arguments carry `clientId:null`; a truly unscoped chat has no compatible action-session credential and stays
unavailable before prepare.

### Integration checkpoint, 18 October 2026

The separate memory composition branch receives `d3a0e291` over the previously bound canonical control retention gate. It preserves
the full trusted executor binding, original stable run identity, immutable prepared command and selected-client checks. Both
command options and source stay absent without a live relay; explicit null selection cannot fall back to scope hints. Neither
the shared intent/execution owners nor the four-class command-retention bundle is mounted by this checkpoint.

The assigned intent `0002` source resolves and verifies its historical state/outcome constraints by exact column sets and parsed
expressions, without relying on PostgreSQL-generated constraint names. The candidate tombstone trigger requires an active
PLANNED/UNKNOWN purge projection and locks its exact target and suppression rows. These are source repairs only; native PostgreSQL
trigger, role, concurrency and restore qualification remains outstanding. Candidate journal reads now depend on `memory/0002`
columns, so a table-only startup readiness check is insufficient for activation. Central integration must verify the new columns
and trigger shape, complete the held approval-metadata/command-journal schemas, and teach intent replay/readers to withhold
`REDACTED` payloads before enabling memory. See `docs/coordination/handoffs/MEMORY-COMPOSITION-20261018.md` for exact gates and tests.

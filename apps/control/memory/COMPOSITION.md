# Memory family composition (lane M, 18 October 2026)

Status: source only. D016 #6 (`docs/coordination/DECISIONS.md`): memory is **review-only and in scope**. Nothing here applies a
migration or opens a listener. Earlier composer diffs below record the integration contract; the late retention bind and readiness
correction remain shared-owner changes.

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
- `memoryComposition(context).commandSourceFor({binding, selectedClientId | scopes})` → `createMemoryCommandSource({producer})` bound
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

Import `bindMemoryRetention` from `product-ports/memory.mjs`. `memoryComposition(productContext).retentionBound()` is the
source-owned readiness signal; the shared readiness path must refuse an unbound memory composition. The bound gate is
`retention.gate`, already used by conversation serving, not a new memory suppression store.

### `apps/runtime/product-readiness.mjs` (+ `apps/runtime/test/product-readiness.test.mjs`)

```diff
- for(const [name,port] of [...,['intents.application','intentApplication'],['settings.tenant','settingsApplication']])
+ for(const [name,port] of [...,['intents.application','intentApplication'],['settings.tenant','settingsApplication'],['memory.producer','memoryApplication']])
...
-  // Memory composes no port until Core M2 routes, the parser and an allocated migration exist (product-ports/memory.mjs).
-  {name:'memory.producer',state:'unavailable'},
```
Test line 14: `missingOwners` of the "composed owners" case becomes `['tasks.commands','schedules.application','schedules.inbox','sources.currentInstallation','proxy.modelGrants','memory.producer','schedules.dispatchWorker']` only while `memoryApplication` is not in `configuredOwners` (unchanged list); add `'memoryApplication'` to that case's `configuredOwners` and drop `'memory.producer'` from the expectation.

The existing `configuredOwners.includes('memoryApplication')` check is insufficient before the late bind. The shared owner should
pass the memory composition's `retentionBound()` result into readiness and mark `memory.producer` unavailable if false, even though
the route port was captured. This prevents readiness from declaring an unbound 503 route composed.

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
owner must add the local class and guarded deletion under the same suppression generation before any purge can claim coverage.
Core remains responsible for its received candidate copy and publication; neither owner can delete the other's payload. Focused
verification covers gate denials, gate outages, and the review inbox's partial/unavailable status without a live migration or purge.

Exact shared-owner work: register a distinct `meriMemoryCandidates` conversation row class (do not conflate it with Core's external
`memoryProposals`); drain `listConversationCandidateIds` to exhaustion during inventory; route, preflight, plan, purge and reverify
`{tenantId,conversationId,candidateId}` under the canonical suppression generation; allocate an additive migration with an exact
target ledger, guarded `BEFORE DELETE` trigger and restricted purge-only DELETE grant. The current retention PG row port accepts
only `sdkSession` and `artifactVersions`, and runtime purge remains disabled. No standalone memory DELETE worker should bypass it.

### Memory-owned payload port, follow-up source checkpoint

`retention-payload-owner.mjs` now exposes `createMemoryCandidateRetentionPayloadOwner({pool})` with the distinct class
`meriMemoryCandidates`. Its `inventoryPage({subject,afterCandidateId,limit})` uses the journal's bounded keyset; the shared retention
inventory owner must drain pages to exhaustion. `present({subject,candidateId})` reads exact tenant, conversation origin and candidate
identity without returning payload content. `purgeInTransaction({client,plan,workflowId})` runs only inside the shared row owner's
READ COMMITTED transaction after its exact `planRows`: it validates the plan digest, locks the recovery and subject keys, reads the
current SUPPRESSED projection, owner and generation, requires a matching PLANNED target inserted in this transaction, then deletes exactly
one scoped candidate row and rereads it. It does not open a transaction, expose an HTTP route, or grant DELETE. The future database
trigger must enforce the same target check independently; source tests simulate the required SQL, not a live database trigger.

**freshIDneeded:** the central ledger reserves `meri_memory` `0001` for the original producer outbox; its source is pinned, so an
additive guarded candidate DELETE trigger needs a new centrally allocated memory migration ID. The ledger reserves
`meri_conversations` `0014_retention_row_targets.sql` to the retention owner under an **AUTHORING HOLD**; the owner must decide
whether to release that exact reservation or allocate a successor for `retention_purge_targets` to carry the distinct class and
`candidate_id`. Neither ID nor migration placement is chosen here. The shared owner must also add class policy/inventory, exact
target plan/record/update/reverification, recovery behavior and a restricted purge role/grant before binding the port. Surface-origin
candidate payloads still lack an actor/client retention subject and remain held for new writes; this conversation port does not
purport to cover them or Core's separately owned received payload.

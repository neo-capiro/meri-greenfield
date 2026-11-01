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

This historical executor seam is superseded. Memory proposals use `command-options.mjs`; approved submissions and readback use the current native approval receiver through `runtime/native-authority/approval-forwarder.mjs`. The generic durable command executor and its legacy fixed-route source have been retired. Personal memory remains a pending candidate until the existing review owner decides it.

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

**Superseded 2026-10-28 (root decision D2(i)).** The memory-module four-class bundle and its held payload schema are retired: the
four retained conversational payloads are served by the existing mounted central path below, not by a second per-class
nullable-payload schema. The class vocabulary `meriMemoryApprovalMetadata`/`meriMemoryCommandJournal`/`meriMemoryIntentPreparations`
and the columns `payload_purged_at`/`memory_conversation_id` were never authored in any migration; the former
`apps/control/memory/approval-metadata-retention-owner.mjs` that targeted them is deleted as dead source. In the same change its
now-orphaned read-only codec `apps/control/memory/approval-metadata.mjs` (exports `MEMORY_COMMAND_OPERATION` and
`memoryMetadataPayload`) is deleted too. The active codec is `apps/control/commands/approval-metadata/memory-kind.mjs` (via
`command-kind.mjs`), and `MEMORY_COMMAND_OPERATION` is served by `apps/control/memory/command-options.mjs`. Do not re-add the
alternative mechanism. The historical coverage manifest `docs/integration/source-coverage-20261021/ledger.json` still lists both
files; it is immutable history, not current wiring.

The same conversation retains memory content in two existing mechanisms:

- `meri_memory.candidates` is the distinct `meriMemoryCandidates` class with its own row owner
  (`apps/control/memory/retention-payload-owner.mjs`), target in `conversations/0018` and the `meri_memory/0002` candidate tombstone
  (`candidate=NULL`, `candidate_purged_at`).
- `meri_commands.approval_metadata`, `meri_commands.command_journal` and `meri_intents.preparations` are the `receipts` class
  conversation content rows (`apps/control/conversations/retention-content-rows.mjs:34-37`) dispatched to modes `approval`,
  `command` and `intent` (`apps/control/retention/conversation-purge-rows.mjs:15-21`). Approval metadata tombstones `payload` to the
  exact marker; the command journal tombstones `payload` and any settled `outcome` to the marker; the intent preparation becomes
  `state='REDACTED', outcome=NULL, outcome_purged_at=clock_timestamp()`. The surviving
  `meri_conversations.guard_conversation_tombstone()` body is `conversations/0030_child_assignments.sql:55` (`CREATE OR REPLACE`
  after 0023/0029) and still refuses any payload change that is not the exact marker, so replay/reply identity (`proposal_id`,
  `command_id`, `idempotency_key`, `*_sha256`, `delivery_id`) survives while a tombstoned row fails the live-payload decode. The
  restricted column grants are the existing `infra/product-preview/first-chat-expired-conversation-purge-grants.sql`. Command
  history, readOutcome and preparation replay withhold tombstoned content. The central `receipts`-class registry owner still owns
  the outstanding accuracy questions there (the `meri_conversations.run_issuances`/`model_run_issuances` rows are not enumerated or
  purged by any mounted owner); that is a shared-owner dependency, not a reason to re-add a per-class schema.

### Current native producer and separate approvals, 31 October 2026

No `bindMemoryCommandRetention` bundle or four-class command-retention bundle is mounted. The current native producer uses the
existing intent and approval owners. `apps/runtime/product-ports/memory.mjs` composes `intentPreparersFor` only with a live run
credential relay, gated by `bindMemoryRetention` (it returns `[]` until the retention gate is bound). Preparation re-borrows the
run's live session and checks membership, the trusted General/client selection, retention and current run authority.

The SDK tool `mcp__meri_intents__propose_memory` exposes `save_memory@0.2.0`. `createMemoryIntentPreparer` in `command-options.mjs`
creates immutable `memory.propose` approval metadata and returns `approval_required`. Preparation creates no candidate or active
memory. A separate submission approval through `apps/control/intents/approval.mjs` dispatches the exact approved proposal through
the native memory execution port to Core. Core's native receiver derives the addition candidate ID from the proposal ID and
retains the exact conversation/run/command provenance with a pending review. This path does not submit through the legacy Meri
candidate journal; a new `meri_memory.candidates` row is not evidence required for native submission.

Submission approval is not publication approval. The candidate remains pending until a separate canonical memory owner decision
publishes it. Native submission is addition-only; matching an existing key must not silently replace approved memory. Corrections
use the existing governed correction/version path. Read the same proposal/execution receipt after an unknown outcome rather than
creating a new proposal to retry it. Approved memory is recalled only through the existing canonical eligibility owner.

Personal memory in a selected-client run uses that run's selected-client UUID for live credential lookup while personal command
arguments carry `clientId:null`. General is supported with its trusted private-user scope and a null selected client; the model
cannot supply `clientId`. See `apps/control/intents/test/native-memory.test.mjs`, `native-memory-execution.test.mjs`,
`apps/worker/conversation/intents/test/native-memory.test.mjs` and `apps/runtime/product-ports/test/memory.test.mjs` for synthetic
preparation, separate submission, General/client and refusal coverage. These checks do not establish a deployed producer run,
publication, recall or retention witness. Existing approval/command/intent payloads remain governed by the central `receipts`
retention path above; do not re-create a per-class retention schema.

### Integration checkpoint, 18 October 2026

The separate memory composition branch receives `d3a0e291` over the previously bound canonical control retention gate. It preserves
the full trusted executor binding, original stable run identity, immutable prepared command and selected-client checks. Both
command options and source stay absent without a live relay; explicit null selection cannot fall back to scope hints. Neither
the shared intent/execution owners nor the four-class command-retention bundle is mounted by this checkpoint.

The assigned intent `0002` source resolves and verifies its historical state/outcome constraints by exact column sets and parsed
expressions, without relying on PostgreSQL-generated constraint names. The candidate tombstone trigger requires an active
PLANNED/UNKNOWN purge projection and locks its exact target and suppression rows. These are source repairs only; native PostgreSQL
trigger, role, concurrency and restore qualification remains outstanding. Candidate journal reads now depend on `memory/0002`
columns, so a table-only startup readiness check is insufficient for activation. Central integration must verify the new
`meri_memory` candidate columns and the pinned `guard_conversation_tombstone` shape (`conversations/0030`), rely on the surviving
`receipts`-class approval/command/intent tombstones rather than authoring held per-class schemas, and teach intent replay/readers to
withhold `REDACTED` payloads before enabling memory. See `docs/coordination/handoffs/MEMORY-COMPOSITION-20261018.md` for exact gates and tests.

### Lifecycle stages, recall and evidence seams, 1 November 2026 (packet M18–M22 source map)

Five stages are distinct owners and never collapse into one another. A list label or a successful chat is evidence of none of them.

| Stage | Meri owner | What exists afterwards |
|---|---|---|
| 1. Explicit intent | `mcp__meri_intents__propose_memory` → `createMemoryIntentPreparer` (`command-options.mjs`) | immutable `memory.propose` approval metadata; no candidate, no memory |
| 2. Submission approval | `apps/control/intents/approval.mjs` (`memory.propose`) → native memory execution port | one Core candidate (addition) under the exact proposal provenance; `review_pending` |
| 3. Governed candidate | `producer.mjs` + `postgres-journal.mjs` (surface and command paths) | journaled immutable candidate, submission state PREPARED/SUBMITTED/SUBMISSION_UNKNOWN |
| 4. Publication | Core's owners only (`core-decisions.mjs` forwards the proposer's own decision) | `review.status` approved with a scoped `publishedMemoryId`; a correction becomes an `item:` successor |
| 5. Recall | gateway `search_memory` (`apps/gateway/sources/client-knowledge/http-adapter.mjs` + `memory-eligibility.mjs`), worker family `client-knowledge-memory` | approved records only, each released against Core's per-record eligibility receipt |

`review-state.mjs` is the proposer-side state machine for stages 3–4: the view status table over journal submission state × Core
answer, decision admission (repeat a terminal receipt, refuse an unreadable review, otherwise forward: Core locks the pending row and
refuses or recovers a decided candidate itself, so Meri keeps no duplicate "not pending" gate) and the correction invariant (the pin `{memoryId, memorySha256}` beside the
proposed content; nothing changes the active record until Core approves). `test/review-state.test.mjs` is table-driven over every
combination, the personal/client/firm walls, target hiding/ineligibility, conflict (stale pin → Core 409, nothing recorded), client
revocation (hidden on status, reload, decision and inbox) and pending-never-overwrites (keyed surface addition refused; keyed command
becomes a pinned correction).

Pending material is never recall: `memory.list_own_proposals` (`memory-proposals` family) carries `claimsAreApprovedFacts:false`, and
the `search_memory` output contract (`packages/contracts/retrieval-0.2/client-knowledge-memory.schema.json`) states that pending,
rejected, withdrawn, revoked, superseded and non-controlling records are not active recall.

**History and evidence (M20).** The frontend reads Core's owner routes directly (`GET /api/memory/owner/items`,
`items/{id}/versions`, `items/{id}/evidence`, Core `memory-owner-items.controller.ts`) through its own same-origin admission; Meri
proxies none of them, and adding a second proxy would duplicate that hop. Meri's part is the independently authorized provenance:
Core's evidence reader (`memory-owner-evidence.sources.ts`) POSTs `/api/conversations/transcript` `{conversationId, after:0, limit:1}`
with the member's own bearer and the frontend `Origin`, and accepts only `meri.conversation-transcript/1` whose `conversation.owner`
is the caller and whose single scope is the caller's private scope or one visible client. Meri answers 200 for the owner, 403 for a
removed member or a client mismatch, 404 for an unknown conversation and 503 `CONVERSATION_UNAVAILABLE` while suppressed, archived or
otherwise unservable (`apps/control/conversations/test/history-http.test.mjs`). Core maps 401/403/404/410 to
`availability:'unavailable', reason:'source_unavailable'`, any other failure to its own 503, and an anchor change during the read to
409 `HISTORY_CHANGED`. The only Meri public contract the memory UI consumes is `@capiro/meri-contracts/conversation-history`
(notification projection); the owner history page shape is Core's (`schemaVersion:1`), received by the frontend's own receiver.

**Notifications (M22).** Core owns the feed and acknowledgements (`memory/review/notifications`, `unread-count`, `read-all`,
`{id}/read`; `memory-review-inbox.controller.ts`). The frontend's `memory.notifications.*` operations call Core directly; the
same-origin adapter `/api/meri/notifications` proxies only the list. Meri has no notification route or store, so the historical ACK
404s cannot originate here. Core answers 404 from `markNotificationRead` when the tenant's memory review switch is off, when the row
is not addressed to `recipient_user_id = ctx.userId`, when `notificationVisibleInTx` no longer admits the candidate (participant or
client-state change), or when the UPDATE affected no row. `unreadNotificationCount` and `markAllNotificationsRead` both walk every
unread page (200 rows per page) with the same visibility rule, so the count and read-all share one complete population.

**Learning producer and memory retention windows (M21).** The learning producer, its CRM completion tasks and their deferral bound
are Core (`apps/api/src/learning/*`, `clients/client-profile-fill-completion*.ts`), as are the memory retention windows
(`memory/memory-retention-policy.controller.ts`). Meri's retained memory payload is the `meriMemoryCandidates` class only:
30-day class retention under `conversationTrashPolicy` (`retention/inventory-source.mjs`), content tombstone and same-transaction
target rule in `retention-payload-owner.mjs`, inventory/readback/redaction tests in `test/retention-seam.test.mjs` and the expired
Trash row transaction in `retention/test/expired-trash-pg.test.mjs`.

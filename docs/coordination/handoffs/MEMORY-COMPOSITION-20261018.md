# Meri memory source composition, 18 October 2026

Source-only continuation from integrated Meri `ce4e75c09546f0eb38a9bc712c3cdf6d23db6986` on the dedicated
`dot/meri-memory-composition-20261018` branch. Receive memory-owned paths from
`6cd19f2a35e589a5e27372bc67b528888e6e21af`; Core counterpart
`d92d07f92b6985b7987a237ae1a8fb3c0d212779`, frontend counterpart
`9f132c0d27a7d45c97f39f6d96c20c21a3326c80`. These pins do not establish activation.

## Implementation outline

- Preserve the existing memory producer, candidate journal, Core transport and
  live-session credential broker as their canonical owners. Receive the assigned
  source's retention checks, immutable replay fixes and review availability.
- Bind the family to the existing control retention gate once that gate exists;
  the coordinator allocated only that narrow `control.mjs` edit and the related
  `product-readiness.mjs` check. Missing or unbound retention must stay unavailable.
- Bind each command source to the trusted run and selected client, and test that
  command/authority/client mismatches cannot reach the producer or credential relay.
- Reuse the canonical retention fence/ledger. Do not create a second deletion
  worker, actor/client suppression model, ledger, or migration allocation. Record
  the exact central registry/purge and cross-repository gates that remain.
- Run focused memory, credential, control composition and readiness tests. The
  tests use synthetic Core, SQL and session boundaries; no live SQL, AWS, secrets,
  model calls, service activation or frozen N21 changes are in this task.

The shared command-intent preparer, approval-metadata and execution owner still
support task commands only. Full `save_memory` conversational parity needs those
owners and Core's matching issuance contract; it cannot be established by wiring
the candidate producer alone. The family remains disabled in deployment inputs.

## Initial checkpoint verification and gates

Implemented:

- Received the assigned memory source's immutable correction replay, explicit
  review availability, canonical retention seam and guarded candidate insertion.
- `control.mjs` binds the exact canonical retention gate to the memoized memory
  family. `product-readiness.mjs` requires both the captured route and successful
  bind. The canonical startup readiness still calls `ensureServing`; binding does
  not open an unrecovered fence. Purge stays disabled.
- `createMemoryCommandSource` now requires the trusted executor `binding` and
  `selectedClientId`. It checks the complete live executor binding, stable original
  run identity and selected client before preparation and execution, and snapshots
  the approved command/authority. Resumed attempts retain original proposal
  provenance. Family composition refuses conflicting explicit/scoped clients and
  foreign-tenant scope hints before a credential lookup.
- Corrected stale comments: the candidate migration is centrally reserved for
  source authoring. No migration body or grant changed.

Verification used Node **24.19.0**, with existing installed dependency directories
linked locally into this worktree. The borrowed dependency directories were not
modified. From the repository root, with `MERI_REVIEW_SOURCE_ROOT` set to that same
absolute source root:

```text
node --test apps/control/memory/test/*.test.mjs apps/runtime/product-ports/test/memory*.test.mjs apps/runtime/native-authority/test/memory-credentials.test.mjs apps/runtime/test/product-readiness.test.mjs
```

**71 passed, 0 failed, 0 skipped.** This covers the real durable command executor
over synthetic SQL/Core boundaries, source binding refusals before effects,
immutable preparation, resumed provenance, live-session bearer lookup, canonical
retention locks and actual control assembly. The new assembly test proves that a
missing ledger still rejects `ensureServing` and that purge remains disabled.
Independent read-only diff review found no blocking regression; `git diff --check`
passed.

Failed attempts retained in this record:

- Initial offline `npm ci` setup could not find cached `aws-cdk-lib` and
  `yargs-parser`; ambient Node was 22.23.3. No manifests or lockfiles changed.
- Initial test attempts lacked `MERI_REVIEW_SOURCE_ROOT` or transitive installed
  dependencies. Corrected the environment and local dependency links, then reran
  the focused suite above successfully.
- The additional `start-control-port-boundary.test.mjs` suite has six
  `DATABASE_SCHEMA_UNAVAILABLE` failures and two passes. Its SQL mock omits
  `initial_inputs`, required by the existing readiness check. The failures were
  reproduced with the original `ce4e75c0` control source in this worktree before
  restoring the candidate. The unrelated mock was not changed or weakened.

Activation remains blocked on these explicit owners:

1. **Shared command composition and Core:** `command-preparer.mjs`, the canonical
   approval-metadata owner and `execution-composition.mjs` need governed
   `save_memory` support, matching Core issuance/body/capability correlation, and
   the live credential relay. The pinned memory source alone does not mount a
   conversational command. Core still owns review, publication, fresh recall and
   its received candidate copy.
2. **Canonical retention:** supply a durable authoritative `retentionLedgerSink`
   outside database restore rollback. Serialize suppression's external ledger
   append through projection with candidate writes/effects. The existing SQL
   locks only serialize with projected suppression; pre/post checks are not an
   atomic barrier across that interval.
3. **Inventory and purge:** register local `meriMemoryCandidates` separately from
   external Core `memoryProposals`, define an explicit duration/policy, drain the
   existing paged inventory to exhaustion, and bind exact guarded row deletion
   and absence verification to the suppression generation and plan hash. The
   canonical PG row port currently supports only `sdkSession` and
   `artifactVersions`; conversation/event rows also need their owners. No local
   memory-only DELETE worker is introduced.
4. **Database owners:** review retention-subject SELECT/row-lock grants for the
   insert guard, and allocate/review an additive exact-target delete ledger,
   trigger and purge-only grant. Candidate migration `0001` is reserved; the
   separate conversation `0014` row-target reservation remains AUTHORING HOLD.
5. **Surface and frontend:** decide the actor/client retention subject for new
   surface candidates (still `MEMORY_RETENTION_SUBJECT_UNAVAILABLE`), bind the
   frontend routes to the real Meri owner and validate the pinned Core/FE contract
   together. FE pin presence does not establish route binding or live acceptance.

No AWS, live SQL, secret reads, builds, activation, public contract changes or
frozen N21 edits were performed. Deployment inputs still omit enabled memory.

## Successor packet reception: d3a0e291

Assigned Meri source `d3a0e2911fa2b5171b369dbe7978f2ee8cf810b9` and frontend
counterpart `481c25593bd77c2c96c219c1dd3e16ff21cee8d3`; Core counterpart remains
with its assigned owner. The frontend checkout is outside this task.

Outline before reception: apply the memory packet delta from `6cd19f2a`, preserving
this branch's command binding and shared control/readiness hardening. The packet
adds the memory-specific immutable metadata/options owner, guarded candidate and
metadata payload ports, separate command-retention activation, reserved source
migrations and independent knowledge-read configuration. The coordinator assigned
the exact conversation `0018`, intent `0002`, test and allocation entries, and the
client-knowledge adapter/test/docs for this reception. No schema apply, feature
activation or new retention duration is included. Review the new retention SQL and
ports independently, and run the affected memory/knowledge/migration source tests.

### Received and reconciled

- Received all 23 assigned packet paths, including conversation `0018`, intent
  `0002`, memory `0002`, allocation entries and the client-knowledge adapter.
- Resolved the runtime family merge by retaining trusted full run binding and
  client/scope/tenant checks. Explicit null selection refuses; UUIDs normalize
  before the same selected client reaches the source and credential broker.
- Memory options and source require both canonical read retention and the
  separate four-class command-retention bundle. Both are absent without the live
  relay. Actual control assembly still leaves command retention unbound.
- Independent review found and repaired two source defects: intent `0002` assumed
  an incorrect generated CHECK name; it now resolves unique validated local
  state/outcome constraints and compares their exact parsed historical expressions
  before dropping them. Candidate `0002` now requires an active purge plan and
  locks the target/suppression rows in its database guard.
- The knowledge adapter permits independently configured non-memory reads while
  requiring the current eligibility owner whenever `search_memory` is configured.
  This changes no runtime read activation or deployment inputs.

### Successor activation gates (supersede the initial gate list)

1. **Shared command and Core owners:** mount governed `save_memory` preparation,
   memory approval metadata and execution in the existing shared owners. Qualify
   Core's matching approval issuance/body/capability correlation. Bind the live
   relay independently of retained-read enablement; truly unscoped chats remain
   unavailable. The parent owns the latest Core pins.
2. **Four retained payloads:** centrally register and exhaustively inventory
   `meriMemoryCandidates`, `meriMemoryApprovalMetadata`,
   `meriMemoryCommandJournal` and `meriMemoryIntentPreparations`. Bind explicit
   policy, exact target recording, guarded dispatch, readback and recovery before
   supplying `bindMemoryCommandRetention`. No retention duration is inferred.
3. **Schema and replay:** the assigned conversation `0018`, memory `0002` and
   intent `0002` are source only. Approval-metadata and command-journal amendments,
   narrow grants, integration-plan hashes, and readiness for new columns/triggers
   remain with shared owners. Table existence alone is insufficient. Intent
   readers/replay must handle `REDACTED` without exposing content or breaking list
   pages before tombstones are enabled. Held conversation `0012`/`0014` allocations
   remain held. Native PostgreSQL migration/trigger/role/concurrency, uncertain
   commit and restore qualification is still required; no local PG binary was
   available and no SQL was executed.
4. **Canonical suppression:** bind a durable authoritative ledger outside database
   restore rollback, and close the external-ledger-append to SQL-projection race
   with candidate writes/effects. SQL locks alone do not close that interval.
5. **Surface, recall and frontend:** choose the actor/client retention subject for
   new surface candidates, qualify Core's fresh eligibility/retention owners and
   real FE route binding at the assigned frontend pin. Core's approved canonical
   memory has its own lifecycle; this inventory covers pending source payloads.

Memory, retained reads and purge remain disabled in deployment. No AWS, live SQL,
secret reads, Core/FE checkout edits or frozen N21 changes were performed.

### Successor verification

Using the same Node **24.19.0** and local borrowed dependency links, with
`MERI_REVIEW_SOURCE_ROOT` set to this worktree:

```text
node --test apps/control/memory/test/*.test.mjs apps/runtime/product-ports/test/memory*.test.mjs apps/runtime/native-authority/test/memory-credentials.test.mjs apps/runtime/test/product-readiness.test.mjs apps/gateway/sources/client-knowledge/test/read-adapter.test.mjs apps/control/intents/test/memory-tombstone-migration-source.test.mjs
```

**169 passed, 0 failed, 0 skipped.** The migration source checks compare the copied
base expressions to the unchanged `0001` file and check the target/plan guards;
they do not execute PostgreSQL. The Stage 1 runner also parsed conversation
`0018` as six statements. `git diff --check` passed. The earlier unrelated
control-boundary mock failures remain as recorded in the initial checkpoint.
Independent repair review found both SQL source defects resolved and no new
blockers in those changes; native PostgreSQL qualification remains open.

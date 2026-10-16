# Fable lane RETENTION: retention ledger, startup composition and restore fence (16 October 2026)

- **Branch:** `fable/live-retention-20261016`.
- **Base:** `fable/live-base-20261016` @ `48a27c8d` (package three plus the round-four repairs; candidate manifest g).
- **Acceptance criteria:** the audit README matrix row "Retention, deletion and restore; DA-1/4, data retention, SEC-REL-05"; the retention/restore sections of `data-artifacts-report.md`; SEC-REL-05 in `security-release-report.md`; and the PACKAGE3 reviews (dot audit branch `dot/meri-comprehensive-audit-20261015`).
- **Preserved:** the DA-1/DA-4 source-safety fixes (lane `FABLE-DA-RETENTION-SAFETY-20261015.md`). Their tests pass unchanged; the only DA-adjacent edit is a new refusal code for a registered but unadmitted row class.
- **Not done:** purge stays inactive. No deployment, AWS action, migration execution, credential, paid build or model call.

## Implementation outline

| Responsibility | Canonical owner | Interface |
|---|---|---|
| Complete data-class inventory (owner, subject kind, tables, deletion path, retention rule, serving rule) | `apps/control/retention/data-classes.mjs` (new; pure data) | `dataClasses`, plus derived `policyClasses`, `retainedClasses`, `externalRequestClasses`, `rowTargetClasses`, `rowTargetSubjectKind`, `plannedClasses` |
| Reference enumeration with an exact row target for every row of every row-target class | `inventory.mjs` (vocabularies now derived from the registry) | `enumerateReferences` (new optional snapshot fields: `receipts`, `schedules`, `memoryProposals`, `budgetRuns`, `editorDrafts`) |
| Policy completeness (every active class; retained classes never purgeable) | `policy.mjs` | `parseRetentionPolicy` |
| External-data block | `purge.mjs` `planPurge` | block `EXTERNAL_DELETION_UNAVAILABLE` |
| Row owner admission | `postgres-journal.mjs` row routing | `RETENTION_ROW_CLASS_UNSUPPORTED` at preflight; `rowClasses` export |
| Restore serving fence | `serving-fence.mjs` (new) | `createServingFence()`: `isEnabled`, `disable(reason)`, `enable({watermark})`, `observe`, `verify(read)`, `state` |
| Recovered watermark port; projection and ledger wrappers | `recovery-watermark.mjs` (new) | `createMemoryWatermarkStore`, `watermarkedJournal`, `acknowledgedLedger` |
| PostgreSQL watermark adapter (proposed table) | `postgres-watermark.mjs` (new) | `createPostgresWatermarkStore({journal})` → `read`, `advance`, `record` |
| Settled reconciliation records and verifies the watermark; works with no purge owners | `reconciliation.mjs` | `createRecoveryReconciler({..., watermark, storage:null, facts:null})` |
| Startup composition | `startup.mjs` (new) | `createRetentionStartup({journal, watermark, ledgerSink, ownership, purge:{enabled}, now})` → `serving`, `journal`, `ledger`, `gate`, `suppression`, `purge`, `reconciler`, `recover`, `ensureServing`, `start`, `state` |
| Trusted control composition | `apps/runtime/control.mjs` `retentionGate`, readiness; `config.mjs`; `product-applications.mjs` | `retentionLedgerSink` product port; `retention.purge` accepts only `{enabled:false}` |

- **Dependency direction:** `startup → {ledger, suppression, reconciliation, purge, serving-fence, recovery-watermark}`, then `→ inventory → data-classes`, all over `boundary`. `apps/runtime/control.mjs → startup, postgres-watermark, postgres-journal`. There are no cycles. Nothing new imports conversation or artifact private modules.
- **Import safety:** importing any of these modules performs no I/O and allocates nothing.

## What was built, and what it closes

| Audit or review item | Status after this lane |
|---|---|
| README "Retention…": *authoritative ledger/reconciler/purge startup* | Built. `createRetentionStartup` is the one startup owner, and control composes it whenever retention is declared. Readiness checks the projections, then `ensureServing()` reconciles from the ledger before anything is served. |
| *Keep purge inactive until safe; explicit disabled switch; nothing purges while disabled* | Built. `purge.enabled` is required by the startup owner. While it is `false`, no deletion owner is composed, and `execute` and `recordBlocked` refuse with `RETENTION_PURGE_DISABLED`. Runtime configuration accepts `retention.purge` only as `{enabled:false}`. Recovery over recorded purge entries with no storage owner keeps every step `UNKNOWN` and deletes nothing. A test proves zero storage deletes and zero row purges, against the same plan deleting once the switch is on and every owner is bound. |
| *Restore serving fence and recovered watermark* (data report: "createServingGate starts open"; "readiness checks table presence and that open local flag") | Built. The fence is closed from construction and opens only with a watermark that a settled pass recorded and read back exactly. Every served read verifies the persisted watermark against the highest position this process projected. A restore underneath a running process is refused from its first read, and a restart over a restored backup is fenced until replay. |
| *Preflight of all targets before any deletion step* | DA-1 preflight is preserved. Preflight now also covers every registered row class: on the applied schema, a complete conversation plan refuses at preflight with zero storage, row or ledger effects, rather than deleting bytes and leaving rows. |
| *Complete data-class inventory* | Built. The registry has 17 classes; each has an owner (or a named pending owner), a deletion path, a retention rule and a serving rule (detail below). |
| *Suppression-before-serving across all classes* | For conversation and artifact subjects, every served read is verified by the startup gate. The registry test checks each served class's owner source for the gate. Gaps are declared instead of hidden: schedules (`subject-unsupported`), and the SDK session store, which is served only to admitted runs. |
| *Per-step uncertainty; UNKNOWN never deleted; safe database lease disposal* | DA-1/DA-4 behaviour is unchanged. New UNKNOWN barriers: a lost ledger acknowledgement closes the fence (`RETENTION_LEDGER_UNKNOWN`), and so does an unknown watermark advance (`RETENTION_WATERMARK_UNKNOWN`). The watermark adapter runs through the journal's bounded `tx`: a lost COMMIT is `RETENTION_COMMIT_UNKNOWN` and the lease is retired. |
| SEC-REL-05 (migration inventory, startup owners, readiness) | Partly. Retention's startup owner and readiness are composed, and the migration request lists the exact new DDL. The deploy manifest itself is outside this lane. |

### Data-class inventory

| Class | Owner | Subject | Deletion | Rule | Serving |
|---|---|---|---|---|---|
| `conversation` (conversations, runs, controls) | conversations/postgres-store | conversation | row-target | policy | read gate (conversations/service) |
| `events` | conversations/postgres-store | conversation | row-target | policy | read gate |
| `lifecycle` (checkpoints) | lifecycle/journal | conversation | row-target, plus objects | policy | admission (lifecycle reads gated history) |
| `completionCheckpoints` | completion-journal | conversation | row-target, plus objects | policy | admission |
| `nextRuns` | next-run-journal | conversation | row-target | policy | admission |
| `sdkSession` | native-authority/session-owner | conversation | row-target (admitted on PostgreSQL) | policy | admission |
| `selectedOutputs` (and selected reads) | runtime/selected/ledger | conversation | row-target, plus objects | policy | read gate |
| `nativeJournals` | execution-journal | conversation | row-target | policy | not served |
| `artifactVersions` (versions, heads) | artifacts/storage/postgres-versions | artifact | row-target (admitted on PostgreSQL), plus objects | policy | read gate (artifacts/service) |
| `uploads` | pending: chat attachments (not yet implemented) | conversation | object-version | policy | not served |
| `receipts` (command, approval, issuance, task-lookup) | commands/postgres-command-journal | conversation | row-target | policy | not served |
| `schedules` | schedules/postgres-schedule-owner | schedule (unsupported) | row-target | policy | subject-unsupported |
| `memoryProposals` | gateway memory-proposals source | conversation | external-request (blocks) | policy | external |
| `budgets` | gateway/budget/postgres-budget-store | conversation | retain | policy-retained | not served |
| `logs` | runtime CLI output | conversation, artifact | retain | policy-retained | not served |
| `telemetry` | runtime/telemetry/redaction | conversation, artifact | retain | policy-retained | not served |
| `editorDrafts` | planned: Office editor (Q-O9) | artifact | row-target | policy (7 days, owner decision) | read gate (planned) |

## Intentional behaviour changes

1. **Retention policies must configure the new active classes.** These are `schedules`, `receipts`, `memoryProposals`, `budgets` and `telemetry`. Retained classes cannot be `purgeable`, and the planned class cannot be configured. No deployed policy exists.
2. **Conversation inventories carry more row targets.** There is now a row target for every conversation row class, not only the SDK mirror. Artifact subjects no longer enumerate conversation `events` rows. Inventory and plan hashes change accordingly.
3. **The PostgreSQL row owner refuses unadmitted classes.** It refuses every row class except `sdkSession` and `artifactVersions` with `RETENTION_ROW_CLASS_UNSUPPORTED`. On the applied schema, a complete conversation purge therefore refuses at preflight. Previously it would have reported `EXECUTED` while leaving conversation, event, checkpoint and journal rows.
4. **Declared retention needs the ledger sink and the watermark table.** Without `retentionLedgerSink`, readiness fails with `RETENTION_LEDGER_UNAVAILABLE`; without the proposed watermark table, it fails with `RETENTION_SCHEMA_UNAVAILABLE`. Both were previously served open. The prepared candidate admits no product ports, so it cannot declare retention until a sink binding exists.
5. **Each served retention read costs one extra single-row watermark read.**
6. **Test-only changes:**
   - The fixture's artifact snapshots no longer include conversation runs.
   - One planning assertion that encoded the incomplete target set is corrected.
   - The real-PostgreSQL suite narrows inventories to the admitted classes (`admitted()`) so it keeps exercising the amended row paths, and adds a refusal test for complete inventories.
   - `download-links-mount` supplies a sink, and its synthetic lease answers only retention statements.
   - `prepared-candidate-startup` asserts the fenced composition, and it closes any runtime that unexpectedly starts.

## Files

- **New:**
  - `apps/control/retention/data-classes.mjs`, `serving-fence.mjs`, `recovery-watermark.mjs`, `postgres-watermark.mjs`, `startup.mjs`.
  - Tests `data-classes`, `deletion-all-classes`, `startup-restore` and `postgres-watermark` (all `.test.mjs`).
  - `docs/coordination/proposals/FABLE-RETENTION-MIGRATION-REQUEST-20261016.md` and this report.
- **Changed:**
  - `apps/control/retention/`: `inventory.mjs`, `policy.mjs`, `purge.mjs`, `postgres-journal.mjs`, `reconciliation.mjs`, `index.mjs`, `test/fixture.mjs`, `test/planning-execution-recovery.test.mjs`, `test/postgres-journal-pg.test.mjs`.
  - `apps/runtime/`: `control.mjs`, `config.mjs`, `product-applications.mjs`, `test/download-links-mount.test.mjs`, `test/prepared-candidate-startup.test.mjs`.

## Checks (Node v24.22.0; dependencies installed with `npm ci --ignore-scripts --no-audit --no-fund` for every lock in the clean-checkout list)

| Check | Base `48a27c8d` | This branch |
|---|---|---|
| Retention suites without PostgreSQL (`apps/control/retention/test/*` except `-pg`) | 26/26 | 45/45: data-classes 5, deletion-all-classes 4, ledger-suppression 2, planning-execution-recovery 8, policy-inventory 3, postgres-journal-lease 6, postgres-watermark 3, purge-safety 5, startup-restore 7, storage 2 |
| Runtime `npm test` (`apps/runtime`) | 234/241 | 234/241, the same 7 host failures (below) |
| Runtime `npm run typecheck` | pass | pass |
| Retention dependents: conversations `retention-serving`, artifacts `artifact-retention`, document-application `retention`, runtime artifacts `download-links`, conversations skills `retention`, local-baseline `dependency-ownership` | 50/52 | 50/52, the same 2 host failures |
| Control core `apps/control/test/*` | not rerun | 260/260 |
| Source proof (`source-proof.test.mjs`) | 5/5 | 4/5: fails only on the two hashed rows below |

The 7 runtime host failures, identical on base and branch:

- the Docker-filtered image closure: no Docker daemon;
- the issuance "claim" and "issuer" checks: `connect ENOENT` on the task-owned PostgreSQL socket;
- three "actual runner" checks: `RUNNER_AMBIENT_CREDENTIAL_REFUSED`, because `npm test` was run directly with this host's ambient proxy environment rather than through the local-baseline runner's environment scrub;
- the bootstrap-file "release" check: `RUNNER_BOOTSTRAP_FILE_REFUSED` under UID 0.

The 2 dependent failures (document-application retention, and the download-links "real canonical owners" check) need the Codex-host Python path `/opt/codex/runtimes/.../python3`. Without it the generator returns 502, or the budget settlement is `UNKNOWN`. Both are listed under `knownHostRequirements` in the local-baseline README.

### Reverted-fix proof

Each fix was temporarily reverted in the working tree, the named suites were rerun, and the source was restored. The scripts are in the session scratchpad.

| Fix reverted | Tests that fail |
|---|---|
| Fence starts open | 4 startup-restore tests |
| Served gate skips the per-read watermark check | restore underneath a running process; restart over a restored backup |
| Recovered watermark not read back after recording | restart test (misreading store) |
| Lost ledger acknowledgement leaves serving open | transactional-faults test |
| Unknown watermark advance leaves serving open | transactional-faults test; PostgreSQL-watermark journal test |
| Inventory emits row targets only for `sdkSession` and `artifactVersions` (pre-lane) | 3 deletion-all-classes tests; data-classes enumeration test |
| Memory proposals do not block | memory-proposals block test |
| Retained class may be purgeable | data-classes policy test |
| Planned class carried silently | data-classes enumeration test |
| Runtime configuration admits purge on | prepared-candidate-startup retention test |
| Runtime readiness skips reconciliation (pre-lane open gate) | prepared-candidate-startup retention test (startup succeeds where it must fail closed) |

## Not run, and why

- **Real PostgreSQL** (`postgres-journal-pg.test.mjs`, 8 tests): **UNRUN**. There is no task-owned cluster, and the brief forbids migration execution. All 8 fail on `connect ENOENT /tmp/meri-broker-pg-socket-20261014`. The file was edited without being run against a cluster:
  - inventories are narrowed to the admitted classes in four places;
  - the artifact object count assertion changes to 2;
  - there is one new refusal test.

  dot should run it on a provisioned cluster.
- **The PostgreSQL watermark adapter against a real engine:** UNRUN. Its table is only proposed (no allocation), and its tests use a synthetic injected pool.
- **Real S3 deletion and absence semantics:** UNRUN (no bucket or authorization). Only the in-memory synthetic bucket was used.
- **Network or driver faults:** UNRUN. Lease faults are injected at the pool or client level.
- **A write-once ledger sink:** none exists. The in-memory sink is synthetic.

## Proposals for dot

1. **Migrations.** See [FABLE-RETENTION-MIGRATION-REQUEST-20261016.md](../proposals/FABLE-RETENTION-MIGRATION-REQUEST-20261016.md):
   - (A) the `meri_conversations.retention_recovery_watermark` table;
   - (B) row-class deletion amendments for the conversation-scoped classes. This includes dropping the `retention_subjects → conversations` foreign key so that a subject tombstone survives its own purge.

   No IDs are requested by number.
2. **Ledger sink binding.** Declared retention needs a trusted `retentionLedgerSink` (the shipping owner's write-once store).
   - Outside the prepared candidate, it is a product port (`append`, `read`).
   - The prepared candidate admits no product ports, so its binding (configuration-compiled, like `multiRunOwners`) needs a decision. Until then, declared retention fails readiness closed.
3. **Suppression owner in control.** The startup owner composes the suppression owner only when given trusted `ownership` (for example `postgres-journal.ownerOf`). Control does not yet expose suppress or release routes, nor a cancellation port. That route belongs with the startup or product-routes owner.
4. **New subject kinds and the external path.**
   - Schedules need their own `schedule` subject kind (a journal table pair, a read gate in the schedule owner and row routing). Until then they are declared `subject-unsupported`.
   - Memory proposals need a deletion port to the source owner; until then their plans block.
5. **Atomic watermark advance.** Optionally, advance the watermark inside the projection transaction in the PostgreSQL journal (`retention_subjects` writes), so that a failed advance can never close the fence. That is an availability improvement, not a safety one.

## Residual risks

- **Snapshot producers.** The registry fixes the class set, but no product owner composes the snapshot producer (`facts.inventoryFor`) for receipts, schedules, budgets or memory proposals. The producer's completeness is a separate integration task. The inventory can only be as complete as the snapshot it is given.
- **Row key mapping.** For `completionCheckpoints`, `nextRuns`, `selectedOutputs` and `receipts`, the key columns differ from the table primary keys (see the migration request). The routing must be confirmed when the amendments are authored.
- **Fence availability.** A closed fence refuses every retained read until the next readiness probe reconciles. This is fail-closed by design, but a flapping ledger sink or watermark store would make the product unavailable.
- **SDK session store.** It is served to already-admitted runs without its own gate check. Suppression relies on cancelling in-flight runs and on the gated admission of new runs.

## Hashed source-proof rows changed

The source proof fails only on these rows: a full scan of the 45 candidate-manifest-g rows against the working tree finds exactly 2 mismatches. No candidate manifest was created.

| Path | Old SHA-256 (manifest g) | New SHA-256 |
|---|---|---|
| `apps/runtime/control.mjs` | `399698afaa8cac6851f9f40590b1bbf0173e73541125a6b25be65af75ad18ee0` | `ec63730199cbc092042dab6b6694506087530ee85572e1daadfb478bf76c5757` |
| `apps/runtime/config.mjs` | `3a1a136ddeccac2983040113c9de16a91110a70178964da601c839db8f169b71` | `9558183a7eab179d3b66d2b1d65707a0f495f882b3aa03e8b04b029942c6685d` |

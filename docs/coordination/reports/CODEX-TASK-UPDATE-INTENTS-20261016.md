# Governed conversational task updates

Task owner: Codex task-6. Pinned base: PR98 `caa7810ff19c09c8f7ea1c2524c025f36f99ccd6`.
Branch: `codex/meri-product-features-task6-20261016`. Dedicated sparse checkout; borrowed dependencies only.
Read AGENTS.md, implementation standards, continuation guide, scope/ownership ledgers and package-four handoff.
No `.agents/skills` directory exists in this Meri source. Disk initially 1.6 GiB free; no dependency installs or archives.

## Implementation outline

- Close the task.update part of P-INT-7. Canonical private task-update validators own normalization and correlation;
  the existing command executor owns approval, fresh authority, budget, journal and effects. Existing source owns the fixed
  `POST /clio/tools/update_task` projection. No new schemas, grants or migrations.
- Extend approval metadata through one task-kind codec and the existing persistence/lifetime owner. Preserve the task-create factory;
  add a task-update factory. Persisted action discriminants select the codec; reads must match the requesting owner's action.
- Extend command intent preparation and the worker's owner-backed catalog. Preparation stores an immutable proposal, never executes.
- Add a bounded task-update Fetch application for approval/execution, separate from recommendation-specific task-create sessions.
  Trusted session resolution supplies current binding, exact command options and execution issuance; browser fields supply no authority.
  Reuse canonical command transport body/error helpers. No shipment runtime mount or gateway changes.
- Owned paths: `apps/control/commands/approval-metadata/{binding,owner,index,task-kind}.mjs`, new metadata tests,
  `apps/control/intents/command-preparer.mjs`, new task-update intent/application modules and tests,
  `apps/worker/conversation/intents/catalog.mjs` and focused tests, suite inventory, this report.
- Verification: prepare-only, exact approved execution through native HTTP serialization, mutation/binding/approval denial,
  replay and unknown effects, task-create regressions, independent source review. Local transport/SQL doubles are synthetic;
  real PostgreSQL, native credentials/authority, SDK model turn and startup mount remain qualification holds.
- Deadline: bounded implementation/check/review turn; no background schedulers or external actions except reviewed source draft publication.

## Results

Implemented the task-update part of P-INT-7. `task-kind.mjs` owns the two existing canonical task codecs; the shared metadata
owner/store retain immutable proposals without a schema or migration change. The task-create factory remains compatible.
The preparer and SDK catalog now expose `propose_task_update` only when its real owner is composed. The worker admits the canonical
private `0.2.0` update proposal rather than incorrectly passing it through the public task-create validator.

`createTaskUpdateServices` composes the existing metadata owner, SQL command journal, durable budget producer/executor and actual
fixed Core HTTP source. `createTaskUpdateFeature` explicitly opts into that composition, the canonical PostgreSQL intent journal,
worker intent port and task-update Fetch API. `enabled:false` returns null without constructing ports. Source execution defaults off.
The host's existing session resolver and approval store retain all authority. Preparation cannot approve or execute.

The API validates exact task/patch/proposal/execution identity. Fresh session/authority bindings may advance attempt, worker and writer
fence while retaining the original immutable approved proposal in the same tenant/actor/conversation/run. Exact current binding is
still required for preparation. Replay does not dispatch another native update; lost native acknowledgements remain UNKNOWN.
No runtime, image recipe, gateway, frozen contract, lockfile or migration was changed. No dead code was removed.

### Verification

- Explicit bundled Node `v24.19.0`, borrowed dependency junctions, `MERI_REVIEW_SOURCE_ROOT` set to this checkout.
- Final focused command/metadata/intent/API/SDK/catalog/private-contract/task-create regression run: **209/209 passed**.
  The 16 new cases include the actual durable composition and opt-in Fetch API, normalized native JSON, original/resumed authority,
  exact approval, hostile binding/patch/hash, source disabled defaults, metadata action confusion, replay and UNKNOWN.
- New `control-task-commands` suite discovery resolves its HTTP test; existing globs discover other new tests. Syntax and diff checks pass.
- Independent Codex reviewer `/root/independent_review`: **ACCEPT for draft source publication**, no remaining implementation findings;
  39 independently rerun focused checks passed, including all 16 new cases. Two resume restrictions found during review were fixed
  and separately tested through the actual HTTP and durable composition paths.
- Initial source-only test launches exposed sparse missing tracked imports. These were materialized without dependency installs;
  final focused checks passed. The first combined run retained 187 pass / 1 sparse-import failure; its corrected run is 209/209.
- Broader schedule-preparer tests retain **seven existing fixture-expiry failures**. Their schedule clock is `1900000000000`, while
  the shared fixture expiry comes from the 2026 command clock. Reproduced read-only in the unchanged source checkout.
- The broader worker options file loads after source/dependency reuse, but retains **three existing failures** (`RUNTIME_CONFIGURATION`
  twice and `STORE_UNAVAILABLE` once), reproduced in the unchanged checkout. These owners were not modified.
- Full repository inventory/typecheck/build, real PostgreSQL/Temporal/Core, SDK model turns and browser qualification are UNRUN.
  Local SQL/identity/Fetch fixtures are synthetic. No live authority, native idempotency or deployment acceptance is claimed.

Raw successful/failed local receipts are preserved outside Git in task-6/validation-evidence. No heavy archives were created.

### Shared integration proposal and coordination blocker

The default and explicitly selected `durable`-host messages to coordinator `01a0ff18-26cd-7609-beba-87726d0300c6` both returned
`thread not found`; neither message was delivered. This is a coordination hold, not a denied source change. Existing shipment
checkouts and PR98/PR60 remain untouched. PR60 was read at `67d4574ddc6615ea8defb29275c01e7acfb96281`, newer than the delegation pin.

Reserve the following narrow post-shipment integration before editing shared owners:

1. `apps/runtime/product-applications.mjs`: capture optional borrowed `taskCommandApplication.handle` and dispatch only exact
   `/api/task-commands/prepare` and `/api/task-commands/execute` paths, otherwise 503. No `control.mjs` route change is necessary:
   its existing `products.handle` dispatch already precedes conversation fallback. Keep the source gate and runtime origin policy.
2. The runtime session/worker composition owner must provide genuine session resolution, exact original command context, current
   executor binding/capability, preparation policy, current approval store, reviewed budget allocation/grant, native credentials,
   SQL pools and intent result-release authority. Bind the grant with `commandExecutor.bindTrustedGrant`; pass feature `intents`
   through the existing worker `governedIntents` port and policy. No fixture can supply those product owners.
3. The public-contract owner must review/export the task-update receiving schema and proposal type before frontend integration.
   Current `@capiro/meri-contracts@0.1.7` has no task-update public export. The frontend's existing action application DTO is
   task-create specific; copying this private DTO would violate repository ownership rules.
4. With those reservations, extend the existing desktop approval presentation and authenticated frontend API gateway in a separate
   sparse frontend branch. Reuse the canonical approval store; add no second approval decision system. Keep all defaults held.

Actual shared runtime mounting and frontend wiring are therefore **pending**, beyond this reviewed source milestone. Native database,
authority, model and end-to-end qualification remain separate activation holds. No AWS, credentials, SQL, deployment or service
configuration action occurred.

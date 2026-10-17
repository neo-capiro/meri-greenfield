# Meri product features: portable Fable handoff

Safe-stop: 17 October 2026. Neo asked to stop Meri at a useful checkpoint and commit everything needed by Fable on another machine. This assignment supersedes the earlier repository wording about who continues engineering. Fable owns Meri; dot retains Core/frontend coordination and E2E, with explicit coordination for any Core activation. Feature implementation, activation and database execution are stopped. This transfer contains reviewed source, reproducible inputs, sanitized evidence and explicitly unfinished proposals. It does not change a shipment candidate or grant a new execution window.

Primary coordinator: [portable shipping handoff](https://github.com/neo-capiro/meri-greenfield/blob/handoff/meri-portable-fable-20261017/docs/handover/20261017/fable-shipping/FABLE-SHIPPING-HANDOFF.md), planned branch confirmed by its owner; publication was pending when this document was authored. Its new source starts at `6fd48c9c3d49962a111e7f801f9f71ad06a7f1c9`. The [older published checkpoint](https://github.com/neo-capiro/meri-greenfield/blob/88620c95ce19d6ec9dd6b34b3cf8b4160bcd3ed5/docs/handover/20261017/fable-shipping/FABLE-SHIPPING-HANDOFF.md) remains historical evidence; its previous ownership block does not override Neo's transfer. Confirm the primary owner's final immutable pin before release work.

## Where the complete transfer lives

- [SOURCE-PINS.json](SOURCE-PINS.json) contains full published heads, trees, reviewed bases, target branches and local-to-remote tree bindings for all seven feature/evidence PRs.
- [Frontend handoff](https://github.com/neo-capiro/capiro-frontend/blob/b12978025858aac65169661e3bf04f13c3ab3faa/docs/meri-product-features-20261017/FABLE-HANDOFF.md) contains UI source ownership, native proxy contracts, exact test commands, screenshots, package/build receipts and remaining consumer proposals. Draft [PR65](https://github.com/neo-capiro/capiro-frontend/pull/65) head is `b12978025858aac65169661e3bf04f13c3ab3faa`, tree `b66ace4b2f1443d2a9ead4c352a7dd47669e3231`, based on PR63 `1c0c059466963a3a5b4757d05f44701eb2007347`; remote commit/tree/parent were read back exactly.
- [PostgreSQL history and sanitized receipts](../../../qualification/user-preferences-20261017/README.md) retain every failed/blocked attempt, actual cleanup and unrun checks. [Portable runner instructions](../../../../scripts/qualification/user-preferences/README.md) preserve the future wrapper as **REVIEWED_HOLD / DO NOT RUN**. Its database execution is unverified, and independent review found an unresolved absolute-window guard defect.
- [Pending proposals](PENDING-PROPOSALS.md) records the memory consumer/public DTO allocation, task-source activation, PG fixture correction, stack integration, routines and document follow-through. Nothing in that file claims implementation.

No required source, evidence, build input or continuation instruction depends on a former workstation path, local Git alternate, temporary file or dependency junction. Commit-local paths in older reports describe their authoring context; use the published pins and portable commands here instead. Keep private logs, credentials, cluster files and historical build output out of Git.

## Published source stacks

All seven PRs were open drafts at source readback. None was merged or activated. Target branches can advance independently; preserve the reviewed parent in SOURCE-PINS.json when evaluating later integration.

| Deliverable | Immutable published head | Reviewed base |
|---|---|---|
| [Meri PR100: governed task-update API/intents](https://github.com/neo-capiro/meri-greenfield/pull/100) | `78fbd3ae813fcf3fe286969e76102353c3a2eed2` | `caa7810ff19c09c8f7ea1c2524c025f36f99ccd6` |
| [Meri PR102: task runtime/public contract](https://github.com/neo-capiro/meri-greenfield/pull/102) | `cc43d0004be59f315658207405ff1aea126adad5` | `78fbd3ae813fcf3fe286969e76102353c3a2eed2` |
| [Frontend PR61: desktop task updates](https://github.com/neo-capiro/capiro-frontend/pull/61) | `bd9e0d03c54ef4fbb57010c3b97cfb3d77bdf2b9` | `ba95f63b4ec98078547958e32833e791be77a656` |
| [Meri PR108: preferences API/CAS/audit/public contract](https://github.com/neo-capiro/meri-greenfield/pull/108) | `9fe0b0857f0284cf460effab34b17fda21c5621d` | `caa7810ff19c09c8f7ea1c2524c025f36f99ccd6` |
| [Meri PR111: actual preferences runtime/reserved SQL/PG suite](https://github.com/neo-capiro/meri-greenfield/pull/111) | `10da73795ab5789cb5724d0db45db50bdecb5da3` | `9fe0b0857f0284cf460effab34b17fda21c5621d` |
| [Frontend PR62: preferences UI/native proxy](https://github.com/neo-capiro/capiro-frontend/pull/62) | `9e6d80843b0a46a862f7613b4ab9b08d925d7b17` | `e0b47a34d00b8c181420188ed39a1d849e25ec0a` |
| [Frontend PR63: complete package/build evidence](https://github.com/neo-capiro/capiro-frontend/pull/63) | `1c0c059466963a3a5b4757d05f44701eb2007347` | `9e6d80843b0a46a862f7613b4ab9b08d925d7b17` |

Task updates and preferences are independent stacks rooted at the PR98 runtime source. PR111 contains preferences, not task PR100/102. Frontend PR63 contains preferences, not PR61. The handoff PRs add documentation, sanitized receipts and portable qualification tooling over PR111/PR63; they do not merge those independent features. A receiving owner must allocate and review a combined integration branch, including shared runtime composition, public package exports, test discovery and frontend registry/package changes. Do not cherry-pick a remote commit onto its local metadata-equivalent parent without considering tree equality and ancestry.

Shipment owners retain their first-chat/image/infra branches. A later read-only PR60 observation was `8fd2c4c4556e5fed37da012293a4f1b4d2088d14`, based on `2a6b817fb27aa9524ab5036a5b8e1bf0955a26c8`; this lane did not change or qualify that advancement. Primary release ownership controls the actual candidate. Do not infer a new shipping source from this feature table.

## Task-update implementation and remaining native composition

Canonical API modules are `apps/control/task-command-application/{feature,http,index,native-session,session}.mjs` on PR102. They compose the existing opaque action session, approval, command metadata/executor, PostgreSQL journal, durable budget and fixed Core `update_task` source. Worker intent preparation performs no task mutation. A task update permits an existing task ID and optional title/status/dueDate patch, freezes the original proposal/hash, and requires the existing separate approval owner. A fresh attempt can use current worker/fence authority for the same stable tenant, actor, conversation and run without replacing the proposal identity. No second approval system or browser approval-decision API was introduced.

POST `/api/task-commands/prepare` receives `{arguments}`. POST `/api/task-commands/execute` receives `{proposal}`. The native session adapter rechecks correlation, selected scope, expiry and current membership around preparation/storage/capability issuance/execution; storage or observed native effect withheld after access loss keeps an explicit known disposition. Lost acknowledgement remains UNKNOWN. Reconciliation/replay uses the same canonical command identity and never prepares a replacement write automatically.

`apps/runtime/product-applications.mjs` mounts exactly those paths only when supplied a trusted `taskCommandApplication` and `configuration.sourceEnabled === true`; missing/disabled composition returns closed503 without dispatch. The source configuration validator in this source accepts only false, so an enabled validated task runtime is still held. The owner must explicitly allocate the reviewed source-access/authority composition rather than silently flipping this policy. Journals, budgets, approval/capability owner and fixed Core source must be qualified together. Shared gateways and initial-chat host are outside this lane's edits.

Frontend `/meri/task-updates` is implemented in PR61 and defaults off behind literal `MERI_TASK_COMMAND_WORKFLOW_ENABLED=true`. The server uses native Clerk admission plus the existing opaque session bearer; browser selected client or owner fields establish no authority. Public receivers come from `@capiro/meri-contracts/task-command-application` and the exact four generated files pinned to PR102 in `@capiro/meri-client/task-commands`. The backend package baseline0.1.7 and frontend installed0.1.8 remain their separate historical versions; the additive application wire is0.1.0. Existing tarballs/lockfiles were preserved, not relabeled equal.

Source evidence: [PR100 report](https://github.com/neo-capiro/meri-greenfield/blob/78fbd3ae813fcf3fe286969e76102353c3a2eed2/docs/coordination/reports/CODEX-TASK-UPDATE-INTENTS-20261016.md), [PR102 report](https://github.com/neo-capiro/meri-greenfield/blob/cc43d0004be59f315658207405ff1aea126adad5/docs/coordination/reports/CODEX-TASK-UPDATE-INTEGRATION-20261016.md). Focused actual-source checks passed209/209, then48/48 integration and36/36 public receiving, all eight public strict TypeScript files and browser-like VM isolation. Independent source reviews accepted the exact trees, including revocation-race repairs. PR61 separately passed30 behavior,7 Node and4 desktop browser checks. Synthetic authority/SQL/Core boundaries remain labeled. Broader baseline retains seven schedule fixture-expiry and three worker-options failures; broader public tests had nine recorded environment/baseline failures. Native deployed Core/PostgreSQL/Temporal/task execution, model turns and task feature production build remain unqualified.

## Preferences implementation and activation boundary

Canonical domain/store: `apps/control/settings/{documents,user-service,service,postgres-store,save-metadata}.mjs`, reused through `user-application`. API POST `/api/settings/user/read` accepts `{}`; POST `/api/settings/user/save` accepts `{expectedRevision,preferences}`. Success contains `{owner:{tenantId,actorId},revision,preferences}`. Owner identity comes from the existing native Clerk/Core current-membership gate, rechecked before persistence and release. Core native `current.user.id` is the actor ID; the Clerk subject is not a substitute. This user-only application excludes tenant/admin routes and needs no tenant/platform capability owner.

Complete-document validation/defaults/timezone semantics have one canonical public/server owner. Initial writes claim by PK-specific INSERT ON CONFLICT RETURNING; updates compare revision and validate returned state. The store computes changed fields from the actual locked prior document in the same CAS/audit transaction. Services no longer pre-read a different revision. Revision conflict is explicit409. Lost write COMMIT acknowledgement stays UNKNOWN; acknowledged save withheld by lost membership reports RESULT_NOT_RELEASED. No automatic mutation retry occurs.

PR111 actually wires `assembleControl` using its borrowed pool, clock and captured `conversationMembership`. Closed control-only `userPreferences:{enabled:boolean}` defaults absent/false. Enabled startup requires membership and both reserved settings relations before listeners open. A bounded readiness adapter preserves serving through healthy pending checks, closes after latest failure and fences stale generations/retirement; it never closes the borrowed pool. Only the two exact public paths reach this application. Disabled/unready responses are closed503, private listener and neighboring tenant/admin paths remain excluded. Runtime readiness `settings.userPreferences` reports composition, not live acceptance.

Frontend PR62 implements `/settings/preferences` (alias `/settings/meri-preferences`) behind literal `MERI_USER_PREFERENCES_ENABLED=true`, native Clerk capiro-template bearer forwarding and independent Core `me.read` correlation. It consumes unchanged generated public0.1.0 files with PR108 provenance. The form edits theme/density/timezone and preserves the complete hidden notification/default-client fields. Theme/density preview only inside this panel. Global appearance, delivery and automatic client selection remain separate consumers.

The full attempted save is immutable. Conflict requires explicit reload. A scoped in-memory QueryClient journal fences UNKNOWN across navigation; unchanged revision/read failures cannot unlock. Matching next revision establishes current matching state; a higher differing revision needs explicit adoption without reapplying the old draft. Late/scope-replaced responses cannot release private data. Journals do not survive a full browser restart.

Source checks: PR108107passed/1explicit real-PGskip; independent backend78passed/1skip plus actual-store audit probes; independent public29+6 checks/all8strict TypeScript files. PR111 focused23passed, independent28 plus two adversarial lifetime probes, product-surfaces112passed/1legacyPGskip. Runtime typecheck and changed syntax passed. Two unchanged local-runner self-tests retain Windows/POSIX path failures. Frontend28behavior+11Node+5desktop browser passed, app/client types and scoped lint passed. These are actual implementation modules with synthetic external boundaries, not evidence of native persistent deployment.

## PostgreSQL outcome and exact block

The existing centrally reserved migration is `apps/control/settings/migrations/0001_settings.sql`, owner source `cf639d4707df0060524218c65d941834ed7ea2e3`, blob `048a834c4335f97aa5f8691afc3c310188ec4388`. Allocation ledger is pinned in SOURCE-PINS.json. PR111 adopted it byte-exact; no new ID/schema was invented. The runtime never applies it. Earlier PR108/report wording that no migration was allocated is superseded by this later inventory, not a reason to create duplicate DDL.

Neo explicitly approved the published source and a disposable synthetic localPG window at `127.0.0.1:55436`, up to20minutes. That original window ended at02:33:23UTC and conveys no future execution authority. Actual source was local `69a61c36b1b98e5bc02591f2b4a4c32f14b828cf`, tree `9f6df335b70b3c91a6ec1c9e71fd4a1dc0b9a1af`, exactly the published PR111 tree.

The real attempt02:16:50-02:17:24 started the owned PostgreSQL16.15 PID15816, created only the new synthetic database (OID16384), applied that exact SQL and provisioned narrow synthetic grants. One pure target guard passed. **All ten real-PG cases were cancelled by the suite before hook. None passed; dump/restore was unrun.** Schema setup is not privilege/concurrency/persistence acceptance. The owned server exited; data and temporary password file were removed;55436 was independently verified free. The existing5432 service and application databases were untouched. Initial disk-preflight, sandboxed startup and Git ownership failures remain in the sanitized history.

**The proposed diagnostic rerun was denied before execution by automatic approval review.** It cited earlier no-migrations/no-credentials restrictions and absent trusted approval for that exact retry. No workaround or further DB retry occurred. The prior cluster was already cleaned. Future correction/execution needs a new exact reviewed source, coordinated disposable allocation and explicit approval; keep the feature off meanwhile. Nothing remains pending or uncertain about this denied rerun's execution: it did not run. Real-PG qualification remains HOLD.

The fixture's `inet_server_addr()::text` comparison is statically defective because the cast includes a netmask; proposed `host(inet_server_addr()) AS address` preserves the strict loopback check. The original scrubbed failure cannot prove that was the only setup issue. **The correction is not applied.** It is recorded for review, not used to justify another run. The portable runner refuses this known source defect before allocation and has never executed a database. See its explicit guards, remaining platform limits and history before considering any future use.

Independent source review accepted the sanitized history but held execution of the new wrapper. Earlier deadline-result and process-identity findings were repaired. The remaining defect is direct `admin.connect` and setup/restored `query` awaits without absolute approved-window/reserve checks before each invocation. Fixed per-query timeouts do not prevent a slow sequence issuing new SQL after the cutoff. Preserve the wrapper as **DO NOT RUN**, repair this invocation-level window guard under a later bounded allocation, independently review the exact repaired source, and obtain fresh approval before any execution. Its inert syntax/help/argument/plan checks are not database acceptance.

## Fresh-machine source reproduction

Read current AGENTS.md, implementation standards and the primary shipping handoff first; the later human Fable assignment controls continuation ownership. Check free disk/memory, running task windows and repository owners. Use fresh task-owned checkouts and exact public source pins; preserve every release owner's checkout/candidate. On this machine only about5GB disk remained, so no duplicate dependency install, large archive or new build was performed for transfer.

Example source-only retrieval (choose the branch stack deliberately):

```sh
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/meri-greenfield.git meri-features
cd meri-features
git fetch origin codex/meri-user-preferences-runtime-task6-20261017
git checkout --detach 10da73795ab5789cb5724d0db45db50bdecb5da3
git rev-parse HEAD
git rev-parse 'HEAD^{tree}'
git status --short
```

For task updates, use PR102 branch/head from SOURCE-PINS.json in a separately allocated narrow checkout. Handoff documents/scripts are on the handoff PR's separately reported immutable pin, not retroactively part of the executed PR111 tree. Fetch that pin when inspecting these new artifacts. Frontend source/commands and complete vendor inputs are in its companion Git handoff. No local alternate, borrowed link or credentials from the old machine are needed.

Use Node24 (author24.19.0). Root Meri lock owns canonicalize5.1.0/Ajv8.20.0/pg8.23.1; runtime lock owns AWS3.1151.0/Temporal1.24.0/Hono2.1.5 and TypeScript5.9.3. On a new machine, allocate resources and install the chosen root/runtime lock scopes only under its continuation approval. For offline source work, inspect existing lock/materialized modules first and coordinate reuse. Never copy this machine's dependency overlays or treat their successful resolution as a release dependency closure.

Dependency resolver closure remains an explicit prerequisite. `apps/control/conversations/temporal-dispatch.mjs` imports `@temporalio/client` outside `apps/runtime`, while that dependency is declared only in the runtime package. Installing those scopes in isolation does not make sibling imports resolve from a common ancestor. Historical startup checks used a coordinated task-owned root dependency overlay. A new owner must prove a release-owned common dependency root or explicitly reviewed packaging before those startup commands; copying the old junctions is not a portable solution. This transfer does not silently repair dependency declarations/locks.

These are future receiver commands, not checks rerun during this safe-stop transfer. At PR111 with matching locked modules installed:

```sh
node --version
node --test apps/control/settings/test/service.test.mjs apps/control/settings/test/postgres-store-cas.test.mjs apps/control/settings/test/migration-source.test.mjs apps/control/settings/user-application/test/application.test.mjs apps/control/settings/user-application/test/feature.test.mjs apps/control/product-access/test/core-membership.test.mjs apps/control/product-persistence/test/transaction.test.mjs
node --test packages/contracts/test/user-preferences-application-public.test.mjs
node --experimental-test-module-mocks --test apps/runtime/test/user-preferences.test.mjs apps/runtime/test/user-preferences-startup.test.mjs
npm run typecheck --prefix apps/runtime
```

These named unit/source checks do not start the opt-in PG suite. Inspect each test's host assumptions before broadening. The existing local-baseline runner (`node scripts/qualification/local-baseline/run-suites.mjs --help`) and its README describe suites and host requirements; do not invoke all runtime/baseline suites on a shared/new machine without checking real SQL, Docker, Python, browser and one-shot evidence prerequisites. All failed/skipped historical outcomes remain recorded.

Public generated files are committed, versioned inputs; consuming/verifying them needs no regeneration. If regeneration is separately needed, the recorded backend is offline Rolldown plus json-schema-to-ts/TypeScript. `MERI_CONTRACT_BUNDLE_ROOT` must point to an installed tooling package root with matching Rolldown/TypeScript and `MERI_CONTRACT_TYPE_MODULES` to matching json-schema-to-ts/ts-algebra. Consult each `packages/contracts/*-application/README.md`; ordinary `--check` selects the recorded backend and refuses missing roots. Avoid silently regenerating with canonical esbuild/type compiler output or installing duplicate tooling. No toolchain or lock was changed here.

Frontend PR63's Node24 Next16.4 Webpack source build and complete package gate passed:11 historical records (including a repeated filename) plus four supplemental preferences files. The committed transcript/JSON/hashes are portable evidence. Its standalone build is **not deployable**: borrowed dependencies left27 externally traced omissions and two absolute next/shiki links. Default Turbopack was not qualified. Allocate a complete release-owned dependency tree and fresh affected build before release; do not copy the historical1.259GB output/cache. No new build was run for this handoff.

## Receiving-owner gates

Allocate one reviewed integration source for the independent feature stacks; preserve current first-chat/read/Objectives/Strategy/Planner ownership and primary shipping pin. Qualify canonical deployed Core membership, exact native token/session correlation and all data-access/approval boundaries. Preferences then needs reviewed SQL rollout, least privileges, real concurrent CAS/audit/unknown-result/restore/disposal evidence and actual authenticated browser read/save/readback. Task updates additionally need the reviewed source-access configuration and durable approval/journal/budget/Core execution combination. Closed defaults remain in force until those exact gates pass.

No AWS, credential retrieval, application migration, deployment or merge was performed by this transfer. Earlier source publication's migration concern was resolved by Neo's exact approval and PR111 now exists; the separate diagnostic PG retry denial remains unresolved. The portable wrapper is retained as REVIEWED_HOLD / DO NOT RUN, not evidence that its DB lifecycle has run. Report the next exact source/image binding and actual qualified/blocked outcomes to the primary handoff rather than promoting fixture evidence into shipment acceptance.

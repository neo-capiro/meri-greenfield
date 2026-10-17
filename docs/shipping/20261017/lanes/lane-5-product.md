# Lane 5 — memory, tasks, settings, routines, budget and model grants

| | |
|---|---|
| Owner | lane-5 session (Fable), reporting to the integration owner (lane 1) |
| Branch | `fable/meri-lane5-product-20261017` |
| Base | started on integration `0e38ef49` (root `59856683`); integration tips `3fa0325a` and `c11323a4` merged in (`af6bd393`, `fbcdedb9`) |
| Target | draft PR into `fable/meri-first-chat-receiving-20261017` (PR #133) |
| Coordination | meri-greenfield PR #121, comments headed "**Fable lane 5 →**" |
| Status vocabulary | as in [BACKLOG.md](../BACKLOG.md): `source` · `integrated` · `qualified` · `deployed` · `live-verified` |

Nothing in this lane is qualified, deployed or live. "integrated (lane)" means received on this lane branch with its focused tests passing; it reaches `integrated` only once lane 1 receives it into PR #133.

## What this branch contains

| Commit | What |
|---|---|
| `6fca187a` | Merge of accepted PR128 `6f315108` (stack PR113→115→116→117→120→124→128, with task PR102 and preferences PR111). One conflict, `apps/runtime/control.mjs`: kept root's Temporal fence, authorization owner and cleanup, and added PR128's preferences config compile and readiness-before-listen. |
| `af8bfb0d` | Merge of PR131 `2a247510` unchanged (SOURCE HOLD snapshot: late task factory, readiness state, fixture extraction, failing flow scaffold, seal and evidence). |
| `0503e8f2` | Routine 0/2 fixed at its cause (below), plus a construction-time hardening with a test that fails on the previous source. |
| `83c8f2c9` | Cherry-pick `-x` of dot's `83f1c6be`: allocated `apps/control/schedules/migrations/0002_occurrences.sql` (owner C, P-R4-1) and its static witness. PR128's schedule owner and service already used `meri_schedules.occurrences`, but no tree on this path had its DDL. |
| `af6bd393` | Merge of integration `3fa0325a` (D1 envelope and $2/run, material roles, CA trust, D2 migrations, renderers). Conflicts were adjacent additions only: budget reservation/settlement keep both the D1 envelope import and the occurrence cost scope; the CLI keeps the pinned server-CA worker gate and adds the schedule-worker refusal. No lane-1-owned file edited. |
| `fbcdedb9` | Merge of integration `c11323a4`, no conflicts. |
| `b99f22ec` | Explicit primary receiving for routines: `schedule-worker` config/CLI role (port of dot's `772cefd2`, closed by default) and control's Temporal `client` in the trusted `productPortsFactory` context. |

Root's first-chat facts are unchanged: no first-chat file was replaced wholesale, and the only first-chat-owned edits are the additive `control.mjs` merge resolution, the `client` field in the factory context, and the new `schedule-worker` role in `config.mjs`/`cli.mjs`. Every other role's validation and the preview gates for the existing roles are unchanged.

## Routine flow 0/2: cause and fix

`apps/runtime/test/product-routines-flow.test.mjs` failed both cases at the final cancellation approval with HTTP 502 `SCHEDULE_TOOL_FAILED` / `UNKNOWN`.

Instrumenting the two masking catch blocks (`tool-interface.mjs` → `schedule-lifecycle.mjs`; instrumentation reverted, not committed) gave `SCHEDULE_SDK_PORT` from `sdkMethod(connection,'withDeadline')` in `schedule-lifecycle.mjs` `rpc()`. The approved cancel runs `effect('cancel_run', cancelRuns)`, bounded by `workflowClient.connection`. The real `@temporalio/client` `WorkflowClient` extends `BaseClient` and carries `readonly connection`, so production composition is correct. The PR131 fixture, however, wrapped `client.workflow` as `{start, getHandle}` and dropped the connection. The refusal therefore came after the Temporal delete had been applied, and the lifecycle correctly recorded UNKNOWN.

- **Fixture fix:** the wrapper keeps the borrowed connection, as the SDK does. Both cases now pass with no assertion changed (2/2).
- **Production hardening:** `createScheduleLifecycle` now refuses a schedule or workflow client without `withDeadline`/`withAbortSignal` at construction. A mis-composed client then fails before any claim or effect, instead of leaving a mutated schedule UNKNOWN. Call-time resolution is unchanged. The new test fails on the previous source and passes on this one.

What this proves: the receiving composition (actual foreground factory, public routes, admission/journals, schedule service, worker activity, inbox history) is coherent over synthetic SQL, Core, Temporal, SDK and native-stop boundaries. It does not prove live PostgreSQL, Temporal, Core, the SDK provider or the image.

## Per-capability reconciliation

| Capability | On root `59856683` | Received here (source) | Status | Exact remaining blocker / owner |
|---|---|---|---|---|
| **Tasks** (governed task updates) | absent (`apps/control/task-command-application` 0 files) | PR102 lineage via PR128: `apps/control/intents/task-update-services.mjs`, `task-command-application/feature.mjs`, routes POST `/api/task-commands/{prepare,execute}`, public contract `@capiro/meri-contracts/task-command-application`; PR131 late `taskCommandApplicationFactory` (create/state, after sessions, only with `sourceEnabled===true`) | integrated (lane), default off | Trusted startup must call the canonical feature with actual sessions and bind a genuine executor grant (no second executor). `sourceEnabled` stays false in the first-chat config, a real activation gate. Frontend PR61 needs a root-origin guard on `MERI_API_BASE_URL` (non-root base → `/api/api/task-commands`); shared module, so dot's. |
| **Preferences / settings** | settings domain present (4 files), not mounted | PR111 via PR128: canonical POST `/api/settings/user/{read,save}`, `apps/runtime/user-preferences.mjs`, control-only `userPreferences` config, readiness before listeners, close hooks; migration `apps/control/settings/migrations/0001_settings.sql` adopted unchanged (allocated to B, blob `048a834c`) | integrated (lane), default off | PG qualification at `127.0.0.1:55436` **denied, not retried**. Needs Neo's approval of an exact isolated-PG command (none requested by this lane; local PG not needed for focused tests). Frontend PR62 composition is dot's. |
| **Memory** | governed producer present: `apps/control/memory/*` (candidate, producer, Core review client, journal, routes); not mounted | nothing new (PR128/PR131 carry no memory source) | source, unmounted | (1) `meri_memory.candidates` has **no migration ID** (M1 request, 16 Oct; asked again on PR #121). (2) Core M2 submit/status/read-target routes are unpublished (dot/Core); Core PR40's review APIs are consumer APIs, not the writer contract. (3) The review consumer waits on the Core parser `87e140a0`, whose publication was **denied and is not retried**. Mounting before (1)–(2) would only produce 503s, so it was deliberately not done. |
| **Routines / schedules** | lifecycle, owner, dispatch, occurrence barrier source; no foreground API, no worker, no occurrence DDL | PR120/124/128: foreground `createRuntimeRoutinesFeature` (POST `/api/routines/{prepare,approve,list,reconcile}`), `schedule-service.mjs` (4 owners, 3 activities, 13 relations), `schedule-worker.mjs` (= dot's `5aa13719` worker extended, not a second subsystem), job lifecycle/lineage/cancellation, inbox custody; occurrence migration `0002`; `schedule-worker` role | integrated (lane); flow 2/2 synthetic | The four trusted owners (`authority.authorize`, `runAdmission.admit`, `runControl.cancel`, `retirement.retire`) have no production composer. `createScheduledNativeAdmission` and `createScheduledRunProfile` have no production caller. Unattended firing needs the fixed-expiry routine grant: Core canonical grant/proof/revocation custody (dot/Core) plus whole-grant accounting by the budget owner ([proposal](../../../coordination/contracts/CODEX-ROUTINE-GRANT-PROPOSAL-20261017.md)). No routine create/manage UI and no public browser routine contract exist. The private `scheduled-conversation-receipt.mjs` has fixture consumers only and is left in place. Existing-data cleanup for old DISPATCHED-at-start rows is separate. |
| **Budget store** | `meri_product_budget` 0001 (per-run allocation, `budget id=1`) and 0002 (tenant monthly/concurrency) | PR128 `occurrence-cost-scope.mjs`, read inside the existing global budget lock by model reservation, model settlement, tool budget and native allocation admission; product namespace only | integrated (lane) | Single owner confirmed: no second ledger. **D1 approved by Neo and implemented by lane 1** (`d375d43d`, merged here): 64k/8k envelope; $2/run is the run allocation's `maxCostMicroUSD` 2,000,000; $25 is the `budget id=1` seed `cap_micro_usd` 25,000,000, which is non-resetting, so at most $25 per day. Routine occurrences draw on the same ledger and per-run cap, because `readOccurrenceCost` runs inside the existing global budget lock and callers still enforce the global/per-run caps. A true resetting daily cap would need a schema change and an allocated ID (not requested). |
| **Per-run model grants** | `model-grant-issuer.mjs`, `meri_conversations.model_run_issuances` (0015), budget grants in `meri_product_budget.grants` via product owner facts | unchanged | source (lane 1 qualifies) | Scheduled runs: the sealed occurrence allocation and fixed expiry must flow through prepared-run issuance, raw/whole facts, admission, replay and continuation. This is the prepared-run compiler/whole-facts path, owned by lane 1. Readiness truthfully reports `proxy.modelGrants: unavailable` and `schedules.dispatchWorker: separate-service-required`. |

### Primary config / CLI / control / compiler / whole-facts receiving

| Seam | State |
|---|---|
| Preferences control-only config validation, factory, readiness-before-listen, close | **received** (`config.mjs` `userPreferences`, `control.mjs`) |
| Task late factory with actual sessions | **received** (PR131); trusted composer still to write |
| Temporal `client` in the trusted `productPortsFactory` context | **received** (`b99f22ec`) |
| `schedule-worker` role in the validator and CLI | **received**, closed: no native capability, refuses product `tokenWriter`, refuses under `MERI_PRODUCT_PREVIEW_REQUIRED`, and the bare CLI refuses before secret reads without trusted owners |
| Trusted in-process `scheduleRuntimePorts` / routines composer | **not received**: needs the Core unattended-grant producer |
| Prepared-run compiler / whole facts for scheduled allocations | **not received**: lane-1-exclusive files (`prepared-candidate.mjs`, prepared-run issuer); exact requirement in the row above |

## Shared-file notices (for dot, PR #121)

- `packages/contracts/package.json` gains two exports (`./user-preferences-application`, `./task-command-application`, each with `/schema`) plus generator scripts. This comes from accepted PR128 and was not edited by this lane. The `dist` artifacts are unchanged from PR128, except PR131's task metadata SHA/size for `apps/runtime/product-applications.mjs`.
- No lockfile changes. No new migration ID was allocated by this lane. `schedules/0002` was already centrally allocated to C; it was received, not allocated.

## Tests (this host: Windows, Node 24.19; see host notes in the lane brief)

The results below were measured on the lane tree **before** the `3fa0325a`/`c11323a4` merges. After the merges the host's commit memory dropped to about 0.2 GB and `node` could not start (exit 127), so post-merge focused reruns are listed separately in "Post-merge focused results" as they complete. Files without a row there are unverified on the merged tree.

| Set | Result |
|---|---|
| PR128 accepted focused set (34 files) on the merged tree | 771/771 directly, plus `scheduled-job-workflow.test.mjs` 3/3 with `NODE_PATH=apps/control/conversations/node_modules` (`@temporalio/workflow` is not resolvable from `apps/control/schedules` without the image's layout) = **774/774** |
| `product-routines-flow.test.mjs` | **2/2** (was 0/2) |
| `schedule-lifecycle.test.mjs` | 35/35 (new construction test fails on old source) |
| `occurrence-migration-source.test.mjs` | 2/2 (static witness, not a SQL proof) |
| `schedule-worker-role.test.mjs` (new) | 3/3 |
| Memory `apps/control/memory/test` | 25/25 with `MERI_REVIEW_SOURCE_ROOT` |
| Full `apps/runtime` + `native-authority` suites | candidate 754 pass / 210 fail / 4 cancelled of 968 under exhausted host memory; the by-name comparison against the untouched base was **not completed** (baseline archive run broke on missing `docs/` fixtures, and full suites are now barred on this host). Not a pass claim. |

Run commands (from the repo root, after the module links described in the brief):

```bash
export MERI_REVIEW_SOURCE_ROOT="$(pwd -W)"
node --experimental-test-module-mocks --test --test-timeout=15000 apps/runtime/test/product-routines-flow.test.mjs
node --test apps/control/test/schedule-lifecycle.test.mjs apps/control/schedules/test/occurrence-migration-source.test.mjs
node --experimental-test-module-mocks --test apps/runtime/test/schedule-worker-role.test.mjs
```

The host's commit memory was exhausted for much of the session (commit headroom under 1 GB, several sessions' Node processes). Some multi-file runs had file-level failures that passed when rerun singly; those are environment, not product, and are listed below by name.

## Remaining tasks

1. Trusted startup composer for tasks: canonical feature, actual sessions, genuine executor grant (lane 1 owns startup; this lane can author it once the grant binding is decided).
2. Routine unattended authority: Core grant/proof/revocation producer (dot/Core); budget whole-grant accounting; then a composer for the four schedule owners and production callers for scheduled admission/profile.
3. Scheduled allocation through the prepared-run compiler and whole facts (lane 1).
4. Memory: migration ID for `meri_memory.candidates`; Core M2 producer routes; Core parser publication (denied, owner decision). Then mount the governed producer, default off.
5. Frontend (own `capiro-frontend` worktree): routine create/manage UI once a public browser routine contract is agreed; memory settings consumer after the parser pin. Task/preferences sibling composition and the non-root base guard are dot's.
6. Qualification: real PostgreSQL for settings 0001, schedules 0001/0002 and occurrence locking (needs Neo's approval of an exact isolated-PG command); Linux image run of the routine and preference suites.

## Acceptance for this lane

- Tasks, preferences: source-complete in Meri with passing focused tests; activation gated on `sourceEnabled` and a trusted composer. **Met at source level.**
- Memory: Meri producer source with passing tests; completion is blocked on (1)–(3) above. **Exact blockers recorded.**
- Routines: synthetic flow passes 2/2 at its real cause; live firing blocked on the unattended grant producer. **Met / exact blocker.**
- Budget and model grants: one canonical `meri_product_budget` owner, occurrence scope joined; D1 is approved and implemented by lane 1; the scheduled prepared-run receipt belongs to lane 1. **Joined at source.**

## Denied actions (unchanged, not retried)

- Preference PG retry at `127.0.0.1:55436`: not attempted, no local PG started.
- Core memory parser `87e140a0` publication: not attempted, not vendored.
- Scope-ledger blob `28865e43…`: not touched.
- No AWS writes, builds, SQL, credentials, listeners or DNS changes.

## Post-merge focused results (tree `fbcdedb9` or later, one file at a time)

| File | Result |
|---|---|
| `apps/runtime/test/product-routines-flow.test.mjs` | 2 pass / 0 fail |
| `apps/control/test/schedule-lifecycle.test.mjs` | 35 pass / 0 fail |
| `apps/control/schedules/test/occurrence-migration-source.test.mjs` | 2 pass / 0 fail |
| `apps/runtime/test/schedule-worker-role.test.mjs` | 3 pass / 0 fail |
| `apps/gateway/budget/product-model-budget.test.mjs` | 12 pass / 0 fail |
| `apps/gateway/budget/product-model-settlement.test.mjs` | 6 pass / 0 fail |
| `apps/gateway/budget/test/occurrence-cost-scope.test.mjs` | 36 pass / 0 fail |
| `apps/runtime/test/schedule-service.test.mjs` | 17 pass / 0 fail |
| `apps/runtime/test/routines-mount.test.mjs` | 7 pass / 0 fail |
| `apps/control/schedules/test/scheduled-job-workflow.test.mjs` | 3 pass / 0 fail |
| remaining: task-command-mount, task-update-services, product-readiness, first-run-mount, native-allocation-admission, product-envelope, memory, settings | pending host memory |

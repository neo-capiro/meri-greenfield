# Meri runtime integration ledger (meri-greenfield)

Branch `fable/meri-integration-20261018`, draft PR to `main`. Owner: Fable (implementation and deployment). Review: dot, read-only, via PR #121.
Started 2026-10-18 03:52 UTC on Neo's instruction to stop the preview first-chat loop and consolidate everything already built (PR #121 comment 6245271467).

Status words: **received** = merged here with provenance; **mounted** = reachable from the real startup composition; **held** = present but default-off or blocked on a named decision; **open** = known defect.

## 1. Merged inputs

| Order | Input | Head | Contents | Result |
|---|---|---|---|---|
| base | `fable/meri-first-chat-receiving-20261017` (PR #133) | `af430a94` | First-chat runtime, issuer, Gate 1, PR #142/#143, lane 4 (#134), defects 1–9, D10, D12, D13 fixes, contracts 0.1.10 | base |
| 1 | `fable/lanes-receive-20261017` (PR #144) | `1cf54457` | Lanes 5 (#136 product: memory/tasks/settings/routines/budget + schedule-worker role), 6 (#138 documents/artifacts), 7 (#140 Objective v2 / Planner), 8 (#139 browser and Bash), 9 (#141 post-shipment preparation) | clean (`4245cec3`) |
| 2 | `fable/meri-lane3-write-intents-20261017` (PR #137) | `8cf6b6f0` | Conversation write intents: decision, approved execution, durable journal | one test-fixture conflict, resolved (`11b689c4`) |
| 3 | `fable/meri-lane2-read-tools-20261017` (PR #135) | `e8def62b` | Read-tool families and skills (PR125 + PR132 codex read stack + Fable fixes) | clean (`4f3520c0`) |

Upstream codex stacks reach this branch through the lane PRs: product/task6 chain #100 #102 #108 #111 #113 #115–#117 #120 #124 #128 #131 (lane 5); read chain #99 #103–#107 #109 #110 #112 #118 #119 #125 #132 (lane 2); Objective v2 #123 #127 #129 (integration + lane 7). Lines #82–#98 are ancestors of the base.

## 2. Conflict resolutions and integration fixes

| Where | Resolution | Commit |
|---|---|---|
| `apps/control/intents/test/fixture.mjs` (lane 3 × lane 5) | Union signature `commandComposition({tenantId, action, approverActorId, approvalStore})`; both lanes' callers keep working. Intents suites 39/39. | `11b689c4` |
| `apps/runtime/test/control-temporal-startup.test.mjs` | Lane 5 made control readiness call `assembly.userPreferences.readiness()`; the integration-side test's fake assembly lacked that owner. Runtime unchanged (stays strict); fake now has a disabled owner. 10/10. | `d3e7da5b` |
| `apps/runtime/config.mjs` (earlier, in #144) | Kept the integration's 30 s `requestMs` bound and lane 5's `schedule-worker` guard. | `4f1a4317` |
| `packages/contracts/package.json` (earlier, in #144) | Union of lane exports/scripts (user-preferences, task-commands) and contracts 0.1.9/0.1.10 initial-input entrypoint; version 0.1.10. | `1cf54457` |

## 3. Quick checks run on the integrated tree

- `node --check` on all 424 changed non-doc `.mjs` files: 0 failures.
- Contracts generators `--check` (generate, actions, documents, conversations, lifecycle, history, input, initial-input): all clean with a real `npm ci` in `packages/contracts` (a junctioned `node_modules` changes esbuild path comments and reports false drift).
- Runtime composition/startup and first-chat render suites (22 files), compared with the pre-merge tip `af430a94` under the same command: the only new failures were the two fixed above plus Windows-path artifacts of the POSIX test shim (schedule-worker role 3/3 without the shim).
- Not run (deferred to the integrated candidate per Neo): full suites, PostgreSQL-backed suites, Linux image qualification, browser parity, live end-to-end.

## 4. Open defects and holds (carried, not fixed here)

| Id | Item | Owner / decision |
|---|---|---|
| D14 | First chat: runner container exits 2 ~13 s after RUNNING, before `cli.main`; log empty. **Ruled out:** the pinned poststart CA matches and verifies the private ALB certificate. **Now observable:** `ac2d2a7a` makes the runner write `RUNNER_STARTUP_FAILED stage=… step=… code=…` (constants only); the first chat on the integrated candidate will name the step | Fable |
| D11 | An admitted conversation whose unused 15-min binding expired is refused forever (`select()`/`claim()`) | **Mitigated:** only conversations with no turn are affected; frontend rotates once to a new chat (nothing is lost). Runtime renewal deferred |
| H1 | `history` 502 for a conversation with no run row yet; `transcript` 404 | **Control fixed** `00076b0a` (history 404 `NOT_FOUND`). Transcript 404 is correct before the first input (no conversation row yet). Frontend lane asked to show both as empty states |
| T1 | ~9/s client TLS negotiation errors on `meri-preview-control-private` since 03:32 UTC, source unidentified | Fable |
| K1 | Kickoff cancellation signal dropped between `prepared-run-registry` allocateNative and `allocateRemoteNativeController` / `allocate()` (pre-existing) | Fable |
| S1 | Session owner re-fetches every Core fact per stage (~20 Core round trips per first send, ~36 s) | Fable + dot design |
| W1 | Shared WAF SQLi rule blocks some Meri bodies; host-scoped exclusion | Neo decision |
| P1 | First-chat catalog re-pin to lane 2's retrieval catalog at the next render (D015 #4a) | Fable, next render |
| P2 | Lane 2 scope-ledger regeneration to honest counts, fresh (D015 #5) | Fable |
| L5 | One isolated-PostgreSQL qualification command; Core memory parser publication | Fable / dot |
| L6 | `meri_artifacts` migrations 0001–0003 + grants via the Stage 1 migrate task (approved, D015 #13) | Fable |
| L7 | Objective: KMS Ed25519 key (D7-2), run-start migration (D7-4), custody SQL unexecuted | Fable |
| L8 | Bash on the isolated browser host (D005/D015 #8); networked-Bash approvals | Fable |
| L9 | Post-shipment N1–N7 (takeover, bridge, WOPI) | Fable, later |
| R2 | Lane 2 read tools: 17 new failures on the integrated tree (read-family availability gate, `search_federal_grants` adapter, SDK tool count 76 vs 71) | Fable session `rt-reads` → PR into this branch |
| X1 | Pre-existing test debt: `apps/worker/conversation/test/activity-capabilities.test.mjs` fails all 8 cases in this Windows environment (STORE_UNAVAILABLE; lane 8's new Bash case included); `start-control-port-boundary` pg mock lacks `initial_inputs`; `image-closure` fails on Windows; generators `generate-user-preferences`/`generate-task-commands` need the offline bundle toolchain env | Fable |

## 5. Wiring inventory (survey of the real import tree, 2026-10-18)

Method: every module reachable from `apps/runtime/cli.mjs`, `apps/runtime/runner-poststart-cli.mjs` and the Temporal `workflowsPath` (`apps/control/conversations/workflow.ts`) — 511 files — joined with what `infra/product-preview/first-chat/render-material.mjs` renders and what `first-chat-migrate.mjs` applies.

**Cross-cutting gates (hold most families):**
- **G1 `sourceEnabled=false`** is enforced by `config.mjs:67`, written by `runner-bootstrap-files.mjs:40` and rendered false — gates reads, tasks, selected skills.
- **G2 no run capability-policy producer** — `loadForExecution` returns no `capabilities`; `generalReads`, `governedIntents`, Bash, subagents, workspace tools and skill plugin are therefore off for every run.
- **G3 single SDK-options pin** (`sdk-option-template.mjs`, `sdk-option-projection.mjs`, pin in `runtime-values.json`) — any MCP server other than `meri_original_reads` or any extra option key (sandbox, agents, plugins, outputFormat) is refused.
- **G4 trusted composer seam** — production `startControl` gets only `{signal}`; no `productPorts`/`productPortsFactory`/`createReadsRuntime` is ever supplied outside tests.
- **G5 migrations** — applied: conversations 0001–0017, budget 0001–0002, issuer 0001. Not applied: settings, schedules, intents, commands, approval-metadata, artifacts 0001–0003 (approved D015 #13), objective-source; memory has none.

| Family | Mounted in production? | Held by | Remaining |
|---|---|---|---|
| Conversations: submit/history/cancel/events/stream, allocate/admit, list/transcript/next-turn, second turn, Stop/recovery, lifecycle steer/pause/inspect | **Yes** | — | D14 (runner), H1 frontend empty states |
| Lifecycle resume/fork/approval.wait | partial (refuses `*_OWNER_UNAVAILABLE`) | G4, Core approval read/decision | Core + owners |
| Budget, model grants | **Yes** | — | readiness census mislabels model grants (cosmetic) |
| Read tools (lane 2) | **No** — gateway mount not imported; worker port dropped | G1, G2, G3, G4, `approvedReads` not rendered | Core retained-authority stack, P1–P3 contracts, render |
| Selected skills | **No** — runner fails them `UNAVAILABLE` | G1, G3, Core reads | decision + Core |
| Write intents (lane 3) | **No** — control mount/journal not imported; worker port not passed | G2, G3, no runner→control run-owner operation (P-INT-9) | Core approval routes, migrations intents/commands/approval-metadata, frontend card; inert mount possible |
| User preferences (lane 5) | composed, **disabled** | render key absent; settings 0001 not applied (enabling without tables stops control startup) | migration approval, then one render key |
| Tenant settings / capability policy | **No** | G2 decision (platform maximum) | mount + migration |
| Tasks | routed, **503** | G1, `createTaskUpdateFeature` unimported | executor grant, Core, commands migration |
| Memory | **No** | no migration, Core M2 routes, parser publication | Core + decision |
| Routines / schedule-worker | routed 503 / role refused in preview | G4 composer, Core unattended grant; `schedule-service-configuration.mjs:10` requires `requestMs ≤ 3000` vs preview 25000 | Core + small config fix |
| Documents / artifacts (lane 6) | app mounted but `/api/documents/*` not on the public allowlist; storage/options composers unimported | Core `artifactOptionsOwner`, bucket, artifacts migrations, link key, retention (D2) | Core + infra |
| Objective / Planner (lane 7) | **No** — activities not registered; source custody unimported; `/v2/internal/objective-generation/*` outside private allowlist | D7-1…D7-4, Core keys/credential owner, custody migration | Core + decision |
| Browser / Bash (lane 8) | imported, **held** (`BROWSER_EGRESS_UNQUALIFIED`); egress proxy only in qualification CLI | G2, G3, D005 placement (Bash on browser host, D015 #8), image packages | infra + decision |
| Post-shipment (lane 9) | **No** (held: takeover, WOPI editor) | N1–N7 | later |

**Already decided (D015, do not re-ask):** lane 3/5 journal port (#7 — satisfied: `intents/journal.mjs` requires claim/settle, accepts read/list); Bash on the D005 browser host (#8); D7-1 Core owns the planner loop, D7-2 KMS Ed25519 signing, D7-3 Core RS256 issuer admit-only, D7-4 run-start migration (#9–12); `meri_artifacts` 0001–0003 + grants via the Stage 1 migrate task (#13); one isolated-PostgreSQL qualification command, memory-parser publication is dot's call (#14); N1–N7 (#15–21); catalog re-pin (#4a) and scope-ledger regeneration (#5).

**Still open (Neo):** (1) lift G1 `sourceEnabled` for the preview; (2) G2 run capability-policy producer and tenant settings (N3 fixes the platform-maximum semantics); (3) G3 redesign of the single SDK-options pin so reads/intents/skills/browser/Bash/typed output can be admitted; (4) migrations not covered by D015: settings 0001, intents 0001, commands 0001, approval-metadata 0001, schedules, objective-source custody (if not the D7-4 run-start migration). **Source-integration tasks (Fable):** intents runtime transport + mount + shared approval store and the P-INT-9 run-owner operation; lane 5 memory candidate DDL and schedule owners (authority, runAdmission, runControl, retirement) plus unattended-grant custody/accounting and scheduled-allocation propagation (lane-5-product.md 43–59; `schedule-service.mjs` 18–51); K1 cancellation signal. **Core (Core lane/dot):** approval record/decision, execution broker, artifact options owner, M2 memory routes, unattended grant, Objective keys and credential owner, retained read authority.

## 6. Parallel lanes

| Lane | Repo / scope | Owner | Output |
|---|---|---|---|
| R0 | meri-greenfield: this branch, merges, ledger, final composition | Fable (this session) | draft PR to `main` |
| FE | capiro-frontend: unify Meri preview line, dot's #91, task6 UI, Objective UI, desktop fixes | Fable session `fe-integration` | `fable/frontend-integration-20261018`, draft PR |
| CORE | capiro-backend: Core preview/auth (#83), Objective chain (#54–#74), reads asOf (#59/#68/#82), cleanup chain | Fable session `core-integration` | `fable/core-integration-20261018`, draft PR |

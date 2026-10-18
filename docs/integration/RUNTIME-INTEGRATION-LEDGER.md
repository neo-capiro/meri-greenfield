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
| T1 | Burst of client TLS negotiation errors on `meri-preview-control-private`: 6,953 in 03:30–03:45 UTC and 579 in 03:45–04:00, none since. Not runner traffic (runners start only on a send). The ALB has no access or connection logs, so the client is unidentified. The listener forwards every path for host `control.meri-preview.internal`, so runner poststart routing is ruled out for D14. | Fable (closed unless it recurs) |
| K1 | Kickoff cancellation signal dropped: `prepared-run-registry.mjs:82-84` memoizes one shared `pending` allocation and `allocateRemoteNativeController` (`remote-composition.mjs:96-97`) takes no signal. Non-blocking: the allocation is bounded by the allocator startup budget and per-call request bound (`4172e474`, `d2f0fd92`, `af430a94`). The fix needs an allocation-owned lifetime, not the first caller's signal. | Fable (after candidate) |
| RC1 | Native read credential. **Option A in source** (dot ack 6245772555): `nativeCredentialFor` (`e320c37f`) → `read-credential-relay.mjs` → composer (#148 `1f4d04ab`) → startup when `reads.enabled` (`f5b26559`). **Limitation:** only while the user's live action session lasts (≤300 s, frontend-minted, `sid`-bound), and unattended runs (schedules, planner) get no reads. **Open:** #148 acceptance is conditional on propagating the session expiry through acquisition and transport (dot 6245911765, rt-reads fixing). Option B, a durable run-bound Core delegation, is being drafted by rt-reads (dot 6245899753) and needs Neo, because the Core middleware is change-controlled. | rt-reads, Core, R0 |
| B1 | Run budget shape: `maxTurns 3` / `maxToolCalls 1` / $2 per run. `maxTurns` is derived from the cap: each model call holds counted input plus worst-case output (567,706 µUSD at the D1 envelope; `product-model-budget.mjs:41,97-98`), so 3 fit under $2 and 4 do not. `maxToolCalls 1` is the global tool ceiling, so multi-step skills and read workflows cannot run. Proposed on PR #121 (6246070225): `maxTurns 20`, `maxToolCalls 20`, $2 cap unchanged, with the invariant relaxed to "one worst-case hold fits" (a run that hits the cap ends `PRODUCT_MODEL_BUDGET_EXHAUSTED`). The invariant-preserving alternative is a $11.36 cap. Read operations must also join `allocation.json`. Needs one re-measure. | Neo (decision), R0 |
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
| Read tools (lane 2) | **No**. Composer `reads-composer.mjs` merged (#146 `44ca7645`, #147 `013ab494`) but not called from startup. | G1, G2, G3; P1 discovery grant and P2 installation receipt producers (no contract); gateway authority/limits; RC1 per-run read credential; Core W1 retained authority; W5 listener packet | contracts (dot + qualification owner), Core, then one startup call in `cli.mjs` and the render keys |
| Selected skills | **No** — runner fails them `UNAVAILABLE` | G1, G3, Core reads | decision + Core |
| Write intents (lane 3) | **No** — control mount/journal not imported; worker port not passed | G2, G3, no runner→control run-owner operation (P-INT-9) | Core approval routes, migrations intents/commands/approval-metadata, frontend card; inert mount possible |
| User preferences (lane 5) | composed, **disabled** | render key absent; settings 0001 not applied (enabling without tables stops control startup) | migration approval, then one render key |
| Tenant settings / capability policy (lane B) | **Composed, config-gated** (`a208af5a`): `settingsApplication` only with `tenantSettings.enabled` and Core membership; G2 producer `capability-policy.mjs` attaches `capabilities` in `loadForExecution` only when `capabilityPlatform` is rendered | settings 0001 (packet); G2 contents (Neo); preview maximum has 13 skills, since `bill_watch` lacks SDK frontmatter; the skill plugin directory must be mounted in the runner (`SKILL_PLUGIN_DIRECTORY_REQUIRED`) | migration decision, then render `tenantSettings`, and `capabilityPlatform` with the final re-measure |
| Tasks | routed, **503** | G1, `createTaskUpdateFeature` unimported | executor grant, Core, commands migration |
| Memory (lane B) | **No port** (by design) | candidate DDL authored: `apps/control/memory/migrations/0001_memory_candidates.sql` (`meri_memory`, sha256 `d925ec36…`, not applied, no migration id yet); Core M2 routes; parser publication (dot) | Core + decision |
| Routines / schedule-worker (lane B) | **Composed disabled** (`routinesApplicationFactory` state `disabled`); schedule-worker role still refused in preview | owners authority/runAdmission (Core unattended grant), runControl (Core proof), retirement and scheduled-allocation propagation (prepared-run files); request cap raised 3000→30000 (lane B: bound by the 60 s activity timeout plus request ≤ 2 min settle wait, test-pinned) | Core |
| Documents / artifacts (lane C) | **Composed, config-gated** (`a208af5a`): `artifactStore` from the `artifacts` block (S3 + KMS, no I/O at construction); options owner late-bound to sessions only with a trusted Core authority (none in production); `/api/documents/` public (honest 503) | Core artifact authority; bucket + control role S3/KMS permissions; Office libraries in the image; artifacts 0001–0003 plus grants (D015 #13); render `artifacts`, retention `tenantId`, link key | Core + infra |
| Objective / Planner (lane C) | **Activities registered, reader disabled** (`a208af5a`): four worker activities answer unconfirmed/not-started; private `/v2/internal/objective-generation/*` adapter answers 503 | D7-2 three KMS Ed25519 keys and a pure-Ed25519 Core signer; JTI replay store (no migration id); custody 0001; D7-3 credential owner; D7-4 migration plus prepared-run splice; `runs` port as new control native operations; Core→private ALB path; runner mounts; a dispatcher | Core + D7 decisions |
| Browser / Bash (lane 8) | imported, **held** (`BROWSER_EGRESS_UNQUALIFIED`); egress proxy only in qualification CLI | G2, G3, D005 placement (Bash on browser host, D015 #8), image packages | infra + decision |
| Post-shipment (lane 9) | **No** (held: takeover, WOPI editor) | N1–N7 | later |

**Already decided (D015, do not re-ask):** lane 3/5 journal port (#7 — satisfied: `intents/journal.mjs` requires claim/settle, accepts read/list); Bash on the D005 browser host (#8); D7-1 Core owns the planner loop, D7-2 KMS Ed25519 signing, D7-3 Core RS256 issuer admit-only, D7-4 run-start migration (#9–12); `meri_artifacts` 0001–0003 + grants via the Stage 1 migrate task (#13); one isolated-PostgreSQL qualification command, memory-parser publication is dot's call (#14); N1–N7 (#15–21); catalog re-pin (#4a) and scope-ledger regeneration (#5).

**Completion gate (PR #121 comment 6245587848).** The chat test runs on the integrated candidate only when every family row above is either wired or deferred by a Neo record; a source-only row keeps the gate closed. Deferred by Neo: lane 9 (takeover, Office editor, bridge, authenticated sites; 10-15 Q-X0, "ship a live version first", order D015 N1–N7). N19 (`da6a9764`, pinned at `291ff5d7`) is a build pin, not the candidate and not deploy approval.

**Reconciled against existing records:**
- **G1 `sourceEnabled`: decided.** 10-15 decision 5 (reads in first-shipment scope) and D015 #4a (retrieval catalog pinned into the first-chat allocation, done at `291ff5d7`); D015 #4a's "after the first chat is verified" trigger is superseded by Neo's 03:38 18 Oct integrate-first instruction. Note: lifting G1 is not only a render flip. `config.mjs:67` accepts only `sourceEnabled===false` and `runner-bootstrap-files.mjs:40` writes false; the composer must thread the value into each module's own `sourceEnabled` option (`action-host/durable/index.mjs:13`, `artifacts/postgres-service.mjs:12`, `artifacts/postgres-analysis.mjs:11`). **Runtime side done (`4bb54ca5`):** control, worker and runner take an explicit boolean; the runner gets it only via control's delivery; the schedule worker stays false. Turning it on is a render input (lane R).
- **G2 producer: model decided; contents proposed to Neo (PR #121 6245708006, dot: matches recorded product direction, 6245733650).** Preview platform maximum = full accepted scope: `generalReads` (lane 2), `governedIntents`, `skillPlugin` (13 skills), `workspaceTools` (confined by the SDK), `subagents` (4 types, max 4) + progress, audit/compaction hooks, `bash` eligibility (unavailable on Fargate without sandbox attestation), browser on by default (own policy, default-deny destinations). The only holds are runtime qualification gates. Producer landed (lane B), deterministic per configuration, so the single SDK pin holds (G3). `maxTurns` 20 under the unchanged $2 cap is applied with the final re-measure.
- **G3 SDK-options pin: source task, not an owner decision.** While every preview run shares one capability profile (G2 as proposed), the single pin still works: the in-image measurement must project the options with that production profile (the measured template then includes the read/intent MCP servers). Per-tenant restriction later needs a profile→pin map.
- **Migrations outside D015: one decision proposed to Neo.** settings 0001, intents 0001, commands 0001, approval-metadata 0001, schedules 0001–0002, task-lookup 0001, objective-source custody 0001 (unless it is the D7-4 run-start migration). All CREATE-only (new schemas `meri_settings`, `meri_intents`, `meri_schedules`, `meri_task_lookup`, `meri_objective_source`; tables `meri_command_journal`, `meri_approval_metadata`); none alters or drops an existing object. Proposed: apply like D015 #13 through the Stage 1 migrate task, snapshot first.

**SEC D1 (Core #83) invariant.** The marked control credential (`identity.credentialFile`, `prepared-candidate.mjs:122`) goes only to `application-authority/{identity,context,membership}`. The broker composed for `tools/*`, `retained-reads/*`, `read-mode-observation` and `clients/check-ref` must never return it.

**Source-integration tasks (Fable R0):** production composer (G4) and G1 threading; intents runtime transport + mount + shared approval store and the P-INT-9 run-owner operation; lane 5 memory candidate DDL and schedule owners (authority, runAdmission, runControl, retirement) plus unattended-grant custody/accounting and scheduled-allocation propagation (lane-5-product.md 43–59; `schedule-service.mjs` 18–51); `schedule-service-configuration.mjs:10` request bound; K1 cancellation signal. **Core (Core lane/dot):** approval record/decision, execution broker, artifact options owner, M2 memory routes, unattended grant, Objective keys and credential owner, retained read authority, D10 guard move, preview-listener route/method/credential packet (no listener mutation during integration).

## 6. Parallel lanes

| Lane | Repo / scope | Owner | Output |
|---|---|---|---|
| R0 | meri-greenfield: this branch, merges, ledger, final composition | Fable (this session) | draft PR to `main` |
| FE | capiro-frontend: unify Meri preview line, dot's #91, task6 UI, Objective UI, desktop fixes | Fable session `fe-integration` | `fable/frontend-integration-20261018`, draft PR |
| CORE | capiro-backend: Core preview/auth (#83), Objective chain (#54–#74), reads asOf (#59/#68/#82), cleanup chain | Fable session `core-integration` | `fable/core-integration-20261018`, draft PR |

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
| D14 | First chat: runner container exits 2 ~13 s after RUNNING, before `cli.main`; log empty | Fable, after integration (runner diagnostic entrypoint prepared: `scratchpad/diagr.mjs`, `patch-runner-diag.mjs`) |
| D11 | An admitted conversation whose unused 15-min binding expired is refused forever (`select()`/`claim()`) | Fable; frontend rotates once as mitigation |
| H1 | `history` 502 for a conversation with no run row yet (`STORE_CORRUPT`); `transcript` 404 (route not mounted) | Fable |
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
| X1 | Pre-existing test debt: `start-control-port-boundary` pg mock lacks `initial_inputs`; `image-closure` fails on Windows; generators `generate-user-preferences`/`generate-task-commands` need the offline bundle toolchain env | Fable |

## 5. Wiring inventory

Filled in by the next batch: for every feature family, whether it is mounted in the real control / temporal-worker / schedule-worker / runner composition, which flag or decision holds it, and the exact wiring left. See section 6 for lanes.

## 6. Parallel lanes

| Lane | Repo / scope | Owner | Output |
|---|---|---|---|
| R0 | meri-greenfield: this branch, merges, ledger, final composition | Fable (this session) | draft PR to `main` |
| FE | capiro-frontend: unify Meri preview line, dot's #91, task6 UI, Objective UI, desktop fixes | Fable session `fe-integration` | `fable/frontend-integration-20261018`, draft PR |
| CORE | capiro-backend: Core preview/auth (#83), Objective chain (#54–#74), reads asOf (#59/#68/#82), cleanup chain | Fable session `core-integration` | `fable/core-integration-20261018`, draft PR |

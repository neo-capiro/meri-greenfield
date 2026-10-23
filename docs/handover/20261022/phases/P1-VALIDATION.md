# P1 validation: PR #200 "P1: centralize preserved hot-path budgets and startup proof"

> **HISTORICAL (superseded 2026-10-23).** This file describes P1, the hot-path budget table / owner-proxy proof reuse. Wave 2 item 0 deletes those layers; P1 #200 and C9 #203 are not to be merged. Do not act on it. Read `STANDING-REQUIREMENTS.md`, `WAVE-1-HANDOFF.md` and `WAVE-2-HANDOVER.md` instead.

adj-c, 2026-10-21. Review only: no edits, no pushes, no GitHub comments. Labels: **[M]** measured here, **[D]** derived from source and git.

**PR:** greenfield #200, `feat/meri-p1-budget-table` @ **`f94ef9e1`**, draft. Base `main` @ `bce70776` (merge base). 578 files, +61,011 / −1,663, 18 commits.

**Verdict: CHANGES** (exact list in §6).
- **The core rule holds:** no budget value changes at production inputs (§2). The golden file really is extracted from the base source, and the no-default and nesting tests are real: they fail on base and catch all 11 of my mutations (§4).
- **What blocks it:**
  - 52k lines of evidence committed under `docs/hot-path/` (O63);
  - the whole 278-hop table rendered into the proxy config, which takes it to 94 % of its hard 32 KB cap;
  - a dead Temporal option counted as a bound;
  - callers that now throw: C11's composed next-turn rehearsal script, the assembled-image probe and its test, and one `prepared-run-bindings` test;
  - a missing control startup-refusal test;
  - 66 `independent` hops that skip the nesting assertion without per-hop justification.

**Gate summary [M]:**
- The image gate is **24/24**.
- First-turn (6/6) and D3 (9/9) rehearsals have the same outcome as base.
- The PostgreSQL and router suites (44/45) and the proxy suites (374 tests, 0 failures) match base.
- **The whole node suite is name-equal to base apart from new tests, except for two real failures:** a `prepared-run-bindings` test call that was not updated (C7), and the assembled-image `workerOptions` callers (C4).
- Both no-default guards are green on head and red on base, and catch all 11 of my mutations.
- The ±10 % timing comparison is **not established** on this loaded host. On a quiet host, `load-amplification` and `lifecycle-activity` are identical on both sides.

## 1. Scope: what the +61k is [M]

| Part | Files | Lines added | Verdict |
| --- | --- | --- | --- |
| **`docs/hot-path/` evidence** (`p1-host-checks-phase1.json` 49,281 lines / 1.75 MB, `p1-mutation-checks.json`, `p1-final-base-checks.json`, `p1-inventory-delta.json`, `P1-VALIDATION.md`, `P1-PHASE1-FAILURES.md`) | 6 | **≈ 52,275** | **Must come out.** `docs/hot-path/` does not exist on `main` and was held out on purpose (O63). Evidence belongs in the PR description or outside the repo. That is 86 % of the PR. |
| Table and guards: `hot-path-budgets.mjs` (812), golden (1,433), `budget-call-sites.json` (1,053), `budget-literal-allowlist.json` (522), `budget-scan.mjs`, `hot-path-budget-sources.mjs`, the golden generator, `generate-workflow-budgets.mjs` + `hot-path-budgets.generated.ts` | ~12 | ≈ 4,300 | In plan §4.1 / §5. Keep. |
| Proxy: `budgets.py` loader/validator, `apps/proxy/product/test/budget-fixture.json` (1,636 lines: the whole rendered table), tests | 49 | 2,343 | In §4.9. The fixture shrinks with change C2. |
| Production source threading budgets (246 non-test files) | 247 | ≈ 2,000 | The plan estimated about 45. The excess follows from the plan's own §5.1(b) sweep scope (all of `apps/control`, `apps/runtime`, `apps/worker/conversation`, `apps/gateway/budget`), so it's the guard's reach, not scope creep. Each change is small (mostly a removed default plus a passed value). |
| Tests passing explicit budgets | 306 | ≈ 4,000 | In §3.3. |
| `packages/contracts/dist/*.metadata.json` | 9 | 39 | Regenerated source hashes of edited files. Mechanical, needed. |
| Tests hosted under `docs/coordination` and `docs/qualification` | 6 | 11 | Existing tests that construct changed modules. Needed. |
| **Dependencies:** `apps/runtime` gains `undici` 7.30.0 and `@smithy/node-http-handler` 4.12.1 (direct); `apps/artifacts/storage` gains `@smithy/node-http-handler` | 4 | ~30 | Needed for plan §3.3's explicit dispatcher and handler. **It changes the runtime image** (new `node_modules/undici`), so no pre-built image can stand in. See §5 on the version mix. |

**Untouched, as the plan requires [M]:** `apps/worker/conversation/options.mjs` (SDK pin), `litellm-product-config.yaml`, both Dockerfiles. `execution-broker.mjs` and `task-router.mjs` change only their number source (a removed `??3000` / `??8000` and an import path); candidate 7/8 logic is untouched. `runner-load-budget.mjs` is deleted (§3.1).

**Render diff** (§8 checklist says "only the `budgets` block and the `max_exchange_ms` source"): it also adds `runWindowMs` to the temporal-worker config, which the worker needs for its turn root. That's acceptable, but it is a third rendered change and part of the coupled rollout (§5).

## 2. Behaviour unchanged: every value [M]

**No budget value changes at production inputs** (`requestMs` 25000, `startupMs` 30000, `shutdownMs` 10000, run window 900000).
- **How:** an independent audit diffed all 246 non-test files token by token against `bce70776`. It pulled out every removed default and replaced literal (121 replacements, about 100 removed defaults with all their base callers, 13 Python files, all 5 workflow `.ts` files), and evaluated the new expression from the table.
- **20 hops** were spot-checked by hand against base source:
  - `activity.heartbeat` 5000, `activity.cleanup.attempt` 3000, `runner.terminal.attempt` 3000, `conversation.retention.inventory` 5000, `conversation.window.slack` 50;
  - `objective.lifecycle.poll`/`.retry` 30000/120000, `native.client.startup` 23000, `native.replay.minAttempt` 1000, `native.tls.challenge`/`.exchange` 3000/30000, `native.allocator.settle`/`.poll` 15000/1000;
  - `temporal.bootstrap.window`/`.retry`/`.reserve` 180000/2500/10000, `temporal.issuer.pg.connect.max`/`.idle` 3000/1000;
  - `browser.cleanup.settle` 131000, `browser.takeover.hard`/`.idle` 130000/600000, `owner.startup.pair.watchdog` 200000;
  - `proxy.request.check` 26000, `proxy.bootstrap` 35000, `proxy.connection` 900000, `http.request`/`.headers`/`.keepAlive` 26000/25000/125000, `gateway.runAllocation.read` 3000.
- **The golden file is genuinely independent:** `hot-path-budget-sources.mjs` reads every value from the base commit by named source anchors (`git show bce70776:<file>`), never from the new table. The test asserts the table equals it (278 hops, digest `81f34501…`).

**Apparent changes that are not:**
- ECS task binding in the allocator: now gets 25 s / 30 s instead of the 3000 default, but that field is never read on the allocator path.
- Session deadlines: `min(httpNow+op, started+op, started+ownerMax)` equals base's.
- Temporal workflow options: numeric milliseconds now, Temporal-encoded identically ('30 minutes' etc.), so replay is safe.
- Python: `int` where base had `float` (26 vs 26.0), and every consumer accepts both.

**Library options made explicit:**

| Site | Finding |
| --- | --- |
| undici `Agent` (connect 10 s, headers 300 s, body 300 s) as `dispatcher` to Node's built-in `fetch` | The values equal undici's defaults; keep-alive, connections and pipelining stay at defaults. **But** each transport now has its own pool instead of the global one, and the npm undici 7.30.0 runs under Node's bundled undici (7.29.0 on Node 24.19; the image's Node 24.21 not checked). A loopback fetch works. |
| AWS `NodeHttpHandler({connectionTimeout:0, requestTimeout:0})` | Same "no timeout" and the same keep-alive agent. One divergence: the socket-acquisition *warning* timer goes from 3000 ms to 0 (logging only). |
| **Temporal `NativeConnection.connect({connectTimeout:10000})`** (`temporal-worker.mjs`, `schedule-worker.mjs`) | **Dead option:** `NativeConnectionOptions` has no `connectTimeout` (checked in `@temporalio/worker` 1.24.0 `connection-options.d.ts`), so it is dropped. Behaviour is unchanged, but the table records a bound that doesn't exist, and the guard accepts it textually. **Change C3.** |
| pg pools (control, schedule, owner) | Identical: control/schedule 25000/10000/25000; owner 15000/10000/15000, the same as base `databaseOptions`. |
| Node `https.createServer`, uvicorn keep-alive 5 s / shutdown `None` | Equal to the library defaults. |
| Temporal issuer ECS/EC2/KMS `maxAttempts:3` | Equals the SDK default, but now overrides an `AWS_MAX_ATTEMPTS` env (none found in the repo's task definitions). |

## 3. Conflicts [M]

**C12 (#201, `codex/c12-unstarted-original` @ `80ea8031`):**
- One textual conflict, `apps/runtime/test/initial-run-bindings.test.mjs` (a test).
- Seven files overlap.
- Merged, P1's Node and Python no-default guards both stay green.
- **Either order works;** the second to merge resolves one test hunk.

**PR197 (`codex/meri-missed-source-20261021` @ `ac80ef4d`):**
- **13 textual conflicts,** including production files:
  - `cli.mjs`, `execution-composition.mjs`, `current-authority-adapters.mjs`, `retained-reads/task-ports.mjs`, `artifacts/authority-composition.mjs`, `action-host/session/http.mjs`, `intents/mount.mjs`, `general-read-tariffs.mjs`, `approval-metadata/owner.mjs`, `bash-runtime-facts.mjs`, `refusal_diagnostics.py`;
  - plus two tests.
- **Semantic conflict:** on the merged tree, P1's literal guard fails on **27 budget defaults or literals in 18 PR197 files**. Examples: `action-host/session/http.mjs` `maxRequestMs=3000`, `intents/mount.mjs` `AVAILABILITY_MS=30000`, `retained-reads/task-ports.mjs` `maxRequestMs??15000`, the host launcher's `readyMs`/`stopMs`/`timeoutMs`. More may sit in the 13 conflicted files.
- **Whichever merges second** must route every one of PR197's new sites through the table (new hops, golden regenerated from the then-current `main`) and re-run both guards. That is real work, not a rebase.
- **Recommendation:** merge PR197 first (it is ready and dark), then P1 rebases onto it, per P1-PLAN §10 ("regenerate the golden file from the rebased base").

## 4. Tests: no default, nesting, mutation checks [M]

**No-default guard (§6.1):**
- Node `no-default-budget.test.mjs` is **3/3 on head** and **0/3 on base** (`MERI_BUDGET_SOURCE_ROOT` pointed at a base extraction).
- Python `test_no_default_budget.py` is **3/3 on head**, and **fails on base** (5 failures).

**Nesting** (`hot-path-budgets.test.mjs`): 14/14 on head.

**My mutations of head** (each restored with `git checkout`; the worktree ends clean). **Every one turns its guard red:**

| Mutation | Caught by |
| --- | --- |
| `native-client.mjs`: re-add `maxRequestMs=3000` | literal + constructor checks |
| `temporal-worker.mjs`: a literal `10000` instead of `budget(…,'temporal.connect')` | literal + library checks |
| `hot-path-transports.mjs`: drop `requestTimeout` | library check |
| `control.mjs` pg pool: drop `connectionTimeoutMillis` | library check |
| new `PROBE_TIMEOUT_MS=4000` in `conversation-runner.mjs` | literal sweep |
| `RUNNER_CAPTURE_MS` = router − 1000 (breaks nesting) | the table refuses at import |
| `RUNNER_CAPTURE_MS` = router − 3000 (still nests) | golden |
| margin 2000 → 1000 | golden only (the margin test checks the rendered hop against the constant, so changing the constant is caught only by the golden; adequate) |
| session RPC `register` 12000 → 12500 | golden |
| Python `service_pair_discovery.py`: re-add `max_request_ms=3000` | Python guard (2 checks) |
| Python `main.py` boto3: drop `read_timeout` | Python library check |

**Startup refusal (§6.4):**
- Demonstrated for the worker and runner (`hot-path-startup.test.mjs`), the owner (`owner-entrypoint.test.mjs`) and the proxy (`test_hot_path_budgets.py`).
- **Not for control.** `startControl` asserts the table (`control.mjs:145`) before its pool and listener, but no test starts control with a violating table and checks the refusal. `hot-path-budget-inputs.test.mjs` only exercises `runtimeHotPathBudgets`. **Change C5.**

## 5. Other findings

1. **The proxy config is at 94 % of its hard cap [M].**
   - `render-material.mjs` renders the whole table (`budgets:hotBudgets`, 278 hops with reasons and metadata) into the model-proxy config.
   - Rendered from the repository's own render fixture, the **model-proxy config is 30,744 bytes against the render's enforced 32,768-byte cap** (`render-material.mjs:731`). Without the block it is 3,316 bytes; the block alone is 27,417 bytes.
   - The proxy reads **24** hops (`budgets.py` `_REQUIRED`). Plan §3.1 asks for a block "for the proxy's hops".
   - Any growth of the table (more hops, PR197's new sites) or of the proxy config refuses the release render. **Change C2.**
2. **66 hops (24 %) use a new `independent` kind** that the plan does not define (§3.2 has `nested`, `serial`, `background`, `derived` and library/`unbounded` with `boundedBy`). Independent hops are never nesting-checked.
   - Many are genuinely standalone: shutdown watchdogs, cleanup after a request, durable workflow policy, background polls.
   - Several **appear** to sit inside an enclosing hop (call paths not fully traced here):
     - `authority.gateway.request` 30 s is the reads gateway per-call limit inside a 25 s control request;
     - `native.pinned.transport` 30 s is bounded by its request signal;
     - `conversation.http.request`, `native.gateway.read.request`, `reads.snapshot`, `intents.snapshot` are each 3 s inside request-bound work;
     - `proxy.request.cleanup` 26 s.
   - The plan's rule is to record such cases as `nested` with an exception row (`removedBy` a phase), or as `unbounded` with `boundedBy`, so that violations are visible. Reasons such as "Dispatch owner" or "Request owner" don't justify the classification. **Change C6.**
3. **152 call sites read fixed hops at import** (`fixedHotPathBudget('…')`) instead of receiving them from a composition root (§3.3). Example: `GATEWAY_LIMITS_DEFAULTS` stays a defaults object, now table-sourced.
   - The values come from the same constants, and the digest covers them, so there is no value risk.
   - It does mean the asserted per-process table is not the instance those modules use. **Observation, not a change.**
4. **Scripts broken by required fields [M]:** `scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs` (C11's composed next-turn rehearsal) calls `createNativeCapabilityClient` with an unknown `startupMaxRequestMs` and without the now-required `loadMaxRequestMs`. Constructing it throws `NATIVE_CONFIGURATION` (checked directly).
   - The audit also lists `scripts/qualification/first-chat-rehearsal/composed-rehearsal.mjs` and `evals/offline-targets/conversation-application.mjs` (they omit `maxRequestMs`), plus `createAdmittedEcsTaskFactory`'s strict key check against the new `broker-stack.mjs` arguments (test and doc path only).
   - **Change C4.**
5. **Coupled rollout** (expected by §8, restated for the shipper):
   - new images refuse old material, and old images refuse new material:
     - the proxy now requires `budgets`;
     - the worker and runner require `runWindowMs`;
     - every role builds the table and refuses with exit 2 if a root is missing;
   - a schedule-worker config (not rendered by `render-material`) would now refuse;
   - so render and images must ship as one change set, and rollback is render plus image together.
6. **Shutdown now awaits `Agent.close()`** (`cli.mjs:129`, the runners, the owner, the prepared candidate, `reconcile-run`). At base the global dispatcher was never closed.
   - `close()` waits for in-flight requests (bounded by the process watchdogs).
   - It's a small shutdown-timing change in a no-behaviour-change phase. **Change C8** (minor).
7. **Image / undici version mix:** see §2. Not a change, but the shipper should confirm `node -e "console.log(process.versions.undici)"` in the built image, and that one connect/headers/body round trip through the npm `Agent` works under the image's Node 24.21.

## 5b. Gates [M]

**Setup:**
- Each side's own image, built by the P0 harness (`43b705c8`, P1-PLAN §13): head `meri-p0-runtime:f94ef9e19a5f` (it adds `undici`), base `meri-p0-runtime:bce707763f2c`.
- uid 1000, network none, one container of mine at a time.
- Other sessions' containers ran on the same host throughout, and WSL stalled once (about 22:00). Timing results below account for that.
- Scripts: `adj-reports/adj-c-evidence/p1/`.

| Gate | Base `bce70776` | Head `f94ef9e1` |
| --- | --- | --- |
| **Image gate** (B 6, R 6, W 12) | 24/24 | **24/24** |
| **Whole node suite** (every `*.test.mjs` under `apps packages infra scripts evals`, except `-pg`, rehearsals and image closure; concurrency 4; the same 10-minute per-file watchdog on both sides) | 1,065 files; 16,647 tests; 15,855 pass; 780 fail | 1,076 files; 16,677 tests; 15,903 pass; 762 fail |
| Harness groups (runner diagnostics, control, worker, owner, telemetry, the new P1 tests) | see below | owner 223/223, telemetry 50/50; others: see below |
| **First-turn rehearsal** (pattern `first turn`) | 6/6 | **6/6** (one interleaved round; host clock steps recorded on both sides, every case passed; the harness runs earlier on the loaded host were void from clock steps on both sides) |
| **D3 rehearsal** | 9/9 | **9/9** (interleaved round; also 9/9 in the harness run) |
| PostgreSQL + `openssl` router suites (§13.4–13.5: completion-broker-poll, capture-self-stop, task-router, native-start-router-budget, runner-load-replay, execution-broker, broker-stack, broker-cleanup) in `pgvector:pg16` with each side's `/opt/meri` | 44/45 | 44/45 |
| Proxy Python, per module, `AWS_EC2_METADATA_DISABLED=true` | 364 tests, 0 failures | **374 tests, 0 failures** |

**Remaining failures, accounted for:**
- **Router suites:** the one failure differs by side. Base fails "real PostgreSQL concurrent/replayed start…"; head fails `native-start-router-budget` "reproduction…", which §13.4 calls timing-flaky on base and head alike.
- **Proxy:** the same two modules (`test_aws_counter`, `test_bedrock_transport`) refuse to load on both sides; they need the fuller offline environment (§13.6).

**Whole-suite comparison by name:**
- 18 names fail on base and pass on head; 37 names are new; 3 names pass on base and fail on head, and 3 are absent from head. Each was rerun:

| Name (file) | Result | Cause |
| --- | --- | --- |
| "original expiry and authoritative target facts persist…" (`apps/runtime/test/prepared-run-bindings.test.mjs`) | **Real, deterministic** (head 3/4, base 4/4, Windows and image) | The test's third `createPreparedRunBindings` call (line 65, a case `main` added with C10/C11) lacks the now-required `limits`, so it throws `INVALID_COMMAND`. **Production is unaffected:** `prepared-candidate.mjs` passes `limits` (`core.request` = 25000, the same as base `requestMs`). **Change C7.** |
| "runtime-owned upstream Temporal bundles canonical workflow with no connections" (`scripts/qualification/assembled-image/temporal-bundle.test.mjs`) | **Real** | `workerOptions` now asserts a budget table. The test and **`scripts/qualification/assembled-image/image_probe.mjs`** (hash-pinned in `meri_image_build.py` `PROBE_HASHES`, run by the assembled-image qualification) call it without one, so both throw `HOT_PATH_BUDGET_CONFIGURATION`. **Change C4.** |
| "unresolved PENDING resume never admits a profile" (`scheduled-run-profile.test.mjs`) | Environmental | 30/30 on head and on base, three runs each, on a quiet host. |
| 3 names absent from head (`apps/control/action-host/local/recovery-independent.test.mjs`) | Environmental | The watchdog killed this file and `application-independent` on head at 22:00:26, during the WSL stall. On a quiet host the whole file finishes in 41 s on both sides with identical results. Under the harness sandbox (`in-image.sh`), **base also hangs** on this file (891 s, no summary), so the in-image hang is environmental and symmetric. |

**Harness-group failures on head only, all rerun and cleared:**
- **Control** (`load-amplification`, 2 cases) and **worker** (`lifecycle-activity` "control not answering in time…"): 46/46 and 50/50 on head and base, three interleaved runs each on the Windows host. These are timing tests under load, and `load-amplification` already flakes on `main`.
- **Runner diagnostics** "SDK initialization milestones…": Linux-only; in-image interleaved rerun: head 4/4, base 3/4 (base failed "a CLI ended by SIGKILL after initialize…"); timing, not a regression.

Every other group failure is shared by name with base: `openssl` absent in the image, the observability suppression filter, browser and host tests needing the host runtime.

## 6. Change list for agent 1

**Required:**

- **C1. Take `docs/hot-path/` out of the PR.**
  - Delete the six evidence files (≈ 52,275 lines; 86 % of the diff), per O63.
  - Put the summary in the PR description. The raw JSON can live in a gist or the shipper's report folder; nothing in the repo reads it.
- **C2. Render only the proxy's hops.**
  - In `render-material.mjs`, replace `budgets:hotBudgets` (the whole 278-hop table, 27.4 KB) with a block holding the 24 hops `budgets.py` requires, their `parent`/`boundedBy` ancestors up to the roots, the roots and the margin, so the Python validator still re-asserts nesting.
  - Regenerate `apps/proxy/product/test/budget-fixture.json` to match.
  - Add a render test asserting the model-proxy config stays far below the 32,768-byte cap (e.g. ≤ 8,192 bytes). Today it is 30,744 bytes, against 3,316 at base.
- **C3. Remove the dead Temporal option.**
  - `NativeConnection.connect({connectTimeout})` in `temporal-worker.mjs` and `schedule-worker.mjs` has no effect (`NativeConnectionOptions` in `@temporalio/worker` 1.24.0 has no `connectTimeout`).
  - Drop the option. Record `temporal.connect` as a `library` entry stating that the worker's native connection has no configurable connect timeout (sdk-core default), and move the call site to `libraryExceptions` in `budget-call-sites.json` with that reason.
- **C4. Fix the callers that now throw.**
  - `scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs`: `createNativeCapabilityClient` gets an unknown `startupMaxRequestMs` and no `loadMaxRequestMs`, so it throws `NATIVE_CONFIGURATION`. Pass `loadMaxRequestMs` and drop `startupMaxRequestMs`.
  - Also fix `scripts/qualification/first-chat-rehearsal/composed-rehearsal.mjs` and `evals/offline-targets/conversation-application.mjs` (missing `maxRequestMs`).
  - Fix `createRunnableNativeRuntime` → `createAdmittedEcsTaskFactory`, whose strict key check refuses the new `broker-stack.mjs` arguments.
  - `scripts/qualification/assembled-image/image_probe.mjs` and `temporal-bundle.test.mjs` call `workerOptions` without a budget table, so both now throw `HOT_PATH_BUDGET_CONFIGURATION`. Pass a production-shaped table, and update the probe's pin in `meri_image_build.py` `PROBE_HASHES`.
  - Add one smoke test that constructs each.
- **C5. Add control's startup-refusal test** (§5.2, §6.4). Start `startControl` with a violating table, without injecting `budgets` (so `runtimeHotPathBudgets` is used), and assert `HOT_PATH_BUDGET_CONFIGURATION` before `createPool` or any listener is called.
- **C6. Justify or reclassify the 66 `independent` hops.**
  - Each hop that runs inside an enclosing hop becomes `nested` (plus a `HOT_PATH_BUDGET_EXCEPTIONS` row with `removedBy` when it violates the 2 s or 10 % rule) or `unbounded` with `boundedBy`.
  - `independent` stays only for lifetimes with no enclosing hop, and its `reason` names why.
  - Start with `authority.gateway.request` (30 s; the reads gateway inside control's 25 s request), `native.pinned.transport`, `conversation.http.request`, `native.gateway.read.request`, `reads.snapshot`, `intents.snapshot`, `proxy.request.cleanup`, and `runner.session.store` (part of the session RPC chain at base).
  - Values do not change; only the classification and exception rows do.
- **C7. Update the remaining `prepared-run-bindings` test call.** `apps/runtime/test/prepared-run-bindings.test.mjs:65` (the RETIRED-source case `main` added with C10/C11) constructs `createPreparedRunBindings` without the now-required `limits`, so "original expiry and authoritative target facts persist…" fails deterministically (base 4/4, head 3/4). Production is unaffected.
- **C8. Keep shutdown identical.** Do not `await` the new transports' `Agent.close()` in the shutdown paths (`cli.mjs:129`, the runners, owner, prepared candidate, `reconcile-run`). At base the global dispatcher was never closed. Either drop the close, or call it without awaiting after the existing shutdown completes.

**Minor (same PR):**
- **C9.** `createHotPathAwsRequestHandler`: pass `socketAcquisitionWarningTimeout: 3000` so the SDK's (logging-only) socket warning timer keeps its base value. With explicit zero timeouts it now computes 0.

**Merge order (for the orchestrator):**
- **C10.** Merge PR197 first, then rebase P1 onto it (P1-PLAN §10).
  - Route PR197's 27 new budget literals or defaults (18 files) and the 13 conflicted files through the table.
  - Regenerate the golden from the new base, and re-run both guards (red on the new base, green on the branch).
  - #201 (C12) can merge in either order (one test hunk).

**Then re-run (agent 1, before re-review):** both guards (head green, base red), `hot-path-budgets`, the render tests, the image gate, the first-turn and D3 rehearsals on a quiet host, and the composed suites. List the results in the PR description, not in the repository.

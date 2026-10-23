# P0 validation: plan conformance of PR #195 (adj-e, 2026-10-20)

**PR:** neo-capiro/meri-greenfield#195, `feat/meri-p0-telemetry` @ `43b705c8`. It is one commit on base `main` @ `69fd1994`: 73 files, +4449/−133, draft.

**Method:**
- Read-only review of the full diff against `phases/P0-PLAN.md` §2-§5 and §9.
- Trial merges (`git merge-tree`) against candidate 7's branches.
- A recount of the rehearsal baseline from saved outputs and commit history.
- I ran no tests or containers; A is running the Docker gates in parallel.
- I posted nothing on GitHub.

## Verdict: **CHANGES**

The telemetry code itself conforms: allowlist emitters, redaction, identity-preserving wrappers, never-throw, no behaviour change. What blocks ACCEPT:
- **Two out-of-plan artifacts should leave the PR:**
  - the CI workflow plus its harness;
  - the two `docs/hot-path/` records.
- **Three small fixes:** the suppressed-filter patterns, the runner gap in the telemetry-dropped alarm, and one Python expression outside the never-throw wrapper.

**Not verifiable from the diff:**
- **The image gate (24/24) and the in-image rehearsals:** the PR's own workflow never ran. Its `resolve` job failed with no steps executed, which looks like an Actions account or billing refusal, not a code failure. A's gate run is the evidence for those §9 rows.

## 1. Exact change list for Neo's agent

**Required:**
1. **Remove the CI workflow and its harness:**
   - `.github/workflows/meri-p0-telemetry.yml` and all of `scripts/qualification/p0-telemetry/`;
   - the plan's deliverable is the code PR, and gates run outside the repository (§13);
   - the workflow is hard-wired to this branch name (`head_ref == 'feat/meri-p0-telemetry'`), so after merge it is dead code that still triggers on every PR into `main`;
   - if the harness is worth keeping, propose it as its own PR.
2. **Remove `docs/hot-path/P0-IMPLEMENTATION.md` and `docs/hot-path/P0-VERIFICATION.md`:**
   - move the verification record (commands, results, the pre-existing-failures table) into the PR description, as plan §10 asks;
   - fold the lasting design notes from P0-IMPLEMENTATION's "Reconciliations" into `apps/runtime/telemetry/TURN-TELEMETRY.md`, which already carries most of them:
     - (3) the suppressed-filter dimension limit;
     - (4) owner pre-reservation attribution;
     - (6) why terminal observation also hooks completion, cancellation and the reconciler;
     - (7) the timeout signal from both control and runner;
   - the records cite `/tmp/...` logs that exist only on the implementer's host.
3. **Fix the suppressed-diagnostics metric filters** (`first-chat-observability.mjs` `filters`, plus the test and the committed template):
   - use the exact emitted tokens: `"PRODUCT_OWNER_DIAGNOSTICS_SUPPRESSED"` on the owner group and `"PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED"` on the proxy group;
   - the bare `"DIAGNOSTICS_SUPPRESSED"` came from my plan. Whether CloudWatch's term matching finds it inside the longer token is uncertain, and an exact token removes the doubt;
   - I corrected plan §3.2.
4. **Add `TelemetryDropped{Service=runner}` to the `telemetry-dropped` alarm:**
   - the runner emits a `meri.process.rollup` with `TelemetryDropped` when `withRunnerDiagnostics` closes its telemetry (`turn-context.mjs` `close()` calls `rollup()`);
   - the alarm sums only control, owner and proxy, so runner drops are never alarmed;
   - that makes 4 metric stats, within the limit of 10. Update the alarm test.
5. **`apps/proxy/qualification/runtime/server.py`:**
   - the new `telemetry.outcome("completed" if response_status < 400 else …)` evaluates its argument outside the `_safe` wrapper;
   - it is unreachable today: `INCOMPLETE_UPSTREAM_RESPONSE` guarantees a status;
   - still, move the classification into `telemetry_context` (for example `telemetry.http_outcome(response_status)`, decorated `@_safe`), so no telemetry expression sits in the request path.

**Optional** (cleanups, not blocking):
6. **Proxy rollup consistency** (`telemetry_lines.build_line`):
   - emit `AwsCalls` with both `[Service]` and `[Service, Attribution]`, as the Node rollups do, and drop the always-zero `CoreCalls` and `DbStatements` for the proxy;
   - align the Python AWS outcome word `failed` with Node's `error`.
7. **One terminal-observation path in control:**
   - `control.mjs` wires both the store's `onPublished` hook and the `turn-publish.mjs` observer around `service.publish`;
   - every `service.publish` goes through `store.append`, so the observer is redundant in production; the sequence dedupe absorbs the duplicate.
   - Either drop the observer from `control.mjs`, keeping it for the rehearsal fixture's in-memory store, or document why both stay.
8. **Pair-retire health fires twice:** one exchange `abort()` emits two health lines, `pair/retired` from `service_pair_discovery.py` and `exchange/retired` from `owner_https.py`. The alarm (≥ 1) is unaffected, but dashboard counts double. Either keep both and say so in TURN-TELEMETRY.md, or emit once.

**Then:** rebase if `main` moved, and update the PR description with A's gate results.

## 2. Scope: files outside plan §4

The orchestrator's list includes three Python files that §4 and §2.3 do name:
- `owner_startup.py`: §2.3, the binding source after placement;
- `response_settlement.py`: §4 timing points `:181` and `:190`;
- `lifetime.py`: §4 `PendingWork.quarantine`.

They are in plan. The rest:

| File | Why it changed (from the diff) | Decision |
| --- | --- | --- |
| `.github/workflows/meri-p0-telemetry.yml`, `scripts/qualification/p0-telemetry/*` (7 files) | Runs the §13 gates on GitHub runners for base and head | **Remove** (item 1) |
| `docs/hot-path/P0-IMPLEMENTATION.md`, `P0-VERIFICATION.md` | Implementation and verification record | **Remove**; move to the PR description and TURN-TELEMETRY.md (item 2) |
| `apps/control/conversations/lifecycle/journal.mjs` | `onPublished` after a validated cancellation stop-fence readback (lost cancel ACK) | **Keep.** Terminal states written outside `service.publish` would otherwise never yield `run.terminal` or a summary. It is post-commit, swallowed and adds no SQL. A test covers a lost ACK. |
| `apps/control/conversations/postgres-store.mjs` | `onPublished` option; called after `appendEvent` commits; passed to the journal | **Keep.** Covers cancellation and reconciler terminals. Fire-and-forget, errors swallowed, result identity unchanged. |
| `apps/runtime/native-authority/completion-capture.mjs` (+ test) | `observeCompletionPublication`: completed-run terminal from the journal's PUBLISHED result, or its validated readback after a lost ACK | **Keep.** Completion is the normal success terminal and never passes `service.publish`, so without this every completed turn lacks `run.terminal` and `resultMs`. No new SQL or authority call; the test pins an equal SQL count and a single summary on replay. No conflict with candidate 7 (§5). |
| `apps/runtime/prepared-run-registry.mjs` | One line: `currentTurnTelemetry()?.bind(binding)` after the binding is validated | **Keep.** Multi-run run-owner routes go through the registry, not `worker-http`, so their Core calls would otherwise be background. |
| `apps/runtime/runner-bootstrap-files.mjs` | Passes an optional `telemetry` into the remote runner's configuration | **Keep.** The remote runner needs `telemetry.environment` for its namespace. Validated by `config.mjs`. |
| `apps/runtime/config.mjs` | `telemetry` is now allowed for `conversation-runner`; `{environment}` alone is valid; OTel keys stay control-only and keep their old validation | **Keep.** The runner cannot declare `enabled` or `endpoint` (test pins it), so there is no exporter egress. OTel starts only on `enabled === true` (`control.mjs:155`), so a control config with only `environment` starts nothing. |
| `apps/proxy/product/startup-config.mjs`, `startup_config.py` | Optional closed `telemetry:{environment}` in the owner and proxy configs | **Keep.** It carries `Meri/<Env>` to owner and proxy. Invalid values refuse; absent defaults to Preview (the plan's one tolerated default). |
| `apps/proxy/product/service-task-leases.mjs` | `health('pair','retired',…)` on pair drift | **Keep.** It is the owner's "retire" transition (N12). One line. |
| `apps/proxy/product/service_pair_discovery.py` | `health('pair','retired')` on `abort()` and on identity drift | **Keep.** It is the proxy's retire transition (N12). See optional item 8. |
| *Also outside §4, not on the orchestrator's list* | | |
| `apps/runtime/cli.mjs` | Wraps the control-side Core `fetchImpl` (documents, current authority, retained task ports, reads composer) with `countingFetch(origin=Core)`; passes the instance down; runner process-start time and binding | **Keep.** This is §4's "verify each Core client receives this instance… pass the wrapped one in". Those composers are built in `cli.mjs`. |
| `apps/proxy/product/service_entrypoint.py` | Request scope plus `health('service-gate','unavailable', PRODUCT_PROXY_SERVICE_UNAVAILABLE / PRODUCT_CALLBACK_UNAVAILABLE)` once per transition | **Keep.** N12's `PRODUCT_*_UNAVAILABLE` events for the proxy. The `not-ready` refusal text is unchanged. |
| `apps/proxy/product/refusal_diagnostics.py` | `raw_writer()` accessor for the preserved fd; `telemetry.refusal(...)` inside `refused()`'s existing try | **Keep.** Required by §4 ("the same raw fd"). The legacy line and its 20/min budget are unchanged (tested). |
| New: `telemetry/turn-publish.mjs`, `turn-vocabulary.mjs`, `TURN-TELEMETRY.md`; `owner-request-telemetry.mjs`; `telemetry_context.py`; tests | Shared-module split | **Keep** (see optional item 7 for the publish observer) |

## 3. §9 checklist

| §9 item | Result | Evidence |
| --- | --- | --- |
| Diff touches only §4 files | **No:** items 1-2 to remove. Everything else is in §4, or a justified one-line seam (§2). | §2 |
| No budget or timeout constants | **Holds** | No changes to `budgets.py`, `runner-load-budget.mjs` or any `maxRequestMs`/`deadlineMs` value. `native-client.mjs` adds counting in `finally` only. |
| No auth or route changes | **Holds** | No route, header or authority-check change. Ingress (`ingress.py`) untouched. |
| No LiteLLM config or callback change | **Holds** | `litellm-product-config.yaml` and `upstream_callback.py` untouched. |
| No new runner egress | **Holds** | Runner telemetry is a stdout write only. The runner config refuses OTel keys. `countingFetch` is never installed in the runner. |
| Every line through the allowlist emitter | **Holds** | Node: `createTurnLineEmitter` rebuilds each line from `LINE_SCHEMAS`, reads only schema keys (`Object.hasOwn`), and derives metric names inside the module. Python: `telemetry_lines.build_line` uses closed vocabularies, including nested maps. |
| No `JSON.stringify(error)` / `str(exc)` | **Holds** | A grep of added production lines finds only `JSON.stringify(line)` of the rebuilt line. Codes go through `safeCode` (pattern + `TELEMETRY_CODES` vocabulary), with `msgHash` and `cause` as `RUNNER_FIRST_FAILURE` already computes them. |
| Ids pattern-checked | **Holds** | `safeId` (UUID or 32 hex, else `invalid`), and the Python `_id`. Run buckets are keyed only on valid ids. |
| Redaction: no tenant, actor, bearer, ARN, IP or error text | **Holds** | `bindingOf` copies only `runId`/`attemptId`/`conversationId`. The proxy's `bind` copies only the ids. Health codes are closed sets. |
| Secret-pin tests, both languages, every line type | **Holds** | Node `turn-lines.test.mjs` loops over every `LINE_SCHEMAS` key with the full poison set, including nested keys, a throwing `toJSON` and an unknown getter. Python `test_telemetry_lines.py` loops over every `EVENTS` entry with poisons in nested `aws`, `ownerExchanges`, `refusal`, headers and body. |
| Identity-preserving counting wrappers | **Holds** | `counting.test.mjs`: the same result and error object for fetch, AWS (promise, callback, sync throw) and the pool (promise, callback, acquired client); a throwing recorder changes nothing; pools keep identity (`counted===pool`); no Proxy objects. Python `_Resources` keeps result and error identity (`test_aws_wrapper…`). |
| Pinned text lines unchanged | **Holds in source:** `RUNNER_FIRST_FAILURE`, `RUNNER_RUNTIME_FAILED`, `PRODUCT_OWNER_*` and `PRODUCT_PROXY_REFUSED` emitters are byte-identical; the new JSON twins are added after them. **Suites:** the implementer reports the same 4 failures on base and head in the diagnostics selection, all host artifacts. A's in-image run is authoritative. | §2 notes; P0-VERIFICATION table |
| Never-throw | **Holds, except item 5** | Every hook is in `try{}catch{}`, `safe()` or `@_safe`. Promise writers have `.catch`. Store and journal observers are fire-and-forget. |
| Image gate 24/24 (uid 1000) | **Not run by the PR** (workflow refused before any step) | A's gate run |
| Rehearsals pass; counters equal the independent counter | **Implementer: passes on base and head, 164 = 164** (host Linux, no clock steps). In-image pending from A. | §4 |
| Observability template rendered, committed, test pins alarms | **Holds:** the committed template equals the renderer's output (test). Change set and apply are shipper steps. | §3.1 below |
| Live two-turn chat, post-deploy alarms | Shipper, after merge | — |

### 3.1 Infrastructure against plan §3

**Resources:** one standalone stack with 10 `AWS::Logs::MetricFilter`, 8 `AWS::CloudWatch::Alarm`, 1 dashboard, an SNS topic, and a conditional email subscription (`HasAlarmEmail`, parameter default empty). **No IAM, no log-group resources.** It is pinned by the test's resource-type count.

**Filters (§3.2):**
- the 10 filters match the table: runner first failure; owner unavailable and refused; proxy pair, exchange and all refusals; suppressed (owner, proxy); runtime unavailable (control, worker);
- every filter has `defaultValue: 0`;
- `DiagnosticsSuppressed` has no `Service` dimension: CloudFormation cannot attach a constant dimension and keep `DefaultValue`. The two filters stay separate by name. **Accepted;** fix the pattern (item 3).

**Alarms (§3.3):**

| Alarm | Threshold | Window | Evaluation |
| --- | --- | --- | --- |
| turn-failure-rate | > 20, guard total ≥ 3 | 30 min | 1/1 |
| timeout-failure | ≥ 1 | 5 min | 1/1 |
| first-text-p95 | > 20000 | 60 min | 1/1 |
| proxy-owner-unavailable | ≥ 1 | 5 min | 1/1 |
| budget-quarantine | ≥ 1 | 5 min | 1/1 |
| core-error-rate | > 5, guard ≥ 20 | 10 min | **2/2** |
| pair-refusals-sustained | ≥ 1 | 1 min | **3/3** |
| telemetry-dropped | ≥ 1 | 15 min | 1/1 |

- All alarms use `notBreaching`; all eight thresholds match §3.3.
- **Deviations, accepted:**
  - `timeout-failure` sums control **and runner** `TimeoutFailures`: the runner sees `DEADLINE` where control keeps `EXECUTION_FAILED`. The dashboard labels it a signal count;
  - `core-error-rate` reads per-status `meri.core.counters` companion records, because one EMF root cannot hold several values of `CoreCalls` (TURN-TELEMETRY.md);
  - `HealthEvents` carries both `[Service]` and `[Service, Component]`.
- **Gap:** item 4, runner `TelemetryDropped`.

**Dashboard `meri-<env>-hot-path`:**
- all §3.4 widgets, including the per-turn calls widget, which excludes background via `FILL(bg)` and is labelled "Clerk reads estimated";
- two Logs Insights widgets across all five log groups.

**Namespace and names:** `Meri/<Env>` and `meri-<env>-…` follow `environment`. Production is tested.

## 4. Rehearsal baseline: 164 is correct for `main`; plan updated

| Source | load | publish (×4) | `next-controls` polls | Total |
| --- | --- | --- | --- | --- |
| Candidate 5 `4797f7da` and my C6 branch (pre-B4): `adj-e-notes/final-firstturn.out`, live-median | 32 | 32 each = 128 | 16 × 4 = 64 | **224** |
| `main` `69fd1994` (base and PR head, implementer's measurement) | 32 | 22 each = 88 | 11 × 4 = 44 | **164** |

**Why the count dropped:**
- G's B4 `31888644` ("one session observation per fresh() pass", merged in candidate 6) took worker publish from 32 to 22 Core calls (dynamic), pinned in `load-amplification.test.mjs`. Load is unchanged.
- The shorter publishes also leave room for only about 11 polls of 4 Core calls each, instead of 16.
- C's capture-verify reduction does not enter this count: the rehearsal stubs `runner/checkpoint/complete` with 0 Core calls.

**The PR handles this correctly:** its rehearsal asserts telemetry equals the independent counter and only reports the reference.

**I updated `phases/P0-PLAN.md`:**
- §5 and §9: baseline 164, gate = equality with the independent counter, because the poll count depends on timing;
- §13.3: pre-B4 durations are marked as such, with no `main` timings recorded.

## 5. Overlap with candidate 7

**Textual:** `git merge-tree` of PR #195 with each branch finishes with no conflicts.
- **`fable/adj-c6-capture-self-stop-20261020` @ `51ad171e`** touches only `native-authority/task-router.mjs` and its test, not `task-checkpoint-source.mjs` or the remote client. There is no file overlap with the PR.
  - Semantically, `observeCompletionPublication` runs only after the completion journal publishes, or on its validated PUBLISHED readback.
  - The self-stop fix lets a forwarded capture finish instead of being cancelled. With both merged, those turns now yield `run.terminal` (completed) where they previously ended `ATTEMPT_LOST` through the reconciler, which the PR also observes.
  - No conflict; complementary.
- **`fable/adj-clerk503-load-20261020`** (`13bf6f7c`, `75ea643a`, `39fd6b42`) shares 4 files with the PR: `native-client.mjs`, `conversation-runner.mjs`, `remote-conversation-runner.mjs` and `first-turn-rehearsal.test.mjs`. The hunks are disjoint: `RUNNER_REPLAY_DELAYS_MS`, `loadMaxRequestMs: startup.load.attemptMs`, and a new `['live-tail',31,503]` reported case.
  - Semantically, P0 counts each HTTP attempt in `attempt()`'s `finally`. A replayed `runner/load` is therefore two `runOwner` calls, which is correct (two real requests).
  - `runner.load.done` marks once, after `native.call` resolves, that is, after the replay.
  - The PR's new rehearsal assertions apply only to the two "completes" tests, not the reported loop, so the added case is unaffected.
  - **Merge order does not matter; no change needed.**
- **`prepared-run-registry.mjs`:** neither candidate-7 branch touches it.

## 6. Notes for the shipper (no action for the agent)

**Telemetry configuration:**
- `deployment-inputs.json` has no `telemetry` key, so preview renders `{environment:'Preview'}` into the control, owner and proxy configs, and into the runner via `runnerConfiguration`.
- The O55 production stacks need `telemetry:{environment:'Production'}` in their deployment inputs.

**Expected log output:**
- The owner's `PRODUCT_OWNER_UNAVAILABLE` path also emits a JSON `meri.health` from a throwaway telemetry instance; there is no timer and nothing to close.
- `proxy-owner-unavailable` counts both, so one failure gives a sum of 2 (≥ 1 either way).
- The control `meri.turn.counters` line is emitted only after every concurrent outer operation for that run finishes. Post-terminal polls are background work by design, so per-turn counts exclude them.

## 7. Re-check of `e64b2231` (adj-e, 2026-10-20)

**Delta:** `43b705c8..e64b2231` is one fast-forward commit ("fix: address P0 telemetry validation feedback"), still on base `69fd1994`. The PR now has 64 files. I read the full code delta; no tests run here, and A is re-running the Docker gates on `e64b2231`.

### Verdict: **ACCEPT** (plan conformance)

It is conditional on A's 24/24 image gate and the in-image rehearsals on `e64b2231`. Two non-blocking nits are below.

| # | Item | Result |
| --- | --- | --- |
| 1 | Remove workflow + `scripts/qualification/p0-telemetry/` | **Done.** All 8 files deleted; nothing under `.github/` remains. |
| 2 | Remove `docs/hot-path/P0-*.md`; move to PR description + TURN-TELEMETRY.md | **Done.** Both deleted. TURN-TELEMETRY.md now covers the store `onPublished` path (including completion, cancellation, reconciler and lost-ACK readbacks), owner pre-reservation attribution, the proxy rollup dimensions and the suppressed-filter limit. The PR description holds the commands, results and the pre-existing-failures table (17 rows, all re-run on unchanged `69fd1994`). |
| 3 | Exact suppressed tokens | **Done.** `"PRODUCT_OWNER_DIAGNOSTICS_SUPPRESSED"` (owner group) and `"PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED"` (proxy group). A new test drives the real owner and proxy diagnostics past their burst and asserts each filter pattern equals the emitted token. Template regenerated (parity test). |
| 4 | Runner `TelemetryDropped` in the alarm | **Done.** 4 Service series (control, owner, proxy, runner), `SUM([control,owner,proxy,runner])`, 5 metric entries ≤ 10. Tests cover a runner writer failure surfacing in its closing rollup, plus alarm-series matching. |
| 5 | `server.py` outcome inside `_safe` | **Done.** New `@_safe http_outcome(status)` in `telemetry_context.py`; `server.py` calls it. Tests: every status class; `None` is contained and counted as dropped; a raising `telemetry.outcome` leaves the response bytes and `app.ready` unchanged. |
| 6 | Proxy rollup dims; `error` vocabulary | **Done.** `AwsCalls` has `[Service]` and `[Service, Attribution]`; no Core/DB metrics; `AWS_OUTCOMES` uses `error`, and `main.py`'s wrapper defaults to `error`. Tests pin both, including that the old `failed` label is dropped. |
| 7 | One terminal-observation path in control | **Done.** `control.mjs` drops `createTurnPublishObserver`. `service = Object.freeze({...rawService, ...observedInput})` still carries the `[taskControlPage]` symbol key, because spread copies enumerable own symbols. A new `p0-control-runner-telemetry` test runs real `assembleControl` over the lifecycle fixture: exactly one store observation per accepted publish (including a durable replay), one summary, and a refused write never observed. `turn-publish.mjs` stays for the rehearsal's in-memory store only, as item 7 allowed. |
| 8 | Pair-retire health once | **Done.** `ProductOwnerHttpsExchange.abort()` no longer emits; pair discovery's own `abort()` owns the single `pair/retired`. Tests: repeated abort, and an already-retired pair, each yield exactly one line. |

**Extra fix: writer release** (`apps/proxy/product/main.py`, a §4 file):
- `run_product_proxy`'s `finally` is now `try: <unchanged cleanup> finally: telemetry_lines.uninstall()`.
- **Correct:**
  - the rollup and `resources.close()` run first, so the terminal `resources/retired` health and the last rollup are written;
  - the borrowed raw-fd writer is released even when cleanup raises;
  - the original exception propagates (test: `assertIs` for shutdown, startup refusal, and a `CleanupUnknown` from `_Resources.close`);
  - a later emit returns False without writing.
- No cleanup ordering, timeout or error behaviour changed.
- **Within scope:** yes.

**No new out-of-scope edits:** the delta touches only files already in the PR (proxy `main.py`, `owner_https.py`, `telemetry_context.py`, `telemetry_lines.py`, `server.py`; `control.mjs`; tests; the observability module, test and template; TURN-TELEMETRY.md), plus `apps/proxy/product/test/test_main.py` for the writer-release test.

### Non-blocking nits (fold into P1, or leave)
- **Hard 164 pin:**
  - `first-turn-rehearsal.test.mjs` now asserts `r.coreCalls === 164` at live-median.
  - Load (32) and publish (22 each) are deterministic, but the `next-controls` poll share depends on timing. Before B4, quiet and median differed by exactly one poll (228 vs 224).
  - The implementer saw 164 for both quiet and median with no clock steps, so it looks stable. If A's run shows 160 or 168 while telemetry still equals the independent counter, that is poll timing, not a regression.
  - The sturdier form is to pin `perOperation['runner/load'].core === 32` and publish `=== 22 × requests`, keeping the total as a diagnostic.
- **Dead vocabulary:** `telemetry_lines.py` still lists component `exchange` and code `EXCHANGE_RETIRED`, which nothing emits now. Two closed-set entries; harmless, but removable.

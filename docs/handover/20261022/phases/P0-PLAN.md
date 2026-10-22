# P0: production telemetry and alarms for Meri (implementation plan)

**Audience:** an engineer who knows this repository but not Meri's history. Everything you need is here or in `docs/hot-path/`. When the plan says "verify", check the cited file before relying on it.

**References:**
- File:line references are against **`main` @ `69fd1994`** ("Merge candidate 6 (PR194) into main"). `apps/`, `packages/` and `infra/` there are identical to candidate 6 `5a8da2fd`.
- If `main` has moved, re-locate a reference by its function or string, never by line number alone.

**What you deliver:** **one pull request.** You never need AWS credentials, and you must not use any:
- every check in this plan runs on a Linux machine with Docker (§13);
- deploying the stacks (§3.5) and the live acceptance (§6, §9) are done afterwards by the Meri shipper, who validates your PR on preview.

**Why P0 exists:** Meri is being redesigned for latency (`docs/hot-path/ADR-HOT-PATH-REDESIGN.md`, phases P0-P7). Every later phase is verified **only** by the telemetry this phase adds, plus the existing CI image gate and rehearsals. There is no throwaway harness and no test-only path. So P0 must measure, in production and on preview, exactly the numbers the later phases promise to change.

## 0. Ten-minute orientation

**Services** (ECS on cluster `capiro-dev`, account 967807252336, us-east-1; preview stacks are named `meri-first-chat-*`):

| Role | Code | Log group (awslogs, 30-day retention) |
| --- | --- | --- |
| control: public API, run owner, journals | `apps/runtime/control.mjs`, `apps/control/**` | `/meri/product-preview/control` |
| temporal-worker | `apps/runtime/temporal-worker.mjs` | `/meri/product-preview/worker` |
| runner: one Fargate task per run; SDK + Claude CLI | `apps/runtime/conversation-runner.mjs`, `remote-conversation-runner.mjs`, `apps/worker/conversation/activity.mjs` | `/meri/product-preview/runner` |
| owner: model budget owner (Node, :8444) | `apps/proxy/product/owner-*.mjs`, `apps/gateway/budget/*` | `/meri/product-preview/owner` |
| proxy: Python/LiteLLM model gateway (:8443), the only Bedrock caller | `apps/proxy/product/*.py` | `/meri/product-preview/proxy` |
| issuer, temporal, migrator | — | (not instrumented in P0) |

The log groups are created by `infra/product-preview/first-chat-foundation.mjs:93-95`. Their names are in `infra/product-preview/first-chat/deployment-inputs.json:23-60`.

**A turn:**
1. The browser's Send is three control requests: `allocate`, `admit` (`apps/control/conversations/input/http.mjs:15-24`) and `submit`.
2. Control creates the run and starts a runner task.
3. The runner calls control's run-owner routes: `runner/load`, then `runner/publish` for `run.status` and for every `message.delta` (`apps/runtime/worker-http.mjs`), then `runner/next-controls` polls, then `runner/checkpoint/complete`.
4. The CLI's model requests go runner → proxy → owner (admission, reserve, settle) → Bedrock.
5. The turn ends when control accepts the terminal `run.status` (completed, failed or cancelled).

**What exists today:**
- **Plain stderr lines with fixed vocabularies:**
  - `RUNNER_FIRST_FAILURE …` and `RUNNER_RUNTIME_FAILED …` (`apps/runtime/runner-runtime-diagnostics.mjs:121-138`);
  - `RUNNER_STARTUP_FAILED …` (`runner-poststart-cli.mjs:32`);
  - `PRODUCT_OWNER_REFUSED …`, `PRODUCT_OWNER_DB_REFUSED …` and `PRODUCT_OWNER_UNAVAILABLE` (`apps/proxy/product/owner-diagnostics.mjs:35,38`; `owner-entrypoint.mjs:211-227`);
  - `PRODUCT_PROXY_REFUSED gate= step= [phase=] [at=] code=` (`apps/proxy/product/refusal_diagnostics.py:132-138`).
- **A few JSON stdout lines:** `{"event":"runtime.listening",…}` (`apps/runtime/cli.mjs:117`), `runtime.task-router.exchange` (`apps/runtime/native-authority/exchange-diagnostics.mjs:9-26`).
- **An OpenTelemetry module** (`apps/runtime/telemetry/`). It is control-only, **off by default**, and wired at `control.mjs:147,208-209`. **Do not extend it in P0:** the runner must never gain exporter egress (`telemetry/README.md:31`). P0 is log-based.
- **No metrics, alarms, metric filters or dashboards anywhere** in `infra/`.

## 1. Goal: the numbers P0 must produce

For **every turn** (key: `runId`; a turn retry is a new `attemptId`), queryable within 5 minutes:

| # | Number | Definition |
| --- | --- | --- |
| N1 | **Stage times** | Wall-clock ms of each stage mark in §2.2, relative to `t0` = control's receipt of the turn's `admit` request |
| N2 | **First text** | `delta.first.durable − t0`: the first `message.delta` control has durably accepted for the run |
| N3 | **Result** | `run.terminal − t0`, and the terminal state and `reasonCode` |
| N4 | **Core calls** | Count by route (`identity`, `context`, `membership`, `current`, `other`) and status class (`2xx`, `401`, `403`, `409`, `4xx`, `503`, `5xx`, `timeout`, `unanswered`), plus total ms. Per service, per turn |
| N5 | **Clerk-backed calls** | Core authority calls are Clerk-backed. Report `clerkReadsEstimate` = identity×1 + context×2 + membership×2 + current×1 + other×0 (the per-route online Clerk reads, documented in `docs/hot-path/adj-g-CORE-SIDE-DESIGN.md` §0). **It is an estimate and must be labelled so.** Exact Clerk counts need a Core-side change, which is out of scope |
| N6 | **ECS/EC2 calls** | Count by service and operation (`DescribeTasks`, `ListTasks`, …) and outcome; per service, per turn (control, owner) and per model request (proxy) |
| N7 | **DB statements** | Count and total ms per service, per turn (control, owner) |
| N8 | **Owner exchanges** | Count by channel (`operation`, `capture`, `admission`) and path (`OPEN`, `OPERATION`, `POLL`, `REPLY`), plus total ms; per model request (proxy side) |
| N9 | **Model request** | Per model request: proxy bootstrap ms, Bedrock response-headers ms, **first Bedrock chunk ms (TTFT)**, end of stream ms, settle ms; outcome |
| N10 | **Failure class** | For a failed turn: the runner's first-failure fields (`origin`, `stage`, `code`, `class`, `exit`, `signal`), the terminal `reasonCode`, and a derived `timeoutClass` (§2.4) |
| N11 | **Latency distributions** | p50 and p95 of N2 and N3 over any window (CloudWatch percentiles on the EMF metric) |
| N12 | **Health events** | Each proxy/owner quarantine, poison or retire, each budget quarantine, and each `PRODUCT_*_UNAVAILABLE`, with a timestamp |

## 2. Design

### 2.1 Mechanism: one JSON line per event, using CloudWatch EMF

- **Every new signal is one JSON line** written to the process's existing log stream (stdout for Node, the proxy's raw stderr fd for Python), using **CloudWatch Embedded Metric Format (EMF)**. awslogs ships it, and CloudWatch extracts the metrics.
- **Why EMF:**
  - no IAM change (no `PutMetricData`);
  - no network egress, which the runner must not have;
  - no collector;
  - each line is also a Logs Insights record joinable by `runId`.
- **Schema:** every line has `"schema":"meri.telemetry/1"` and `"event":"<name>"`. Lines are written synchronously, one `write` per line, ≤ 8 KB.
- **The existing text lines** (`RUNNER_FIRST_FAILURE`, `PRODUCT_*`) **stay byte-for-byte unchanged**: tests pin them. P0 adds JSON twins next to them.
- **Never block or throw.** A failure to build or write a telemetry line is swallowed (try/catch) and counted in a process-local `telemetryDropped` counter, reported in the next rollup (§2.2 `meri.process.rollup`).
- **Metric namespace:** `Meri/<Env>`, where `Env` is `Preview` now and `Production` for the O55 production stacks. It comes from one config value, `telemetry.environment`, rendered per stack. It defaults to `Preview` when absent. **The default is the one place P0 tolerates an absent value.**
- **Dimensions are low-cardinality only:**
  - allowed: `Service` (`control` / `runner` / `owner` / `proxy`), `Stage`, `Route`, `Outcome`, `Operation`, `Component`;
  - **never** a run, conversation, tenant or user id as a dimension. Those are EMF *properties* (Logs Insights fields), not dimensions.

### 2.2 Line types

All times are `epochMs` (wall clock, `Date.now()` / `time.time_ns()//1e6`) unless named `…Ms` as a duration. `runId`, `attemptId`, `conversationId` and `requestId` must match the UUID pattern `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (case-insensitive) or a 32-hex string (the proxy's `uuid4().hex`). Anything else is replaced by `"invalid"`.

| `event` | Emitted by | When | Fields (properties) | EMF metrics (dimensions) |
| --- | --- | --- | --- | --- |
| `meri.turn.stage` | control, runner | at each stage mark in the table below, **once per run per stage** (the first time) | `service`, `runId`, `attemptId`, `stage`, `atMs` | none (Logs Insights only) |
| `meri.turn.summary` | control | when control accepts the terminal `run.status` | `runId`, `attemptId`, `conversationId`, `state`, `reasonCode`, `t0Ms` (or null), `stages:{name:atMs}` (control's own), `firstTextMs` and `resultMs` (null if `t0Ms` unknown), `deltaPublications` (the count of `message.delta` accepted), `timeoutClass` | `FirstTextMs`, `ResultMs` (`Service`), only when known; `Turns` (`Service`,`Outcome`), where `Outcome` = completed/failed/cancelled; `TimeoutFailures` (`Service`) = 1 if `timeoutClass` ≠ `none` |
| `meri.turn.counters` | control, owner, runner | control: at the run's terminal `run.status`; owner: at the settle of each model request (one line per request, keyed by `runId`); runner: at process exit | control and owner: `service`, `runId`, `attemptId`, `core:{route:{statusClass:count}}`, `coreMs`, `clerkReadsEstimate`, `aws:{operation:{outcome:count}}`, `awsMs`, `db:{statements, ms}`. The **runner** makes no direct Core, AWS or DB calls; it reports `runOwner:{operation:{statusClass:count}}` and `runOwnerMs` for its calls to control (`runner/load`, `runner/publish`, `runner/next-controls`, …), counted in `native-client.mjs`'s request path | `CoreCalls`, `ClerkReadsEstimate`, `AwsCalls`, `DbStatements` (`Service`); runner: `RunOwnerCalls`, `RunOwnerMs` (`Service`) |
| `meri.turn.failure` | runner | right after the existing `RUNNER_FIRST_FAILURE` line (same moment, same data) | `runId`, `attemptId`, `origin`, `stage`, `code`, `class`, `exit`, `signal`, `cause`, `msgHash`, `timeoutClass` | `RunnerFailures` (`Service`,`Stage`) |
| `meri.model.request` | proxy | at the end of each model request (`InferenceApp` lifetime close) | `runId`, `attemptId` (from the owner placement's binding; `"unknown"` if the request was refused before placement), `requestId` (proxy uuid), `outcome` (`completed` / `refused` / `failed` / `cancelled`), `refusal:{gate,step,code}` (if refused), `bootstrapMs`, `bedrockHeadersMs`, `firstChunkMs`, `streamEndMs`, `settleMs`, `ownerExchanges:{channel:{path:count}}`, `ownerExchangeMs`, `aws:{operation:{outcome:count}}`, `awsMs`, `inputTokens`, `outputTokens` | `ModelRequests` (`Service`,`Outcome`), `ModelTtftMs`, `ModelBootstrapMs`, `OwnerExchanges`, `ProxyAwsCalls` (`Service`) |
| `meri.health` | proxy, owner | on each state transition into quarantine, poison or retire, and on `PRODUCT_*_UNAVAILABLE` | `service`, `component` (e.g. `bootstrap`, `pending-work`, `owner-gate`, `pair`, `service-gate`, `facts`, `credential-delivery`, `currentness`), `transition` (`quarantined`/`poisoned`/`retired`/`unavailable`), `code` (fixed vocabulary) | `HealthEvents` (`Service`,`Component`) |
| `meri.budget.quarantined` | owner | when settlement sets `budget.quarantined` | `runId`, `attemptId`, `reason` (fixed code) | `BudgetQuarantines` (`Service`) |
| `meri.process.rollup` | control, owner, proxy | every 60 s | `service`, `windowMs`; unattributed totals `core`, `aws`, `db`, `ownerExchanges` (work not inside any run context: background renewals, pair-proof watch, startup); `telemetryDropped` | `CoreCalls`, `AwsCalls`, `DbStatements` (`Service`,`Attribution=background`); `TelemetryDropped` (`Service`) |

**Stage marks** (`meri.turn.stage.stage` values; **closed list**, so extend it only by editing the schema):

| Stage | Service | Where it fires |
| --- | --- | --- |
| `send.admit.received` (= **t0**) | control | entry of the admit handler, `apps/control/conversations/input/http.mjs:~15-24`, once the run binding is known from `service.admitInput`'s result. Record `atMs` taken at **handler entry**, and emit after the binding is known |
| `send.submit.accepted` | control | submit handler success (same file; locate the submit route; verify) |
| `run.starting`, `run.running` | control | the first accepted `run.status` of that state (the publish observer, §2.3) |
| `runner.process.start` | runner | first line of `apps/runtime/cli.mjs` for the runner role, once the binding is known (emit the `atMs` captured at process start) |
| `runner.load.done` | runner | after `runner/load` returns (conversation-runner) |
| `runner.query.start` | runner | the activity `diagnostic('stage','activity-query')` (`apps/worker/conversation/activity.mjs:104`) |
| `delta.first.durable` | control | the first `message.delta` accepted by `service.publish` for the run (the publish observer) |
| `run.terminal` | control | the terminal `run.status` accepted (the publish observer) |

**Redaction rules** (enforced in one function per language, and tested):
1. **Allowed fields only:** each line type has an explicit allowlist (the table above). A field not on the list is dropped, never "best-effort serialized".
2. **Ids:** only `runId`, `attemptId`, `conversationId` (random UUIDs) and the proxy's `requestId` (`uuid4().hex`), validated by pattern.
3. **Never in any field:**
   - `tenantId`, `actorId` or any user, tenant or client identifier;
   - bearer or credential values or their hashes;
   - grant ids, task ARNs, ENI ids, IPs, URLs or paths with ids, query strings, headers or bodies;
   - error messages, SQL or Core response content.
   - The existing `meri.run` OTel span exports `meri.tenant.id` (`telemetry/run-lifecycle.mjs:20`). Leave OTel alone, but **do not copy** that into P0 lines.
4. **Codes and stage, step and gate names:** they must match `^[A-Za-z0-9_.:-]{1,64}$` and come from code constants, otherwise they become `"other"`.
5. **`cause`, `msgHash` and `site`** only as `RUNNER_FIRST_FAILURE` already computes them (hashed or allowlisted, `runner-runtime-diagnostics.mjs:64-94`).
6. **Python:** the same rules. Note `refusal_diagnostics.py:13-14` forbids identifiers in *refusal* lines. That rule stays for `PRODUCT_PROXY_REFUSED`. P0's new `meri.model.request` line is a separate, reviewed line type allowed to carry `runId`, `attemptId` and `requestId` (UUIDs only).

### 2.3 Correlating a turn

| Hop | Id available | How P0 gets it |
| --- | --- | --- |
| Browser → control | none in the browser (the frontend has no telemetry) | **t0 is server-side:** control's receipt of `admit`. The capiro-frontend change is out of scope for P0; noted in §7 |
| control | `binding.runId`/`attemptId` on every run-owner request (`worker-http.mjs`, `input.binding`) and in every published event (`event.binding`) | **The publish observer:** wrap `service.publish` exactly as `telemetry/run-lifecycle.mjs:28-31` (`observeRunOwner`) does, but **always on** (independent of `telemetry.enabled`). **Counters:** an `AsyncLocalStorage` turn context set by `worker-http.mjs` around each run-owner operation (from `input.binding`) and by the Send routes after admit |
| runner | `configuration.binding` (`remote-conversation-runner.mjs:35`) | Store the binding in the diagnostics context of `runner-runtime-diagnostics.mjs` (`AsyncLocalStorage`, line 26) when the runner starts |
| proxy | the run binding arrives in the owner placement reply (`owner_startup.py:89`, `ProductSession` `:139-157`), keyed by the bearer hash; the proxy's own `request_id` (`:144`) | Read `runId`/`attemptId` from the `ProductSession.binding` dict after placement. The runner cannot send correlation headers (`ingress.py:100-102` refuses `x-meri-*`), **and P0 must not change that** |
| owner | `requestId` and binding in OPEN and reservation frames (`owner-channel.mjs:135,238`) | Turn context keyed by `requestId` → `runId` |

Joining all services for one turn uses **Logs Insights across the five log groups** on `runId` (the dashboard query in §3.4).

### 2.4 Failure and timeout classification

`timeoutClass` is computed in one shared function (Node, plus a Python twin for the proxy) from the codes. It returns one of:
- `none`;
- `deadline`: code `DEADLINE`, `RUNTIME_STARTUP_TIMEOUT`, `RUNTIME_SHUTDOWN_TIMEOUT`, `PRODUCT_OWNER_STARTUP_TIMEOUT`, or a proxy refusal `code=DEADLINE`;
- `transport-timeout`: `PINNED_NATIVE_TIMEOUT`, `REMOTE_RUNNER_CLEANUP_UNKNOWN`, `SDK_CLEANUP_UNKNOWN`;
- `upstream-unavailable`: `NATIVE_UNAVAILABLE`, `PINNED_NATIVE_STATUS_503`, Core `503` / `timeout` / `unanswered`.

A turn with `timeoutClass ≠ none` counts toward the **"0 timeout failures"** gate (ADR §7.5). Unit-test every mapping.

## 3. AWS side

### 3.1 The new stack

- **One new, standalone CDK stack:** `meri-first-chat-observability`.
- **Why standalone:** the app, issuer and model stacks have tests that pin their exact resource lists or forbid `AWS::Logs::*`:
  - `manifest.test.mjs:35-36`;
  - `first-chat-issuer-service.test.mjs:37,39`;
  - `model-proxy-template.test.mjs:15`.
  Adding resources there would break them.
- **Files:**
  - `infra/product-preview/first-chat-observability.mjs`: same style as `first-chat-foundation.mjs` (aws-cdk-lib, `BootstraplessSynthesizer`, export a function returning `Template.fromStack(stack).toJSON()`). Inputs: the 5 log-group names (from `first-chat/deployment-inputs.json`), `environment` (`Preview`), `alarmEmail` (optional).
  - `infra/product-preview/first-chat/observability.template.json`: the committed synthesized template, as `foundation.template.json` is.
  - `infra/product-preview/first-chat-observability.test.mjs`: see §5.
  - `infra/product-preview/render-observability.mjs`: a small CLI that writes the template from `deployment-inputs.json`. Mirror how the foundation template was produced.
- **Resource names:** prefix `meri-preview-…` (production: `meri-production-…`, from `environment`).

### 3.2 Metric filters (for existing text lines; EMF lines need none)

| Filter | Log group | Pattern | Metric (namespace `Meri/<Env>`) |
| --- | --- | --- | --- |
| runner first failure (text, kept for safety) | runner | `"RUNNER_FIRST_FAILURE"` | `RunnerFirstFailureLines` |
| owner unavailable | owner | `"PRODUCT_OWNER_UNAVAILABLE"` | `OwnerUnavailableLines` |
| owner refusals | owner | `"PRODUCT_OWNER_REFUSED"` | `OwnerRefusedLines` |
| proxy pair or exchange refusals | proxy | `"PRODUCT_PROXY_REFUSED gate=pair"` and a second filter `"PRODUCT_PROXY_REFUSED gate=exchange"` | `ProxyPairRefusals`, `ProxyExchangeRefusals` |
| proxy refusals (all) | proxy | `"PRODUCT_PROXY_REFUSED"` | `ProxyRefusedLines` |
| diagnostics suppressed | owner, proxy | the exact tokens `"PRODUCT_OWNER_DIAGNOSTICS_SUPPRESSED"` (owner) and `"PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED"` (proxy); corrected 10-20 from the bare `"DIAGNOSTICS_SUPPRESSED"` | `DiagnosticsSuppressed` (two filters) |
| runtime unavailable | control, worker | `"RUNTIME_UNAVAILABLE"` | `RuntimeUnavailable` |

Set `defaultValue: 0` for all of them, so alarms see zeros.

### 3.3 Alarms

All alarms go to one SNS topic, `meri-<env>-alarms`, with an email subscription from `alarmEmail` when provided. The subscription needs a manual confirmation click. Every alarm has `TreatMissingData: notBreaching`, except where noted.

| Alarm | Expression | Threshold | Period / evaluation |
| --- | --- | --- | --- |
| `meri-<env>-turn-failure-rate` | `100*failed/(completed+failed)` from `Turns` by `Outcome`, with a guard `completed+failed ≥ 3` (metric math `IF(total>=3, rate, 0)`) | > 20 | 30 min, 1 of 1 |
| `meri-<env>-timeout-failure` | `TimeoutFailures` Sum | ≥ 1 | 5 min, 1 of 1 (the O55 gate is 0) |
| `meri-<env>-first-text-p95` | `FirstTextMs` p95 | > 20000 | 60 min, 1 of 1 |
| `meri-<env>-proxy-owner-unavailable` | `HealthEvents` Sum (all components, `Service` in owner/proxy) + `OwnerUnavailableLines` | ≥ 1 | 5 min, 1 of 1 |
| `meri-<env>-budget-quarantine` | `BudgetQuarantines` Sum | ≥ 1 | 5 min, 1 of 1 |
| `meri-<env>-core-error-rate` | `100*(core 5xx + 503 + timeout + unanswered)/core total`, from the control and owner `CoreCalls` split by status class (emit `CoreCalls` with an extra `StatusClass` dimension on the rollup and counters lines to make this possible), guard total ≥ 20 | > 5 | 10 min, 2 of 2 |
| `meri-<env>-pair-refusals-sustained` | `ProxyPairRefusals + ProxyExchangeRefusals` Sum | ≥ 1 | 1 min, **3 of 3** (refusals for over 2 min; one startup burst within 60 s of a deploy is normal) |
| `meri-<env>-telemetry-dropped` | `TelemetryDropped` Sum | ≥ 1 | 15 min, 1 of 1 |

### 3.4 Dashboard `meri-<env>-hot-path`

- **First text and result:** `FirstTextMs` and `ResultMs` p50 and p95 (1 h and 1 d).
- **Turns:** by `Outcome`; `TimeoutFailures`.
- **Per-turn calls:** `CoreCalls`, `ClerkReadsEstimate`, `AwsCalls` and `DbStatements` per turn, by service.
- **Model requests:** `ModelTtftMs` and `ModelBootstrapMs` p50/p95; `OwnerExchanges` per request.
- **Health:** `HealthEvents` by component; `BudgetQuarantines`; the pair-refusal metrics.
- **Logs Insights widget "turn detail"**, across all five log groups:

  ```
  fields @timestamp, @log, event, service, stage, atMs, firstTextMs, resultMs, state, reasonCode, timeoutClass, core.*, aws.*, db.*, ownerExchanges.*, firstChunkMs
  | filter schema = "meri.telemetry/1" and runId = "<paste runId>"
  | sort atMs asc
  ```

- **Logs Insights widget "last 20 turns":** `filter event="meri.turn.summary" | sort @timestamp desc | limit 20`.

### 3.5 Applying it (the shipper only; documented, not run by you)

**For the implementer:**
- **Your part ends at a committed, rendered template that passes its test** (§5 item 8).
- **Don't run these commands.** They need AWS credentials you don't have and must not use.

1. `node infra/product-preview/render-observability.mjs > infra/product-preview/first-chat/observability.template.json`, then commit.
2. Review:

   ```bash
   aws cloudformation deploy --profile capiro-dev --region us-east-1 \
     --stack-name meri-first-chat-observability \
     --template-file infra/product-preview/first-chat/observability.template.json \
     --parameter-overrides AlarmEmail=<email> --no-execute-changeset
   ```

   Then review the change set.
3. Execute the change set and wait.
4. Confirm the SNS subscription email.

No IAM capability is needed: there are no roles. Add the template to the ship packet's hash pins (`first-chat/ship-packet.mjs:194`) **only** if the shipper asks; it is not an app stack.

## 4. File-by-file change list (keep each change small)

**New shared Node modules** (`apps/runtime/telemetry/`, next to the OTel code but independent of it):
- `turn-lines.mjs`:
  - `emit(event, fields, metrics)`: builds one EMF line and writes it with `process.stdout.write`; does the allowlisting, id-pattern and code-pattern redaction; never throws;
  - the line schemas (the §2.2 table as data);
  - `timeoutClass()`.
- `turn-context.mjs`: an `AsyncLocalStorage` turn context `{runId, attemptId}`, per-run counters (bounded Map, max 10,000 runs, oldest evicted), the `background` counters, and the 60 s rollup timer (`unref()`).
- `counting.mjs`. Three wrappers that only count and time, never change a result or an error:
  - `countingFetch(fetchImpl)`: classifies Core routes by URL path suffix (`/application-authority/identity|context|membership|current`, else `other`) and records the status class (or `timeout` / `unanswered` from the rejection);
  - `countingAwsClient(client)`: wraps `send(command)`; records `command.constructor.name` without the `Command` suffix and the outcome;
  - `countingPool(pool)`: wraps `query` and `connect` the way `owner-diagnostics.mjs:44-56` `createDiagnosticPool` does.

**Control:**
- `apps/runtime/control.mjs` / `prepared-candidate.mjs`:
  - wrap the injected `fetchImpl` (`prepared-candidate.mjs:91`, `c.fetchImpl??fetch`) with `countingFetch`. **Verify** each Core client receives this instance; list any that fall back to `globalThis.fetch` and pass the wrapped one in (`authority-http.mjs:28`, `core-membership.mjs:36`, …);
  - wrap the ECS/EC2 clients (`control.mjs:177`, `prepared-candidate.mjs:172`);
  - wrap the pool (`control.mjs:157`);
  - wire the publish observer unconditionally (a sibling of `run-lifecycle.mjs`'s `observeRunOwner`).
- `apps/runtime/worker-http.mjs`: run each run-owner operation inside the turn context from `input.binding`.
- `apps/control/conversations/input/http.mjs`: the `send.admit.received` (t0) and `send.submit.accepted` marks. t0 is kept in the turn context, keyed by `runId` for the summary.

**Runner:**
- `apps/runtime/runner-runtime-diagnostics.mjs`:
  - store the binding in the context;
  - `markRunnerStage` also emits `meri.turn.stage` for the listed stages;
  - `captureRunnerFailure` also emits `meri.turn.failure`, after the unchanged text line.
- `apps/runtime/remote-conversation-runner.mjs` / `conversation-runner.mjs`: pass the binding in; emit `meri.turn.counters` at exit.
- `apps/runtime/native-client.mjs`: count each run-owner request (operation, status class, ms) into the runner's turn context. Count only: no change to its timeout or retry. **P1 also edits this file** (§12).
- **No network exporter, ever.**

**Owner (Node):**
- `apps/proxy/product/owner-diagnostics.mjs`: add `health(component, transition, code)` and `budgetQuarantined(...)` emitters (via `turn-lines.mjs`).
- Call `health` where state flips (each a one-line addition):
  - `serviceGate.poison()` (`owner-channel.mjs:65,91,159,175,404,421`; `owner-https.mjs:63,69`);
  - `quarantined=true` (`service-pair-discovery.mjs:173`, `product-owner-facts.mjs:174`, `owner-credential-delivery.mjs:122`, `owner-native-currentness.mjs:108-112`);
  - `PRODUCT_OWNER_UNAVAILABLE` (`owner-entrypoint.mjs:227`).
- `apps/gateway/budget/product-model-settlement.mjs:109-115`: `budgetQuarantined`.
- `owner-entrypoint.mjs:117-118`: wrap the ECS/EC2 clients; the diagnostic pool already wraps queries, so add counting there.
- Turn context from the `requestId` and binding in OPEN and reservation frames (`owner-channel.mjs:135,238`).

**Proxy (Python):**
- New `apps/proxy/product/telemetry_lines.py`:
  - writes JSON lines to the **same raw fd** that `refusal_diagnostics.install_stderr()` uses (`refusal_diagnostics.py:69-74`). `main.py:359-366,382` discards normal stdout/stderr, so `print` or `logging` will not reach CloudWatch;
  - the same allowlist and redaction rules;
  - **not** subject to the 20/min refusal budget, because it has its own bounds: one `meri.model.request` per request, health lines only on transitions, one rollup per minute.
- `main.py:72-84`: `_Resources.track_client` already wraps every ECS, EC2 and Bedrock method, so add timing and outcome counting there.
- `owner_https.py:228-268` (`_send`): count channel, path and ms.
- `qualification/runtime/server.py:47-169`: emit `meri.model.request` at `life.close()` (`:169`). `server.py:62` already counts output bytes.
- Timing points:
  - Bedrock headers: `main.py:208`;
  - first chunk: `main.py:216`;
  - end of stream: `response_settlement.py:181`;
  - settle: `:190`.
- Health lines:
  - `PendingWork.quarantine` (`lifetime.py:47-52,171`);
  - bootstrap `_quarantine` (`host_composition.py:322`);
  - `OwnerHostGate.poison` (`owner_channel.py:203`);
  - exchange `abort()` (`owner_https.py:264`).
- **Do NOT:**
  - add a LiteLLM callback or edit `litellm-product-config.yaml`. Its SHA is pinned (`main.py:34`, Dockerfile), and `registration_current()` (`upstream_callback.py:100-109`) would make the proxy not ready;
  - change the ingress header refusals.

**Infra:** §3.1.

## 5. Tests

**New unit tests** (Node: `node --test`, next to each module; Python: the proxy suite's existing style):
1. **Per line type:** schema shape, the EMF `_aws` block (namespace, dimensions, metric names), and the allowlist (unknown fields dropped).
2. **The secret pin, in both languages:** emit every line type with an input object that also contains these "poison" values. Assert that none of them appears anywhere in the output bytes:
   - `tenantId`, `actorId`, `bearer`, `authorization`, a grant id, a task ARN, an IP, a URL with a query, an error message, an SQL string.
   Make it a table-driven test so a new line type must be added to it.
3. **Ids:** a non-UUID becomes `"invalid"`; codes outside the pattern become `"other"`.
4. **`timeoutClass`:** every mapping in §2.4.
5. **Counting wrappers:** the same result and the same thrown error as the unwrapped call (identity), and the counters increment once per call with the right route, status class and operation.
6. **The publish observer:**
   - `delta.first.durable` fires once per run;
   - `meri.turn.summary` at the terminal state;
   - `firstTextMs` null when t0 is unknown;
   - **publish results and errors are unchanged.**
7. **Never throws:** a writer that throws does not break publish, Core calls, or the proxy request; `telemetryDropped` increments.
8. **Infra:** `first-chat-observability.test.mjs` pins:
   - the resource types (`AWS::Logs::MetricFilter`, `AWS::CloudWatch::Alarm`, `AWS::CloudWatch::Dashboard`, `AWS::SNS::Topic`, `AWS::SNS::Subscription` (conditional));
   - **no IAM**;
   - the alarm names and thresholds in §3.3;
   - log-group names from the inputs;
   - the committed template equals the rendered one.

**Existing gates that must stay green:**
- **The image build gate:** `infra/product-preview/image-build-producer.py` `LINUX_ONLY_TESTS` must report exactly 24 cases (`B` 6, `R` 6, `W` 12) with no failures, run as uid 1000 in the Linux runtime image.
- **Every suite that pins the existing text lines.** All of these must pass unchanged:
  - `apps/runtime/test/runner-runtime-diagnostics.test.mjs`, `runner-first-failure.test.mjs`, `pinned-native-transport.test.mjs`, `activity-runtime-diagnostics.test.mjs`;
  - `apps/runtime/native-authority/test/sdk-initialization-milestones.test.mjs`, `native-start-router-budget.test.mjs`;
  - the owner diagnostics tests;
  - the proxy refusal-diagnostics tests.
- **Rehearsals:** `apps/runtime/test/first-turn-rehearsal.test.mjs` and `d3-rehearsal.test.mjs` (Linux, POSIX only). Extend the first-turn rehearsal to capture stdout, parse the new lines, and assert:
  - the stage marks appear in order;
  - `meri.turn.summary` has `firstTextMs` and `resultMs`;
  - control's `CoreCalls` per turn equals the rehearsal's own Core counter. **The baseline on `main` @ `69fd1994` is 164** for a median 2-delta first turn: load 32, four publishes × 22, and about eleven `next-controls` polls × 4. The poll count depends on timing, so the gate is equality with the independent counter, not a fixed total. (Corrected 10-20: the earlier 224 was measured before G's B4 `31888644`, which cut publish from 32 to 22 Core calls; the shorter publishes leave time for 11 polls instead of 16.)
  Leave the rehearsal's timings untouched.
- **`apps/control/conversations/test/load-amplification.test.mjs`:** its Core-call pins must not change. P0 counts; it does not add calls.

## 6. Acceptance criteria (the validator checks these on preview)

After the shipper deploys P0 (app, model and observability stacks) and runs **one live two-turn chat**:
1. **The dashboard shows both turns:**
   - for each `runId`: every stage time from §2.2 in order;
   - `firstTextMs` and `resultMs`;
   - control and runner `CoreCalls` and `ClerkReadsEstimate`;
   - `AwsCalls` and `DbStatements`;
   - at least one `meri.model.request` per turn, with `firstChunkMs` and `ownerExchanges`.
2. **The numbers match the logs:** the Logs Insights "turn detail" query returns the same values, and counts equal the number of matching log records. Spot-check at least: the Core calls in control, which must equal the `CoreCalls` metric sum for those runs, and the owner exchanges in the proxy.
3. **Every alarm exists and is `OK`** (or `INSUFFICIENT_DATA` for the percentile alarm), and the SNS topic has a confirmed subscription.
4. **No new line contains a forbidden field.** A Logs Insights query for `tenantId`, `actorId`, `authorization` and `bearer` over the five groups returns 0 P0 records.
5. **No behaviour change:**
   - the image gate is 24/24;
   - the rehearsals pass;
   - turn outcomes and first-text times are within noise of the pre-P0 candidate on the same preview (compare the two turns against the rehearsal numbers: quiet / median first text 22.7 / 37.8 s in-process).

## 7. Out of scope

- No behaviour change of any kind: no retries, budgets, timeouts, auth, routes or headers.
- **Budget values** (P1).
- **Auth or Core changes** (P3, PC).
- No OTel expansion and no exporter.
- No browser or frontend instrumentation. A capiro-frontend change could add a client "Send clicked → first text rendered" line later; P0's t0 is control's receipt of `admit`.
- No exact Clerk counts (Core-side).
- No issuer or Temporal metrics.

## 8. Rollback

- **Code:** redeploy the previous release. The new lines are additive and nothing reads them at runtime.
- **AWS:** `aws cloudformation delete-stack --stack-name meri-first-chat-observability` removes the filters, alarms, dashboard and topic. The log groups (foundation) and their data are untouched.
- **No migrations.** The O55 rule applies: rollback is the previous release; no runtime switch.

## 9. Validation checklist (for the validator)

- [ ] **The diff touches only the files in §4:**
  - no budget or timeout constants;
  - no auth or route changes;
  - no LiteLLM config or callback change;
  - no new runner egress.
- [ ] **Each new line:**
  - goes through the allowlist emitter;
  - uses no `JSON.stringify(error)` or `str(exc)`;
  - has its ids pattern-checked.
- [ ] **The secret pin test** exists in both Node and Python and covers every line type.
- [ ] **The counting wrappers are identity-preserving:** a test asserts the same result and the same error.
- [ ] **The pinned text lines are unchanged:** their suites pass without edits.
- [ ] **The image gate is 24/24** on the PR head (§13.2, uid 1000).
- [ ] **The rehearsals pass,** and the first-turn rehearsal's new counters equal its independent Core counter (164 at median on `main` @ `69fd1994`).
- [ ] **The observability template** is rendered and committed, its test pins the alarms, the change set was reviewed, and the stack applied.
- [ ] **Live two-turn chat:** §6 items 1-5 hold, with screenshots of the dashboard and the Logs Insights output in the validation report.
- [ ] **After the deploy:** `meri-<env>-pair-refusals-sustained` stays OK beyond the first 2 min, and `telemetry-dropped` is OK.

## 10. Base branch

- **Branch from `main`** (`69fd1994` or later). If `main` advances while you work, rebase before opening the PR, and re-run §13.2-§13.4 on the rebased head.
- **Branch name:** `feat/meri-p0-telemetry`. One PR into `main`. The PR description lists:
  - the §13 commands you ran and their summary output (the gate's JSON verdict line; each suite's `ℹ tests / pass / fail`);
  - **a "pre-existing failures" table:** each failing test with its result on the PR's base commit, so the shipper can see nothing new fails.
- **You stop at the PR.** The shipper applies the observability stack (§3.5), deploys, runs the live two-turn chat and checks §6. Don't run any `aws` command, and don't add credentials anywhere.

## 11. Effort

About **5-7 engineer-days:**

| Work | Days |
| --- | --- |
| Shared Node modules and tests | 1.5 |
| Control wiring | 1 |
| Runner | 0.5 |
| Owner | 0.5 |
| Proxy (Python) | 1.5 |
| Observability stack and test | 1 |
| Rehearsal extension and gate runs | 0.5 |

## 12. Parallelism with P1 (the budget table)

**P1 replaces** the per-module default timeouts with one nested budget table (`packages/runtime/hot-path-budgets.mjs`, generalizing `packages/runtime/runner-load-budget.mjs`). It touches the **constructors** of the clients:
- `native-client.mjs`, `session-client.mjs`, `remote-task-boundary.mjs`;
- the broker in `temporal-worker.mjs`, owner exchanges, and the Python `owner_startup.py` / `host_composition.py` caps.

**Files both phases touch:**

| File | P0 change | P1 change | Conflict risk |
| --- | --- | --- | --- |
| `apps/runtime/control.mjs`, `prepared-candidate.mjs` | wrap fetch, AWS clients and pool | pass budgets from the table | low: different lines; rebase |
| `apps/runtime/conversation-runner.mjs`, `remote-conversation-runner.mjs` | pass the binding to diagnostics; emit counters | runner stage budgets from the table | medium: same composition blocks |
| `apps/proxy/product/owner-https.mjs`, `owner-channel.mjs`, `owner-entrypoint.mjs` | health lines, exchange counting | exchange and request budgets | medium |
| `apps/proxy/product/owner_https.py`, `host_composition.py`, `main.py` | counting, timing, health lines | caps from rendered config | medium |
| `infra/product-preview/first-chat/render-material.mjs` | `telemetry.environment` value | the budget table values | low |
| `apps/runtime/native-client.mjs` | count run-owner requests | its request budget comes from the table | low: P0 adds counting around the existing request; P1 changes the timeout source |

**Recommendation:**
- **P0 and P1 can be implemented in parallel by different people,** but **P0 merges first.** P1's acceptance is "0 budget expiries and tail margin ≥ 1.5× per hop", and that is measured with P0's telemetry.
- **P1 rebases onto P0.** Its owner of the shared files resolves conflicts.
- **The other modules are disjoint:**
  - P0 only: `telemetry/*`, `worker-http.mjs`, `input/http.mjs`, `runner-runtime-diagnostics.mjs`, `product-model-settlement.mjs`, `telemetry_lines.py`, `server.py`, the observability stack;
  - P1 only: the budget table, `session-client.mjs`, `remote-task-boundary.mjs`, `temporal-worker.mjs`.

## 13. Environment: running the gates from a fresh Linux box

**What you need:**
- Linux x86_64 with Docker Engine and BuildKit (`docker buildx`);
- about 20 GB of disk and 8 GB of RAM;
- outbound HTTPS to `public.ecr.aws`, `cgr.dev`, `registry.npmjs.org` and `pypi.org`;
- no AWS credentials. Nothing here needs them.

**Run every container one at a time.** The rehearsals are timing-sensitive and record host clock steps.

All commands run from the repository root on your branch:

```bash
git clone https://github.com/neo-capiro/meri-greenfield.git && cd meri-greenfield
git switch feat/meri-p0-telemetry   # or main, for the baseline
```

### 13.1 Build the runtime test image (the same recipe the image build uses)

This is `apps/runtime/Dockerfile` with the two pinned public bases, the same `docker build` the production image producer runs (`infra/product-preview/image-build-producer.py`, `DOCKER_BUILD` phase). Build it once per commit you test. It takes about 10-15 min the first time.

```bash
export NODE_IMAGE=public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63
export RUNTIME_IMAGE=cgr.dev/chainguard/wolfi-base@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4
export IMG=meri-runtime:$(git rev-parse --short=12 HEAD)
DOCKER_BUILDKIT=1 docker build --platform linux/amd64 \
  --build-arg NODE_IMAGE=$NODE_IMAGE --build-arg RUNTIME_IMAGE=$RUNTIME_IMAGE \
  -f apps/runtime/Dockerfile -t $IMG .
```

**About the image:**
- **Its inputs are all in the repo.** The runtime APKs (`infra/product-preview/runtime-packages/x86_64`, 45 files) and wheels (`…/wheels`) are committed, and the build fetches only from npm.
- **It runs as `node`, uid 1000** (`adduser -u 1000` in the Dockerfile).
- **`.dockerignore` excludes every `test/` directory.** The steps below add the tests to the container.
- **If `cgr.dev` refuses the pinned digest** (Chainguard's free tier may garbage-collect old digests): stop and report it in the PR. **Don't substitute another base.** The shipper owns base-image pins.

### 13.2 The image gate: the 24 `LINUX_ONLY_TESTS`, exactly as the build runs them

**What it mirrors:** `image-build-producer.py` `_run_linux_tests`. It mounts the 10 fixture files (`infra/product-preview/image-build-linux-checks.py`, `FIXTURE_PATHS`) read-only, then runs the 3 test files with the build's own reporter, in the build's sandbox flags. The image's user is uid 1000.

```bash
FIXTURES="apps/control/conversations/test/application-fixture.mjs apps/control/conversations/test/initial-input-fixture.mjs
apps/control/conversations/test/store-fixture.mjs apps/gateway/test/fixtures.mjs apps/runtime/native-authority/test/fixture.mjs
apps/runtime/test/prepared-candidate-bootstrap.test.mjs apps/runtime/test/prepared-candidate-fixture.mjs
apps/runtime/test/remote-conversation-runner.test.mjs apps/worker/conversation/continuation/test/fixtures.mjs
apps/runtime/temporal-product-token-writer.test.mjs"
MOUNTS=(); for p in $FIXTURES; do MOUNTS+=(--mount "type=bind,src=$PWD/$p,dst=/opt/meri/$p,readonly"); done
REPORTER="data:text/javascript;base64,$(base64 -w0 infra/product-preview/image-build-test-reporter.mjs)"
docker run --rm --init --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 128 --memory 2g --tmpfs /tmp:rw,nosuid,nodev,noexec,size=128m "${MOUNTS[@]}" \
  --entrypoint /usr/local/bin/node $IMG --test --test-reporter="$REPORTER" \
  apps/runtime/test/prepared-candidate-bootstrap.test.mjs apps/runtime/test/remote-conversation-runner.test.mjs \
  apps/runtime/temporal-product-token-writer.test.mjs
```

**Pass:** the reporter's JSON line has `"observedCases":24`, `"failedCaseIds":[]` and `"fileCaseCounts":{"B":6,"R":6,"W":12}`, and the command exits 0.

**On `main` @ `69fd1994`, expect 24/24.** That tree passed the gate's 24 cases with the same reporter and test files, both in the shipper's gate on the PR194 merge and in the planner's run. The planner's run copied the source into the image instead of bind-mounting the fixtures. **This exact bind-mount recipe has not yet been run end to end.** If it disagrees, report both outputs.

**Notes:**
- **Fixture imports:** if your change makes one of these 10 fixtures import a new file from a `test/` directory, the gate can't see that file (it isn't in the image) and fails with `ERR_MODULE_NOT_FOUND`. Keep new test helpers out of the fixtures' import graph.
- **The hash preflight:** the producer also hash-checks the fixture files against the build manifest. The local run skips that check, and the shipper's build enforces it.

### 13.3 Node suites and rehearsals in the image (overlay the full checkout)

This helper starts a container from the image, copies your committed checkout over `/opt/meri` (the image's own `node_modules` stay), and runs `node --test` as uid 1000. Save it as `meri-in-image.sh`:

```bash
#!/usr/bin/env bash
# Usage: meri-in-image.sh <image> <timeout-s> [--test-name-pattern=...] <test files...>
set -uo pipefail
IMG=$1; LIMIT=$2; shift 2; C=meri-test-$$
docker run -d --name $C --network none -m 3g -u 0 --entrypoint sh $IMG -c "sleep $((LIMIT+300))" >/dev/null
trap 'docker rm -f $C >/dev/null' EXIT
git archive HEAD apps packages infra docs | docker exec -i -u 0 $C sh -c 'cd /opt/meri && rm -rf apps/*/test docs && tar -xf -'
docker exec -u 0 $C sh -c 'find /opt/meri/apps /opt/meri/packages /opt/meri/infra /opt/meri/docs -name node_modules -prune -o -exec chown 1000:1000 {} +'
docker exec -u 1000 -w /opt/meri -e MERI_REVIEW_SOURCE_ROOT=/opt/meri $C \
  timeout $LIMIT node --experimental-test-module-mocks --test --test-concurrency=1 "$@"
```

- **`git archive HEAD` packs committed files only.** Commit first.
- **Don't `chown -R` the whole tree:** copying the image's `node_modules` layer up adds minutes.

**The suites P0 must keep green**, plus your new test files:

```bash
# Runner diagnostics: the text lines P0 must not change
./meri-in-image.sh $IMG 1500 apps/runtime/test/runner-runtime-diagnostics.test.mjs apps/runtime/test/runner-first-failure.test.mjs \
  apps/runtime/test/pinned-native-transport.test.mjs apps/runtime/test/activity-runtime-diagnostics.test.mjs \
  apps/runtime/native-authority/test/sdk-initialization-milestones.test.mjs apps/runtime/native-authority/test/native-start-router-budget.test.mjs
# Control: the Core-call pins must not change
./meri-in-image.sh $IMG 1500 apps/control/conversations/test/load-amplification.test.mjs apps/control/conversations/test/startup-composition-latency.test.mjs
# The worker conversation suites (activity, lifecycle, coalescing)
./meri-in-image.sh $IMG 1500 apps/worker/conversation/test/*.test.mjs
# Owner suites (Node)
./meri-in-image.sh $IMG 1500 $(git ls-files 'apps/proxy/product/test/*.test.mjs')
```

**Rehearsals** (POSIX only; about 6 min and about 20 min). They compose the real control services, session owner, worker-http, runner, activity and lifecycle in one process, with injected Core latency profiles:
- quiet: identity / membership / context 85 / 220 / 250 ms;
- median: 100 / 300 / 500 ms;
- tail: 150 / 450 / 750 ms.

`apps/runtime/test/rehearsal-support.mjs` keeps `Date.now` monotonic, and records host clock steps in each result as `hostClockSteps`.

```bash
./meri-in-image.sh $IMG 1500 --test-name-pattern='first turn' apps/runtime/test/first-turn-rehearsal.test.mjs
./meri-in-image.sh $IMG 3300 apps/runtime/test/d3-rehearsal.test.mjs
```

**Reference results** (durations measured on the candidate-6 branch before G's B4 `31888644`; on `main` the Core counts are lower and durations shorter, and no main timings are recorded):
- **First-turn gates, all pass:**
  - quiet: completed, result about 32.0 s, 228 Core calls before B4;
  - median: completed, about 52.2 s before B4. **On `main`: 164 Core calls** (load 32, publish 22 each, polls 4 each), measured by the P0 implementer on base and head alike;
  - tail: completed, about 79.3 s;
  - Clerk timeout answered 401: `EXECUTION_FAILED` at about 14.6 s;
  - Clerk timeout answered 503: completed at about 56.8 s.
- **D3:** 9/9 pass.

**What P0 adds:** the first-turn rehearsal parses the new `meri.telemetry/1` lines from captured stdout and asserts the §5 checks.

**Repeat any run whose output contains a `hostClockSteps` entry** before believing a timing failure.

**Known pre-existing failures:** expect them, record them in the PR's table, and don't fix them in P0.
- Some document-preparation cases (ZIP, PowerPoint) in `apps/control/intents/test/*`.
- `load-amplification` timing tests, which flake under CPU contention: re-run them alone.
- "load budget retains the later startup stages and original-lease reserve".

**Always compare against the same suites on the PR's base commit,** with an `$IMG` built for each.

### 13.4 Proxy Python suites

**Why not the product proxy image:** it can't be built from the repo alone. `infra/product-preview/proxy-image-build.sh` needs the 331 pinned wheel artifacts listed in `apps/proxy/qualification/linux/assembly-pins.json`. They are supplied to the shipper separately and are not committed. Use this test image instead:
- the same hash-locked Python dependencies (`apps/proxy/qualification/linux/requirements.lock`) from public PyPI;
- Node 24 from the pinned public image, because 7 owner-wire tests shell out to `node`.

Save this as `proxy-test/Dockerfile`, with `requirements.lock` copied next to it (`cp apps/proxy/qualification/linux/requirements.lock proxy-test/`):

```dockerfile
FROM public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63 AS node
FROM public.ecr.aws/docker/library/python:3.13-slim
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY requirements.lock /tmp/requirements.lock
RUN python -m venv /opt/meri-proxy-venv \
 && /opt/meri-proxy-venv/bin/pip install --no-cache-dir --require-hashes --only-binary=:all: -r /tmp/requirements.lock \
 && useradd -u 10001 -M meri
```

```bash
docker build -t meri-proxy-test proxy-test
```

The source must be **root-owned and not group- or world-writable.** The proxy's `read_reviewed_file` refuses files owned by another user or writable by others. **Copy it in, never bind-mount it.** Save this as `meri-proxy-tests.sh`:

```bash
#!/usr/bin/env bash
# Usage: meri-proxy-tests.sh <dotted modules...>. There are no __init__.py files: run modules by dotted name, not `unittest discover`.
set -uo pipefail
C=meri-pytest-$$
docker run -d --name $C --network none -u 0 --entrypoint sleep meri-proxy-test 3600 >/dev/null
trap 'docker rm -f $C >/dev/null' EXIT
git -c tar.umask=0022 archive HEAD apps packages scripts infra | \
  docker exec -i $C sh -c 'mkdir -p /src && cd /src && tar -xf - && chown -R root:root /src && chmod -R go-w /src'
docker exec -u 10001 -w /src $C /opt/meri-proxy-venv/bin/python -B -m unittest -v "$@"
```

```bash
MODULES=$(git ls-files 'apps/proxy/product/test/test_*.py' 'apps/proxy/product/test_*.py' 'apps/proxy/qualification/test/test_*.py' | sed 's/\.py$//; s#/#.#g')
./meri-proxy-tests.sh $MODULES
```

**Expectations:**
- `test_model_proxy_material` skips without a repo-root `node_modules` and `apps/runtime/node_modules`. That is expected here; the shipper's in-image run covers it.
- **Record the base-commit result** (OK, failures, skips) in the PR next to your branch's.
- **`python:3.13-slim` is a tag, not a digest.** Record the digest you used (`docker image inspect --format '{{index .RepoDigests 0}}' public.ecr.aws/docker/library/python:3.13-slim`) in the PR.
- **This image is the planner's local method,** which passed every module except environment skips. The hash-locked dependencies are what make it faithful.
- **Exclude** the Postgres-fixture modules (`apps/proxy/qualification/linux/postgres-fixture/*`); P0 does not touch them.

### 13.5 Postgres

- **P0's required suites need no database.**
- **If you run a `*-pg.test.mjs` suite for your own confidence,** start the repo's pinned image and pass the variables that suite's header documents (for example `MERI_FIXTURE_TEST_DATABASE`, `MERI_INSPECTION_TEST_DATABASE`):

```bash
docker run -d --name meri-pg -e POSTGRES_PASSWORD=meri-test -p 127.0.0.1:55432:5432 \
  docker.io/library/postgres@sha256:3cec7eb015ba8adb28139fa5c83b8489cdf0e666e53dfdf20f598ae0cc8739e3
```

- Such runs use a superuser over scripted SQL. They do **not** prove the production per-role grants; the shipper's live check does.

### 13.6 What only worked on the planner's machine (don't look for these)

- **`meri-local:<sha>`:** a locally built tag of the runtime image at an older commit. Use §13.1.
- **The ECR-pulled images:** the runner image and the serving proxy `meri-greenfield/qualification-worker@sha256:…`. They need AWS credentials. Use §13.1 and §13.4.
- **The proxy's 331-wheel assembly bundle:** it is not in the repo, hence §13.4's PyPI-locked test image. It is close to, but not exactly, the product image.
- **Windows `node_modules` junctions and WSL2 Docker:** the Windows host shared one `npm` install across worktrees and ran Docker in WSL2. WSL2's wall clock steps backwards by 0.4-2 s under load, which faked authority refusals until the rehearsals were made monotonic. A plain Linux box has neither problem; still repeat any run that shows `hostClockSteps`.
- **The planner's helper scripts** (`run-gate-linux.sh`, `run-rehearsal-files.sh`, `run-worker-linux.sh`): §13.2-§13.3 reproduce them in full.

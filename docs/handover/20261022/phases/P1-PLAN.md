# P1: one nested budget table for the Meri hot path (implementation plan)

> **HISTORICAL (superseded 2026-10-23).** This file describes P1, the hot-path budget table / owner-proxy proof reuse. Wave 2 item 0 deletes those layers; P1 #200 and C9 #203 are not to be merged. Do not act on it. Read `STANDING-REQUIREMENTS.md`, `WAVE-1-HANDOFF.md` and `WAVE-2-HANDOVER.md` instead.

**Audience:** an implementer who has only this repository (GitHub) and a Linux box with Docker. **No AWS access is needed, and none may be used.** No knowledge of earlier work is assumed.

**Companion files** (committed beside this plan in `docs/hot-path/`):
- `ADR-HOT-PATH-REDESIGN.md`: the design. P1 is §2.5, as amended by decision O55 (§7).
- `P1-INVENTORY.md`: 620 timeout, deadline, lease and poll rows, re-anchored to this plan's base.
- `P0-PLAN.md`: the telemetry P1 reports through (§9).

**Base:** `main` @ **`e3ba4e47`** ("Merge fable/c7-completion-poll-20261021 into main (candidate 8)"). It contains:
- candidate 6 (`69fd1994`);
- P0's telemetry (`74ece1d5`, PR #195);
- candidate 7 (`574ee962`: the capture self-stop and the Clerk-503 load replay);
- candidate 8 (`8ef90c79`: the broker poll defers to the completion capture).

**References:**
- Every `file:line` below was checked at `e3ba4e47`.
- If `main` has moved, re-locate a reference by its function or constant name, never by line number alone.
- **Read §10 first.** Other work is changing the same files right now.

**What you deliver:** one pull request into `main`. The Meri shipper reviews it, deploys it to preview and checks §6 item 7 live.

## 0. Ten-minute orientation

**Meri is five services plus Temporal.** A user's "Send" goes through them in this order:

| Step | From | To | Main code |
| --- | --- | --- | --- |
| Send: `allocate`, `admit`, `submit` | browser | control | `apps/control/conversations/input/http.mjs`, `conversations/service.mjs` |
| Kickoff and broker poll | Temporal worker | control | `apps/runtime/temporal-worker.mjs` (`createBrokerActivity`) → `native-client.mjs` → control `execution/poll` → `native-authority/execution-broker.mjs` |
| The runner task starts and runs the Claude SDK | runner | control | `apps/runtime/remote-conversation-runner.mjs`, `conversation-runner.mjs`, `apps/worker/conversation/activity.mjs` |
| The runner's calls back to control: `runner/load`, `runner/publish`, `runner/next-controls`, `runner/session/*`, `runner/checkpoint/*` | runner | control | `apps/runtime/native-client.mjs` → control `worker-http.mjs`, `native-authority/session-http.mjs`, `checkpoint-http.mjs` |
| Control's calls into the runner (capture, inspect, stop) through its task router | control | runner | `native-authority/remote-task-client.mjs` → `task-router.mjs` → the runner's `remote-task-http.mjs` |
| Model request | runner (CLI) → proxy (Python) → owner (Node) → Bedrock | | `apps/proxy/product/*.py`, `apps/proxy/product/owner-*.mjs` |

**How time budgets work today:**
- **The deadline wrapper:** most calls are wrapped in `createOperationLifetime({deadlineMs,…})` (`packages/runtime/operation-lifetime.mjs`), which aborts with `code:'DEADLINE'`.
- **The rendered root limits:** `infra/product-preview/first-chat/render-material.mjs:595`: `{startupMs:30000, shutdownMs:10000, requestMs:25000, requestBytes:131072}`. The run window is `:522` (`runWindowMs`).
- **The only nested table so far: `packages/runtime/runner-load-budget.mjs`.** Each enclosing hop sits one control margin (`RUNNER_LOAD_CONTROL_MARGIN_MS` = 2 s) above the hop it encloses:
  - the load cap and its replay: `RUNNER_LOAD_MAX_MS` 23 s, `RUNNER_REPLAY_DELAYS_MS` [500, 1500], `RUNNER_LOAD_STAGE_MAX_MS` = 2 × 23 s + 0.5 s. The replay part came from candidate 7's Clerk-503 load fix;
  - native start: `RUNNER_NATIVE_STARTUP_ROUTER_MS` 21 s → `RUNNER_NATIVE_STARTUP_RECEIVER_MS` 19 s;
  - session RPCs: `RUNNER_SESSION_RPC_MS`, `controlSessionRpcMs`, `RUNNER_SESSION_STORE_CALL_MS`;
  - the end-of-turn capture chain: `CONTROL_CHECKPOINT_CAPTURE_MS` 21 → `CONTROL_CAPTURE_CHANNEL_MS` 19 → `TASK_ROUTER_CAPTURE_MS` 17 → `RUNNER_CAPTURE_MS` 15 s;
  - `ACTIVITY_PREPARATION_MAX_MS` 30 s;
  - `runnerStartupBudget()` (`:64`) and `runnerLoadBudget()` (`:88`).
- **Thirteen production modules import it.** Find them with `git grep -l runner-load-budget -- apps packages`.
- **Other named constants outside it:**
  - `temporal-worker.mjs:18` `BROKER_NATIVE_MS` 10 s, and `:27` broker `pollMs` 1000;
  - `http-server.mjs:7` `RUNTIME_KEEP_ALIVE_MS` 125 s;
  - `owner-https.mjs:17` `PRODUCT_OWNER_IDLE_SOCKETS`;
  - `service-pair-discovery.mjs:14` `OWNER_MAX_REQUEST_MS` 15 s;
  - `apps/proxy/product/budgets.py` (`MAX_OWNER_EXCHANGE_MS` 15000, `OWNER_CARRIER_WAIT_MS` 10000, `IN_REQUEST_CHECK_SECONDS`, `BOOTSTRAP_SECONDS`).
- **Everywhere else, a module picks its own default:**
  - `native-client.mjs:38` `maxRequestMs=3000`;
  - `remote-task-boundary.mjs:16` `transportLimits` (8000);
  - `independent-task.mjs:13` (3000);
  - `prepared-kickoff.mjs:12` (3000 / 30000 / poll 100);
  - `lifetime.py:23-25` (5 s / 5 s / 1 s).
- **Or it inherits a library default:**
  - undici fetch: connect 10 s, headers and body 300 s;
  - AWS SDK: no request timeout (`maxAttempts:1` only);
  - the owner's pg pool (whatever `databaseOptions` sets);
  - Temporal `NativeConnection.connect` (no explicit timeout, `temporal-worker.mjs:78`).
- **Why it matters:** those defaults caused every DEADLINE failure seen in live tests, a fixed small budget around work that grows with latency. Neither side of a hop knows the other's budget.

**What P1 is, in one sentence:** move every one of those numbers, **unchanged**, into one table that derives them from the turn's limits; make every module take its budget only from that table; and assert at startup that each inner budget is smaller than the hop enclosing it.

## 1. Goal

1. **Zero unset defaults on the path.**
   - No constructor or factory on the two-turn path has a default value for a time budget (`…Ms`, `…Seconds`, `timeout…`, `deadline…`, `poll…`).
   - No library client on the path is created without its time options passed explicitly.
   - "Explicitly unbounded" is allowed **only** as a table entry with `unbounded: true`, the hop that bounds it instead (`boundedBy`), and a reason.
2. **One table.** Every budget comes from `packages/runtime/hot-path-budgets.mjs`, derived from the rendered limits and the run window (the "turn deadline").
3. **Asserted nesting.**
   - At startup, control, temporal-worker, runner, owner and proxy refuse to start with `HOT_PATH_BUDGET_CONFIGURATION` when a nested budget is not at most `outer − 2 s`.
   - The ADR's stricter target `outer − max(2 s, 10 %)` is checked by a test against a dated exception list (§3.4).
4. **Same values.** Effective budgets after P1 equal today's, hop for hop. A golden file proves it (§5.6). Value changes belong to later phases.

## 2. Inventory

**`P1-INVENTORY.md` (companion)** lists 620 rows from three static sweeps of an earlier tree (`4797f7da`), re-anchored to `e3ba4e47`.

**Each row gives:**
- component, name and `file:line` at the sweep;
- value and how it is set;
- **unset** (yes when it is a library default, a module default no caller sets, or unset);
- **file**: `same` = the cited file is unchanged since the sweep; `changed` = re-locate it; `library` = an installed package;
- **since 5a8da2fd**: `moved` = the cited file changed again after the previous plan base (198 rows, mostly P0's counting wrappers and candidates 7-8).

**How to use it:**
- Use the committed file as your worklist. The generator reads the planner's local sweep notes, so you don't regenerate it.
- **Re-locate every `changed` row at your base by name.**
- **The code-level test in §5.1 is the authority, not the inventory's count.** The inventory counts 86 unset defaults: runner 38, control 24, owner/proxy 24.

**The unset defaults P1 must remove,** by module. Line numbers are checked at `e3ba4e47`:

| Module | Site | Today |
| --- | --- | --- |
| Native client | `apps/runtime/native-client.mjs:38` `maxRequestMs=3000`, `loadMaxRequestMs=maxRequestMs` | 3000, refuses > 10000. The runner passes stage budgets, and the worker passes `BROKER_NATIVE_MS` (`temporal-worker.mjs:76`). |
| Session client and bound store | `native-authority/session-client.mjs:14,24`; `apps/worker/qualification/checkpoint/bound-session-store.mjs:46` | The session client already takes `RUNNER_SESSION_RPC_MS` per operation (`maxRequestMs` only lowers it). **The bound store still defaults `timeoutMs = 5000`.** |
| Control ↔ runner channel | `native-authority/remote-task-boundary.mjs:16` `transportLimits(value={})` | 8000 default. The runner's `processTransport` and the registry allocation (`prepared-run-registry.mjs:95`) pass none. |
| Independent task | `native-authority/independent-task.mjs:13` `maxRequestMs=c.maxRequestMs??3000` | 3000; the close grace ≤ 3000, then SIGKILL |
| Launch configuration | `native-authority/launch-configuration.mjs:11` `shutdownMs=c.shutdownMs??1000` | 1000 |
| Prepared kickoff | `native-authority/prepared-kickoff.mjs:12` `settings()` | maxRequestMs 3000, maxWaitMs 30000, pollMs 100, cleanupMs |
| Session registration | `native-authority/session-registration.mjs:25` `maxRequestMs:l.maxRequestMs??3000` | observation wait 3000 |
| Prepared run bindings | `apps/runtime/prepared-run-bindings.mjs:22` (`limits` optional) | 3000 |
| Objective runtime | `objective-generation/lifecycle-activities.mjs:28` (15000), `run-owner.mjs:24` (10000) | as listed |
| Original stop | `apps/runtime/original-stop.mjs:13` `timeoutMs=15000` | 15000 |
| Runner bootstrap | `runner-bootstrap-files.mjs:47` (5000); `runner-poststart-bootstrap.mjs:26` (`maxStartupMs`); `runner-poststart-transport.mjs:28,51` (3000); `task-bootstrap.mjs:6` (poll 100) | as listed |
| Activity | `apps/worker/conversation/activity.mjs:30` `TERMINAL_ATTEMPT_MS` 3000; the `loadMaxMs`/`runtimeMaxMs` defaults in `createConversationActivity` (`:35`) | The runner passes stage values. Replace the inline `>30000` caps (`:39,41`) with `ACTIVITY_PREPARATION_MAX_MS`. |
| Continuation lifecycle | `apps/worker/conversation/continuation/activity-lifecycle.mjs:22` `pollMs=100` | 100 |
| Lifecycle journal | `apps/control/conversations/lifecycle/journal.mjs:60` `continuation({… deadlineMs=now()+3000})` | now + 3000 |
| Events stream | `apps/control/conversations/events.mjs:5` `maxSubscriptionMs=30000, pollMs=100, idleRecheckMs=10000` | as listed |
| Temporal worker | `temporal-worker.mjs:27` `pollMs=1000`; `:78` `NativeConnection.connect` (no timeout) | as listed |
| Core and other HTTP via global fetch | `prepared-candidate.mjs:93` (`fetchImpl` default `fetch`, wrapped by P0's `countingFetch`); `owner-entrypoint.mjs:156` `rawFetch=d.fetchImpl??fetch`; the control composers in `cli.mjs` (`countingFetch(globalThis.fetch, …)`) | undici: connect 10 s, headers 300 s, body 300 s |
| AWS clients | `control.mjs:184` (ECS, EC2), `prepared-candidate.mjs:175` (ECS, S3), `owner-entrypoint.mjs:120-121`, `product-ports/documents.mjs:66`, `temporal-issuer/entrypoint.mjs:154-155` (ECS, EC2, KMS), `artifacts/storage/s3-objects.mjs:53` | maxAttempts 1; no request or connection timeout (the abort signal only) |
| Postgres pools | `control.mjs:164` (`connectionTimeoutMillis:requestMs`, `idleTimeoutMillis:10000`, `query_timeout:requestMs`, already explicit); owner `defaultPool` (`owner-entrypoint.mjs:112`, options from `databaseOptions`) | `statement_timeout` / `lock_timeout` / `idle_in_transaction_session_timeout` unset |
| HTTP server | `apps/runtime/http-server.mjs:40` | `requestTimeout = requestMs+1000`, `headersTimeout = requestMs`, `keepAliveTimeout = RUNTIME_KEEP_ALIVE_MS`. Already explicit; move them into the table. |
| Owner diagnostics | `apps/proxy/product/owner-diagnostics.mjs:31` `burst=20, windowMs=60000` | a rate, not a deadline; table it anyway |
| Proxy pair discovery | `apps/proxy/product/service_pair_discovery.py:206` `max_request_ms=3000, max_lease_ms=30000`; `main.py:345` constructs it with the defaults | as listed |
| Proxy lifetime | `apps/proxy/qualification/runtime/lifetime.py:23-25` | poll 5 s, check 5 s (product passes `IN_REQUEST_CHECK_SECONDS` from `budgets.py`), cleanup 1 s (product passes `REQUEST_CLEANUP_SECONDS`) |
| Proxy server | `uvicorn_tls_protocol.py` (`serve_product_proxy_with_owner`, imported at `main.py:353`) | uvicorn defaults: keep-alive 5 s, no graceful-shutdown timeout. **Verify** where the server object is configured before tabling these. |
| boto3 | `main.py:184-188` | Already explicit: connect 1 s, read 1 s, 1 attempt. Move them into the table. |
| LiteLLM | `litellm.request_timeout` 6000 s; pass-through 600 s; the httpx handler 600 s / connect 5 s | **Pinned config, see §7** |
| SDK / CLI | `apps/worker/conversation/options.mjs` (no API timeout env); SDK `loadTimeoutMs` 60000, run-end ceiling 600000, SessionStore append retry 3 × [200, 800] ms | library or CLI defaults, see §3.3 |

**Rows tagged `library`** are Node, Python or SDK package defaults. P1 makes them **explicit at their call site**, with the same value (§3.3).

**Values that depend on budgets but are not themselves a timer** (record them in the table as `derived`; don't move them):
- **Candidate 8's completion deferral** (`execution-broker.mjs` `poll`): it answers `executing` while the completion capture holds the run, so it is bounded by `CONTROL_CHECKPOINT_CAPTURE_MS` plus the worker's execution deadline.
- **Candidate 7's capture self-stop** (`task-router.mjs`, the `captures` set): a capture already in flight keeps `TASK_ROUTER_CAPTURE_MS` after a stop.

## 3. Table design

### 3.1 Location and one source of truth

- **`packages/runtime/hot-path-budgets.mjs`** (new):
  - it generalizes `packages/runtime/runner-load-budget.mjs`, which becomes a thin re-export so its 13 importers keep working;
  - remove the re-export once they import the new module;
  - pure data plus pure functions, no I/O, no imports outside `packages/`.
- **Node services** import it directly.
- **Python (proxy)** gets the same numbers **rendered into its config,** as the ADR says:
  - `infra/product-preview/first-chat/render-material.mjs` already renders proxy values (`ownerPeer.max_exchange_ms` = `OWNER_MAX_REQUEST_MS` at `:645`). It gains a `budgets` block computed by `hot-path-budgets.mjs` for the proxy's hops;
  - the Python side reads it and re-asserts the nesting with the same rules in `apps/proxy/product/budgets.py`, which turns from constants into a loader plus validator;
  - **why rendering, not a generated `.py` file:** the proxy image is hash-pinned (`apps/proxy/product/Dockerfile:44` asserts package versions and the LiteLLM config SHA). Rendered config already flows into the proxy, so no generated source enters the image and no pin moves.
- **The rendered `limits` block** (`render-material.mjs:595`) stays the root input. The table never invents a root number.
- **Temporal workflows** (`apps/control/conversations/workflow.ts`, `lifecycle/workflow.ts`, `recovery-workflow.ts`, `objective-generation-workflow.ts`, `scheduled-dispatch-workflow.ts`):
  - import the table if the workflow bundler accepts `packages/runtime/hot-path-budgets.mjs` (pure data, deterministic);
  - if it does not, generate `apps/control/conversations/hot-path-budgets.generated.ts` from the table with a script, and add a drift test (§5.6);
  - **never** change a running workflow's argument shape. Activity option values must stay byte-identical (§5.6).

### 3.2 Data shape

```js
// packages/runtime/hot-path-budgets.mjs (shape, not final code)
export const HOT_PATH_BUDGET_MARGIN_MS = 2000;               // today's RUNNER_LOAD_CONTROL_MARGIN_MS
export const HOP = Object.freeze({                            // one entry per hop; ids are stable strings
  'runner.call.load':          {parent:'runner.stage.load', ms:({request})=>Math.min(23000, request.ms-2000), kind:'nested'},
  'control.session.load':      {parent:'runner.session.load', ms:p=>p.ms-2000, kind:'nested'},
  'pg.owner.connect':          {parent:'owner.request', value:0, unbounded:true, boundedBy:'owner.request', reason:'pg default; owned by the request lifetime'},
  'runtime.preparation':       {parent:'turn', ms:30000, kind:'serial', children:['runner.stage.runtime','runner.stage.local']},
  'broker.poll.completionDefer': {parent:'control.capture', kind:'derived', reason:'execution-broker poll defers while the completion capture holds the run'},
  // … every hop in P1-INVENTORY (§2)
});
export function hotPathBudgets(inputs) { /* derive every hop from {limits, runWindowMs, originalExpiresAtMs}; freeze; assert */ }
export function assertHotPathBudgets(table) { /* throws {code:'HOT_PATH_BUDGET_CONFIGURATION', hop, parent} */ }
export const budget = (table, id) => /* the hop's ms; throws on an unknown id */;
export function hotPathBudgetDigest(table) { /* sha256 over the canonical {id: ms} map; used by §9 */ }
```

**Kinds:**
- **`nested`:** child ≤ parent − margin.
- **`serial`:** the children run one after the other inside the parent.
  - Today's one case is runtime preparation: runtime 23 s + local 10 s run inside the activity's 30 s.
  - Assert that each child ≤ parent − margin, and **report** the sum. It exceeds the parent today, as documented in `runner-load-budget.mjs` beside `ACTIVITY_PREPARATION_MAX_MS`.
- **`background`:** renewals, polls and leases that never sit inside a request. Assert expiry ≥ 2 × period (ADR §2.5).
- **`derived`:** a bound that follows from another hop. It is recorded for review and never asserted as a timer.

**Roots:**
- **`turn`:** the run window, `multiRun.runWindowMs ?? min(maxRuntimeSeconds×1000, 86400000)` (`render-material.mjs:522`), today 900000;
- **`startup`, `shutdown`, `request`:** the rendered `limits`;
- **`original`:** the per-run `originalExpiresAtMs` (runner stages).

**Existing derivations carry over unchanged:**
- `runnerStartupBudget` and `runnerLoadBudget`, including the replay stage from candidate 7;
- the capture chain;
- the native start router/receiver pair;
- the session RPC table;
- `ACTIVITY_PREPARATION_MAX_MS`.

### 3.3 How each module receives its budget

**Composition roots read the table once:**
- control: `apps/runtime/control.mjs`, `prepared-candidate.mjs`, and the composers built in `apps/runtime/cli.mjs` (control role);
- runner: `apps/runtime/cli.mjs` (runner role), `remote-conversation-runner.mjs`, `conversation-runner.mjs`;
- worker: `temporal-worker.mjs`, `schedule-worker.mjs`;
- owner: `apps/proxy/product/owner-entrypoint.mjs`;
- proxy: `apps/proxy/product/main.py`.

Each root calls `hotPathBudgets(inputs)` (which asserts) and passes **explicit** values down.

**Constructors take budgets as required fields:**
- Delete every default: `maxRequestMs=3000` becomes a required `maxRequestMs`.
- Keep each constructor's existing range validation. Those caps are safety rails, not defaults.

**Tests that construct modules** pass explicit values: small test numbers, or `budget(testTable,'…')`. Add a tiny `packages/runtime/test/budget-fixture.mjs` exporting the production-shaped table, so tests don't each invent numbers.
- **Do not add it to the image gate's fixture graph.** The 10 `FIXTURE_PATHS` in `infra/product-preview/image-build-linux-checks.py` are mounted alone; a new import from them fails the gate with `ERR_MODULE_NOT_FOUND` (§5.4).

**P0's wrappers stay where they are.** Several constructors below are wrapped by P0's counters (`countingPool`, `countingAwsClient`, `countingFetch`). P1 changes the **constructor arguments**; P0 wraps the constructed object. Construct with the table's options first, then wrap, on separate lines.

**Library clients:**
- **pg:**
  - control (`control.mjs:164`) already passes `connectionTimeoutMillis`, `idleTimeoutMillis` and `query_timeout`. Source them from the table, with the same values;
  - owner: pass the same three fields explicitly from the table, with today's effective values from `databaseOptions`;
  - **do not** add `statement_timeout`, `lock_timeout` or `idle_in_transaction_session_timeout` in P1. They are unset today, and setting them changes behaviour. Record them as `unbounded` table entries with `boundedBy`.
- **undici / global fetch:** pass an explicit `dispatcher` (`new Agent({connect:{timeout}, headersTimeout, bodyTimeout})`) with today's 10 s / 300 s / 300 s. The fetch call's own `AbortSignal` remains the real bound.
- **AWS SDK v3:** pass `requestHandler: new NodeHttpHandler({connectionTimeout, requestTimeout})` with today's effective `0` (none) and `maxAttempts: 1`. Make them table entries marked `unbounded` / `boundedBy` the router or the request lifetime.
- **Temporal `NativeConnection.connect` / client:** pass `connectTimeout` (the library's 10000) explicitly. Keepalive and retry stay as library entries recorded in the table.
- **Node HTTP servers:** move `http-server.mjs:40`'s `requestTimeout`, `headersTimeout` and `keepAliveTimeout`, and `owner-https.mjs`'s `PRODUCT_OWNER_IDLE_SOCKETS`, into the table with the same values.
- **Python:**
  - the uvicorn options (keep-alive, graceful shutdown) go explicit at the server's construction;
  - the `service_pair_discovery` caps (`main.py:345`), `lifetime` and `owner_startup` come from the rendered `budgets` block;
  - boto3 `Config` (`main.py:184-188`) values come from the block, with the same values.
- **SDK / CLI** (`@anthropic-ai/claude-agent-sdk`, CLI env):
  - record `loadTimeoutMs` (60000), the run-end ceiling (600000), the SessionStore append retry and the API timeout (unset) as `library` table entries;
  - **do not pass new options or env** in P1. `apps/worker/conversation/options.mjs` is hash-pinned by the SDK options pin (`sdk-option-template.mjs`), so a change re-qualifies the SDK profile.

### 3.4 Nesting rules and exceptions

- **Startup assertion (P1):** `child ≤ parent − 2000 ms` for `nested`; each `serial` child ≤ parent − 2000 ms; `background` expiry ≥ 2 × period. It fails closed with `HOT_PATH_BUDGET_CONFIGURATION`.
- **ADR target (tested, not asserted at startup):** `child ≤ parent − max(2000, 10 % of parent)`.
  - Today's chain fails it wherever the parent exceeds 20 s. For example, 21 s inside 23 s needs ≤ 20.7 s.
  - Each such hop goes into `HOT_PATH_BUDGET_EXCEPTIONS`, and `removedBy` names the ADR phase that changes the value:

  ```js
  {hop:'control.capture', rule:'adr-margin', reason:'21 s inside 23 s (2 s margin)', removedBy:'P2'}
  ```

**Known exceptions at the base:**

| Hop | Issue | removedBy |
| --- | --- | --- |
| `runtime.preparation` (serial) | runtime 23 s + local 10 s > 30 s | P5 (local spawn) |
| Core client calls inside control requests | Core `maxRequestMs` = `requestMs` = 25 s, equal to its enclosing request | P6 (Core leaves the request path) |
| Control session owner | `maxRequestMs` 25 s; governed by session-http's per-operation deadline | P1 itself: pass the per-operation value to the owner as well, same effective value |
| Capture chain 23/21/19/17/15 | ADR 10 % margin | P2 |
| Native start router 21 s / receiver 19 s | ADR 10 % margin | P5 |
| Load stage `RUNNER_LOAD_STAGE_MAX_MS` (two attempts + replay pause) | `serial` children: attempt, pause, attempt | report only; carried from candidate 7 |
| `checkpoint/complete` | tail margin 1.43× (control capture 1.31×) | P6 |
| Load/publish 23 s | tail margin 1.47× | P6 |
| Owner reserve 15 s | tail margin < 1× | P4 |
| Event window 30 s (`events.mjs:5`) | `SUBSCRIPTION_UNAVAILABLE` at median and tail | P6 |
| Stop cleanup inside 25 s | not nested | P2 |

**Add every further violation found while building the table** to the list. Do not change a value to make the test pass.

## 4. File-by-file change list

Keep each change small, and do one module family per commit.

1. **New:**
   - `packages/runtime/hot-path-budgets.mjs`, plus `packages/runtime/test/hot-path-budgets.test.mjs` and `packages/runtime/test/budget-fixture.mjs`;
   - turn `runner-load-budget.mjs` into a re-export, and delete it at the end.
2. **Render:** `infra/product-preview/first-chat/render-material.mjs`.
   - Compute the table from the render inputs and emit the proxy `budgets` block.
   - Source `max_exchange_ms` (`:645`) from the table.
   - Update `render-material.test.mjs` and the proxy template tests (`model-proxy-template.test.mjs`).
3. **Control:**
   - `apps/runtime/control.mjs`: pool, AWS clients, the router's capture values (already table), server options;
   - `prepared-candidate.mjs`: the `limits` objects, the fetch dispatcher, the S3 and ECS clients;
   - `cli.mjs` (control role): the fetch passed to the documents, authority, retained-task and reads composers;
   - `prepared-run-registry.mjs:95`: pass `limits` to the allocation's transport from the table;
   - `prepared-run-bindings.mjs:22`;
   - `http-server.mjs`.
4. **Native authority:**
   - remove the defaults in `native-client.mjs`, `remote-task-boundary.mjs` (`transportLimits`), `independent-task.mjs`, `launch-configuration.mjs`, `prepared-kickoff.mjs`, `session-registration.mjs`, `session-owner.mjs` (owner `maxRequestMs`), `session-http.mjs`, `task-router.mjs`, `task-router-network-reader.mjs`, `runner-poststart-task-reader.mjs`, `kms-signer.mjs`, `original-stop.mjs` and the `objective-generation/*` defaults;
   - then thread the values from the composition roots: `remote-composition.mjs`, `broker-stack.mjs`, `first-run-ports.mjs`, `admitted-supervisor.mjs`.
   - **Do not change** `execution-broker.mjs`'s poll logic or `task-router.mjs`'s stop and capture rules (candidates 7-8). Only the numbers they read move.
5. **Runner:**
   - `cli.mjs` (runner role);
   - `remote-conversation-runner.mjs`: pass explicit `processTransport.limits` (today it gets the 8000 default);
   - `conversation-runner.mjs`;
   - `runner-bootstrap-files.mjs`, `runner-poststart-bootstrap.mjs`, `runner-poststart-transport.mjs`, `task-bootstrap.mjs`.
6. **Worker / activity:**
   - `apps/worker/conversation/activity.mjs`: remove the defaults; use `ACTIVITY_PREPARATION_MAX_MS` for the inline caps;
   - `continuation/activity-lifecycle.mjs`;
   - `apps/worker/qualification/checkpoint/bound-session-store.mjs`: remove the 5000 default;
   - `apps/runtime/temporal-worker.mjs` (`BROKER_NATIVE_MS`, `pollMs`, `NativeConnection.connect`), `schedule-worker.mjs`.
7. **Control conversations:** `lifecycle/journal.mjs:60`, `events.mjs:5`, the workflow `.ts` timeouts (§3.1).
8. **Owner (Node):**
   - `owner-entrypoint.mjs`: fetch dispatcher, AWS clients, pool;
   - `owner-https.mjs`: server options and `PRODUCT_OWNER_IDLE_SOCKETS` into the table;
   - `owner-channel.mjs`;
   - `service-pair-discovery.mjs` (`OWNER_MAX_REQUEST_MS` from the table);
   - `owner-diagnostics.mjs`.
9. **Proxy (Python):**
   - `apps/proxy/product/budgets.py`: loader plus validator of the rendered `budgets`;
   - `main.py`: the boto3 config (`:184-188`) and the pair-discovery caps (`:345`);
   - `service_pair_discovery.py`, `host_composition.py`, `owner_startup.py`, `owner_https.py`;
   - `apps/proxy/qualification/runtime/lifetime.py`: the product passes all three caps. The qualification defaults stay for the qualification harness only, listed as an exception `scope:'qualification'`;
   - the uvicorn options;
   - **do not touch** `litellm-product-config.yaml` (§7).
10. **Telemetry seam** (§9): `apps/runtime/telemetry/turn-lines.mjs` and `apps/proxy/product/telemetry_lines.py`, one new line type each, in **its own last commit**.

**Expected size:** about 45 source files and about 60 test files, mostly passing explicit budgets.

## 5. Tests

1. **No default budget** (`packages/runtime/test/no-default-budget.test.mjs` + `apps/proxy/product/test/test_no_default_budget.py`):
   - **(a) Registry check.** `packages/runtime/test/budget-call-sites.json` lists every call site from §2 as `{file, constructor, field, hop}`, produced from `P1-INVENTORY.md` and reviewed.
     - Parse each file.
     - Fail if `field` has a default in the constructor's destructuring (regex `\b<field>\s*=\s*[0-9]`, or `?? <number>` on it).
     - Fail if the composition root that constructs it does not pass `budget(…,'<hop>')`.
   - **(b) Sweep.** Scan `apps/runtime`, `apps/control`, `apps/worker/conversation`, `apps/proxy/product`, `apps/gateway/budget` and `packages/runtime` (non-test) for numeric literals assigned to budget-named identifiers (`/(Ms|Seconds|Timeout|timeout|Deadline|deadline|poll\w*)\s*[:=]\s*\d{2,}/`) outside `hot-path-budgets.mjs`.
     - Fail unless the site is in `budget-literal-allowlist.json` with a reason (e.g. a validator cap such as `maxRequestMs>30000`).
     - **Python:** the same for `_seconds = <literal>`, `timeout=<literal>`, and `Config(` without `connect_timeout`/`read_timeout`.
     - **Exclude P0's telemetry modules**: their 60 s rollup and 8 KB caps are not hot-path budgets. Allowlist them with that reason.
   - **Library clients:** assert that `new Pool(`, `new ECSClient(`/`EC2Client(`/`S3Client(`/`KMSClient(`, `NativeConnection.connect(`, `createServer(` and the uvicorn construction on the path all pass their time options. Detect these textually, per call site.
   - **Must fail on the base:** demonstrate it against `e3ba4e47`. `native-client.mjs:38` alone fails it.
2. **Nesting** (`hot-path-budgets.test.mjs`):
   - **Production inputs:** `{limits:{startupMs:30000,shutdownMs:10000,requestMs:25000}, runWindowMs:900000}` and an original expiring at claim + 900 s. Every `nested` and `serial` child is ≤ parent − 2 s, and every `background` entry passes.
   - **Mutations:** each mutated table (shrink a parent, grow a child) throws `HOT_PATH_BUDGET_CONFIGURATION` naming the hop.
   - **The ADR 10 % rule** holds except for the `HOT_PATH_BUDGET_EXCEPTIONS` rows, and each row must name an ADR phase. A row that no longer violates must be removed: the test fails on stale exceptions.
   - **Startup refusal:** for control (`control.mjs`), worker, runner (`cli.mjs`), owner and proxy (`main.py`), start with a violating table or rendered block, and assert exit with `HOT_PATH_BUDGET_CONFIGURATION` before any network listener.
3. **Tail-profile margin:** extend `apps/runtime/native-authority/test/capture-chain-budget.test.mjs` into `hot-path-margins.test.mjs`.
   - Per hop, model serial work at the quiet / median / tail Core profiles (`apps/runtime/test/rehearsal-support.mjs` `CORE_PROFILES`), as the existing capture-chain test does.
   - Assert ≥ 1.5×, or membership in the exception list with `removedBy`.
   - Keep the existing capture-chain cases.
4. **Image gate:** `LINUX_ONLY_TESTS` (`infra/product-preview/image-build-producer.py:30`) stays **24/24** (B 6, R 6, W 12), run exactly as §13.2 says.
5. **Rehearsals and composed suites:**
   - **First turn:** `apps/runtime/test/first-turn-rehearsal.test.mjs` (all ten cases). Required: identical outcomes to the base.
     - The two gated cases complete.
     - The median asserts **164 Core calls**.
     - Clerk-401 ends `EXECUTION_FAILED`; Clerk-503 median and the Clerk-503-inside-a-tail-load case complete.
   - **D3:** `apps/runtime/test/d3-rehearsal.test.mjs`, 9/9: stream completed with no duplicates or gaps, double submit gives one run, Stop gives run `cancelled`.
   - **The composed end-of-turn suites** (they need `openssl`, §13.4): `native-authority/test/completion-broker-poll.test.mjs` (4/4), `capture-self-stop.test.mjs` (3/3), `task-router.test.mjs`, `native-start-router-budget.test.mjs`, and `apps/runtime/test/runner-load-replay.test.mjs` (3/3).
   - **Timing:** within ±10 % of the base (values are unchanged).
6. **Golden values** (`packages/runtime/test/hot-path-budgets.golden.json`):
   - the effective value of every hop at production inputs, generated once **from your final base** (§10) by a script that reads today's defaults and call-site values, then reviewed;
   - the test asserts the table equals it, so P1 changes no value;
   - the workflow `.ts` drift test lives here too.
7. **Existing suites stay green on Linux:** the native-authority, worker, control-conversations, telemetry, owner and proxy suites. Pre-existing failures must equal the base's, name for name (§13.6).

## 6. Acceptance criteria (checkable)

1. `no-default-budget` passes on the branch and **fails on the base** (attach both outputs).
2. `hot-path-budgets.test.mjs` passes. The exception list is complete, each row names an ADR phase, and there are no stale rows.
3. The golden file equals the base's effective values. A reviewer spot-checks 20 random hops against the base source.
4. The startup refusal is demonstrated for all five roles.
5. The image gate is 24/24. The rehearsals and composed suites are identical in outcome to the base; timings are within ±10 %.
6. Linux suite failures equal the base's, name for name.
7. **Live behaviour is unchanged on preview** (after the P1 deploy, checked by the shipper), over at least 20 turns and a comparison window of equal size before the deploy, using **P0 telemetry**:
   - the budget-expiry count (`timeoutClass=deadline`) has the same rate;
   - per-stage p50/p95 (`meri.turn.stage`, `meri.model.request`) are within noise;
   - there are no new refusal codes;
   - each service's `meri.budget.table` line (§9) carries the golden digest;
   - no `HOT_PATH_BUDGET_CONFIGURATION` text line appears.
8. The rendered proxy config's `budgets` block equals the table, and the proxy starts with it. `budgets.py` holds no literal hop values.

## 7. Out of scope

- **Any value change,** including fixing the exceptions. Those are later phases.
- **Authorization changes** (P6 lease), proof reuse (P2) and warm runners (P5).
- **Logic changes** to candidate 7's capture self-stop or candidate 8's completion deferral.
- **The SDK options and CLI env** (pinned profile) and **`litellm-product-config.yaml`** (its SHA is pinned in `apps/proxy/product/Dockerfile:44`). Record them only as `library`/`pinned` entries.
- **Setting Postgres `statement_timeout` / `lock_timeout` / `idle_in_transaction_session_timeout`** (a behaviour change).
- **New metrics, alarms or dashboard widgets.** §9 adds one log line, nothing else.

## 8. Rollback, validation checklist, effort

**Rollback:**
- Revert the P1 merge commit and re-render. There is no data or schema migration.
- After P1, the proxy refuses to start without its rendered `budgets` block. So roll back the render and the image **together**, in the same change set.

**Validator checklist:**
- [ ] every `changed` and `moved` row of `P1-INVENTORY.md` re-located at the final base;
- [ ] the no-default test green on the branch and red on the base;
- [ ] nesting, startup refusal ×5, the exception list with phases, no stale exceptions;
- [ ] golden values equal the final base; 20-hop spot check;
- [ ] the image gate 24/24; the rehearsals and composed suites equal the base;
- [ ] Linux failures name-equal to the base;
- [ ] the render diff contains only the `budgets` block and the `max_exchange_ms` source change;
- [ ] no SDK options, CLI env or LiteLLM config changes;
- [ ] the telemetry seam is one line type per language, with the secret-pin tests extended (§9);
- [ ] after deploy: the P0 telemetry comparison and the digest check (by the shipper).

**Effort:** about **6–8 engineer-days**:
- table and tests: 2;
- Node modules and composition roots: 2–3;
- proxy and render: 1;
- rehearsals, the rebase (§10) and validation: 1–2.

## 9. P0 is merged: what P1 reports through it

**P0's telemetry is live on `main`:**
- `apps/runtime/telemetry/turn-lines.mjs` and `turn-context.mjs`;
- `apps/proxy/product/telemetry_lines.py`;
- one closed-schema EMF line per event.

**Decision: add one startup line, `meri.budget.table`, and nothing else.**
- **Fields:** `service`, `atMs`, `hops` (count) and `tableSha256` (`hotPathBudgetDigest(table)`, 64 hex).
- **No metrics, no values.**
- **Emitted once** by each composition root right after `hotPathBudgets()` asserts: control, runner, owner and proxy. The temporal-worker is not a P0 telemetry service; it asserts but emits nothing new.

**Why this, and why it is small enough:**
- It is the only way the shipper can prove from logs that every deployed service runs the golden table. The table is computed in-process from rendered limits, so config files alone do not show the result.
- It is one schema entry in each language. P0's emitter rebuilds every line from its schema, and the secret-pin and schema tests are table-driven over `LINE_SCHEMAS` / `EVENTS`, so the new type is covered by adding it to those tables.
- `tableSha256` uses a pattern-checked field: `^[a-f0-9]{64}$`, else `"invalid"`. No identifiers, no values, no error text.

**Rejected:**
- logging the hop values: about 200 entries is over P0's 8 KB line limit and duplicates the golden file;
- a per-hop metric: high cardinality, no consumer;
- carrying a `budgetHop` on DEADLINE errors: it touches every lifetime and is not mechanical. It belongs to a later phase if wanted.

**If the reviewer objects,** drop the last commit (§4 item 10). Nothing else depends on it, and §6 item 7 then falls back to the render diff.

**Shared files with P0's code:**

| File | P0 has | P1 changes | How to keep them apart |
| --- | --- | --- | --- |
| `control.mjs`, `prepared-candidate.mjs`, `owner-entrypoint.mjs`, `cli.mjs` | `countingPool` / `countingAwsClient` / `countingFetch` around constructed clients | the constructor **arguments** | construct with table options, then wrap: separate lines |
| `native-client.mjs` | counting in `attempt()`'s `finally` | the `maxRequestMs` destructuring and validation | different lines |
| `main.py`, `host_composition.py`, `owner_https.py` | counting, timing and health hooks | caps from the rendered `budgets` | P1 edits construction and config reading only |
| `render-material.mjs` | `telemetry.environment` in control, owner and proxy configs | the `budgets` block | different keys |

## 10. Base branch and the conflict you will hit

**Branch:** `feat/meri-p1-budget-table` from `main` @ `e3ba4e47`. One PR into `main`.

**Conflict note: read before you start.**
- The Meri shipper's team is fixing a live **turn-2 failure at `runtime-admission`** (503) on top of candidate 8. That fix will land in `main` while you work, and it is expected to edit the same files P1 edits:
  - `apps/runtime/native-authority/*`: admission, the router, the broker, the remote task boundary;
  - `packages/runtime/runner-load-budget.mjs`.
- **It may change a budget value or add a stage.** Therefore:
  1. Keep your table's derivations **by name**, mirroring `runner-load-budget.mjs`, not as copied numbers, so a rebase carries new values in.
  2. **Right before opening the PR,** rebase onto the latest `main`. Re-locate every new or moved budget, and **regenerate the golden file from the rebased base**. Never hand-edit it to match: P1's promise is "the values of the base you rebased onto".
  3. **After the rebase, re-run** the image gate (§13.2), the first-turn and D3 rehearsals, the composed suites, and `no-default-budget` (red on the new base, green on the branch).
  4. **In the PR description,** list every value or stage that changed in `main` between `e3ba4e47` and your final base, and state that the golden file reflects them.
- **If `main` moves again during review,** repeat steps 2–4. Don't merge `main` into your branch; rebase.

**The PR description must include:**
- the §13 commands run and their summary output (the gate's JSON verdict line; each suite's `ℹ tests / pass / fail`);
- a **"pre-existing failures" table:** each failing test with its result on the PR's base commit (§13.6);
- the §10 value-delta list.

**You stop at the PR.** Don't run any `aws` command, and don't add credentials anywhere.

## 11. Parallel work (the companion `P2-PLAN.md` is in `docs/hot-path/` too)

| Work | Files | Interaction with P1 |
| --- | --- | --- |
| Turn-2 admission fix (shipper's team) | `native-authority/*`, `runner-load-budget.mjs` | **Direct conflict:** §10 |
| P2 proof reuse (`docs/hot-path/P2-PLAN.md`) | `service-task-leases.mjs`, `service-pair-discovery.mjs`, `owner-https.mjs`, `owner-channel.mjs`, `owner_https.py`, `service_pair_discovery.py`, `host_composition.py` | **Overlap on the owner/proxy files.** P1 changes construction-time numbers there; P2 changes pair-proof logic. Whichever merges second rebases. Coordinate through the shipper: if both are open, P1 takes `OWNER_MAX_REQUEST_MS` / pair-discovery caps into the table and P2 keeps reading them by the table id. |
| P6-Core (capiro-backend) | another repository | none |

## 12. Who validates and ships

The Meri shipper validates the PR against §5-§6, runs the suites again in the deployed images, deploys to preview and checks §6 item 7 live. You don't deploy.

## 13. Environment: a fresh Linux box

**The commands below follow the harness that ran P0's gates end to end** (adj-a, 2026-10-21: image gate 24/24, rehearsals, suites, proxy). It lives in `main`'s history at commit `43b705c8`, `scripts/qualification/p0-telemetry/`. It was deleted from the tree, so copy it out; don't commit it.

### 13.1 Prerequisites and the harness

- Ubuntu 22.04/24.04, Docker 24+, git, Python 3.13, Node 24.19+ (for host-only checks), `openssl`, 16 GB RAM, 40 GB disk.
- Run one container at a time: the rehearsals are timing-sensitive.

```bash
git clone https://github.com/neo-capiro/meri-greenfield.git && cd meri-greenfield
git switch -c feat/meri-p1-budget-table e3ba4e47
mkdir -p ~/p0h && for f in verify.py evidence.py in-image.sh proxy-tests.sh proxy-test.Dockerfile; do
  git show 43b705c8:scripts/qualification/p0-telemetry/$f > ~/p0h/$f; done
python3 ~/p0h/verify.py --help
```

**The harness modes,** run against a **committed** checkout (it packs `git archive HEAD`):

```bash
python3 ~/p0h/verify.py runtime --source . --output ~/p1-out/head-runtime --side head   # builds the runtime image, gate, suites, rehearsals
python3 ~/p0h/verify.py proxy   --source . --output ~/p1-out/head-proxy   --side head   # Python suites in a pinned-requirements image
python3 ~/p0h/verify.py infra   --source . --output ~/p1-out/head-infra   --side head   # host render tests (needs Node 24 + Python 3.13)
```

- **What `runtime` does:**
  - builds `apps/runtime/Dockerfile` on its pinned public Node and Wolfi bases (`NODE_IMAGE`, `RUNTIME_IMAGE` in `verify.py`);
  - checks uid 1000;
  - runs the gate (§13.2), then the suite groups and the rehearsals in containers that overlay the committed source on the image (`in-image.sh`).
- **Each run writes** `result.json` plus one log per check.
- **To include your new test files,** set `P0_CHANGED_NODE_TESTS='["packages/runtime/test/hot-path-budgets.test.mjs", …]'`.
- **Then run the same modes on the base** (`--side base`, from a checkout of `e3ba4e47`, or of your final base after §10) for the §13.6 comparison.

### 13.2 The image gate, exactly as the build runs it

- The harness's `image-gate` check mirrors `image-build-producer.py` `_run_linux_tests`:
  - the 10 `FIXTURE_PATHS` from `infra/product-preview/image-build-linux-checks.py` are mounted read-only into the built image;
  - `--read-only --network none --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 --memory 2g`, uid 1000;
  - the build's reporter `infra/product-preview/image-build-test-reporter.mjs`;
  - the three gate files.
- **Pass:** `"observedCases":24`, `"failedCaseIds":[]`, `"fileCaseCounts":{"B":6,"R":6,"W":12}`, exit 0. **On `e3ba4e47`, expect 24/24.**
- **A new import from any of the 10 fixtures fails the gate** with `ERR_MODULE_NOT_FOUND`, because test directories are not in the image. Keep `budget-fixture.mjs` out of their import graph.

### 13.3 Rehearsals

- The harness runs `first-turn-rehearsal.test.mjs` (pattern `first turn`) and `d3-rehearsal.test.mjs`. It retries once when a run records `hostClockSteps`.
- **For all ten first-turn cases** (including the reported Clerk-503 ones):

  ```bash
  bash ~/p0h/in-image.sh meri-p0-runtime:$(git rev-parse --short=12 HEAD) . 2400 apps/runtime/test/first-turn-rehearsal.test.mjs
  ```

- **A run with non-empty `hostClockSteps`** that fails on timing is void: re-run it.

### 13.4 The composed router suites need `openssl`

- **The problem:** `apps/runtime/native-authority/test/router-tls-fixture.mjs` runs `openssl` at import. The runtime image ships none, so in the image these fail at import:
  - `capture-self-stop`, `completion-broker-poll`, `native-start-router-budget`;
  - anything importing `capture-composition-fixture.mjs` or `router-tls-fixture.mjs`.
- **The fix:** run them on the host with Node 24 and `openssl`, after the harness's `infra` mode has done the `npm ci` installs:

  ```bash
  MERI_REVIEW_SOURCE_ROOT=$PWD node --experimental-test-module-mocks --test --test-concurrency=1 \
    apps/runtime/native-authority/test/completion-broker-poll.test.mjs apps/runtime/native-authority/test/capture-self-stop.test.mjs \
    apps/runtime/native-authority/test/task-router.test.mjs apps/runtime/native-authority/test/native-start-router-budget.test.mjs \
    apps/runtime/test/runner-load-replay.test.mjs
  ```

- **`native-start-router-budget` is timing-flaky on base and head alike:** a different case fails each run under load. Interleave base and head runs before blaming your branch.

### 13.5 PostgreSQL suites

Some broker and control suites need PostgreSQL, through the repository's own disposable clusters (`scripts/qualification/local-baseline/provision-postgres.sh`: Unix sockets, trust auth). This recipe ran end to end on candidate 8:

```bash
IMG=meri-p0-runtime:$(git rev-parse --short=12 HEAD); W=$(mktemp -d)
docker create --name p1-x $IMG >/dev/null && docker cp p1-x:/opt/meri/. $W/meri && \
  docker cp p1-x:$(docker run --rm --entrypoint sh $IMG -c 'readlink -f "$(command -v node)"') $W/node && docker rm p1-x
git archive HEAD apps packages infra scripts docs | tar -x -C $W/meri && chmod -R a+rwX $W/meri
docker run -d --name p1-pg --network none -m 3g -v $W/meri:/opt/meri -v $W:/n --entrypoint sh pgvector/pgvector:pg16 -c 'sleep 7200'
docker exec p1-pg bash /opt/meri/scripts/qualification/local-baseline/provision-postgres.sh start --repo /opt/meri
docker exec -u postgres -w /opt/meri -e HOME=/tmp -e MERI_REVIEW_SOURCE_ROOT=/opt/meri p1-pg /n/node --experimental-test-module-mocks \
  --test --test-concurrency=1 apps/runtime/native-authority/test/execution-broker.test.mjs apps/runtime/native-authority/test/broker-stack.test.mjs \
  apps/runtime/test/broker-cleanup.test.mjs
docker rm -f p1-pg
```

**Notes:**
- `docs/` must be present: the scripted fixtures import `docs/qualification/...`.
- The `pgvector` image also has `openssl`, so the §13.4 suites can run here too.
- **On `e3ba4e47`:** 19/19.

### 13.6 Compare against the base

Run §13.1-§13.5 on the base and on your branch. In the PR, list every failing test with its base result. **"No new failure" is the bar.**

**Known on the base:**
- **The control timing-window tests** in `load-amplification` ("500 ms Core replies fit…", "conservative tail-heavy…") fail on base and head alike.
- **The proxy material cross-check** (`test_model_proxy_material`) needs a repository `node_modules` and errors in the plain Python image.
- **Two proxy suites** (`test_aws_counter`, `test_bedrock_transport`) need `AWS_EC2_METADATA_DISABLED=true`, which ECS sets at the task level.

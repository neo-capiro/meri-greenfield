# Always-on turn telemetry

These P0 modules are independent of the default-off OpenTelemetry modules in this
directory. They emit bounded EMF JSON into existing log streams. They create no
exporter, network connection, database connection or import-time timer.

`turn-lines.mjs` owns the line schemas, recursive allowlists, fixed vocabulary,
UUID validation, metric names and dimensions. `turn-vocabulary.mjs` retains
reviewed diagnostic constants; unrecognized strings become `other`. No messages,
SQL, bodies, headers, actor/client/tenant identifiers or AWS identifiers are
serialized. A line exceeding 8 KiB is dropped. Write failures are swallowed and
reported through `telemetryDropped` on the next process rollup.

`turn-context.mjs` owns async attribution and bounded process-local run/request
buckets. `counting.mjs` observes existing fetch, AWS send and PostgreSQL query
ports without changing requests, timeouts, results or errors. AWS facades are ordinary
objects because product boundaries reject JavaScript Proxy objects. Pools and pooled
clients retain their identities; their writable query/connect methods are instrumented
in place. Immutable injected ports remain unchanged and increment the dropped counter.
Pool query
instrumentation suppresses only its nested client-query count, preserving one
count per statement across pooled-client reuse. Callback and promise APIs remain
supported. Wrapper composition is idempotent for the same telemetry instance.

Production control observes committed journal results through the store's
`onPublished` hook. Completion, cancellation and the run reconciler can write
terminal events without calling `service.publish`, so their existing acknowledged
journal results and validated readbacks after a lost acknowledgement also feed
the same telemetry owner. These hooks add no SQL or authority checks. Failed
transactions and unproven readbacks produce no success observation; repeated
durable evidence is deduplicated. `turn-publish.mjs` is used by the rehearsal's
in-memory store, which has no production journal hook.

First durable delta and terminal times are recorded once. Terminal counters wait
until all concurrent outer operations attributed to that run finish, including
post-publication authority checks. Later post-terminal polls are background work.
After a process restart or eviction, unknown admission/first-text times stay null.

## Composition API

Create a service-specific `createTurnTelemetry({service, environment, write, now})`.
`environment` defaults to `Preview`; `Production` is the other accepted value.
Call `start()` in the owning entry point and `close()` during resource cleanup.
The 60-second interval is unreferenced and does not keep a process alive.

- `within(binding, operation)` attributes an operation to a run.
- `provisional(operation)` captures work before admission returns its binding;
  nested provisional scopes reuse the active bucket. `bind(binding)` transfers
  that bucket exactly once. Unbound operations become background work.
- `withRequest(requestId, binding, operation)` attributes owner work to a model
  request; `bind` can fill its binding after placement. The run bucket is separate.
- `counters(binding, {requestId, includeRun, reset, release})` emits a request's
  counters. `includeRun` also drains pending work that predated the model request
  identifier; `reset` clears emitted counts and `release` removes its request slot.
  Other concurrent request buckets are not touched.
- `currentTurnTelemetry()` returns only the current async context's instance.
  Health hooks outside a run use their injected service-owned instance.

Owner placement and admission work before the reservation does not yet have a
model request ID. A validated run binding keeps those counts in the run bucket;
the subsequent settlement drains them once alongside its request counters. Work
without a validated binding stays background. Attribution adds no correlation
headers or authority fields to the wire contract.

## EMF schema reconciliations

P0's status-class alarm needs distinct `CoreCalls` values for each status. A single
EMF root can only give the `CoreCalls` property one value. Therefore counters and
rollups emit up to nine nonzero **`meri.core.counters`** companion records. Each
contains only service, validated run/attempt ids when attributed, status class,
count, attribution and timestamp. Its metric dimensions are `Service,StatusClass`.
The aggregate `meri.turn.counters` record remains one record per flush.

Background rollups emit both the all-work aggregate `Service` series and the
`Service,Attribution=background` subset. Background status companions likewise
emit both `Service,StatusClass` and its `Attribution=background` subset. **Never
add the subset to the aggregate.** The Core error alarm consumes aggregate series
only, keeping its metric-stat count within CloudWatch's ten-metric alarm limit.
Turn-detail queries use the run id and exclude background work naturally.

Proxy background rollups expose `AwsCalls` with both `Service` and
`Service,Attribution` dimension sets. They do not publish Core or database metrics
because the proxy does not own those calls. AWS failures use `error`, matching
Node's outcome vocabulary.

CloudWatch text metric filters cannot combine dimensions with `DefaultValue=0`,
and a plain text filter cannot extract a constant Service dimension. The owner
and proxy therefore have separate filters on their respective log groups, using
the exact `PRODUCT_OWNER_DIAGNOSTICS_SUPPRESSED` and
`PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED` tokens. Both publish the undimensioned
`DiagnosticsSuppressed` metric with a zero default.

`HealthEvents` emits both `Service` and `Service,Component` dimension sets for the
same value. The service aggregate powers the owner/proxy health alarm; component
series support drill-down. Identifiers are never metric dimensions.

Runner failures emit `TimeoutFailures` with `Service=runner` when their classified
cause is a timeout. Control summary classification can use only its terminal
reason and observed Core outcomes: a remote runner's detailed failure is sometimes
collapsed to `EXECUTION_FAILED` before publication. P0 does not change that wire
contract. The zero-timeout alarm sums control and runner signals; that sum is a
**signal count, not a unique failed-turn count**. Join failure and summary records
by `runId` to inspect the original runner cause.

Checks: `node --test apps/runtime/telemetry/test/{turn-lines,turn-context,counting}.test.mjs`.

## AgentCore setup, settlement and process startup

`createAgentCoreQuery` opens the existing runner diagnostic context before input
validation and binds correlation IDs only after that validation succeeds. Fixed
stages distinguish input, admission, workspace, client setup, assembly, cleanup,
canonical readback and settlement. The assembled runner borrows this context;
the existing stage deduplication keeps one `runner.process.start` record. The
first activity failure survives later cleanup uncertainty.

`meri.turn.settlement` is a log-only record emitted after the unchanged SDK
cleanup check and canonical settlement receipt validation. It contains validated
run/attempt IDs, the receipt state, and `sdkCleanup=closed`. Failed validation or
unknown cleanup emits no receipt. This record adds no `Turns` metric and proves
neither physical runtime retirement nor a durable restore on the next turn.

Before a run exists, `RUNTIME_STARTUP_FAILURE` uses the same reviewed classifier
with a fixed `agentcore` or `temporal-worker` role and fixed boundary stage. Worker
material, readiness, Temporal connection, construction, run and listener failures
remain distinct; a rejected poller completion also emits `worker-run`. A startup
cleanup failure produces a separate `worker-cleanup` line.
AgentCore configuration, transport, client, listener and shutdown stages use the
same emitter. No raw error message, SDK stderr, body, token or configuration value
is included. Diagnostic write failures are swallowed. Existing generic process
errors and exit/cleanup behavior remain unchanged.

These observations add no retry policy. The earlier worker startup failures'
cause remains unknown; ordinary ECS recovery still owns process replacement.
The focused local checks are `agentcore-query.test.mjs`,
`temporal-worker-startup.test.mjs`, `agentcore-entrypoint-diagnostics.test.mjs`
under `apps/runtime/test`, plus the existing diagnostic and line-schema tests.
Use Node 24 with `--experimental-test-module-mocks --test --test-concurrency=1`.
These synthetic checks do not establish deployed acceptance.

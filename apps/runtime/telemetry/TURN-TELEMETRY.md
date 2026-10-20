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

`turn-publish.mjs` observes only the committed value returned by run-owner publish.
It records first durable delta and terminal times once. Terminal counters wait
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

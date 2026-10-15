# Control telemetry (OpenTelemetry)

Base `ba40647`. Owned paths: this directory, the optional `telemetry` block in `../config.mjs`, its composition in `../control.mjs`,
the runtime `package.json`/lock additions and `tsconfig.json` include. Default-off: without `telemetry.enabled === true` control loads
no SDK module and wraps nothing.

## Outline

- **Configuration** (`../config.mjs`, the single validator). Control role only: `{enabled, endpoint, exportIntervalMs?, serviceName?}`.
  `endpoint` is a collector origin (https, or loopback http only under the existing `native.loopback` declaration); the signal paths
  `/v1/traces` and `/v1/metrics` are appended. No headers or credentials are configurable.
- **Lifecycle** (`sdk.mjs`, `index.mjs`). `startControl` dynamically imports `index.mjs` first and closes it last, after the listener,
  Temporal connection and pool. `close` flushes both OTLP/HTTP exporters (bounded by `limits.requestMs`), then unregisters the global
  API providers. Resource detection is off; resource attributes come from the validated `versions` object. Logs are not exported.
- **Instruments** (`instruments.mjs`). Counter `meri.runs`, histograms `meri.run.duration`, `meri.run.cost` (uUSD) and
  `meri.http.server.duration`. Metric dimensions are terminal state, closed reason code, HTTP method and status only.
- **Run lifecycle** (`run-lifecycle.mjs`). The run-owner `publish` path of the worker application is observed after each durable
  append; one `meri.run` span per run is emitted at its terminal transition with each transition as a span event. Process-local
  state is bounded; replays and post-terminal duplicates are not counted twice. Telemetry never changes a publish result or failure.
- **HTTP** (`http.mjs`). One server span per control request: method, path and status; time to response headers.
- **Redaction** (`redaction.mjs`). Every attribute passes through it: keys matching credential/token/authorization/cookie are
  dropped, values over 512 bytes are cut at a code-point boundary and marked `<key>.truncated`, non-primitives are dropped.

## Known gaps

- `meri.run.cost` has no producer in control yet: measured usage is owned by the gateway (`requests.actual_micro_usd`) and the
  unwired tenant gate's `settle` (`apps/gateway/budget/tenant`). `recordRun` accepts it once that owner is composed in control.
- Cancellation appended by the lifecycle journal on a user control does not pass through `publish` and is not observed.
- The temporal-worker and conversation-runner roles have no telemetry; the isolated runner must not gain an exporter egress.

## Checks

```sh
cd apps/runtime && node --test telemetry/test/*.test.mjs && npx tsc --noEmit -p tsconfig.json
```

The SDK test exports to an in-process loopback OTLP/HTTP collector; it does not qualify a deployed collector, network policy or
sampling configuration.

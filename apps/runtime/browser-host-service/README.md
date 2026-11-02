# Browser-only host service

The production code of **one provisioned `hostMode:'browser-only'` host**: the second purpose of the native host
lifecycle (reserve, provision, SSM bootstrap, admit, currentness, Control-driven teardown; see
[BROWSER-HOST-PATH-20261102.md](../../../docs/handover/20261102/BROWSER-HOST-PATH-20261102.md)). A browser-only host has no
SDK query, process factory, model proxy, provider credential or Bash process; the AgentCore runtime owns the sole SDK
query and in-process MCP and reaches this host through Control's named browser operations.

## Modules

| Module | Role |
|---|---|
| `host.mjs` | Production `startBrowserHost()` and CLI `main()`: installed bundle → hierarchy and lifecycle producer → Control facts (active policy) → egress proxy → browser network compartment → observers → composition with the lifecycle route; operator stop settles locally. |
| `installed.mjs` | `installedBrowserHostConfig()`: the shared protected material (`native-processing-host/protected-bootstrap.mjs` `installedHostMaterial`) plus the browser layout of the reviewed profile (`kind:'browser-host'`, limits, fixed paths, four distinct identities, private interface and proxy port). A native-processing bundle refuses. |
| `composition.mjs` | `composeBrowserOnlyHostService(input, dependencies?)`: inert construction over the real owners listed below, `start()`, `destroy({reason, retainListener})`, `closeListener()`, `sourceRunSettled()`. |
| `retirement.mjs` | Host-owned takeover retirement: `prepare` pins the custody the session host minted, `wait` polls Control's facts until the run leaves `active` with SDK and Bash denied and this custody attached (the SDK is remote), `retain` re-reads Control's hold verification for this exact host. |
| `read-run.mjs` | The canonical `readRun` over the authenticated currentness client (`createBrowserHostReadRun`) and the client's own artifact ingest/reconcile. |
| `entrypoint.mjs` | `browserHostServiceReadiness({inputs})` and `createBrowserHostServiceEntrypoint({inputs})`: readiness from ACTUAL owner objects through the canonical validators; a list of binding names can never produce `ready:true`. |
| `fixture.mjs`, `testfixture/` | Inert test inputs and the static mTLS fixture (generated once offline; tests never generate keys). |
| `image/package.json` | The pinned `@playwright/mcp` 0.0.83 and `playwright-core` for `../Dockerfile.browser-host`; the lockfile owner generates its `package-lock.json` in the gate environment. |

## Real owners composed (imported, never re-implemented)

| Owner | Use |
|---|---|
| `host/launcher/supervisor.mjs` `createBrowserOnlyHostLauncher`, `startConfinedLocalRelay` | browser-only launch, context-only `prepareBrowserContext`, currentness before/after the measured pre-exec; the confined namespace-local relay |
| `host/network/confinement.mjs` `prepareNetworkCompartment` + `host-launcher-adapter.mjs` / `launcher-adapter.mjs` | the browser compartment: one route from the namespace-local relay port to the host egress proxy, host-veth relay and local relay as separate unprivileged processes |
| `host/browser-egress-service.mjs` | the run-bound egress proxy on host loopback, denied until `browser-prepare` grants the policy, refreshed by authenticated currentness |
| `host/launcher/context-port.mjs` | single confined browser context over the native child transport |
| `host/browser-session-host.mjs` | `modelTransport:'host-owned'`, context-only installation; the one stable facade for relay, custody and takeover |
| `host/browser-operation-host.mjs` | named model operations against canonical `readRun` facts |
| `host/browser-viewer-transport.mjs` | the one pinned mTLS listener: viewer, named browser operations and the Control lifecycle route |
| `host/browser-viewer-relay.mjs` | the viewer controls binder (frames, user input batches, hand-back) |
| `host/process-observer.mjs`, `host/host-wide-process-observer.mjs`, `host/composition/browser-verifier.mjs` | per-browser leaf observer; host-wide generation observer with the measured browser confinement verifier (leader kernel facts, root-owned closed groups, only confined uids in the tree, hidden cgroupfs) |
| `host/teardown.mjs` | host-local browser-only settlement (`ports` exactly `{browser,processes}`): egress revoke/close, `browser-host-descendants` absence, profile disposal; the instance is Control's |
| `host/composition/run.mjs` | admitted workspace + exact measured readback before GO |
| `native-processing-host/{hierarchy,lifecycle,lifecycle-http}.mjs` | root-owned generation/run cgroups, the lifecycle producer (`close`/`processes`; `observe` refuses for a browser host) and the authenticated route handler shared with the native host |

## Service seam

- `composeBrowserOnlyHostService(input, dependencies?)` — inert construction. `input` is validated before any effect and
  refuses by name (`…_SDK_UNSUPPORTED`, `…_PLACEMENT_REFUSED`, `…_CURRENTNESS_UNBOUND`, `…_RETIREMENT_UNBOUND`,
  `…_PROCESS_OBSERVER_UNBOUND`, `…_EGRESS_UNBOUND`, `…_HOST_UNBOUND`, `…_READRUN_UNBOUND`, `…_VIEWER_UNBOUND`,
  `…_CONFIGURATION`). Supplying `processClientFactory`, `runnerQuery`, `modelTransport`, `bash`, provider credentials or
  `capabilityPolicy` is a configuration error, not a feature. `host` (cloud destroy/readback) is OPTIONAL: present on the
  legacy self-destroying host, absent on a provisioned host whose instance Control destroys over the lifecycle route;
  `lifecycle` is the optional route handler served on the listener.
- `start()` — prepares the admitted workspace FIRST, after an authenticated browser-purpose currentness read and
  BEFORE any native launcher/child exists, and retains that exact receipt. The pre-exec callback then performs the
  measured readback and arms the per-profile observer followed by the host-wide observer, all before GO; only then is the
  pinned listener mounted. It never opens the session facade: the original `createBrowserOperationHost ->
  prepareBrowserRun` chain alone opens/adopts, grants egress and applies the activation gate, with the canonical
  `readRun.port.sessions` bound to this exact facade object. A rejection closes every resource actually obtained and
  marks the service failed; concurrent `start()` calls share one launch.
- `destroy({reason, retainListener})` / `abort(reason)` — the single terminal path, also used by startup failure. It
  stops admission, closes the owned context/launcher (and the viewer unless `retainListener`), then runs the canonical
  teardown once and retires the observers. On a provisioned host that teardown is the host-local browser-only
  settlement (egress revoke/close, `browser-host-descendants` absence, private-state disposal; instance destroy and
  readback honestly `not-applicable`). `HOST_TEARDOWN_UNKNOWN` is returned as the receipt (UNKNOWN preserved, private
  state kept) and a local failure surfaces `BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN`. Repeated `destroy()` settles once;
  `closeListener()` retires a retained listener afterwards.
- Terminal triggers are real: the caller's AbortSignal, the canonical allocation/run expiry, manual destroy and startup
  failure all revoke one owned terminal lifetime before the final teardown; a late resolution cannot prepare workspace
  state or acquire observers after settlement. Local settlement is bounded by `localSettleMs`.

## Control-driven end of a run (provisioned host)

Control's teardown owner (PR 2) drives `POST /v1/native-processing/lifecycle` on the host listener: `close` → the host
runs `destroy({reason:'conversation-end', retainListener:true})`, closes its network compartment and answers
`status`, `browserEgress` and `browserState`; `processes` → the lifecycle producer reads the generation cgroup
`populated 0` and answers `scope:'browser-host-descendants'`; Control then destroys the instance and reads back
instance, root volume and ENI absence, recording the 0004 browser-only receipt. An operator stop (SIGTERM) runs the same
local settlement, closes the listener, disposes the lifecycle producer and releases the created cgroups.

## Tested here vs not tested here

`node --test apps/runtime/browser-host-service/*.test.mjs` runs the real imported owners for their own refusals, the
pre-effect validations, the host-local browser-only teardown, retirement over scripted Control facts, the installed
browser layout, and the production `startBrowserHost` over inert low-level ports (hierarchy, lifecycle cgroup, egress,
compartment, procfs/cgroup readbacks, currentness client) with the real composition, observers, verifier and lifecycle
route handler. Tests only import the saved mTLS fixture bytes. The native Linux launch, cgroup confinement, mTLS
listener, browser context, network compartment and physical absence paths are **not run on Windows**: they need the
image-pinned Linux helpers and kernel cgroup/network namespaces. Scripted ports are not native evidence; source
composition is not deployed acceptance (runbook step 4c measures the live host).

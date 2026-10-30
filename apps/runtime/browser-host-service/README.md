# Browser-only host service (SCRUM-235 continuation 02, 2026-10-30)

Composition and lifecycle seam for **one `hostMode:'browser-only'` allocation**. It replaces the earlier
`prepareGuestHostRun` + `runnerQuery` composition, which was not a browser-only entrypoint: a browser-only host has no
SDK query, process factory, model proxy, provider credential or Bash process. The canonical AgentCore runtime already
owns the sole SDK query and in-process MCP.

## Real owners composed (imported, never re-implemented)

| Caller file | Owner | Use |
|---|---|---|
| `host/launcher/supervisor.mjs` | `createBrowserOnlyHostLauncher` | browser-only launch, context-only `prepareBrowserContext`, currentness before/after the measured pre-exec |
| `host/launcher/context-port.mjs` | `createConfinedContextPort` | single confined browser context over the native child transport |
| `host/browser-session-host.mjs` | `createBrowserSessionHost` | `modelTransport:'host-owned'`, context-only installation; the one stable facade for relay and custody |
| `host/browser-operation-host.mjs` | `createBrowserOperationHost` | named model operations against canonical `readRun` facts |
| `host/browser-viewer-transport.mjs` | `createBrowserViewerHostServer` | pinned mTLS listener carrying viewer + named operations |
| `host/teardown.mjs` | `createConversationHostTeardown` | browser-only receipt ports exactly `{browser,processes,host}` |

Process observation is the **host-wide** observer (`createHostWideProcessObserver`), armed from
`onBrowserPrepared({leaderPid,kind:'browser'})` with `arm({browserLeaderPid})`. Browser-only polling is never substituted
for that proof.

## Service seam

- `composeBrowserOnlyHostService(input, dependencies?)` — inert construction. `input` is validated before any effect and
  refuses by name (`…_SDK_UNSUPPORTED`, `…_PLACEMENT_REFUSED`, `…_CURRENTNESS_UNBOUND`, `…_PROCESS_OBSERVER_UNBOUND`,
  `…_EGRESS_UNBOUND`, `…_HOST_UNBOUND`, `…_READRUN_UNBOUND`, `…_VIEWER_UNBOUND`, `…_CONFIGURATION`). Supplying
  `processClientFactory`, `runnerQuery`, `modelTransport`, `bash`, provider credentials or `capabilityPolicy` is a
  configuration error, not a feature.
- `start()` — launches, arms the observer from the measured leader, mounts the pinned listener and opens the session.
  A rejection closes every resource actually obtained (viewer, context port, launcher, observer) and marks the service
  failed; a retry is refused (`…_START_FAILED`). Concurrent `start()` calls share one launch.
- `sourceRunSettled()` — records source-run completion. The physical browser host is **retained** for takeover; nothing
  is torn down. Original AgentCore keeps ownership of source SDK takeover completion.
- `destroy({reason})` — only path to physical teardown. Closes the listener and local resources and returns the
  canonical receipt; `HOST_TEARDOWN_UNKNOWN` is returned as that receipt (UNKNOWN preserved, private state kept), a local
  close failure surfaces `BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN`, and the host destroy/absence attempt is never blocked by
  a local failure. Repeated or concurrent `destroy()` returns the same receipt; `start()` after destroy is refused.

## Trusted bindings still required (owners named in `entrypoint.mjs`)

host allocation/host identity, currentness reader, browser policy, browser network plan/proof, browser egress port,
controls binder, session currentness, site workflows, hold, dispose, host-wide process observer (native cgroup ports +
`verifyConfinement`), cloud `destroy`/`observeAbsent`, canonical `readRun`, context installation + pinned upstream,
native helper path and browser uid/gid, viewer mTLS material, the hard-held activation record, and the still-UNBOUND
provisioning LOGIN/protected credential reference. `entrypoint.mjs` reports them and exits 3; a caller-declared "bound"
list is not proof.

## Tested here vs not tested here

`node --test apps/runtime/browser-host-service/*.test.mjs` runs the real imported owners for their own refusals and the
canonical browser-only teardown UNKNOWN receipt, plus service-lifecycle ordering. The native Linux launch, cgroup
confinement, mTLS listener, browser context and physical absence paths are **not run on Windows**: they need the
image-pinned Linux helper and kernel cgroup/network namespaces. Scripted ports in the lifecycle tests are not native
evidence. Source composition is not deployed acceptance.

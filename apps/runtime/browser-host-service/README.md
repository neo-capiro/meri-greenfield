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
| `host/composition/run.mjs` | `prepareAdmittedBrowserWorkspace`, `armBrowserAfterWorkspaceReadback` | admitted workspace + exact measured readback before GO (sdk UID/GID are filesystem identities only) |

Two different observation contracts are kept apart: session/run lifecycle uses the browser-scoped observer
(`sessionProcesses`), final physical teardown uses the host-wide `createHostWideProcessObserver` (`processes`), armed
from `onBrowserPrepared({leaderPid,kind:'browser'})` with `arm({browserLeaderPid})` and retained until its proof is
consumed. Neither substitutes for the other.

## Service seam

- `composeBrowserOnlyHostService(input, dependencies?)` — inert construction. `input` is validated before any effect and
  refuses by name (`…_SDK_UNSUPPORTED`, `…_PLACEMENT_REFUSED`, `…_CURRENTNESS_UNBOUND`, `…_PROCESS_OBSERVER_UNBOUND`,
  `…_EGRESS_UNBOUND`, `…_HOST_UNBOUND`, `…_READRUN_UNBOUND`, `…_VIEWER_UNBOUND`, `…_CONFIGURATION`). Supplying
  `processClientFactory`, `runnerQuery`, `modelTransport`, `bash`, provider credentials or `capabilityPolicy` is a
  configuration error, not a feature.
- `start()` — launches; the pre-exec callback prepares the admitted workspace, verifies the exact measured readback,
  arms the per-profile observer and then the host-wide observer, all before GO; then mounts the pinned listener. It never
  opens the session facade: the original `createBrowserOperationHost -> prepareBrowserRun` chain alone opens/adopts,
  grants egress and applies the hard activation gate, with the canonical `readRun.port.sessions` bound to this exact
  facade object.
  A rejection closes every resource actually obtained (viewer, context port, launcher, observer) and marks the service
  failed; a retry is refused (`…_START_FAILED`). Concurrent `start()` calls share one launch.
- `sourceRunSettled()` — records source-run completion. The physical browser host is **retained** for takeover; nothing
  is torn down. Original AgentCore keeps ownership of source SDK takeover completion.
- `destroy({reason})` / `abort(reason)` — the single terminal path, also used by startup failure. It stops admission and
  closes the owned viewer/context/launcher FIRST, then runs the canonical teardown once (egress revoke/close, host-wide
  `browser-host-descendants` absence, private-state disposal, instance/volume/ENI destroy and readback), then retires the
  observer. A local close failure never prevents the independent physical attempt; `HOST_TEARDOWN_UNKNOWN` is returned
  as the receipt (UNKNOWN preserved, private state kept) and a local failure surfaces
  `BROWSER_HOST_SERVICE_CLEANUP_UNKNOWN`. Concurrent/ repeated `destroy()` settle once.
- Terminal triggers are real: the caller's AbortSignal and the canonical allocation/run expiry both call the same
  final teardown (including during startup). Local settlement is bounded by `localSettleMs`: a stalled start or close
  becomes UNKNOWN and the independent instance/volume/ENI destroy+readback backstop still runs.
- Stop is terminal while an acquisition is in flight: every async step re-checks terminal ownership, the late result is
  disposed (or the late listener closed) without publishing, and destroy awaits the pending start before tearing down.

## Trusted bindings still required (owners named in `entrypoint.mjs`)

host allocation/host identity, currentness reader, browser policy, browser network plan/proof, browser egress port,
controls binder, session currentness, site workflows, hold, dispose, host-wide process observer (native cgroup ports +
`verifyConfinement`), cloud `destroy`/`observeAbsent`, canonical `readRun`, context installation + pinned upstream,
native helper path and browser uid/gid, viewer mTLS material, the hard-held activation record, and the still-UNBOUND
provisioning LOGIN/protected credential reference. `entrypoint.mjs` derives readiness from the ACTUAL owner objects through the canonical validators (host binding,
browser policy, context installation, workspace ownership, TLS bytes); a list of binding names can never produce
`ready:true`, and
`createBrowserHostServiceEntrypoint({inputs})` returns the finite start/stop handles without starting anything.

## Tested here vs not tested here

`node --test apps/runtime/browser-host-service/*.test.mjs` runs the real imported owners for their own refusals and the
canonical browser-only teardown UNKNOWN receipt, plus service-lifecycle ordering. The native Linux launch, cgroup
confinement, mTLS listener, browser context and physical absence paths are **not run on Windows**: they need the
image-pinned Linux helper and kernel cgroup/network namespaces. Scripted ports in the lifecycle tests are not native
evidence. Source composition is not deployed acceptance.

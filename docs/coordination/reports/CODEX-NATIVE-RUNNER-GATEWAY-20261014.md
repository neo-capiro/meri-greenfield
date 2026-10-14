# Complete fixed native runner relay

**ACCEPT_SOURCE_RELAY; ACCEPT_LOCAL_SDK_TRANSPORT_WITH_SCRIPTED_ACK; HOLD_AUTHENTICATED_FIRST_SESSION_AND_OUTPUT.** Production freeze `7df7a9e00b72f097de66acb1a467c51eac026e2c`, unchanged PR70 base `742e57287db5294f84724b6c1878c113bff3bba8`. Dedicated worktree `/workspace/meri-native-runner-gateway`, branch `codex/native-runner-gateway-20261014`. Prior source/evidence and protected fixture remain preserved.

## Dependency now implemented

`apps/runtime/native-runner-gateway.mjs:createNativeRunnerGateway` implements the complete fixed forwarding dependency between the native task-facing protocol and existing Meri control owners:

- All six canonical `runOwnerOperations`: `/v1/runner/{load,publish,next-controls,claim-control,ack-control,record-checkpoint}` → fixed control `/internal/conversations/<operation>`.
- All four canonical `sdkSessionOperations`: `/v1/runner/session/{register,load,append,list-subkeys}` → same control path.

This was previously implemented only by the synthetic process-fixture, which substituted its fixture token. Production relay preserves the **actually presented task bearer** and byte-exact request/response bodies. It neither substitutes a service credential nor issues authority. Current verification, identity/session resolution, observation, allocation/fence/grant locking, durable writes and UNKNOWN stay with `worker-http.mjs`, `session-http.mjs`, `session-owner.mjs` and existing admission/service/storage owners.

Construction is inert and disabled by default; controlOrigin is compiled fixed HTTPS (explicit loopback HTTP option for owned fixtures only). Routes are derived from existing canonical tables, not a new registry. Bounded readers preserve opaque SDK JSON without ordinary depth64 decoding; session request/response ceilings remain9MiB/34MiB, ordinary runner ceilings128KiB/2MiB, further shortened by configured limits. Original signal/deadline bounds the whole body/fetch/reply, readers and late/acquired replies are cancelled without awaiting unbounded cleanup promises, and no request is retried. Upstream refusal/UNKNOWN bytes/status pass through; local post-dispatch transport failure returns UNKNOWN, never a fabricated commit/refusal receipt. Cookies, caller-selected destinations and upstream credential headers are not forwarded.

## Executable provider handoff

Use the existing trusted native-provider listener/lifecycle and compiled genuine owners. This composition is complete JavaScript; required inputs are explicit and not fetched or minted by the relay:

```js
import {createNativeRunnerGateway} from './apps/runtime/native-runner-gateway.mjs';
import {listenRuntime} from './apps/runtime/http-server.mjs';
import {storageMethod} from './apps/artifacts/storage/boundary.mjs';

export async function startRelayBoundProvider({configuration, controlOrigin,
    nativeProvider, readiness, signal, fetchImpl = fetch}) {
  const otherNativeOperation = storageMethod(nativeProvider, 'handle');
  const relay = createNativeRunnerGateway({controlOrigin, fetchImpl,
    enabled: true, limits: {maxRequestMs: configuration.limits.requestMs,
      maxRequestBytes: 9437184, maxResponseBytes: 35651584}});
  return listenRuntime({configuration, signal, readiness,
    application: {async handle(request) {
      return await relay.handle(request) ?? otherNativeOperation(request);
    }}});
}
// Caller must await the returned runtime.close() on shutdown/failure.
```

Unknown operations return null for the genuine provider composition: readiness, worker/authorize, execution/start/poll, runner/runtime and physical checkpoint/retirement are not synthesized. The stock role CLI does not install this provider; its owner supplies the existing compiled provider and approved listener/control TLS bindings. Pointing an unconfigured runner at Meri control or returning a fake readiness/runtime reply still cannot execute a genuine conversation. Source relay implementation is now complete; its deployed gateway/control binding remains pending.

## Independent registration-reader boundary

The original plan (`MERI-DEPLOYMENT.md:91`) places gateway and execution broker in the new Meri trusted stack. It does not require another repository or a second Capiro Meri runtime. The independent reader is external to the worker/control observation producer: `CODEX-NATIVE-FIRST-RUN-ADAPTERS-20261014.md:5` says “A borrowed compiled independent native registration.read owner remains external; no worker callback, UUID, grant hash, fixture receipt or new HTTP observation endpoint replaces it.” Existing session-owner register checks are unchanged.

A registry fed by worker callback keys/JSON would be an incompatible substitute. The supervising owner must supply actual authenticated task/process/event binding and original observation expiry before its `.read({binding,key,signal,deadlineMs})` can be installed. No such genuine producer/service binding exists here. This increment therefore closes the repository-owned ten-route relay, not the independent-reader/verifier/broker/runtime implementation or live qualification. Those existing owner boundaries remain explicit in PR70's binding report.

## Checks actually run

| Check | Actual result/source |
| --- | --- |
| Initial gateway controls |6/7 FAIL at ed03134e; positive publication fixture lacked reasonCode and jumped queued→running. Failed evidence retained. |
| Fixture field/header repair |6/7 FAIL at f64a69ae; unchanged canonical transition still refused. Retained; no production gate weakened. |
| Canonical queued→starting fixture |1/1 PASS at70dc8840; reran only changed positive assertion. |
| Independent active error reproduction |0/2 FAIL at70dc; instanceof invoked transport Proxy prototype traps and could escape normalization. Retained. |
| WeakMap normalization repair/root controls |7/7 PASS at b2cebbc5; no caller prototype/error getter access. |
| Independent deadline-edge reproduction |2/3, one FAIL at b2ce; a reply acquired at deadline escaped cleanup before outer assignment. Retained. |
| Acquired-reply cleanup repair/root controls |7/7 PASS at7df7a9e. |
| Independent exact source controls |12/12 PASS at7df7a9e; unchanged failed assertions plus exact bearer/byte/UNKNOWN/header and distinct session-size controls, positive canonical load/publish and registered SDK owner. |
| Actual SDK/CLI transport probe |One execution, PASS at7df7a9e after independent static permit; details below. |
| Owned dependency/temp cleanup |238 verified task-owned links removed from six directories, originals preserved, actual SDK temporary directory absent; group absent. |

The single real SDK0.3.295/CLI2.1.295 `/status` used the previously admitted fresh temporary config/workspace, sanitized account/provider environment, unchanged HOME, one actual native process, no tools/MCP/plugins and a refusing loopback model sink with no upstream. Three native mirror batches crossed **two actual owned HTTP listeners** through the canonical SDK client, new relay and canonical session receiving application. The test-only append owner provided three scripted ACKs, with exact input/entry hashes/offsets; it implemented no registration, task verification, admission or durable storage. Native init/main key/main mirror path correlated, stdout was complete/error-free, child closed cleanly, no forced kill, and the owned process group was absent. Model turns0, cost0, sink/provider requests0. Registration/durable storage/physical isolation/task verifier/product reader remain false in the receipt. This is real SDK/HTTP mechanics plus a scripted ACK, not a product conversation or observation authority.

All failed results, frozen test/script/capture hashes and independent reviews are under `docs/qualification/candidates/native-runner-gateway-20261014`. Every captured owned group was absent; no timeout/group kill/reap was needed. Protected PostgreSQL was never started/connected/seeded/mutated; original schemas/data and SDK evidence are unchanged. No contracts, locks, migrations, public APIs, source activation, cloud/security change, live credential operation, paid provider request, document creation, preview action, merge or deployment occurred. Node test environment24.19.0 is not a deployed image pin.

The new private backend removal boundary is separately recorded in `CODEX-CAPIRO-BACKEND-INTEGRATION-BOUNDARY-20261014.md`: preserve/extract the two native identity/context integration handlers and ordinary shared domain authorization/read services, including active owned clioConversation/client/wall predicates; leave Meri execution/SDK/broker/artifacts in meri-greenfield. No backend runtime is added or deleted here. Output still awaits separate explicit approval and approved renderer/storage resources.

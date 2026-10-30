# Browser host service — caller composition (SCRUM-235, 2026-10-30)

Finite caller for the merged guest host bootstrap (`apps/worker/conversation/host/composition/run.mjs`,
`prepareGuestHostRun`). It adds one new file layer plus build glue; it does not change the capabilities owner, the
shared SDK runner mounts, the control browser-host owners or any contract.

## What this directory is

- `composition.mjs` — calls `prepareGuestHostRun` once with the validated run inputs, mounts the EXISTING
  `createBrowserViewerHostServer({relay:browserHost,custodyOwner:browserHost})` with the same facade identity, and hands
  the returned one-use `processClientFactory` to exactly one prepared runner query. It distinguishes source-run
  completion (host retained for takeover, no `settle`) from final physical teardown (`settle` once).
- `config.mjs` — pure, side-effect-free reader for the service's own invocation settings. Missing or malformed values
  become named `missing` entries; nothing is defaulted, minted or guessed.
- `entrypoint.mjs` — inert readiness/refusal surface that names every still-unbound production binding and refuses
  before any browser/SDK/provider effect.
- `*.test.mjs` — inert tests using local fakes only.

## Deliberately NOT in this directory

`createPreparedRunnerQuery` is the shared integration owner's seam and does not exist in this tree (see
`docs/coordination/handoffs/M8-BROWSER-BASH-SOURCE-DEPLOYMENT-20261018.md:131,141`). This caller therefore takes it as a
required port named `runnerQuery` and refuses with `BROWSER_HOST_SERVICE_QUERY_UNBOUND` when it is absent. Wiring the
real prepared query, its settlement and its sandbox mounts remains that owner's change.

Also unbound here, by design (owning decision, not this task): the production capability-policy producer
(`capabilityPolicy.forRun`), the provisioning LOGIN/protected credential reference, the currentness store/DB client, the
browser activation record, and the viewer mTLS material. Each is reported by name in the handback and by
`entrypoint.mjs`.

## Invocation sketch (production inputs pending)

```js
import {composeBrowserHostService} from './composition.mjs';
const service = await composeBrowserHostService({
  prepareGuestHostRun, createBrowserViewerHostServer, runnerQuery,
  allocation, binding, hostIdentity, cwd, deadlineMs,
  capabilityPolicy, readBrowserPolicy, control, model, browser, bash, native, network, host,
  viewer: {bind, tls, peer}, now, signal,
});
await service.viewer?.start();
// source run finishes: service.sourceRunSettled() — keeps the physical host for takeover
// final physical end: await service.destroy() — settle() once, viewer closed, cleanup receipt
```

Source composition is not deployed acceptance, and the tests here prove composition only.

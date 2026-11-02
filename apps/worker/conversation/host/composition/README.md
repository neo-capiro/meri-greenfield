# Browser-only host workspace helpers

## Source outline

`run.mjs` keeps the two helpers the browser-only host service (`apps/runtime/browser-host-service/composition.mjs`) composes:

- `prepareAdmittedBrowserWorkspace` admits private-state preparation only after an authenticated browser-purpose currentness read for the exact allocation, binding and policy digest, then runs the synchronous root-only workspace preparation (`../browser-workspace/prepare.mjs`) and checks its exact cwd, paths and inode readback.
- `armBrowserAfterWorkspaceReadback` performs the measured workspace readback (`../browser-workspace/readback.mjs`) and arms the browser process observer only when every field matches the allocation, binding, host identity, paths, identities, leader PID and the prepared inodes, within a one-second observation window.

Both return frozen data; neither creates a client, launcher, namespace or SDK process. Control's configured browser activation record (`apps/worker/conversation/browser/activation.mjs`) is enforced through control's browser-purpose currentness, which these helpers consume; there is no host-side activation literal.

The browser workspace owner creates a root-owned, SDK-group `01770` cwd and browser-owned `0700` state; it does not provision the separate SDK config parents. The caller must preserve those boundaries and qualify actual SDK readability on the native host.

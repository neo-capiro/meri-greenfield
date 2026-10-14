# First-chat rehearsal, step 1: real SDK launch descriptor against the remote launch gates

Two receipts written by `scripts/qualification/first-chat-rehearsal/capture-sdk-descriptor.mjs` at this slice's head. The tool builds the product SDK options with `buildConversationOptions`, lets the pinned SDK 0.3.295 call its spawn hook once, records the descriptor (command, argv, cwd, env with secret values hashed), and runs it through the remote launch gates without spawning anything: inert JSON (`data()`), presence of the per-task config directories, the presence of a secret inside the env, and `compileNativeLaunch` with directories injected.

- `sdk-descriptor-capture-pr86-options.json`: the PR86 option builder (an exact copy of `apps/worker/conversation/options.mjs` at `c6053e2` was passed with `--options-module`). The inert-JSON gate fails on `undefined` env entries.
- `sdk-descriptor-capture.json`: the option builder after this slice's reconciliation. The inert-JSON and compile gates pass; the config-directory gates still fail and the proxy credential is still inside the env.

Reading: see [the finding report](../../../coordination/reports/FABLE-REMOTE-LAUNCH-DESCRIPTOR-FINDING-20261014.md). No process, network, provider, database or credential was involved; the proxy credential in the receipts is a synthetic string recorded only as a hash. The composed end-to-end rehearsal with the real CLI was not run; it is blocked on the two remaining gates.

## Checks after the option-builder reconciliation

`checks/RESULTS-touched-suites.json` (local baseline runner, non-root, local PostgreSQL 16 running): `runtime-tests` 111/112 (only the Docker image-closure control), `native-authority` 305/305. `checks/RESULTS-touched-suites-clusters-stopped.json` is the retained first attempt of the same set, run while the local clusters were stopped: `source-proof` 3/3, `worker-conversation` 135/135, `gateway-selected-skills` 36/36, `control-admitted-runs` 85/85, `scripts-local` 27/27, and 30 `native-authority` connection refusals (`ENOENT` on the fixture sockets) that disappeared once the clusters were started again.

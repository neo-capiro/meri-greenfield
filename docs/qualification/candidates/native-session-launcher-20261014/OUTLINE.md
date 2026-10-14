# Trusted native session launcher slice

Exact base PR73 `104df6f09b000b8376bb4a5ff7b5a76fe1242b68`, dedicated worktree `/workspace/meri-native-session-launcher`, branch `codex/native-session-launcher-20261014`.

Root owns new native-authority launch configuration, process lifetime and session launcher modules, author tests and report. Independent Codex owns only this candidate's independent evidence. Contracts, index, migrations, locks, existing evidence and private backend are unchanged.

The trusted supervisor compiles one original command/arguments/environment, executable digest, binding, workspace/config paths, SDK/CLI versions and lease before exposing a one-use SDK spawn hook. The hook compares the SDK request to those immutable launch inputs, spawns the actual native process with explicit environment and an owned Linux process group, and attaches PR73's canonical observer before stdout consumption. Registration stays with the supervisor; only a readable process transport goes to the SDK. No worker JSON/child/stream can install observations. This is an implementable source binding, not proof of independent deployed admission.

Configuration validation and executable/path readback precede allocation. Process lifetime owns cancellation, lease expiry, stream/initialization failure and bounded retirement; child close plus positive group absence is required for physical cleanup. The existing durable session owner remains the sole persistence owner. No new route, public contract, authorization owner or model loop.

Checks: real local child fixtures for immutable input matching, native receipt and unchanged bytes, hostile inputs, executable mismatch, no ambient environment inheritance, second spawn, stream failure, expiry/cancellation/cleanup. Independent reviewer executes distinct controls on frozen source. No paid/provider calls, AWS/security changes, credentials, product database/Temporal access or document output. Deployment verifier/broker/runtime/proxy and resources remain owner bindings.

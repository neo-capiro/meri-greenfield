# SDK fixture private transport — SOURCE only (H2)

Owner: Codex. Worker: one bounded Hermes H2 session. This is a **source-only** assignment; G1 remains open. The session exited after returning this commit and handoff; Codex owns independent review, process registration, deadline enforcement, teardown and physical-exit verification.

Exact task base: `3d496f6845bf2503cf623c353ea3b5b9fc307a00` on `task/remote-sdk-fixture-transport-20261011`. Worktree HEAD at start of work: `7014005bc7c0e8930f7a0b13ab1cd15a9adcc207` (allocation commit, descendant of the exact base; it adds only this task's brief). Shared policy commit: `b32b4803933760dc0a93fffdcd8fba30a89c3aac` in `neo-capiro/capiro-agent-ops` (`main` is 3 ahead of `origin/main`, `origin/main` is an ancestor, no local change discarded). Machine map: `machine-paths.local.yaml` app_repo_root `C:\dev\capirov2`, worktree_root `C:\dev`.

## What changed

One new private source module and its offline test, both under the existing checkpoint directory:

- `apps/worker/qualification/checkpoint/fixture-transport.mjs` — `createFixtureHttpsTransport(options)` returns the async transport function for the borrowed `createFixtureChannel` call shape `{operation, requestBytes, deadlineMs, signal}`. It is a bounded HTTPS POST transport, not an authorization, durability or SessionStore owner.
- `apps/worker/qualification/checkpoint/fixture-transport.test.mjs` — 19 focused offline cases plus the 7 shared canonical-wire cases it imports; every case injects a fake `node:https` boundary, so no socket, DNS, TLS handshake, certificate or network call is made.

No existing channel, driver, schema, catalog, package, lockfile, image, migration or infra path was touched.

## Code structure and boundaries

Trusted composition is validated once at factory time and fails closed (`FIXTURE_TRANSPORT_CONFIG`) before any dispatch:

- `endpoint.origin` — must parse as an `https:` URL with no username, password, query, fragment or non-root path.
- `endpoint.path` — a fixed absolute path: no query, fragment, backslash, whitespace or `.`/`..` segment.
- port — default `443`, or an explicitly supplied `approvedPorts` entry; nothing else is accepted.
- `identity.pinSha256` — a fixed SHA-256 peer-certificate fingerprint (colon form normalised); the default hostname check is preserved and the pin is added on top, so a foreign, missing or unverifiable certificate collapses to one content-free `FIXTURE_TRANSPORT_IDENTITY` error.
- `mtls.cert/key/ca` — required and nonempty; copied, so the transport never owns or mutates the caller's credential buffers.
- `limits.requestBytes/responseBytes` — required safe integers, each bounded by the fixed `FIXTURE_TRANSPORT_MAX_LIMIT_BYTES` (64 MiB) ceiling.
- `contentType` — an exact bare media type; no implicit default.

Per call, every rejection happens before any network allocation: unknown operation, non-Buffer/empty body, non-integer deadline, malformed signal, request body over the configured cap, malformed or noncanonical profile bytes, expired budget, already-aborted signal.

Dispatch is structurally fixed: exactly one `httpsModule.request` with `method: 'POST'`, `protocol: 'https:'`, the composed hostname/port/path, `agent: false` (no pooled or proxy agent, no environment-derived routing), `rejectUnauthorized: true`, `minVersion: 'TLSv1.2'`, the composed SNI/mTLS material and the pin hook. The channel's `requestBytes` are written verbatim through one `end()` — raw canonical bytes preserved, no re-serialization. There is no redirect following, no retry, no proxy fallback and no second dispatch.

**Deliberate decision (no operation header).** The four-operation profile uses one fixed path, and the operation is already carried inside the canonical request body, so the task's conditional ("bind operation as an exact header or path only if needed") is not met and no operation-derived header is invented. The dispatched header set is exactly `content-type`, `accept`, `content-length`. The operation is still validated against the closed four-operation set before dispatch.

Response handling applies every limit during receipt, before aggregation: non-200 and any `location` header are refused (`STATUS`), a non-identity `content-encoding` is refused (`ENCODING`), the media type must equal the composed type (`CONTENT_TYPE`), a declared `content-length` over the cap is refused without attaching readers (`RESPONSE_BOUND`), and the running streamed total is checked on every chunk so an oversized chunk is refused at the crossing chunk, not at `end` (`RESPONSE_BOUND`). A non-Buffer chunk, `aborted`, `error` or a `close` before `end` refuses with a fixed error (`CLOSED`).

Resource ownership: the transport clears its own timer, removes its own abort listener and destroys its own request and response exactly once on every success and failure path. It never aborts or otherwise disposes the borrowed channel `AbortSignal`, the injected `https` boundary, or the credential material. All failures are fixed, content-free codes (`FIXTURE_TRANSPORT_*`); no response body, header, private error message or rejected-object property is read, logged or placed in a thrown message.

The transport enforces only its own byte boundary — the fixed profile envelope (`channelVersion`, `profile`, closed operation) plus exact canonical byte equality via the existing `canonicalize` dependency. The complete fixture schema, receipt binding and authority checks remain with the existing owners (`qualification-sdk/wire.mjs`, `qualification-sdk/validate.mjs`); no second schema registry, parser or canonicaliser was added.

## Verification actually run

Environment: Windows 11, git-bash. Runtime actually used: the installed pinned Node 24 at `C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`, `node --version` = **v24.19.0** (satisfies the package `engines` range `>=24 <25`). `apps/worker/qualification/node_modules` is absent in this checkout; the transport and its test are dependency-free apart from the repository-root `canonicalize` closure.

Owned focused suite (final bytes), **exit 0, 26/26 pass, 0 fail**:

```
node --test apps/worker/qualification/checkpoint/fixture-transport.test.mjs
```

The 26 are 19 new transport cases plus the 7 canonical-wire cases the test imports from the shared helper. Raw stdout: `.task-inputs/remote-sdk-fixture-transport-1/transport-test-output.txt`.

Directly affected existing controls:

```
node --test apps/worker/qualification/checkpoint/fixture-channel.test.mjs   # exit 0, 22/22 pass
node --test packages/contracts/test/sdk-fixture-wire.test.mjs               # exit 0, 7/7 pass
```

Both baselines were captured before any edit and were unchanged by it (22/22 and 7/7 before and after). Raw stdout: `.task-inputs/remote-sdk-fixture-transport-1/channel-test-output.txt`, `wire-test-output.txt`.

New cases, all against the public contract (no implementation constant is restated): trusted-composition refusal across 19 malformed configurations with zero dispatches; an explicitly approved non-default port accepted; operation/body/deadline/signal input refusal; malformed, BOM, trailing-newline, unnecessary-escape, wrong-profile and wrong-operation bytes refused as noncanonical; expired budget and pre-aborted signal refused; exactly one fixed POST carrying the exact canonical bytes with the exact trusted TLS options; no dispatched option derived from the request body, the environment or a redirect (body and environment canaries); redirect/non-200/compression/wrong-type/declared-oversize refusal with owned-resource destruction; the streaming cap enforced at the crossing chunk before `end`; mid-stream non-Buffer chunk/abort/close refusal; the real composed pin hook refusing foreign, missing, hostname-mismatched and unverifiable certificates; the original deadline honoured with its owned timer cleared (asserted through `process.getActiveResourcesInfo()`); abort during flight refusing without disposing the borrowed controller; borrowed credentials, module and caller buffers neither disposed nor mutated; hostile rejected objects never inspected and no private body text escaping; and an end-to-end composition in which the **real** `createFixtureChannel` borrows this transport over the injected boundary and accepts the result (`gateway.authorize` returns `true`, exactly one dispatch, no retry).

`git diff --check` clean. Working diff and hashes: `.task-inputs/remote-sdk-fixture-transport-1/working.diff`, `changed-file-sha256.txt`.

## Limits and cleanup

- Request: composition-supplied cap (test composition 4096 B; module ceiling 64 MiB). Over-cap bytes are refused before dispatch.
- Response: composition-supplied cap (test compositions 1024 B and 262144 B); enforced on the declared length and on the running streamed total during receipt.
- Exactly one POST, one send, no redirect, no retry, no proxy fallback.
- Budget: the original channel `deadlineMs` and abort signal are honoured; an expired budget refuses before allocation; the owned timer is cleared on every path.
- TLS: `rejectUnauthorized: true`, minimum TLSv1.2, pinned peer SHA-256 plus hostname, required mTLS cert/key/CA; ports limited to `[443]` unless explicitly approved.
- Cleanup: `clearTimeout`, `removeEventListener`, `response.destroy()` and `request.destroy()` exactly once per invocation; the borrowed signal, module and credentials are never disposed.

## Known failures / limitations

- **Pre-existing setup failure, unrelated to this change:** the qualification package's declared entry `npm --prefix apps/worker/qualification test` (`node --test probes/static.test.mjs`) fails with exit 1 and three `ERR_MODULE_NOT_FOUND: Cannot find package '@anthropic-ai/claude-agent-sdk'` errors, because `apps/worker/qualification/node_modules` does not exist in this checkout. Raw stdout retained at `.task-inputs/remote-sdk-fixture-transport-1/qualification-static-test-output.txt`. Independence is provable from the import graph: `static.test.mjs` imports only `../sdk-options.mjs`, `./runtime.mjs`, `./browser.mjs` and `./artifacts.mjs`, and nothing anywhere imports the new module (verified by repository-wide search). `npm ci` is outside this task's authorized scope.
- **NOT RUN (correctly refused):** a real loopback TLS test. It would need committed private key material or external setup, so no socket, handshake, certificate or network call was made; the transport's real-TLS behaviour (chain validation, pin enforcement during a handshake, mTLS presentation, connection teardown) is therefore unverified here and must be exercised by Codex on the pinned image. No real network call was authorized by this task.
- The streaming/aggregation and timer-cleanup properties are asserted offline through the injected boundary and `process.getActiveResourcesInfo()`; they are not evidence of live socket memory containment.
- This module is a transport only. It does not authenticate the application actor, decide current grants/fences, prove service persistence or qualify TLS against a real peer. A peer pin and mTLS are transport checks only; the future trusted service must independently enforce peer/current grant/policy and atomically publish immutable readback under the current fence.

## Proposed shared-interface changes (not made)

Per the brief, these are proposals for root/Codex allocation rather than edits:

1. `scripts/qualification/worker_context.py` `PACKAGE_FILES` does not list `checkpoint/fixture-channel.mjs`, `checkpoint/fixture-transport.mjs` or their tests, and `component-pins.json` `interruptionPackaging.records` pins only three files. The new transport is therefore **not** in the assembled image context. This is consistent with the existing channel/adapter state recorded in `docs/qualification/SDK-FIXTURE-CHANNEL.md` (the private contract/schema/adapter closure is deliberately outside the public archive), and adding these private paths plus their dependency closure to a new reviewed image context remains a root decision.
2. The new test file is not wired into the qualification package's `npm test`/`check` script, which runs only `probes/static.test.mjs`; the existing `checkpoint/fixture-channel.test.mjs` is likewise run explicitly by the coordinating task. Registering checkpoint tests in the package test entry (and in the smoke-discovery mechanism) is a package.json change outside the owned paths.
3. The transport imports the repository-root `canonicalize` dependency directly, as the sibling private `checkpoint/fixture-channel.mjs` already does transitively. The qualification package's own `package.json`/lock does not declare it; the image context allocation in item 1 must include that closure.

## Evidence hashes

Final (post-change) SHA256 of the owned source files:

- `apps/worker/qualification/checkpoint/fixture-transport.mjs` = `00a9c50469e4d50db27598283ebf2767cf0e2102233e926b8126e7bbc129a929` (12470 bytes, 229 lines)
- `apps/worker/qualification/checkpoint/fixture-transport.test.mjs` = `e3f67bd238866ae0b8b5df417d0acfda13107408e104bb69044b64847233f2a4` (28172 bytes, 503 lines)

Both were untracked additions at the recorded base; no previous revision exists for them. Evidence is under the ignored namespace `.task-inputs/remote-sdk-fixture-transport-1/` (three passing suite logs, the retained failing static-entry log, `changed-file-sha256.txt`, `working.diff`). No secret, credential, private key, customer data or live capture was copied into the repository or the evidence.

## Changed paths

- `apps/worker/qualification/checkpoint/fixture-transport.mjs` (new)
- `apps/worker/qualification/checkpoint/fixture-transport.test.mjs` (new)
- `docs/coordination/reports/CODEX-G1-SDK-FIXTURE-TRANSPORT-REMOTE.md` (new, this handoff)

## Next dependencies / handoff to Codex

1. Codex independently reviews and tests this exact commit on the pinned Node 24 runtime and records ACCEPT or HOLD. A worker summary is a claim until independently verified.
2. Real-TLS qualification (chain, pin during handshake, mTLS presentation, teardown) needs separate root review, fresh authority and an actual approved endpoint; this source task deliberately produced none of it.
3. The trusted service side — peer/grant/fence enforcement, atomic immutable publication under the current fence, and actual process-exit/drain evidence inspection — remains absent and is not implied by this transport.
4. G1 remains open. No runtime, security, native, Fargate, scheduler or deployment acceptance is claimed or implied, and no mock here proves native TLS or physical remote cancellation.

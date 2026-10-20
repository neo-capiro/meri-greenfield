# Runner first-failure diagnostic correction

## Authorized scope and outline

- Base: exact deployed `5b395d4ce9218b872b21c420dc00a3af31739824`.
- Branch: `fix/runner-first-failure-20261019`; separate worktree. PR175 is unchanged.
- Source only: no build, deploy, model call, credential access, authorization or security change.
- Canonical diagnostic owner: `apps/runtime/runner-runtime-diagnostics.mjs`. Retain its task-local first failure and existing final diagnostic; emit a constant-only first-capture event immediately.
- Capture the original SDK preparation error before cleanup aggregation in `native-authority/sdk-query-preparation.mjs`. Capture failed prepare/start at their existing rejecting owner boundary in `native-authority/remote-task-client.mjs`, using a local fixed origin and excluding already closed/aborted startup.
- Preserve the same returned/thrown errors, cleanup order, request data, authorization checks, deadlines, retries and shutdown/retirement waits. No generic channel logging, SDK replacement, new transport or diagnostic payloads.
- New event: `RUNNER_FIRST_FAILURE origin=<fixed allowlisted origin> code=<fixed allowlisted code>`. No arbitrary message, stack, identifier, prompt, descriptor, payload or credential field. The existing final `RUNNER_RUNTIME_FAILED stage=... code=...` remains separate.
- Focused checks: known preparation/remote failures, preparation-plus-cleanup aggregation, immediate capture while cleanup is pending, one immutable first record, redaction/hostile error values, concurrent contexts, unchanged transport/auth/deadline semantics, existing activity and CLI diagnostic behavior. No broad test sweep.

This corrects diagnostic loss and emission timing only. It does not identify or repair the failed live chat's transport, prove provider reach, or establish durable settlement.

## Verification

- Node 24.19.0, sequential focused diagnostic/activity/facade suite: **36/36 passed**.
- Eight selected existing remote transport contract tests: **8/8 passed**. They retain role separation, request envelope, distinct startup/ordinary deadlines, absolute cutoff and cancellation, late-response retirement, positive-stop ordering and refusal of late start.
- The 12 new tests use the actual preparation function and remote client with only a mocked adopted SDK and in-memory transport. They check native prepare/start refusal, canonical SDK no-launch/preparation refusal, an already assembled aggregate remaining UNKNOWN, original error retention before a held cleanup aggregate, silent success, cancellation, cutoff, immutable single capture, hostile values and writer failure.
- Existing activity/CLI checks retain publication states, cleanup counts, returned codes, CLI exit 3 and `RUNTIME_UNAVAILABLE`; only the additional first-capture diagnostic is expected.
- Independent read-only review approved the three production changes and the new test file; `git diff --check` passed. Production changes are limited to the three modules named above. No authorization, request, timeout, retry, process-release or cleanup-return branch changed.
- First local test attempt was retained: 16 passed / 4 failed because the new worktree lacked the existing conversation SDK dependency link and Node's `assert.rejects` itself inspected a hostile proxy. The test uses an inert rejection envelope now. Second attempt retained: 18 passed / 2 failed because the existing control-conversation Temporal dependency link was also missing. The final run uses the same existing installed dependency paths as the base; no package or lockfile was changed or installed.
- A command transport disconnect during the second attempt was reconciled by reading its completed log before any rerun. Both failed logs and final passing logs remain in the task's `pr193-one-chat-20261019` evidence directory.

Reproduction commands from the branch root:

```text
node --experimental-test-module-mocks --test --test-concurrency=1 apps/runtime/test/runner-first-failure.test.mjs apps/runtime/test/runner-runtime-diagnostics.test.mjs apps/runtime/test/activity-runtime-diagnostics.test.mjs apps/runtime/test/runner-kickoff-diagnostic.test.mjs apps/runtime/native-authority/test/runner-query.test.mjs
node --test --test-concurrency=1 --test-name-pattern="^(control task ports|startup prepare and start|startup stage cutoff|timed out fetch|client close during prepare|client ignores late stdout|stdout refusal during close|stdin refusal)" apps/runtime/native-authority/test/remote-task.test.mjs
```

## Pinned native transport classes (20 October follow-up)

The product runner's `fetchImpl` for native prepare/start is `apps/runtime/pinned-native-transport.mjs`. Its rejections
were code-less, so every control/ALB status, socket, TLS or truncation failure at `origin=native-start` printed `UNKNOWN`.
Each rejection now carries exactly one constant from `PINNED_NATIVE_FAILURE_CODES`. The canonical diagnostic owner
defines that list and spreads it into its allowlist, and the transport imports it. The message stays `PINNED_NATIVE_REFUSED`. No status text, body, system code, peer detail, header,
prompt or credential is echoed, and request bytes, TLS options, ceilings and denial conditions are unchanged.

| Class | Meaning |
| --- | --- |
| `PINNED_NATIVE_CONFIGURATION` | adapter construction refused (origin, limits, CA file ownership/mode/type/size/hash) |
| `PINNED_NATIVE_REFUSED` | the call was refused locally before any byte was sent |
| `PINNED_NATIVE_ABORTED` / `PINNED_NATIVE_TIMEOUT` | caller signal / the adapter's own 30 s ceiling |
| `PINNED_NATIVE_CONNECT` / `PINNED_NATIVE_TLS` / `PINNED_NATIVE_SOCKET` | failure before any response head |
| `PINNED_NATIVE_TRANSPORT` | any other request error (bounded fallback) |
| `PINNED_NATIVE_STATUS_403` / `_503` / `_4XX` / `_5XX` / `_OTHER` | non-200 head, decided at the head before any body is read |
| `PINNED_NATIVE_RESPONSE` | 200 head whose framing, size or body did not complete, including loss after the head |

At `native-start`, the client's operation lifetime still wins deadline and cancellation races, which print
`REMOTE_TASK_REFUSED`. The transport's 30 s `TIMEOUT` is unreachable within the 23 s start bound. A 200 reply whose body is
not JSON, is not valid UTF-8, or has a missing or wrong-shaped `original` fails in `native-authority/remote-task-client.mjs`
(`JSON.parse`, `TextDecoder`, `CommandError('INVALID_COMMAND')` without a code), not in the transport. It is classified by
the fixed fields below (`SYNTAX_ERROR`, `ERR_ENCODING_INVALID_ENCODED_DATA`, `INVALID_COMMAND`).

`apps/runtime/test/pinned-native-transport.test.mjs` drives the real transport over local TLS. It covers every class,
cancellation, the ceiling, abort/response races, late responses, redaction, unchanged denial, and socket/timer/listener
cleanup, and it also drives the remote client plus runner diagnostics. On POSIX the CA is a real 0600 own-uid file, and the
ownership/mode refusals run against the real filesystem with no module mock. On Windows only, the CA handle is mocked and
cases are labelled `[windows-ca-mock]`. The test is not part of the image build's `LINUX_ONLY_TESTS` set, and
`.dockerignore` keeps it out of the build context.

```text
node --experimental-test-module-mocks --test --test-concurrency=1 apps/runtime/test/pinned-native-transport.test.mjs
```

## Fixed classification of every first failure (20 October, live run ef0c07c7)

Image `sha256:d7995b75…` (candidate `3dc993ef`) printed `RUNNER_FIRST_FAILURE origin=runtime code=UNKNOWN` 13.4 s after
native start completed. Cleanup then ran past the shutdown timer (`RUNTIME_SHUTDOWN_TIMEOUT`), so the final
`RUNNER_RUNTIME_FAILED stage=… code=…` line, the only one carrying the stage, was never written.

- The activity's `diagnostics.failure` hook captures the raw inner error.
- On the post-start path, most errors are code-less: every SDK-originated failure (own `errorClass`, `exitCode` or `signal`,
  no `code`), the text and progress projectors' `Error('SDK_TEXT_*')` / `Error('SDK_PROGRESS_REFUSED')`, and the client
  parse errors above.

The event is now:

```text
RUNNER_FIRST_FAILURE origin=<origin> stage=<stage> code=<code> class=<class> exit=<0-255|none> signal=<SIGNAME|none>
  cause=<code|none> msg=<12 hex|none> site=<module:line:column,…|none>
```

(one line in the log; wrapped here)

- `code`: an allowlisted own code, else an allowlisted constant message, else the class. An Error is never printed as
  `UNKNOWN`; a thrown non-error or proxy is `NON_ERROR`.
- `class`: `SDK_<errorClass>` for the pinned SDK's tagged classes (`SDK_PROCESS_EXITED_NONZERO`,
  `SDK_PROCESS_KILLED_BY_SIGNAL`, `SDK_PROCESS_ERROR`, `SDK_CONTROL_REQUEST_FAILED`, `SDK_INITIALIZE_TIMEOUT`,
  `SDK_ABORTED`, …; `SDK_OTHER` for any other), else the built-in type (`AGGREGATE_ERROR`, `TYPE_ERROR`, `SYNTAX_ERROR`,
  `RANGE_ERROR`, `REFERENCE_ERROR`, `DOM_EXCEPTION`, `ERROR`).
- `exit` / `signal`: the SDK's own `exitCode` / `signal` data, bounded to 0–255 and a fixed list of POSIX names.
- `stage` is on the first line because a hung cleanup never reaches the final line.
- `cause`: the own `cause`, classified like `code`. The lifecycle controls' `LIFECYCLE_EXECUTION_UNKNOWN` now carries its
  original failure as `cause`.
- `msg`: the first 12 hex characters of SHA-256 over the message, never the text. Resolve it with
  `docs/integration/runner-first-failure-message-hashes.json`. That table holds the constant messages of the pinned SDK
  bundle (including its plain `Error`s) and of the runner, worker and contract sources. Regenerate it with
  `node scripts/diagnostics/runner-first-failure-message-hashes.mjs > docs/integration/runner-first-failure-message-hashes.json`.
- `site`: up to three innermost stack frames as module basename, line and column, for absolute file paths and `node:`
  modules only. The lines of the `name: message` header are skipped, so message text is never read as a frame.

Only own data properties are read. Getters and proxies are never invoked. The stack is formatted only through V8's own
accessor and Node's default `prepareStackTrace`, and only when `name` and `message` resolve to data properties. No message,
stack text, stderr tail or directory is printed.

Attempt 2 (20 October, 08:26Z) printed `code=ERROR class=ERROR`, the line the lifecycle pump produced then:
`LIFECYCLE_EXECUTION_UNKNOWN` was unlisted, and its original failure was dropped. A failed control poll now prints
`code=LIFECYCLE_EXECUTION_UNKNOWN … cause=<the poll's failure> msg=a6073a611574 site=activity-lifecycle.mjs:…`.

The failure itself was the first lifecycle control poll after `system/init`:
- `runner/next-controls` crosses control's `worker-http.mjs`, which verifies task authority three times and issues and
  reads an action session for every call. Live, verifies took 0.8–1.35 s each.
- The native client gave that call its 3 s default, so the poll timed out (`DEADLINE`), and the pump failed the run about
  3.0 s after the session started.
- The four lifecycle control calls (`next-controls`, `claim-control`, `ack-control`, `record-checkpoint`) now share the
  session allowance up to the execution cutoff, as checkpoint capture already did.
- `apps/runtime/test/lifecycle.test.mjs` reproduces the failure through the real native client and proves that the product
  budget completes the same slow poll.

`apps/runtime/native-authority/test/sdk-initialization-milestones.test.mjs` signals the real CLI after its initialize answer
crosses the remote facade:

| Signal | Deployed image | With the fix |
| --- | --- | --- |
| SIGKILL | `code=UNKNOWN` | `code=SDK_PROCESS_KILLED_BY_SIGNAL … signal=SIGKILL` |
| SIGTERM | `code=UNKNOWN` | `code=SDK_PROCESS_EXITED_NONZERO … exit=143` |

That suite is Linux-only and needs the pinned CLI. Run it inside the image with the candidate's test directories mounted,
as in `adj-reports/adj-b-D1-PREFLIGHT.md`.

## Limits and retained startup evidence

The new event identifies the first observed terminal error at a rejecting boundary. A cancellation can still produce an outer SDK terminal rejection; the native prepare/start origin is suppressed once that client is closed or its spawn signal aborted. Concurrent failures may race to capture first. The event does not prove root cause or provider contact. An already assembled aggregate reports `AGGREGATE_ERROR`; its members, cause and message are never inspected.

The paired 37-character startup lines at 22:43:51.818 (control) and 22:43:51.823 (runner), 19 October 2026, remain **UNCLASSIFIED**. A bounded private equality comparison against 26 local first-party/dependency source files found no exact substring match. Only timestamps, length, classification and empty match lists were persisted; raw messages and message digests were not emitted or stored. Local dependency version/source equality is not deployed-byte attestation.

Original task STOPPED evidence, prior startup failures and APP STOP_FAILURE remain unchanged. Current conversation transcript and durable settlement remain pending. This source-only change does not authorize a model call, image build, deployment or security/configuration change.

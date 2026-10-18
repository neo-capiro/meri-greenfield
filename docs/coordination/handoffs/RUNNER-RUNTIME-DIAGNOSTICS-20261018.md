# Runner runtime failure diagnostics — source only

Base: `107af36b89686bb8545b200e05a39f2c4733b56b`.
Branch: `dot/runner-runtime-diagnostics-20261018`.
Scope: constant failure diagnostics and synthetic regressions only. No image,
deployment, live provider request, credential read or new dependency installation.

## Diagnosis of the existing observation

The reported runner exited 3 with only `RUNTIME_UNAVAILABLE`, and the saved owner
transcript contained only queued. The historical log cannot be retroactively
disambiguated: base `apps/runtime/cli.mjs:30,46` catches both the dynamic module
import and all of `runConversation`, discarding the caught error.

Earlier product poststart bootstrap and pinned native transport precede this
boundary (`runner-poststart-cli.mjs:47-51`); CLI configuration and runner measurement
fail separately with exit 2 (`cli.mjs:11-27`). The outer poststart reporter does
not run when CLI returns numeric 3 (`runner-poststart-cli.mjs:51-52`).

The product path is workspace/environment preflight, capability load, admitted
binding bootstrap, remote configuration/TLS/clients, worker construction, receiver
listen, kickoff gate, nested activity, then cleanup. Binding bootstrap catches
transport errors and retries until its deadline (`task-bootstrap.mjs:17-22`).

The activity prepares runtime before publishing starting or setting claimed
(`apps/worker/conversation/activity.mjs:42-50`). SDK query is after acknowledged
starting and running publications (`:50,69,73`). Preclaim errors produce no failure
status and are translated to EXECUTION_FAILED/EXECUTION_STOPPED (`:92-103`). A
queued-only complete current history for the exact binding therefore does not
identify the failing preclaim step. Query is unreachable on the ordinary activity
path before both publications succeed. This is not an independent provider audit.

Existing narrow readback: the exact original's allocation journal records state
and `resource.launchBinding.state`; prepared kickoff reads these to distinguish
preparing and STARTED (`native-authority/prepared-kickoff.mjs:24,46-56`). A missing
acknowledgment is not proof of missing persistence (`conversations/postgres-store.mjs:17-20`).

## Implementation outline and result

The runtime entrypoint owns a scoped AsyncLocalStorage diagnostic context. Runtime
composition marks fixed stages; it captures the first escaped failure before
activity translation or cleanup replacement. The helper owns the fixed stage and
code allowlists. It never reads error.message, error.stack, error.cause or error
property getters; unknown codes become UNKNOWN. No activity, contract, admission,
secret, transport, lifetime, cleanup or model-loop behavior is changed.

One additional stderr line is emitted only on runner failure:

```text
RUNNER_RUNTIME_FAILED stage=runtime-admission code=NATIVE_UNAVAILABLE
RUNTIME_UNAVAILABLE
```

The new line originates in `apps/runtime/runner-runtime-diagnostics.mjs:35`, inside
the diagnostic wrapper called at `apps/runtime/cli.mjs:31`. Existing exit codes and
the existing RUNTIME_UNAVAILABLE line are preserved. The diagnostic identifies the
first failing stage; later cleanup errors may still be the exception ultimately
returned. It is not a cleanup-success receipt. Plain Errors without an allowed own
data code report UNKNOWN; no message is used as a substitute.

## Validation

Node 24.19.0, command:

```text
node --test apps/runtime/test/runner-runtime-diagnostics.test.mjs apps/runtime/test/runner-poststart-cli.test.mjs apps/runtime/test/cli-product-runner-pin.test.mjs
```

Passed 14/14. The new regressions cover actual runtime-admission failure through
the canonical activity before claim/Query; first failure through cleanup
replacement; secret-bearing messages, arbitrary codes and getters excluded;
concurrent context isolation; successful-run silence; exact CLI exit/log behavior;
and stderr write failure preserving the original rejection.

Dependency setup initially failed at imports for the SDK, contracts and Temporal
polyfill; these attempts executed no test bodies. Existing dependency trees were
reused through untracked junctions after matching lockfile SHA-256 values. SDK is
0.3.295. No install occurred. An initial regression using the older submit fixture
failed STORE_UNAVAILABLE before reaching the runner; it was replaced with a narrow
synthetic queued run port, retaining the canonical runner and activity under test.

All source syntax checks and git diff whitespace checks passed. These are source
checks only; the historical runtime cause and any future image/live behavior remain
unverified. Parent owns independent review, publication and operational decisions.

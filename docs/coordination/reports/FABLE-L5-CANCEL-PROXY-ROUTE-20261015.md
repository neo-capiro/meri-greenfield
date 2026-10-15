# Fable lane l5-cancel-proxy-route: broker cancellation cleanup and retained proxy route (15 October 2026)

Branch `fable/a2-cancel-proxy-route-20261015`, base `e046be84` (the corrected P1b pin, which contains shared candidate `ba40647`). This lane covers audit findings **L5** (`lifecycle-report.md`) and **SEC-REL-01** (`security-release-report.md`) from `docs/coordination/audits/meri-comprehensive-20261015/` on `origin/dot/meri-comprehensive-audit-20261015`. These are source-level repairs backed by synthetic tests. They do not establish runtime, live or release acceptance. No deployment, cloud, credential, database, model or provider action was taken.

## Implementation outline

| Responsibility | Canonical owner (unchanged) | Change |
| --- | --- | --- |
| Temporal broker activity: dispatch, poll, original cleanup | `apps/runtime/temporal-worker.mjs` `createBrokerActivity` | Removed the legacy `execution/start` branch. The prepared kickoff is now the only broker mode, and the original stop runs on every exit after dispatch. |
| Poller startup configuration | `apps/runtime/config.mjs` `validateConfiguration` | The `temporal-worker` role now requires `native.preparedKickoff === true`. |
| Native original stop and physical cleanup | `native-authority/prepared-kickoff.mjs` (`stop`/`close`) and the admitted supervisor | Not changed. The worker now reaches this owner in every case. |
| Retained proxy inference ingress | `apps/proxy/qualification/runtime/ingress.py` `IngressAdmission.validate_scope` | Closed route contract: the path is exactly `/v1/messages` and the query is exactly `beta=true`. |

Dependency direction, persistence, authorization and execution placement are unchanged. No new module, framework, contract, migration or lockfile change was introduced. The only new file is a focused test (`apps/runtime/test/broker-cleanup.test.mjs`).

## L5: which repair was chosen, and why

The audit accepts either of two repairs. One fails startup/readiness for the unsupported non-prepared mode while keeping a qualified in-flight plan. The other wires an original-bound stop/revoke owner into the legacy path. This lane takes the first, smaller option:

- The deployment path already runs the poller with `native.preparedKickoff: true` (`docs/coordination/reports/CODEX-PREPARED-CANDIDATE-DEPLOYMENT-20261014.md` §startup; `FABLE-FIRST-CHAT-RECONCILIATION-20261014.md`, "Temporal poller owner"). Legacy mode is not part of the plan, so refusing it removes no planned capability and changes no placement.
- Prepared mode already has the qualified cleanup contract. `execution/kickoff/stop` closes the original with an independent 3000 ms signal, and an unknown cleanup prevents a successful receipt (audit L5, "Important boundary"). Wiring a second stop owner into the legacy native routes would add a parallel cleanup path across `execution-http.mjs`, `broker-stack.mjs`, `allocated-runtime.mjs` and `remote-composition.mjs`, which this lane does not need.
- Prepared behaviour does not change. The existing prepared tests pass with no changes to their assertions.

### Plan for executions already in flight

- **Deployments.** None was performed (completion report: "Image digest and deployment receipts: none"). No legacy-mode product execution exists to migrate.
- **Activity retry.** The workflow sets `retry: {maximumAttempts: 1}` (`apps/control/conversations/workflow.ts`), so a legacy activity is never retried on a prepared-only worker. The workflow definition and activity name are unchanged, so recorded history stays valid.
- **Draining a qualification environment that ran legacy workers:**
  1. Stop admitting new runs to that queue.
  2. Keep the old-build legacy workers running until each in-flight activity ends. The native `poll` retires the task when the run is terminal or its admission is revoked. To cancel, revoke admission and let the next legacy poll retire the task.
  3. Only then start the prepared-only build.
- **If a legacy worker died before its poll observed retirement.** That execution's cleanup is UNKNOWN. It must be reconciled through the native broker's original `stop`/retire owner, not redispatched or reused. Its lease (`expiresAtMs`) bounds admission but is not proof that the task stopped.

## SEC-REL-01: retained proxy route

`validate_scope` required `query_string == b""`. That refused the request the pinned CLI 2.1.295 actually sends, `POST /v1/messages?beta=true` (receipt `docs/qualification/candidates/fable-resume-20261015/rehearsal/standin-probes-20261015.json`, probe C1b), and admitted an empty query that no pinned client was observed to send.

The scope is now admitted only when all of these hold:

- `path == "/v1/messages"`
- `raw_path` is the bytes `b"/v1/messages"`
- `query_string` is the bytes `b"beta=true"`

Everything else is refused with `INFERENCE_ROUTE_REQUIRED` before any state read or body access, including:

- the empty query;
- another parameter or value (`beta=false`, `beta=1`, `beta=`, `beta`);
- different case;
- repetition, extra or leading `&`, `;` or `#`, or whitespace;
- percent-encoded forms;
- non-bytes or `bytearray` values, or a missing query;
- a query folded into `raw_path`;
- `/v1/messages/count_tokens`, a trailing slash, or other paths.

Header, peer, opaque-key and recheck controls are unchanged. The proxy README route statement now matches. The CLI's `GET /api/hello` connectivity probe is outside this inference ingress and is still not admitted. C1b shows the CLI continued to the inference POST after that probe failed.

## Files

- `apps/proxy/qualification/runtime/ingress.py`, `apps/proxy/qualification/test/test_ingress.py`, `apps/proxy/qualification/test/test_server.py`, `apps/proxy/qualification/README.md` (commit `be7db499`)
- `apps/runtime/temporal-worker.mjs`, `apps/runtime/config.mjs`, `apps/runtime/README.md`, `apps/runtime/test/broker-cleanup.test.mjs` (new), `apps/runtime/test/runtime.test.mjs`, `apps/runtime/test/prepared-temporal.test.mjs`, `apps/runtime/test/temporal-authorization.test.mjs` (commit `6af75bfb`)

## Checks

Environment: Node v24.21.0; Python 3.13.16. `apps/runtime` dependencies were installed with `npm ci --ignore-scripts`; its lockfile differed from `meri-fable-complete`, so it could not be linked. Other packages are symlinked to byte-identical lockfiles. Runtime suites ran with `MERI_REVIEW_SOURCE_ROOT` set to the worktree, which the shared invocation harness fixture requires.

### Proxy (all synthetic: no database, provider, TLS, socket or AWS)

| Suite | Before (base) | After |
| --- | --- | --- |
| `test_ingress` | 22 tests OK | 25 tests OK (3 new tests and 2 changed fixtures; the query-negative test has 21 subtests) |
| `test_server` | 10/11; 1 error (`httpx`, then `litellm`, not installed) | 10/11; the same environment error. The routes-denied test now refuses `b""` and `b"beta=true&x=1"`. |
| `test_lifetime`, `test_native_usage`, `test_tool_budget_source` | — | 12, 10 and 7 tests OK |

Proof that the tests depend on the fix: with `runtime/ingress.py` reverted to base and the new tests kept, `test_ingress` fails. `test_pinned_cli_wire_shape_is_admitted_exactly`, `test_honest_direct_tls_request` and three stream tests error; the `query=b''` subtest and the route-denial test fail; and `test_quiet_stream_revocation_polls_without_chunks` hangs until the run is killed. With the fix restored, all 25 pass.

### Runtime (synthetic: no Temporal server, ECS, PostgreSQL or model)

| Run | Result |
| --- | --- |
| Focused worker suites at base (`runtime`, `prepared-temporal`, `prepared-candidate-config`, `bundle`, `temporal-authorization`) | 41/41 |
| `test/broker-cleanup.test.mjs` (new) | 6/6, three consecutive runs |
| Full `apps/runtime/test/*.test.mjs` with module-mock and VM-module flags, after the change | 205 tests: 199 pass, 6 fail; see below |
| `telemetry/test/*`, `native-authority/test/prepared-kickoff{,-http}.test.mjs`, `native-authority/test/execution-broker.test.mjs` | 36/36 |
| `scripts/qualification/assembled-image/temporal-bundle.test.mjs` (actual upstream bundler with `workerOptions`) | 1/1 |

How the 6 full-run failures break down:

- **Five fail identically at base** (checked with a stashed rerun) and are caused by this environment:
  - `image-closure` needs a Docker build;
  - three `process.test.mjs` runner tests fail on `RUNNER_AMBIENT_CREDENTIAL_REFUSED` because this sandbox exports ambient variables;
  - one `runner-bootstrap-files` cleanup test fails because it runs as root.
- **The sixth is timing-sensitive.** `process.test.mjs` "actual control listener mounts…" returned 408 DEADLINE under load average 5 on 4 cores, while another lane's suites were running. It passed when rerun alone and in the first full run. It belongs to the control role, which this lane did not change.
- **One failure this lane caused was fixed during the lane.** The first full run after the change failed the `temporal-authorization` worker-config fixture, which lacked `preparedKickoff`. The fixture now carries it, and the test still proves the authorization-namespace refusal.

The new tests are:

- **Audit probe.** A broker built with defaults gets cancelled through its heartbeat after launch and poll. It now calls `execution/kickoff`, `execution/kickoff/status`, `execution/poll`, then `execution/kickoff/stop` on a live independent signal, and never calls `execution/start`. Before the fix the calls were `[execution/start, execution/poll]` with stopCalls=0.
- **Startup refusal.** A `temporal-worker` config with `preparedKickoff` absent, `false`, `'true'` or `1` is refused.
- **Loopback HTTP composition.** These run the activity through the real `createNativeCapabilityClient`, `createPreparedKickoffApplication` and `createNativeExecutionApplication` routes, with the real `createPreparedTaskKickoff` owner behind them. Cases:
  - cancellation after actual launch;
  - lost kickoff acknowledgment (the owner received the dispatch; cleanup stops it by execution key);
  - cancellation during a blocked poll;
  - lease expiry.

  Each case asserts one stop request and exactly one owner close (which records task termination and grant revocation) before the activity settles. The close must land within the activity's 3000 ms cleanup bound; observed times were tens of milliseconds. The case also asserts zero legacy starts.

Proof that the tests depend on the fix: with `temporal-worker.mjs` and `config.mjs` reverted to base and the new tests kept, the focused run fails 6 tests. Those are the audit probe, startup refusal, lost acknowledgment, cancellation after launch, and the two converted runtime broker tests. The blocked-poll and lease-expiry composition tests never complete; the file hit the 120 s timeout. With the fix restored, everything passes.

## UNRUN, and why

- **Real CLI → retained proxy → provider flow** (stream termination, cancel, next turn): this requires a model/provider call, which is not authorized in this lane.
- **The ASGI-caller test** `test_actual_caller_private_context_explicitly_wires_native_guard` needs `litellm` (LiteLLM 1.104.2, per pins). That is not installed here, and installing it is outside this lane.
- **Real ECS task termination, grant revocation and the native stop path against PostgreSQL/Temporal** within the accepted bound. The owner's `controller.close` in the new tests is a synthetic stand-in. Real physical cleanup is owned by the admitted supervisor's suites and needs approved live qualification, which this lane cannot run.
- **Temporal heartbeat-timeout delivery from a real server.** The tests model it as an aborted `cancellationSignal`.

## Proposals for dot

1. **Retire the legacy `/v1/execution/start` route.** After this change no product caller uses it. It remains mounted in `native-authority/execution-http.mjs` (used by `broker-stack.mjs`, `allocated-runtime.mjs` and `remote-composition.mjs`) and is covered by `execution-broker.test.mjs`. Retiring it, or confirming a qualification-only caller, is a separately scoped native-authority change.
2. **Align the offline proxy reference.** `apps/proxy/qualification/offline-policy.mjs` still models the bare `/v1/messages` route. If it should mirror the closed ingress query contract, that is a separate offline-reference change.
3. **Approve the live proxy check.** The query contract is closed to the one observed pinned-CLI form. Any SDK or CLI version change must re-record the actual wire form before this constant changes. The live CLI → proxy → provider check (SEC-REL-01 "Minimum fix") still needs an approved bounded run.

## Residual risks

- **An unobserved non-beta call path would be refused.** If the pinned CLI sends any inference call without `?beta=true` on a path not seen in C1b, it is refused. This fails closed and is visible, and only the real CLI-through-proxy run can settle it.
- **Legacy-era tasks may need manual reconciliation.** Any qualification environment that ran legacy workers and lost them before retirement must reconcile those tasks through the native original stop owner (plan above).
- **SEC-REL-02 is still open.** The proxy is still not composed with the product budget or per-run model grants. This lane does not address that.

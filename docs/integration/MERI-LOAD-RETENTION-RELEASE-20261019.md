# Worker load response retention — 2026-10-19

Base: `9acbfe7168eb4e9c1e2c3acb02e2a28d08bbd262`, PR193. That source seal is held after independent review identified a response-boundary race: suppression can finish while the third task verification is pending, after the conversation service's final retention assertion and before worker response serialization.

## Implementation outline

The canonical retention gate remains the only owner of serving locks and suppression ordering. The worker HTTP boundary will receive the exact configured gate from `assembleControl`, derive the conversation subject from authenticated task authority, and serialize a load response inside canonical `withRelease` after the final task verification. Its callback must use the gate's scoped assertion and check cancellation/deadline before serialization. No lock, suppression store, authorization cache, or alternative retention implementation will be introduced.

Production ownership is limited to `apps/runtime/worker-http.mjs` and the injection at `apps/runtime/control.mjs`. The session cancellation owner and load service algorithms remain unchanged. Configurations that declare retention must provide the release gate; malformed supplied gates must fail closed. Existing compositions with no declared retention retain their existing optional configuration behavior. The new focused runtime tests will use ordinary synthetic data with canonical retention owner/ledger/journal/read gate, exercise suppression ordering and cancellation/cleanup, and preserve pre-fix failure evidence. Combined load/cancellation checks and canonical release tests will be rerun after source review. No build or AWS action is authorized.

## Safeguard boundary

The parent reported that another reviewer was denied permission by a security safeguard to share its local reproduction file. That file-sharing action remains stopped. This lane has not requested, retrieved, or indirectly accessed the file, and bases this defensive repair solely on the documented finding, repository source and independently authored local synthetic regressions. No external exploitation or private data is involved.

## Reproduction and minimal repair

The new `apps/runtime/test/worker-load-retention.test.mjs` composes the repository's canonical retention startup, acknowledged ledger, watermarked memory journal, suppression owner and read gate. It also uses the real session owner and basic/lifecycle conversation services. Task authority and saved conversation data are local synthetic ports; a trusted fixture hook observes the actual response serialization point. No listener or external service is started.

Before either production file changed, the race regression failed with `200 !== 403`. Its diagnostic recorded `promptPresent:true`, projection `SUPPRESSED`, three task verifications, four service retention assertions, two saved reads, one lifecycle read and zero conversation writes. Suppression is performed by the canonical owner during the third verification, not by directly changing a projection. The first failure output is retained; the diagnostic was then added and the unchanged-source failure rerun.

The production change adds one trusted `retention` dependency to the worker factory and passes the exact `retention.gate` already owned by control composition. Canonical `storageMethod` captures `withRelease` without invoking getters/proxies. A declared-retention configuration with no release port, or an explicitly malformed port, refuses construction. No session or conversation wire contract changes.

For `load` only, after the third verified task receipt, the worker derives `{tenantId, kind:'conversation', subjectId}` from the pinned authenticated binding. It calls canonical `withRelease`, requires its scoped assertion, checks both lifetime and fence signals before/after that assertion, and constructs `Response.json` while the lock remains held. It awaits the release operation inside the existing `try`, so temporary-session revocation and lifetime close occur afterward. The deadline passed to the gate is the minimum of the original request cutoff and verified task receipt expiries. No timeout was extended.

Other worker routes retain their prior behavior. The original session cancellation owner/tests, combined reader, load service and load count/retention fixture remain byte-identical to `9acbfe`. A successful configured load now has **four existing service retention assertions plus one scoped response-boundary assertion**; three task checks and Core call counts remain unchanged. The older load-amplification fixture uses an undeclared-retention worker configuration; its four-assertion count alone does not prove the new boundary. The new canonical fixture proves `retention:4`, `scoped:1`, `release:1` separately.

## Review and checks

Independent Astra ultra source review approved the defensive change and verified canonical-gate injection, authenticated subject binding, scoped reads on the serving lease, final-task ordering, effective deadline propagation, awaited cleanup, and configuration compatibility. The reviewer read the locally authored baseline evidence and ran whitespace checks; the coordinating agent executed tests.

Node `v24.19.0`, using the same exact-lock dependency installs as the preceding PR193 checks. `MERI_DIAGNOSTIC_IMPORT_STUBS=1` selects existing import-only configuration/provider stubs; it does not replace the retention, session, conversation or worker owners under test.

```sh
# Before production edits; expected failure with HTTP 200 and committed suppression.
MERI_DIAGNOSTIC_IMPORT_STUBS=1 node --test --test-reporter=tap --test-name-pattern='suppression committed during final task verification' apps/runtime/test/worker-load-retention.test.mjs

# Final retention/cleanup set.
MERI_DIAGNOSTIC_IMPORT_STUBS=1 node --test --test-reporter=tap apps/runtime/test/worker-load-retention.test.mjs apps/control/retention/test/release-fence.test.mjs apps/control/conversations/test/retention-port.test.mjs

# Previous combined source guarantees.
node --test --test-reporter=tap apps/control/action-host/session/authenticated-current-state.test.mjs apps/control/action-host/session/cancellation.test.mjs apps/control/action-host/session/owner-independent.test.mjs apps/control/action-host/session/transition-owner.test.mjs apps/control/action-host/session/native-credential-relay.test.mjs apps/control/conversations/test/stream.test.mjs
MERI_DIAGNOSTIC_IMPORT_STUBS=1 node --test --test-reporter=tap apps/control/conversations/test/load-amplification.test.mjs
```

The retention set passed **38/38**, including 11 new worker cases, 25 existing canonical release-fence cases and two existing retention-port cases. The prior session/stream set passed **168/168**, and the full load suite passed **39/39**: **245/245 affected tests passed**. The initial ten-case worker run also passed; one final-authority-expiry case was added before the final set. Console output is committed in `meri-load-retention-20261019/`, with trailing whitespace normalized and original local output retained separately.

The repaired race diagnostic records HTTP **403**, `promptPresent:false`, committed projection `SUPPRESSED`, three task verifications, four service retention assertions, one release/one scoped assertion, zero serializations and zero conversation writes. The full load suite retains 31/37 fixed/dynamic Core call counts and the existing unchanged deadline/latency/retention checks.

The new cases cover committed suppression during the final task check, earlier suppression, response-lock-first ordering, cancellation and deadline during acquisition and scoped read, serialization failure, the final task receipt's earlier expiry, missing/malformed release configuration, and a missing scoped assertion. Subsequent canonical suppression proves subject locks are released after each failed release, and late completion never serializes the saved prompt. Temporary worker sessions are removed.

Syntax checks passed for both production files and the new test; whitespace checks passed. No manifest, lockfile, session-owner, shared lifetime, database schema or runtime configuration value changed. The two historical graph-query 502 failures remain recorded with their exact-a16 reproduction in the original cancellation packet and are not repaired here.

| Source | SHA-256 |
| --- | --- |
| `apps/runtime/worker-http.mjs` | `5354470ab49ec4148ea947989d46f0e979ae7920cea3908529b6acc451105f18` |
| `apps/runtime/control.mjs` | `c203cba5586897db8954d9865add0881132b1ce8036a5562651651d44af19b28` |
| `apps/runtime/test/worker-load-retention.test.mjs` | `b980ef34370c7e5a4c022da8ee06228939af9598052f3b4fad918b0d833f5a90` |

No build, AWS operation, deployment, live database check or paid provider call was performed. Local canonical composition and scripted PostgreSQL lease tests do not establish live database behavior or the incident's exact cause. The prior `9acbfe` seal remains held; this is a separately reviewed source successor for the parent to evaluate.

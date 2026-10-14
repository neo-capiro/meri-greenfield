# Independent native runner gateway review

Decision: **ACCEPT_SOURCE_ONLY** at `7df7a9e00b72f097de66acb1a467c51eac026e2c`; **HOLD_NATIVE_FIRST_SESSION_AND_OUTPUT**. Base PR70 is742e57287db5294f84724b6c1878c113bff3bba8. The fixed relay respects the original new trusted Meri gateway/broker deployment boundary and independent observer ownership. No actual SDK/DB/provider/cloud/credential/security/document action was performed by this reviewer. Dependencies and production source were not edited.

## Material findings, preserved failures and repairs

1. At clean70dc8840f12a96d9fb60240fbef50b9466877888, arbitrary transport rejection passed through instanceof RelayError. Independent Proxy errors executed prototype traps; a throwing trap rejected handle instead of producing a sanitized response. **0/2 passed**, exit1. Returning trap count was3; throwing trap escaped. The root repaired this with private WeakMap facts for constructor-owned RelayErrors and explicit Proxy exclusion; no instanceof/prototype/code/status getter is evaluated on foreign errors. The unchanged two assertions subsequently pass.
2. At cleanb2cebbc5ba1ac22f64e8075e660d93d09cec0601, a Response acquired exactly at deadline was lost before `upstream=await life.run(...)` assignment: the lifetime's post-await check refused, while the existing pending callback had seen the pre-abort signal. Finally had no response to cancel. The deterministic injected-clock assertion counted0 body cancels instead of1. This capture is **2/3 passed**, exit1 (two error repairs passed; deadline cleanup failed). Root repair records the acquired reply inside pending fulfillment before the lifetime's post-check, retaining late-after-abort cancellation. The unchanged assertion now passes.

Both failed raw captures and test sources are retained unchanged. These are source/callback lifecycle defects, not native execution evidence.

## Reviewed source behavior

Construction is inert/default-disabled and validates closed configuration, fixed approved controlOrigin, finite limits and compiled Fetch transport. Ten routes derive from the canonical six runOwnerOperations and four sdkSessionOperations. Ordinary routes map /v1/runner/<operation> to /internal/conversations/<operation>; session paths stay identical. Unrelated provider operations return null for provider composition. The relay synthesizes no readiness, verifier, launch, runtime-options or observation response.

The actually presented task bearer is preserved exactly; no configured server/fixture credential replaces it. Only bounded content/auth headers cross the fixed hop, with redirect:error, credentials:omit and cache:no-store. Caller body/origin/forwarding metadata cannot select the destination. Canonical worker-http and session-owner retain actual current verification, opaque session/current-context checks, independent registration, held allocation/fence/policy checks and SQL effects. The relay adds no broker, verifier, observer, budget lock or second codec/model loop.

Raw request/reply bytes preserve Unicode, spacing, duplicate markers and opaque session contents. Requests/response limits distinguish ordinary131072/2097152 bytes from session9437184/35651584 bytes; deeper transcripts bypass ordinary DTO decoding. Status/refusal/UNKNOWN bodies from trusted control remain exact. After possible dispatch, local timeout/transport/invalid-response failure returns outcomeUNKNOWN, never a known rollback/refund or retry instruction. Before dispatch, refusal records NOT_DISPATCHED. No retry occurs.

One operation lifetime covers collection, transport and response. Owned request/response readers are cancelled and locks released without waiting indefinitely on cancel promises. Acquired-at-deadline and late-after-abort responses are both retained/cancelled after the repair. This is cooperative transport cleanup, not proof of remote rollback or physical task termination. Source-only tests do not qualify TLS/native isolation.

## Checks actually executed

All commands ran under an independently adapted Linux child-subreaper capture. The capture refuses allocation unless exact expected HEAD and clean production diff match; it records exact test-source SHA256, raw stream sizes/hashes, source head/diff before and after, timeout/kill/reap and owned process-group absence.

- `70dc`: `node --test docs/qualification/candidates/native-runner-gateway-20261014/independent/active-error.test.mjs` — **0/2**, exit1.
- `b2ce`: `node --test docs/qualification/candidates/native-runner-gateway-20261014/independent/active-error.test.mjs docs/qualification/candidates/native-runner-gateway-20261014/independent/deadline-reply.test.mjs` — **2/3**, exit1.
- `7df7`: `node --test docs/qualification/candidates/native-runner-gateway-20261014/independent/active-error.test.mjs docs/qualification/candidates/native-runner-gateway-20261014/independent/deadline-reply.test.mjs docs/qualification/candidates/native-runner-gateway-20261014/independent/relay-boundaries.test.mjs apps/runtime/test/native-runner-gateway.test.mjs` — **12/12**, exit0.

The final run includes five independent assertions (two foreign-error behaviors, acquired-at-deadline cancellation, preserved presented authority/UNKNOWN bytes/header stripping, and session-vs-ordinary byte bounds) plus seven new focused author controls. Author controls execute canonical receiving owners with scripted authority/SQL, including valid load/publish, revoked/foreign refusal, deep SDK entries/dedup and commitUNKNOWN. The author's earlier fixture-only missing reasonCode and queued->running failures remain parent-owned evidence; the final fixture's queued->starting transition matches canonical state rules. This reviewer neither changed nor omitted author assertions.

All three allocated owned groups were absent; no timeout, kill or descendant reaping was needed. Final before/after production diff is empty and HEAD remained7df7. No broad unrelated suite ran.

## Mechanical probe and remaining gates

PREEXECUTION.md independently permits one bounded parent-run /status transport probe with the existing no-upstream403 sink, two loopback listener hops and scripted ACK-only receiver. No such SDK probe was executed by this reviewer. Its outcome, listener/child/temp cleanup and source binding still require postexecution review; scripted ACK is not actual registration/admission/durable commit authority.

Actual canonical application authority/current identity/context, approved product schema/pool/current admitted allocation/grants, genuine task verifier and launch/runtime provider, independent native registration reader, approved model/proxy/task image/isolation and physical cleanup remain external/live qualification gates. Separate approved output run/source/storage/renderer authority remains necessary for editable DOCX; no document was created. No relay health or test success closes these gates.

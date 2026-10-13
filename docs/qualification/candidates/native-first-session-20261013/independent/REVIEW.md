# Independent first-session source review

Decision: **ACCEPT_SOURCE_ONLY** for repaired commit `482e7e8af66516177c6e6599a8b11ecf07adf672`. **HOLD_NATIVE_QUALIFICATION**. Base PR66 remains `53c845e2da5e3c038d05688f3bafbd634391f38f`. Initial reviewed candidate was `a657814b31c52c429e4ded13defe25a4488abdb0`. No provider/SDK task was launched, document created, native database accessed, or cloud/security/production write performed.

## Material finding and repair

Initial candidate permitted a first SDK mirror callback during cancelled-query cleanup to start native registration and retain entries. `sdk-session-runtime.mjs` dropped the preparation signal for null selectors; the fresh mirror had no run cancellation signal. The SDK's cleanup can flush its pending mirror batches before closing transport, so closing the mirror only in the runner's outer finally was too late.

The independent lifecycle reproduction cancelled a scripted query before a cleanup-time callback. Expected native requests: zero. Actual synthetic requests: `/v1/runner/session/register`, `/load`, `/append`. Initial cancellation capture exits 1, one test failed, and is preserved unchanged. This was a correctness/lifecycle blocker for the source candidate, independently of whether a real native owner would subsequently revoke the capability.

Repair passes the actual activity run controller as `runtimeSignal` through compiled preparation/runner/factory boundaries. The temporary preparation signal is checked initially and remains separate: preparation.close() aborts it before query, so retaining that signal for the mirror would break every fresh run. The fresh mirror combines the run signal with its own close controller, checks cancellation before registration and queued transport dispatch, passes the combined signal to registration and canonical transport, and aborts owned work on close. Known-key preparation remains unchanged. Independent cancellation reproduction now passes; a second test verifies transport cancellation during first registration and no subsequent persistence/retry.

## Reviewed boundaries

- Null is only an explicit fresh-task selector; it conveys no authority. Missing selector, changed binding and null continuation refuse before query. The private selector and runtime signal do not enter SDK Options or RPC JSON.
- First callback is validated as a canonical main key; entry data is copied/validated before initialization. Accessor/Proxy objects and subagent-first keys refuse before registration. Later keys pass through the canonical pinned project/session scope. Opaque subpaths are never resolved into local filesystem paths.
- Registration goes through the existing durable owner, which requires real task verification and independently observed exact key/init version. It pins current binding/scopes/policy/allocation, rechecks authority, and uses current allocation transactions. An observation supplied by a synthetic fixture is not native evidence.
- Registration is attempted once per mirror. Refused or uncertain registration rejects queued calls and prevents future retries; native UNKNOWN is not reset. Successful registration precedes canonical load and append. The canonical adapter, rather than the new module, owns serialized queues, request bounds, offset maps per validated subpath and uncertainty barriers.
- A focused parked-registration test exercised 128 accepted pending batches and refusal of the next batch before dispatch. Registration stayed one attempt; no writes occurred while it was parked. Previously admitted batches could settle after release, while completion and close correctly remained failed because overflow had occurred. This tests local admission, not SDK quiescence or durable checkpointing.
- Completion requires an observed initialized mirror and settled writes; successful SDK result without a mirror refuses. Actual pinned SDK0.3.295 source flushes before delivering results and during cleanup, retries append failures with backoffs [200,800], and emits mirror_error after failure. Product activity already refuses mirror_error. Source hash is in manifest.json.
- Mirror retirement is owned by createOwnedRuntimeSdkSession and remains bounded. Cleanup status explicitly does not prove physical task exit. A cancelled remote operation may already have committed; uncertainty and fail-closed completion remain necessary.

No additional blocking source finding was identified after the lifetime repair. No architecture, contracts, catalog, locks, dependencies or production implementation was edited by this reviewer.

## Checks actually executed

Capture commands run from `/workspace/meri-first-session`, on clean production source at each named commit, using the existing Linux child subreaper capture adapted under this exclusive evidence directory. Raw stdout/stderr, hashes, source pin, exits and process-group status are retained in JSON receipts and manifest.json.

1. Initial `a657814b`: `node --test apps/runtime/test/first-session.test.mjs apps/runtime/native-authority/test/session-owner.test.mjs apps/runtime/native-authority/test/session-http.test.mjs apps/runtime/native-authority/test/session-integrity.test.mjs` — **40/40 passed**, exit 0.
2. Initial `a657814b`: `node --test docs/qualification/candidates/native-first-session-20261013/independent/cancellation-review.test.mjs` — **0/1 passed**, exit 1; material cancellation failure above. Exact original single-test source preserved as cancellation-original.test.mjs.
3. Repaired `482e7e8a`: `node --test docs/qualification/candidates/native-first-session-20261013/independent/cancellation-review.test.mjs docs/qualification/candidates/native-first-session-20261013/independent/queue-review.test.mjs apps/runtime/test/first-session.test.mjs` — **13/13 passed**, exit 0. Rerun justified by failed cancellation case and changed lifetime behavior.

All three allocated capture process groups were absent on completion; no group kill was required and no descendants needed reaping. Post-run production diff was empty and HEAD remained the repaired pin. A planned initial queue check was refused by the capture guard while coordinator edits were in progress; no test process allocated and no outcome claimed. It subsequently ran on the repaired frozen source. Existing unaffected native-owner checks were not broadly repeated.

## Remaining qualification blockers

Genuine task verification, independent SDK init/key observation, approved database/current-allocation resources, approved renderer/output resource binding, model/proxy pin, and physical isolation/cleanup proof remain unverified or absent. One real authenticated conversation and separately approved output run through editable DOCX have not executed. Output remains awaiting separate explicit approval. These source results do not accept a native run, deployment, staging environment, renderer sandbox, durable database operation or DOCX delivery.

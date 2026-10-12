# Independent SessionStore admission repair review

11 October 2026 UTC. **ACCEPT_SOURCE_ONLY** for exact commit `680f09cef6e97bee101d09c9d39ab325c0af2007`, tree `32f6528b10154098a0a95ee3ed1cc99099ca4194`, parent `cf9eb76a0f9ea797151a2684bc83592ae1033c9f`. No remaining source blocker was found in the allocated repair. This acceptance does not qualify actual SDK mirroring, transport/storage durability, a new worker image, G1 or release.

## Scope and preserved ownership

The review uses a dedicated detached worktree from the frozen repair, with local Git reads explicitly disabling lazy fetch. AGENTS.md, implementation standards, allocation, author report and exact source diff were read. Only four product source paths change from the parent: `bound-session-store.mjs`, `verify-session-store.mjs`, `session-store.test.mjs` and new `session-store-data.mjs`. All other changes are allocated reports or retained source evidence. Public contracts, native helper, component pins, image recipe, dependency manifests, SDK driver and source/runtime authority are unchanged.

`session-store-data.mjs` owns inert SessionStore JSON admission, one-pass descriptor records and capture of trusted executable method descriptors. The adapter owns ordering, bounds, mirror closure, timeout and uncertainty state. The verifier owns comparison against an externally trusted immutable/quiesced expected inventory and continues to reuse the canonical restore verifier and public hashing. Authentication and atomic current-generation enforcement at actual durable commitment remain responsibilities of the injected trusted transport.

The separate data owner is justified by its actual shared adapter/verifier callers and different transcript semantics: unlike the private fixture protocol's limited JSON traversal, the SessionStore boundary must preserve up to 100,000 transcript entries and opaque deeply nested JSON. Its iterative encoding retains these semantics without executing serialization hooks; it is not another agent loop, authorization system or storage implementation.

## Original HOLD reproduced against the repair

The original frozen-09b payload definitions were independently replayed: a stable enumerable entry getter and a changing `projectKey` getter returning the authorized project first and `foreign-project` second. Both now refuse before execution. The key was additionally checked through append, load, listSubkeys and construction-time session binding. Observed getter reads are **zero**, and observed foreign-key transport effects are **zero**.

The earlier frozen-09b HOLD remains a separate historical finding. Its original script, receipt and stdout/stderr are preserved byte-identically in the repair's retained evidence; their acceptance assertions and recorded foreign dispatch were not rewritten to appear passing. The new reviewer replay records the repaired behavior separately.

## Boundary review

Proxy detection precedes prototype or descriptor inspection, including revoked proxies. Plain records and arrays require inert own descriptors; accessors, hidden/symbol fields, custom prototypes, sparse/augmented arrays and non-JSON values refuse. Serialization traverses only captured data values, never caller getters or `toJSON`. Cycles refuse while repeated aliases preserve JSON value semantics. Exact UTF-8 encoded-byte budgets remain enforced; ordered unknown fields, main/subagent content and UUID-less duplicates remain covered by the original assertions.

Session keys are admitted into one descriptor snapshot and the same frozen primitive values are validated and forwarded. Construction options are inspected before destructuring. Binding is copied before canonical RunBinding validation. Trusted methods are captured separately rather than treated as JSON: class/private-field receivers work, while method replacement after construction cannot change the captured dispatch. Transport-error code accessors cannot authorize retry: they remain unexecuted and produce uncertainty, which prevents another append dispatch. Returned transcript/subkey data and expected snapshot inputs use the same inert JSON owner. Invalid expected input causes zero trusted store reads.

The existing queue, timeout, cancellation signal, uncertainty and no-retry implementation is preserved. Only an own data-valued `SESSION_WRITE_REJECTED` denotes confirmed pre-commit refusal. Timers are cleared and timeout abort does not claim to undo a dispatched remote operation. `closeMirror()` rejects new appends; `settleObservedCalls()` still describes already observed promises and is explicitly neither SDK flush nor complete durable checkpoint acknowledgement. Whole-snapshot verification retains its independent 32 MiB aggregate entry budget and returns only `session-mirror-readback-only`.

## Actual independent checks

| Check | Physical result |
| --- | --- |
| Native 14 + native boundary 7 + SessionStore 23 | **44/44 PASS**, exit 0, no failures/skips; 0.802 seconds |
| Static/source group plus those focused cases | **137/137 PASS**, exit 0, no failures/skips; 1.127 seconds |
| Original getter replay and additional admission probes | PASS, exit 0; 1.038 seconds; getter/trap counters and forbidden effects zero |
| Canonical context/member and assertion preservation | PASS, exit 0; all 53 members / 994,568 bytes identical to parent; original 16-case test file is a byte-identical prefix |

Independent probes additionally exercised revoked proxy refusal, hidden/symbol/non-plain/unsafe values, sparse and augmented arrays, cycles, repeated aliases, exact UTF-8 byte admission/refusal, a 100,000-entry transcript, 100,001-entry refusal, nested JSON depth 512, captured private-field class receiver, uncertain error-code getter, returned data getters and expected-input getter refusal. These are source controls with injected synthetic dependencies, not live SDK transcript or storage durability evidence.

Checks use the pinned local Node 24.19.0 binary, SHA256 `bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`. Already restored ignored worker dependencies were physically copied from the author worktree; there was no installation, lock change or network dependency acquisition. Test processes have 60-second external supervisor limits; the extra probe has a 30-second limit. All process groups are absent and owned test TMPDIRs are empty and removed. No broad SDK-suite rerun was performed: its unchanged driver/context source was verified byte-exact instead, as allocated.

The native module and component pins are byte-identical to the parent. Native SHA256 remains `543e05c230bf614cd5cf73f2d69877f1311ec0faf9d7ca205429161a75b842e1`, 12,049 bytes. The canonical context assembler itself is unchanged; its fixed roster excludes the optional SessionStore source fixtures. Therefore this repair neither changes runtime image content nor supplies image admission. The original sixteen SessionStore tests and all existing native test assertions are preserved, with seven adversarial groups appended.

## Limits retained

The native boundary's previous ACCEPT_SOURCE_ONLY applies under documented ownership/quiescence and ancestor-replacement prevention. Actual uid/gid mutation on this host remains **unrun** because the earlier owned probe's chown returned `EINVAL`; this repair did not waive or replace that missing runtime control. Hostile atomic traversal, reverted mutation and full Windows reparse behavior remain unproved.

Actual SDK append/mirror behavior, authenticated durable transport, SDK/process/subagent/tool quiescence, transcript/workspace binding, immutable fenced publication, replacement-task resume and stale-worker effect denial remain unqualified. Flags stay `completeRecoveryCheckpoint:false` and `sessionStoreQualified:false`. There is no model/provider/cloud/native SDK query, remote Git write, merge, deployment, production data access or transfer of historical image authority in this review.

Evidence is in [repair-independent-review](../../qualification/candidates/sessionstore-consolidation-20261011/repair-independent-review/): `focused44.json`, `static137.json`, raw streams, `original-replay-and-boundaries.mjs` with bounded receipt/raw streams, `preservation.json`, and `review.json`. Reviewer writes are restricted to this report and that allocated evidence directory. No product source was edited.

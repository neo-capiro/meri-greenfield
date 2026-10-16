# Bounded independent activity cleanup

Base `eca78d458acb46cbfd54a94cf870841d999ef6b1`. Separate focused increment on `dot/meri-startup-history-20261016`; product-effect repair remains a preceding independent commit.

The activity previously placed skill/read/intent close, lifecycle finish/close, input close and query close in one unbounded try. A rejected close skipped later owners, and a stalled close prevented browser settlement. Its catch path also awaited query close without a bound.

`cleanup.mjs` now owns independent bounded attempts, preserving finish-before-close and idempotent query-close order. Each SDK/resource attempt has a fresh lifetime independent of the aborted run (default 3 s; trusted configuration may choose 1–30 s). Browser settlement always gets an attempt after query close was attempted and retains its own existing 130 s maximum plus 1 s wrapper allowance. Unconfirmed query closure cannot block egress revocation; the canonical browser owner still requires process-exit proof before deleting profiles. Any failed or timed-out attempt yields `SDK_CLEANUP_UNKNOWN`, including when the model result was already durably completed. Native retirement remains the physical stop owner. A timer is never a stop receipt.

Synthetic Node 24.19.0 check, one process at a time, 192 MiB V8:

`node --max-old-space-size=192 --experimental-test-module-mocks --test --test-concurrency=1 apps/worker/conversation/test/cleanup-activity.test.mjs apps/worker/conversation/test/activity.test.mjs`

**26 passed, 0 failed**: 14 existing activity cases and 12 full-activity regressions with scripted SDK/resource ports. Throwing and never-settling skill/read/intent/lifecycle-finish/lifecycle-close owners must all attempt subsequent query/browser cleanup. Query close that never settles is tested on both success and failure. The capability composer and resource preparations are explicitly synthetic module mocks; no real SDK query or browser ran.

Reverted-fix proof: temporarily restored base activity bytes and ran all 12 new cases, then restored the repair. **0 passed, 6 failed, 6 cancelled** (test timeouts), exit 1. Earlier development attempts exposed a missing locked UI dependency and two test-fixture mistakes (skill catalog prefix and Windows/Linux capability-path mismatch); those were corrected without changing production capability behavior or assertions.

No hashed candidate-h row changes: activity and the new cleanup module are outside its row list. No manifest, lock, frozen contract, Dockerfile or migration changes. Locked worker, window-resolution and UI-stream dependencies were installed without scripts. UNRUN: real SDK/browser/Temporal/native stop, compiler and broad suites; heavy qualification is coordinator-held. No release acceptance is claimed.

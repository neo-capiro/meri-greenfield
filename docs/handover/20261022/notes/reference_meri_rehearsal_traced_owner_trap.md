---
name: reference-meri-rehearsal-traced-owner-trap
description: "The first-turn rehearsal's traced owner copies broke worker-http's WeakMap-registered session issuer: +10 Core calls per load/publish, durations ~1/3 too long from af393710 until 2090cafa (10-20)"
metadata:
  node_type: memory
  type: reference
  originSessionId: 132a8902-f161-42d4-b1f8-47a3f7430573
  modified: 2026-10-21T00:05:10.061Z
---

`apps/runtime/test/first-turn-rehearsal.test.mjs` traced control's owners by copying their keys into new frozen objects (my `af393710`, 2026-10-20). But `worker-http.mjs:15` finds the session owner's registered current-state issuer with `issuedCurrentState(sessions)`: a lookup in a module-private WeakMap keyed by the owner object.

The copy missed that lookup, so control fell back to the plain session port (issue + authenticate + read):
- load and publish went from 32 to 42 Core calls;
- at median, 10.5 → 13.9 s; at tail, 20.8 s against the runner's 23 s;
- a Clerk-timeout-503 case falsely failed at load.

Fixed on `fable/adj-c6-delta-coalesce-20261020` @ `2090cafa`: `sessions` is passed through untraced. I found it by bisection: untraced owners in a scratch overlay, then halves. Making the wrapper preserve synchronous methods did not help.

**Why:** every first-turn and 40-delta duration measured with the `af393710` rehearsal until `2090cafa` is about a third too long. Those outputs are kept as `adj-e-notes/traced-*.out`. `d3-rehearsal.test.mjs` never used `traced`, so it is unaffected.

**How to apply:**
- Never wrap or copy an owner that is registered by identity (a WeakMap, or `===` against a registry); pass it through.
- Before trusting a rehearsal's durations, check its Core calls against the known baseline **for that source**:
  - **`main` @ `69fd1994` and later: 164** for a median 2-delta first turn (load 32, publish 22 ×4, about 11 polls ×4);
  - **pre-B4 (candidate 5, C6 branch): 224** (publish 32 ×4, 16 polls). G's B4 `31888644` cut publish 32→22.
  - The poll count depends on timing, so compare against the rehearsal's own independent counter, not a fixed total.

Related: [[project-meri-deadline-sweep-c5]], [[reference-meri-in-image-test-recipe]]

---
name: project-meri-p1-pr200-validation
description: "P1 budget-table PR #200 review (10-21) — CHANGES; no value changed, but evidence-docs bloat, proxy config at 94% of render cap, dead Temporal option, broken callers; PR197 must merge first"
metadata:
  node_type: memory
  type: project
  originSessionId: 9ae56df5-b065-4fe6-8698-2c20c2c729cb
  modified: 2026-10-21T23:31:06.502Z
---

PR #200 (`feat/meri-p1-budget-table` @ `f94ef9e1`, base `bce70776`) reviewed 2026-10-21. Verdict **CHANGES**. Report: `C:\dev\fable\adj-reports\phases\P1-VALIDATION.md`; evidence `adj-reports/adj-c-evidence/p1/` (results/, mutate.py, render-sizes.mjs, gates scripts).

- **Values:** none changed at production inputs (independent audit of ~250 sites; golden is truly base-extracted). Guards real: Node + Python no-default red on base, green on head; 11/11 mutations caught.
- **Blockers:** `docs/hot-path/` evidence = 52k of 61k lines (O63 says out); whole 278-hop table rendered into proxy config → **30,744 of the 32,768-byte render cap** (proxy reads 24 hops); `NativeConnection.connect({connectTimeout})` is a dead option (not in `NativeConnectionOptions` 1.24.0); C11's `composed-next-turn-rehearsal.mjs`, assembled-image `image_probe.mjs`/temporal-bundle test, one `prepared-run-bindings` test call now throw; no control startup-refusal test; 66 `independent`-kind hops skip nesting.
- **Merge order:** PR197 first, then P1 rebases — merged tree fails P1's literal guard on 27 PR197 sites in 18 files plus 13 textual conflicts. C12 (#201) either order.

**Why:** the hot-path phase workflow ([[project-meri-hot-path-phase-workflow]]) has agent 1 fix and me re-validate; this is the baseline for the re-review.
**How to apply:** on re-review, re-measure the proxy config size, re-run both guards on head/base, and check the C1–C10 list item by item. Traps hit: the P0 harness `in-image.sh` sandbox hangs `action-host/local/recovery-independent.test.mjs` on base too; WSL (vmmem ~16 GB cap) stalls when several sessions run containers — re-run timing gates on a quiet host. See [[reference-meri-in-image-test-recipe]].

---
name: project-meri-proxy-403-owner-grant-and-exchange-budget
description: "20 Oct Meri first-chat proxy 403 INFERENCE_DENIED — attempt 1 = owner DB grant (fixed live), attempt 2 = 3 s owner-exchange deadline; candidate 5 fix split across two branches"
metadata:
  node_type: memory
  type: project
  originSessionId: 132a8902-f161-42d4-b1f8-47a3f7430573
  modified: 2026-10-20T18:10:10.231Z
---

Proxy `403 INFERENCE_DENIED` on the first real chats (2026-10-20). Report: `C:\dev\fable\adj-reports\adj-e-PROXY-DENIED.md`.
- **Attempt 1 (12:16Z):** `meri_model_budget_owner` lacked SELECT (+ lock-only `UPDATE(record_sha256)` for FOR UPDATE) on `initial_run_bindings` and SELECT on `next_runs`. Fixed live by one-off on `d2-migrate:6` (orchestrator applied 14:4xZ after snapshot `meri-pre-owner-grant-20261020`); ledgered as ordinal 22 (`55f2f768`), CI static check `f9cade3e`. Ledger reconcile (ordinal 22) still pending from candidate 5's image; a meri-only run re-enables `meri_temporal_migrator` LOGIN (re-disable after).
- **Attempt 2 (14:55Z):** no check refused — the deadline did. Each model request = 2 owner exchanges under ONE 3 s cutoff; each exchange = 4 pair proofs (proxy+owner, before+after), each 10 sequential ECS/EC2 calls, never cached by design. Proof: CloudTrail shows exactly one discovery per role and no after-proofs; 403 ≈ proxy start + 3.0 s.
- **Candidate 5 fix:** F1 budgets (exchange/owner 15 s, proxy bootstrap 25 s), F2 parallel discovery (phases 5/1/1/3), bounded refusal lines on both sides (proxy `PRODUCT_PROXY_REFUSED gate= step= [phase=] [at=] code=DEADLINE|REFUSED`). Python/proxy `57f9c66f` (adj-e, `fable/adj-proxy-admission-20261020`), Node/render `ec08c987` (adj-c, `fable/adj-owner-exchange-budget-20261020`). Merging both conflicts in 4 files: take adj-c's for owner-diagnostics/placement/currentness .mjs, take adj-e's for first-chat-database.test.mjs; verified 242/242 Node + 205 Python on the merge.
- **F3 (reuse pair proofs, relax "fresh around every reply") DEFERRED** to an ADR with its own security review (orchestrator decision under D016).
- **F1 gap (found 10-20 in the deadline sweep).** The request's `LifetimeLimits` (`qualification/runtime/lifetime.py`) still cut every in-request owner exchange at `check_seconds` 5 s. It also quarantined the proxy on `cleanup_seconds` 1 s whenever a request closed mid-refresh.
  - Fixed in `7afaeb83` on `fable/adj-sweep-deadlines-20261020` (both now 15 s).
  - Not in candidate 5 `4797f7da`. See [[project-meri-deadline-sweep-c5]].
- **adj-b independent review of `57f9c66f` (10-20): APPROVE** (`adj-reports\adj-b-review-proxy.md`).
  - No check removed (mechanical diff); 205/205 in the real image; 12/16 mutants killed.
  - Lines reach container stderr as PID 1; task def proxy:37 `model-proxy` → awslogs.
  - **F-1 trap:** the startup pair-wait (every 2.5 s, up to 180 s, outside any request) shares the 20-lines/min budget, so a first-chat refusal within ~60 s of pair admission can be suppressed (reproduced). **Wait ≥ 60 s after the proxy's last startup `gate=pair` line before the first chat.** The fix (a separate out-of-request budget) is proposed as a follow-up.
  - The Python pair proof still caps at 3 s (`max_request_ms ≤ 3000`), unlike Node's 15 s.
- **Candidate 5 = `4797f7da`** (candidate 4 + C call reduction + both branches above + B's run-owner replay). Rehearsal gate PASSES (harness `1142cb41`, needs L3/candidate ≥5): median 52.4 s/224 Core calls (cand 4: 74.8 s/310); Clerk timeout answered 401 still fails the turn, answered 503 completes via B's replay. Report `adj-e-E2E-REHEARSAL.md`.
- **Owner-exchange model** (real-code checked): each model request = ~10 owner exchanges, ~40 pair proofs, 182 proxy ECS calls → median ~18 s owner overhead before first token (~24 s total); 15 s caps hold at median; tail risk = proxy ECS clients' 1 s read timeout/1 attempt (≈182 × per-call P(>1 s)), which poisons the proxy. F3 is the latency lever.

**Why:** the next attempt needs both images + re-render; if it fails again, the new lines name the check. **How to apply:** before diagnosing a new proxy 403, read `/meri/product-preview/proxy` and `/meri/product-preview/owner` for these lines first.

Related: [[project-meri-greenfield-fable-shipping]], [[reference-meri-proxy-python-test-env]], [[reference-meri-preview-rollout-traps]]

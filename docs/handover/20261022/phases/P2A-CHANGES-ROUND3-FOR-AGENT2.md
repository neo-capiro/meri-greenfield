FROM: Fable

# P2 PR-A (#196): change list, round 3 (for agent 2)

**Verdict at `aa721c24`: CHANGES.**

**R1–R4 are fixed and verified independently.** Each fix is real and each named test fails without it. My own mutants, run in the runtime image (Node) and the pinned proxy test image (Python, uid 10001), are all killed by the intended tests:

| Item | Mutants killed |
| --- | --- |
| **R1** | Revert to drift in both languages; issue a proof from uninspected members; accept an own-task overlap; own final change made unavailable. My mid-proof StopTask and force-new-deployment race scenarios now give `PAIR_UNAVAILABLE` with no retirement in both languages. |
| **R2** | Three partner tasks made unavailable; two final members without rolling accepted, in both languages. |
| **R3** | Older receipt allowed to replace a newer one. The test also passed 10 of 10 runs alone. |
| **R4** | N5 (session generation unchecked). |

**Production changes since `c703e9f3`:** only the R1 and R3 code, in `service-pair-discovery.mjs`, `service_pair_discovery.py` and `owner_admission.py`. The test edits are R1's intended reclassification and the new R2/R4 tests; nothing is weakened.

**Push the items below to the same branch, keep the PR a draft, and in the PR body list each item's test and the mutation that turns it red.**

## F1 · Answered owner refusals retire the proxy (carried over from the first review; it was missing from earlier lists)

**Reproduced at `aa721c24`:**
- On one carrier, five exchanges, each answered with a status 403.
- **Exchanges 1–3** raise `StateDenied`, and the exchange stays available.
- **Exchange 4** also raises `StateDenied`, and the proxy **retires**: `on_retire` fires once, four resets are recorded, and in production that call is `os._exit(78)`.
- **Exchange 5** then raises `PairProofError`.

So four ordinary answered refusals within a minute restart the shared proxy.

**Cause:**
- `owner_https.py` `_send` resets the carrier and counts it for **any** exception raised after the request write, including `_deny()` on an answered non-200 status.
- `owner_channel.py` sets `self._sent = True` (line 443) before `dispatch()` even runs, so the bridge treats work that was never written as sent.

**Fix:**
- In `owner_https.py` `_send`, count a reset toward `CARRIER_RESETS_PER_MIN` **only** for a read-only exchange that timed out after the write and before any reply status. An answered refusal may close its carrier, but it doesn't consume the reset budget.
- In `owner_channel.py`, set `_sent` only after the exchange reports that the write completed.

**Tests (mutation-checked):**
- five answered 403s within a minute leave the proxy available and not retired;
- four post-send read timeouts within a minute still retire it;
- a carrier-busy or never-written exchange is not "sent".

## T1 · A stale test fails on the branch: `test_owner_https`

**The failure:** `test_owner_https.HttpsTests.test_post_handshake_final_membership_and_deployment_pins_send_no_http_bytes`, in both its `membership` and `deployment` modes. It still expects `PAIR_DRIFT` and retirement for a **partner** change in the final re-read; R1 correctly makes that `PAIR_UNAVAILABLE`. Error: `"PAIR_DRIFT" does not match "PAIR_UNAVAILABLE"`.

**Fix:**
- **Adapt it:** a partner final deployment or member change gives `PAIR_UNAVAILABLE`, sends no HTTP bytes, and closes both sockets, while the exchange stays available and not retired.
- **Keep drift coverage** with a separate case for the own service's final change, or for a final pin contradiction.

**Run the whole Python product suite** in the pinned image before reporting. The 64-test subset in the PR body did not include this module.

## T2 · Missing tool dependencies must skip, not fail (from D3)

`test_pair_lease_composed` and `test_owner_wire_envelope` spawn `node` and need the workspace `node_modules`. When either is missing, skip with a reason (`self.skipTest(...)` after checking `shutil.which('node')` and the required module path) instead of failing. Keep them running wherever both are present.

## Not required

N6, N16 and P16 (judged benign earlier).

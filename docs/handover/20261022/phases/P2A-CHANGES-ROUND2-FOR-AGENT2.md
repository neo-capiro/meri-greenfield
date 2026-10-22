# P2 PR-A (#196): change list, round 2 (for agent 2)

**Status:** the security re-check of `c703e9f3` found that most of round 1 is fixed: C2, C3, `retire` exiting non-zero, and M1–M5. The relaxation sign-off is now unconditional. **Four items remain.** Push them to the same branch (`feat/meri-p2-proof-reuse`), keep the PR a draft, and list each item's test and the mutation that turns it red.

## R1 · A replacement that appears *during* a proof still retires the survivor (both languages)

**What happens:** the final re-read of the partner's service treats any member, or PRIMARY deployment, that wasn't in the first read as `PAIR_DRIFT`.
- Node: `service-pair-discovery.mjs`, "a new final ARN stays drift".
- Python: `service_pair_discovery.py:477-487`.

So if the replacement task is placed while a renewal is in flight, the survivor retires. That hits about 10–15% of one-sided restarts.

**Fix:**
- **For the partner's service only:** if the final service observation passes every pin check, a final member or PRIMARY deployment not seen in the first read means **`PAIR_UNAVAILABLE`**, not drift.
- **Keep drift** when the final read contradicts any pin, and for the side's own service.
- An uninspected task never contributes to a proof (no lease, no generation). The next renewal inspects it in full.

**Tests (both languages):**
- **StopTask race:** a gap at the first read, and the replacement listed (PENDING) by the final read.
- **Force-new-deployment race:** stable at the first read, and the new task and deployment present by the final read.

Each must end without retirement, and the following renewals must reach exactly one `reproven`.

## R2 · Pin the partner count boundary (mutant N11)

**Test (both languages):** three distinct RUNNING members in the partner service give `PAIR_DRIFT`, including when the service observation is otherwise a pinned rolling deployment.

## R3 · A late, older admission read must not replace a newer one (Python)

**What happens:** `test_next_tick_reads_again_after_an_unanswered_renewal` is flaky (1 in 3). When the unanswered first read's reply arrives after the second read's, `ProductOwnerAdmissionReader._install` publishes it last, so the current receipt becomes the staler one.

**Fix:** `_install` refuses a receipt whose read **began** before the current receipt's read. Compare `read_at_mono`, or use a per-lifetime read sequence. Make the test deterministic.

## R4 · Pin the owner's session-generation check (mutant N5)

**What happens:** in `owner-https.mjs`, the check `session.generation !== s.lease.generation` is unpinned. An `open` in flight during a replacement can re-insert its session after the clear.

**Test:** a session whose `open` completes after a replacement is refused on any new-generation socket.

**Not required:** N6, N16 and P16 (judged benign).

The Docker image gate and rehearsal results are still being run; anything they find comes as a separate short list.

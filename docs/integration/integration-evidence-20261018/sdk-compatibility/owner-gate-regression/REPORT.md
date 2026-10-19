# Actual owner bridge unresolved-readback regression

Commit `fb3b62977a0306cd16ef90fbf7dc211272524d5b`, branch `test/owner-unresolved-settlement-quarantine-20261019`, base `f45b9b599ada9438fd443e878641a91602c32b92`. Only `apps/proxy/product/test/test_owner_channel.py` changed. Production code and canonical SQL are byte-identical to the base.

The second provider attempt in the earlier offline receipt crossed omitted production boundaries: `AccountingBridge` propagated a failed readback without invoking the actual `ProductOwnerBridge._abort`, and the hand-written IPC accounting path omitted the actual JS owner channel. The actual bridge catches failed readback, poisons its shared process-lifetime `OwnerHostGate`, and retires its borrowed exchange. Startup uses that same gate/exchange for admission and later bridges. Canonical reservation SQL intentionally allows legitimate new requests after a prior slot is SETTLED. No SQL repair or body-hash/global-once deduplication was introduced.

Two regression cases now exercise the actual bridge and admission reader classes:

- Exact SETTLED readback following uncertain settlement leaves the shared gate available. A distinct `request_B`, carrying identical original/native bytes on the **same borrowed exchange and gate**, obtains a new UNKNOWN reservation. This preserves legitimate next model requests.
- Unavailable readback after uncertain settlement invokes the actual abort path. The shared gate becomes unavailable and the borrowed carrier reports aborted. An already-created request_B bridge, a fresh bridge, an existing admission reader used from a foreign thread, and a new admission reader all refuse with no further exchange calls. The admission fixture is explicitly unexpired under the synthetic clock, including its consistent expiry tag, so expiry cannot explain its refusal.

The existing complete-capture fixture setup was extracted unchanged for reuse; original assertions remain. The existing exchange fixture now defaults its request ID to request_A and can represent a distinct later request.

Python 3.13.5, TZ America/Toronto, scrubbed environment with no credentials. Original owner-channel baseline: **10/10 pass**. Final: expanded owner-channel **12/12** plus adjacent actual admission **13/13**, total **25/25**, no skips. `git diff --check` passed. Commands, source hashes and all scrubbed logs are in `EVIDENCE.json`.

Preserved intermediate results: first new tests raised two uncaught exceptions because importing the exception class inside the existing sys.modules patch produced a stale class identity; its import was moved outside the patch. An initial 25-test pass used an expired admission fixture and therefore did not prove that particular refusal cause. Review caught it before completion. Aligning expiry initially omitted the fixture's required matching tag, which the real validator rejected (24 pass/1 setup error); expiry/tag were corrected together and both final reruns passed 25/25. These are test setup corrections, not product failures.

This unit fixture proves the actual refusal-before-exchange path. It does not itself execute a provider or assert a live provider count; egress owns the separate actual SDK/wire matrix. It establishes post-unresolved fail-stop behavior, not cross-process exactly-once guarantees or prevention of every overlapping request before readback finishes. Synthetic transport replies are not live mTLS or physical-stop evidence. No production edits, build, provider/AWS/SQL mutation, Core work, push, merge or deployment occurred.

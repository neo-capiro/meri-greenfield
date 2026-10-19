# Read-only ACK-uncertainty review

Reviewed the exact local receiving head recorded in EVIDENCE.json. No production, SQL, fixture or test source edits. Independent source confirmation agrees with root/capabilities: the current actual-SDK repeated-send observation uses an incomplete offline bridge, not the canonical product bridge's post-failure gate. Capability regression and egress fixture upgrade retain their owners.

| Boundary | Confirmed source behavior |
| --- | --- |
| ProductOwnerBridge.read_outcome, owner_channel.py543–570 | Only UNCERTAIN same-request state is accepted; the exact closed authenticated SETTLED outcome is required. Cancellation, malformed/unavailable/timeout outcomes call _abort. |
| ProductOwnerBridge._abort, owner_channel.py287–302 | Unconditionally marks bridge failed and poisons the shared OwnerHostGate before synchronously aborting both operation/capture connections. Even abort failure cannot restore permission. |
| Shared gate identity, owner_channel.py187–207 and constructor | One service-pair key fixes the gate; a fresh replacement object for the same owner/proxy identity is refused. Same exchange fixes loop, policy, gate and operation/capture locks. |
| ProductOwnerStartup, owner_startup.py52–56,117–129 | One constructor-captured gate/exchange feeds both the admission reader and every fresh UUID request bridge. Session currentness uses that same reader and original immutable source/deadline caps. |
| ProductOwnerAdmissionReader, owner_admission.py99–114,129–132,194–228 | Fresh construction requires available shared gate. Existing reader refresh refuses before I/O when the gate is poisoned, and cached receipts cannot be consumed after poison. |
| Existing authority, state/admission.py48–54 | Product GrantAdmission.check delegates to the same reader's fresh check; it does not cache a previous successful authorization. |
| Reservation SQL, product-model-budget.mjs | The same request slot is always single-use, and any UNKNOWN liability on the grant blocks a new slot. Once the prior row is SETTLED, a different request ID can proceed if all other currentness/budget checks pass. This supports legitimate later messages; it is not an ACK-uncertainty owner. |
| Offline AccountingBridge, native_proxy.py115–130,245–248 | Plain RPC delegation has no canonical _abort, shared host-gate state or exact wire session/receipt state machine. After durable SETTLED90 plus unresolved readback, its next UUID can therefore reserve again. |

Recommended qualification correction: remove AccountingBridge/manual capture RPC authority and invoke actual Python make_product_owner_bridge over one long-lived thin pipe Exchange. Relay canonical OPEN/POLL/REPLY/OP bytes to actual JavaScript createProductOwnerChannel, which composes existing JS request/settlement owners and capture codecs. Share one Python policy/exchange/OwnerHostGate with the actual admission reader and every request bridge; share one JS serviceGate/persistedFacts/pool across sessions. Preserve distinct fixed operation/capture identities, nested capture admission carrier selection, exact canonical replies, original issued deadlines, synthetic SQL and real accounting counters. Mark OwnerTlsEvidence/peer/facts as synthetic and real private HTTPS OPEN.

Acceptance: unresolved readback triggers actual ProductOwnerBridge poisoning and no subsequent count/reservation/provider call; proven SETTLED readback preserves successful completion and permits a legitimate new request. Do not body-hash deduplicate legitimate same-text turns, mutate bridge _state, reset a poisoned gate, rewrite SETTLED to UNKNOWN, refund or introduce a new journal.

Scope: this source path proves process-shared post-unresolved fail-stop. It is not durable logical-request idempotence across process restart, and this read-only review does not establish all overlapping requests during the earlier UNCERTAIN-to-readback interval. The bridge releases its claim lock between those operations; the requested sequential SDK retry occurs after outcome failure, when poison is already published. Those broader properties must not be claimed from the corrected sequential fixture.

No new source blocker for the allocated sequential retry qualification was found. Actual private HTTPS/peer lease/transport, real PostgreSQL, exact image and live chat remain separate held gates.

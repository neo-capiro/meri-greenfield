# Complete reservation decoding before public artifact acceptance

Base `772cefd26ec02a6345937d6f9b608a53e90ac1a1`. Parent independently accepted corrected L3 `5abfa6535263e2a8d2a7cd8cacadd86305227844` for reserved additive public export authoring, and required complete pending-reservation decoding before artifact acceptance.

`next-run-reservation.mjs` is now the canonical internal complete decoder shared by the existing next-run journal's writer/reader and history. Existing checkpoint/retirement/revocation/no-authority fact validation was moved unchanged into that owner. It validates closed required reservation keys, bindings, scopes, versions, revision/time, target fence/identity and complete facts before comparison/hashing. History brands pure decode failures as `CONVERSATION_STORE_CORRUPT`500; driver/transport failures retain unavailable semantics. No new table or authority is created.

Five recomputed-digest negatives remove scopes, versions, facts, policyRevision or reservedAt. Against prior history source: **1pass/4fail**, exit1 (missing scopes produced generic503; the other failed controls accepted incomplete reservations). Corrected history plus canonical next-run owner controls: **38pass/0fail/0skip**, exit0, 1.81s wall, sampled peak working set186,126,336 bytes. Node128MiB heap, one process/isolation none/concurrency1, owned45s hard watchdog; baseline owned30s. Fresh memory total33,632,079,872/free11,880,275,968 bytes. These are synthetic SQL/authority/lifecycle tests, no DB/provider/Temporal/compiler/browser.

Command: `node --max-old-space-size=128 --test --test-isolation=none --test-concurrency=1 apps/control/conversations/test/history-http.test.mjs apps/control/conversations/test/next-run-owner.test.mjs`.

Accepted lineage, authorization-before-retention, status/null semantics and prior fixes remain intact. Frozen contracts/locks/historical manifests remain unchanged in this correction. Additive public export implementation follows separately, now authorized by the parent's exact acceptance; generated artifact/provenance and frontend adoption still need their normal exact review.

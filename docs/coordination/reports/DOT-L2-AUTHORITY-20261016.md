# L2 authority before successor persistence

Base `eca78d458acb46cbfd54a94cf870841d999ef6b1`; branch `dot/meri-startup-history-20261016`. This increment is separate from product-effect and worker-cleanup repairs and the subsequent history/runtime composition.

Missing transition/native owners are refused before a resume/fork control is journaled. Before closing the source range or persisting a successor, the lifecycle journal now reads fresh **source** current authority outside SQL locks, checks exact actor/binding/scopes/client/policy and receipt freshness, and bounds the persistence transaction by that authority's expiry. Existing post-commit target authority, transition/session context, APPLIED readback, original expiry, immutable input identity and UNKNOWN barriers remain authoritative. This does not invent a pre-persistence target-current owner or relax old writer eligibility.

Missing owners return `503 LIFECYCLE_OWNER_UNAVAILABLE` with NOT_DISPATCHED. If native retirement/admission already started and fresh authority then refuses, the original control remains UNKNOWN, with no successor inserted and no dispatch. A lifecycle HTTP control interrupted after invocation now reports LIFECYCLE_EFFECT_UNKNOWN/UNKNOWN; deadline/cancellation never proves non-dispatch. The helper reuses one receipt/freshness validator before insertion and during target transition reads.

Synthetic Node 24.19.0, 192 MiB heap, one process:

`node --max-old-space-size=192 --test --test-concurrency=1 apps/control/conversations/test/lifecycle-http-uncertainty.test.mjs apps/control/conversations/test/authority-before-successor.test.mjs apps/control/conversations/test/next-run-owner.test.mjs apps/control/conversations/test/lifecycle-transition.test.mjs`

**31 passed, 0 failed**. This includes five new denied/revoked/scope/actor/expired source-authority cases, two transport timeout/cancellation cases, the rewritten missing-owner regression, and existing canonical session/journal/Temporal-adapter APPLIED, cancellation, fork and lost-ACK regressions. SQL, native, Core and Temporal infrastructure are synthetic. Reverting base lifecycle service/journal/HTTP bytes makes all **8 targeted negative cases fail**, exit 1; repaired bytes were restored.

No candidate-h hashed source row is edited by this increment. No manifest, contract, lock, Docker recipe or migration change. Real PostgreSQL/Temporal/native lifecycle qualification and compiler runs remain UNRUN/coordinator-held. Full L2 remains HOLD: concrete prepared startup still lacks canonical transition authority, continuation admission/retirement and approval bindings. The next runtime increment names those gaps and preserves fail-closed operation; optional trusted factory seams are not proof those production owners exist.

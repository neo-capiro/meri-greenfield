# Independent prefreeze finding

Independent suite29 groups:28 PASS,1 FAIL. Stable module SHA256875e80298eeadaaac35c26ac0998d4df3ebf3a8e0ec887ca35ac5dfbc71c299d and schemaSHA25680e6c104e75821e9cfe2861b19073b1e83ea17f87a3efd5e90b77edd4eba8c3f before/after the run. Ownedgroup159120 absent.

Request country=France admitted a FARA result with country:null. The original source applies a nonempty country `contains` predicate, which cannot match SQLNULL. This is a known null/filter relation, independent of collation. The test deliberately does not simulate case-insensitive database substring matching or demand a visible FARA general-query match, because the source OR also searches the unreturned description suffix.

Author requested a narrow refusal for selected nonempty country with a null returned country. No production edit by reviewer. The failing29-group assertions will be replayed unchanged after the repair. Raw failure and original source identities remain in prefreeze-independent.* / prefreeze-source-*.json.

Before first execution, two synthetic fixtures were corrected without changing criteria: custom status was shortened below the producer20-unit selector limit, and the per-operation row-bound counterexample was made structurally valid so it isolates the bound. These changes appear in the captured tracked test diff; no executed failures or source repairs are attributed to them.

## Second admission defect

After the country/null repair, the unchanged original29 groups passed. A new30th control failed: the operation selector used Object.hasOwn without a prior string guard, causing property-key coercion of a hostile object. Its Symbol.toPrimitive getter returned the canonical SEC operation; normalization succeeded instead of throwing. The test therefore proves accepted non-string operation admission with caller-code execution, not only a hypothetical static concern. Exact tested module/schema are retained under operation-coercion-source with hashes; raw29PASS/1FAIL and ownedgroup160241 absent are retained. Requested a narrow primitive-string guard before property lookup. No model/source/provider effects occurred; hostile code was an inert local test counter.

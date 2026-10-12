# Independent entity candidates source review

**ACCEPT_SOURCE** for repaired source `788c0419c9489dfdd4906a50b59661595a072713`, tree `cc42292346660c99160b1f98725804e59e92a8ad`. This accepts the private `resolve_entity` contract family only. Canonical integration belongs to root; source connectivity, current authorization, source/database truth and runtime gates remain unavailable/unqualified.

Author `memory_author` and reviewer `readiness_author` used separate branches/worktrees and exclusive paths. Independent criteria were frozen at `aac0ba3ec942bdb8738f9c68b987a9a00da4779e`, before initial candidate replay. The reviewer changed no production, registry, loader, helper or author files. Parent-approved prerequisite `e721b6f815e68df80d598f9ff1d8127a190ae62a` contains the exact previously accepted state identity helper from `a25516ae8d2c44638800e492e439e212098dc750`; the existing congressional helper is unchanged.

## Actual defect and repair

Original source `49db57c9259f0180fad4f619bf745e541d935db9` passed the first 29 independent controls. Further projection/primary-key inspection found that it accepted duplicate `(entityType,canonicalId)` rows in name-search results. Each name family comes from an unjoined primary-key table. Three additional controls—member, committee, state legislator—failed against that exact source: **29 passed, 3 failed of 32**, no skips. Their source and raw streams are retained in [name-duplicates-before.json](../../qualification/candidates/read-continuation-20261012/entity-candidates-review/name-duplicates-before.json), with the original failure test frozen at `93eca51e6d1f6dab59585a1376f5980442db8d63`.

The author repaired uniqueness only in the name phase. Crosswalk entries may repeat canonical IDs, even with identical projected fields, and remain valid. Case-distinct raw primary keys and the same raw ID in different entity families remain valid. The reviewer independently verified the exact narrow production delta and replayed all unchanged controls, adding a positive control for those legitimate duplicate cases before the repair replay.

One author current-order fixture incorrectly reused one member ID with opposite currentness. Its second synthetic ID was changed; its assertion remains unchanged, its original full source is preserved, and one separate regression was appended. This fixture correction does not replace the three independent failing assertions. The schema, input normalization, helper grammar and non-name phases are unchanged by the repair.

## Verification

| Check | Exact result |
|---|---|
| Initial independent replay, original source | 29/29 pass |
| Added identity counterexamples, original source | 29 pass / 3 fail of 32; retained |
| Repaired focused family replay | **60/60 pass: 33 independent + 27 author**, no skips |
| Independent immutable source/reference audit | **49/49 pass**; 6,110 complete original file blobs/modes preserved |
| Independent author packet, repair and raw receipt audit | **68/68 pass**; all 16 author manifest members verified |
| Broad/public/native/provider/SQL suites | **Not run**, outside this bounded lane |

The final focused invocation was:

```sh
python3 -B docs/qualification/candidates/read-continuation-20261012/entity-candidates-review/capture-reaped.py repaired-family node --test packages/contracts/test/retrieval-entity-candidates-independent.test.mjs packages/contracts/test/retrieval-entity-candidates.test.mjs
```

All replay receipts record zero production/test source diff. The captures use bounded local process supervision; five owned process groups were confirmed absent at closeout, with no timeout, kill or surviving descendant. Only seven already-installed small dependency packages were physically reused, without installation, lifecycle scripts, lock changes or donor mutation.

The final author packet is `4c3b35c9d0c1709bfeb61280474c7186d516a618`, tree `8b5130e26fb304d94706f86079fbe12197510818`; its 16-member manifest SHA-256 is `cc2a7b1f05ee925ad4d120a98aa8c6e6bc2cc3f28997608d7c97c4d25802f0d0`. Independent checks verify both raw author captures (26/26 initial; 27/27 repaired), exact precommit source-diff hashes, original test preimage, three author reference pairs and all packet hashes. The author's 41/41 verification is retained as author evidence; it is separate from the reviewer's 68/68 checks.

## Contract and remaining boundaries

The independent controls cover all five exact variants, nullable and signed stored scalars, canonical ISO/SQLDate admission, missing query versus no-match notes, returned count/window limits, direct/crosswalk/name phase exclusivity, direct ID request correlation, type filtering, current-first order within name families, hostile selectors/data, and detached/frozen normalization semantics. There is no invented currentness field for bills, global deduplication, display-substring proof, party/chamber enum or raw state/session/Congress-to-ID cross-check.

Every branch requires the closed trusted context `{defaultCongress: positiveInt32}`. A model argument cannot supply this context, and normalization reads no ambient clock. Canonical bill and state-selector grammar remain owned by existing helpers. Query has its second trim after UTF-16 clipping; type lowercases after clipping without a second trim and preserves lowercase expansion. Intentional typed JSON admission excludes arbitrary legacy object coercion.

This selected state entity lookup is stored-only, with no live LegiScan fallback or ingestion. For direct state designations, canonical key correlation is a declared narrower admission; latest stored synchronized session is not proven by the result. Current actor/service guards, crosswalk existence, database collation/hidden ordering, current roster facts, authenticity and source freshness remain adapter/runtime obligations. Empty matches are not absence proof and candidate identity is not a grant.

[Independent reference identities](../../qualification/candidates/read-continuation-20261012/entity-candidates-review/reference-identities.json) bind eight source/policy/test files at `fd8765ec01d292013758606204f2c9d886cd31c1` and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; all eight complete blob pairs are unchanged. Only metadata is retained. No private producer implementation was copied/imported/executed. The public distribution, native reservation, canonical catalog and all original tests remain unchanged.

Two non-source lookup mistakes are separately disclosed in the review evidence: a prior helper lookup used the Capiro repository instead of Meri, and a final metadata read used uppercase `MANIFEST.json` instead of the actual lowercase filename. Neither changed source or test results; the valid immutable reads completed. No network, database, native runtime, model, provider, customer-data, cloud, frontend or deployment operation occurred.

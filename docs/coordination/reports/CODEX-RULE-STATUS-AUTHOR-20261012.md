# Stored rule status source candidate

**Candidate awaiting independent review.** Production freeze `95442b40d006e48e2215d6acec09fd7f029a2b9b`, tree `a5911079f7d68d3e94a33ccc65bc1ff658f8d9e8`, extends `2aa0a33bdaf36af1224cfdb840bc493e53cea9f3` in the isolated rule-status worktree. Root approved the factory and separate trusted-clock representation before implementation. This author grants no source/runtime acceptance.

The single operation `get_state_rule_status` has a cohesive private schema and validator. The schema owns closed projections and frozen stage/type/label/note policy vocabulary; the validator uses canonical inert `snapshotOperationData` and injected Ajv, with no source lookup, SQL, resolver, provider, live clock or service initialization. Catalog/loader and every original file remain exact. This branch retains139 originals/96 selected/43 deferred,36 mapped unavailable/60 selected pending and37 typed unavailable operations. A later independent review and root integration are required to bind this candidate.

## Interface and explicit clock contract

`createRuleStatusValidators({validateShape,schema})` exposes `normalizeRuleStatusInput`, `assertRuleStatusOutput`, `validateRuleStatusShape`, and `ruleStatusInputDefinition`/`ruleStatusOutputDefinition`. `RULE_STATUS_OPERATION_IDS` contains only `get_state_rule_status`. Definitions are `RuleStatusRequest`, `RuleStatusInput` and `RuleStatusOutput`. Normalization returns frozen input and frozen empty metadata. Model inputs contain only optional query/state strings or null; the missing-query branch remains representable.

The required trusted context is exactly `{stageAsOf,commentAsOf}`, two canonical serialized instants. Neither is admitted in model input or result. The frozen producer calls stage derivation, comment-window derivation and generatedAt separately. A result timestamp therefore cannot stand in for either decision clock. The new contract preserves that distinction:

- Proposed types become comment_closed only when the stored end is strictly earlier than stageAsOf; equality remains nprm.
- Final/self-executing types become effective when the stored effective date is on or before stageAsOf; otherwise final.
- Notice and unknown types remain notice. Type matching uppercases without trimming stored data.
- isOpen requires the validated stage to accept comments, a nonnull end strictly after commentAsOf and a null start or start on/before commentAsOf.
- Clocks may differ or regress. No ordering or equality is imposed between the two anchors or generatedAt. generatedAt is validated solely for canonical wire serialization.

These anchors describe observations a future adapter would have to bind. They prove neither clock authenticity nor current comment eligibility, freshness or authority. No ambient clock is read. A single-asOf simplification was explicitly avoided because it would change the frozen producer's possible boundary behavior. Context is required consistently even for refusal envelopes; it does not manufacture a rule lookup or current authorization.

## Preserved projections and restrictions

Query trims and clips at200 UTF16 units; optional state clips at2 then uppercases. Post-case expansion beyond the typed state bound refuses. Closed inert scalar admission rejects arbitrary legacy coercion, extra fields, nonfinite data, accessors, proxies and cycles. Direct operation/shape selectors require strings before lookup.

Missing/no-match results retain exact request-bound notes. Ambiguity preserves the returned state-before-federal grouping, at least2 candidates, at most6 per namespace and12 overall, and unique IDs within each namespace. The same identifier may appear once in each namespace. An optional state excludes federal results and checks the projected state of ambiguous candidates. The returned ambiguity count is not a complete source total. No-match metadata does not establish exhaustive absence.

Found federal and state fields remain distinct. Federal publicationDate is nonnull DateTime, comment start is always null, linkedBillKeys is empty, and sourceUrl is nullable. State publication/comment/effective/filing dates are nullable SQLDate values serialized at UTC midnight; state adds filingDate, linkedRuleNumbers, nullable sourceRevision and the exact notice-metadata coverage statement. State agencies project exactly one string and a docket is either absent or one nonempty stored value. The wrapper's defensive nullable state ruleType fallback remains represented even though the current Prisma field is nonnull. Free-form identifiers, URLs, type strings, text and stored arrays are not narrowed to invented vocabularies.

Stage labels must match their policy stage. The missing-deadline note appears exactly for a comment-accepting stage with no end date. No extra deadline or completeness claims are created. Found-state results have no state field; the validator does not infer one from an identifier. Exact federal-document precedence, source ID/name selection, state lookup filtering, current source access and freshness remain adapter obligations and cannot be proved from this projection.

## Frozen references

[Reference metadata](../../qualification/candidates/read-continuation-20261012/rule-status-author/reference-identities.json) binds9 paths at inventory `fd8765ec01d292013758606204f2c9d886cd31c1` and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. All9 complete blobs are unchanged. Only paths, blobs, bytes and hashes are published, never private bodies.

- `apps/api/src/meri/meri-tools.service.ts`: input schema1349–1356; lookup/result boundaries6193–6347; frozen blob `753b425b3e6b8cf55a7d0863aa961a3c9a696dea`.
- `packages/shared/src/index.ts`: stage/label vocabulary1791–1804, lifecycle1820–1853, accepting stages1862 and comment predicate1873–1884; blob `62eb32931826f77abd985bc142f6a65adad6a23a`.
- `apps/api/prisma/schema.prisma`: FederalRegisterDocument5761 and StateRule7007 establish nullability, string arrays, DateTime versus SQLDate; blob `cdf1923217edae6e7624993796a5671922b61ac0`.
- `apps/api/src/meri/meri-committee-roster-representation-tool.spec.ts`, `apps/api/src/ingestion/rule-lifecycle-stage.spec.ts` and `packages/meriv2-core/test/evals/legislation/state-rule-status.eval.ts` supply projection/policy counterexamples. They were read as references, never imported or executed.
- `meri.controller.ts`, `tool-service-secret.guard.ts` and `auth/roles.guard.ts` retain current tenant/user-role/internal-service admission; the tool service retains its active-request guard. The passive DTO does not confer those rights or inherit development/test observe-mode permission.

The immutable remaining-discovery packet `b3c405d` with correction `fdcdac8` was read, not cherry-picked or rewritten. Shared policy was expressed as schema data and new consistency checks; no legacy query, handler, agent or retrieval implementation was copied into the product.

## Verification and remaining work

**33/33 author contract tests pass** at the exact production freeze. These are new rule-status source tests, unrelated to the native owner's33-case harness. Coverage includes strict Ajv compilation, four envelope variants,6+6 ambiguity/refusal/isolation, all stage categories and inclusive/strict boundaries, independent/regressing clocks, nullable/free-form projections, canonical DateTime/SQLDate differences, note/coverage constraints, frozen/detached data and hostile-selector refusal. The first complete run passed; no failed test outcome occurred or was discarded in this lane.

**6085/6085 offline audit checks pass**: every original file remains unchanged, both production files match the freeze, all18 reference versions bind recorded bytes/hashes/blobs, private schema definitions do not collide, and raw streams/source/owned cleanup authenticate. Authored whitespace passes. Full canonical integration and public checks were not rerun because no existing/catalog/public source changed; root owns later integration checks.

Commands actually captured with the existing120-second child/five-second cleanup helper:

```sh
node --test --test-concurrency=1 packages/contracts/test/retrieval-rule-status.test.mjs
python3 -B docs/qualification/candidates/read-continuation-20261012/rule-status-author/verify-source.py
```

All owned groups exited. Existing physical dependency directories were copied without install/download/lifecycle execution. No native/SQL/provider/customer-source/model/service/container/browser/cloud/image/credential/security/network/infra/frontend operation, spending, deployment or main merge occurred. G1 and all runtime/source qualification holds remain unchanged.

[Packet manifest](../../qualification/candidates/read-continuation-20261012/rule-status-author/manifest.json) includes exact source/tests/reference and capture evidence. Independent ACCEPT_SOURCE/HOLD, canonical binding and qualified clock/source adapters remain outstanding.

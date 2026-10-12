# Entity candidates author packet

Final source candidate: `788c0419c9489dfdd4906a50b59661595a072713`, tree `cc42292346660c99160b1f98725804e59e92a8ad`; base `a3e946c1fa264ae7b33205f5b87804ee1ef75773`. **Ready for independent source acceptance; runtime HOLD.** This is a private contract for the selected `resolve_entity` read. It implements no source adapter, lookup, handler activation or authority grant.

The initial family source `49db57c9259f0180fad4f619bf745e541d935db9` remains preserved. Separate prerequisite `e721b6f815e68df80d598f9ff1d8127a190ae62a` adds only the exact independently accepted `state-bill-identity.mjs` from `a25516ae8d2c44638800e492e439e212098dc750`. Integration should reuse the identical already-integrated helper rather than introduce another owner or copy of its grammar.

## Interface and contract behavior

Schema ID is **`urn:meri:retrieval:entity-candidates:0.2.0`**, with `EntityCandidatesRequest`, `EntityCandidatesInput`, `EntityCandidatesOutput` and `EntityCandidatesContext` definitions. The factory is `createEntityCandidatesValidators({validateShape, schema})` and exposes:

- `normalizeEntityCandidatesInput(operation, request, context)`;
- `assertEntityCandidatesOutput(operation, output, request, context)`;
- `validateEntityCandidatesShape(name, value)`;
- `entityCandidatesInputDefinition(operation)` and `entityCandidatesOutputDefinition(operation)`.

The only operation is `resolve_entity`. Every branch requires trusted context `{defaultCongress: positiveInt32}`; model request fields cannot supply Congress or authority. This replaces the source's ambient year-derived default with the existing approved trusted-context convention. It does not certify that the supplied Congress is current. The accepted congressional identity helper handles canonical IDs and explicit designation suffixes unchanged; the accepted state helper handles syntax only, never current session selection.

Normalization returns detached frozen `{input, metadata}`. Effective input is `{limit, query?, type?}`: query trims, clips to 200 UTF-16 units, then trims again; type trims, clips to20, then lowercases. Unicode lowercase expansion is preserved rather than limited again to20. Null/blank selectors are omitted. Limit preserves the producer's finite numeric/string conversion, truncation and clamp1–10/default5. Typed admission refuses nonstring selector objects, unknown aliases/fields and caller authority; it does not claim equivalence to every ignored malformed legacy value.

Five closed result variants preserve their exact fields and nullable/scalar domains:

| Variant | Canonical identity type | Distinct projected facts |
|---|---|---|
| member | bioguide | Nullable party/state/district/LIS ID; signed integer district; raw chamber and currentness. |
| committee | committee | Raw chamber, nullable parent system code and currentness. |
| federal bill | billId | Signed stored Congress, nullable sponsor/action facts and SQLDate; no invented currentness. |
| state bill | stateBillKey | Raw state/session, nullable sponsor/action facts and SQLDate; no invented currentness. |
| state legislator | openstatesPersonId | Raw state, nullable chamber/string district/party and active-derived currentness. |

Direct, crosswalk and name phases cannot mix. Direct identities bind to the normalized request and the allowed method for that variant. State designation matches admit canonical keys matching the source state/bill-number convention, explicitly refusing malformed stored keys on that direct path; they cannot prove that the returned session is latest. No CHECK between raw stored state/session/Congress values and ID segments is invented.

Crosswalk matches support only member/state_bill/state_legislator, preserving arbitrary namespace text, including the empty namespace's `-crosswalk` suffix. Repeated canonical IDs are legitimate and are preserved. Name matches support member/committee/state_legislator in that family order, with current-first order only within each family. Name identities are unique within their primary-key table; the same ID text across different families is allowed. Hidden member lastName and database collation/wildcard predicates cannot be reconstructed from display text; no false display-substring or lexical ordering check was added.

Returned count equals the returned window and stays within limit. Missing query and no-match branches retain different exact notes. Empty results are not corpus-absence proof. Candidate identity and currentness observations are not grants, source freshness or a verified ownership decision. Canonical finite ISO generatedAt and UTC-midnight SQLDate values are admitted within the existing Ajv date-time range; alternate equivalent offsets, leap seconds and wider database wire spellings are deliberately outside this contract.

## Immutable basis and effects

The [reference ledger](../../qualification/candidates/read-continuation-20261012/entity-candidates-author/reference-identities.json) records exact blob IDs, lengths and SHA-256 values for three private reference-file pairs at `fd8765ec01d292013758606204f2c9d886cd31c1` and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; all three pairs are unchanged. Relevant locators are:

- `meri-tools.service.ts`4446–4533 (input and member/committee/legislator projections),4535–4634 (direct identities and federal/state projections),4636–4686 (crosswalk),4688–4734 (name queries, ordering, trim and notes),9948–9954/10044–10048 (normalization helpers).
- `schema.prisma`4136–4180,4210–4229,4262–4287,4315–4328,6651–6720,6722–6746 (raw scalar/null and primary-key evidence).
- `packages/shared/src/index.ts`921–965/1009–1045 (identity grammar referenced by accepted helpers).

The selected state entity branch performs stored lookup only; unlike state status/votes, it has **no live LegiScan fallback, quota reservation or ingestion path**. All source/database reads, current actor/source guards, crosswalk existence, current roster facts and latest-session selection remain unexecuted and unqualified. No private implementation was imported, copied or executed; retained files contain metadata and original Meri contracts only.

## Verification and preserved repair

Initial author tests passed26/26; initial independent tests passed29/29. The reviewer then appended three negative controls for duplicate member/committee/state-legislator name rows and retained an exact **29-pass/3-fail** replay of source49db57c at reviewer commit `93eca51e6d1f6dab59585a1376f5980442db8d63`. That exposed an actual name-phase uniqueness defect. The final repair adds exact `(entityType,canonicalId)` uniqueness only in the name phase; it preserves crosswalk duplicates and cross-family IDs.

The original author test is retained byte-for-byte. One positive current-order fixture incorrectly reused one member ID with opposite currentness; only its second synthetic ID changed, with the assertion retained. A separate regression was appended. Repaired author tests pass **27/27** through the actual factory and shared helpers. The [repair receipt](../../qualification/candidates/read-continuation-20261012/entity-candidates-author/name-uniqueness-repair.json) links the preserved source and independent failure without pretending the initial tests caught it.

Focused checks used only seven small, physically copied existing packages; no installation, lifecycle scripts, package-cache copy, lock change or donor mutation occurred. Both owned test groups were confirmed absent, with no timeout or kill. Broad/public/native checks were **not run** in this lane, as root owns combined verification. Offline source/reference/receipt preservation passes **41/41** with **6110 original files unchanged**. Exact packet hashes are recorded in [verification.json](../../qualification/candidates/read-continuation-20261012/entity-candidates-author/verification.json) and [manifest.json](../../qualification/candidates/read-continuation-20261012/entity-candidates-author/manifest.json).

The canonical loader/catalog, public0.1 distribution, all original source and existing tests remain unchanged. Source connectivity stays disabled. Claude SDK/Temporal responsibilities, provider budgets, current authorization and runtime gates are unaffected. No model, provider, customer-data, HTTP, SQL, native, service, cloud, frontend or deployment action was performed.

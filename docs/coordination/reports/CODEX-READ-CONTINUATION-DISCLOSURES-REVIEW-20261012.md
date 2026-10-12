# Independent stored-disclosures review

**ACCEPT_SOURCE** at `88c9257e10822396c30cc99fb277ab145aac7218`, tree `8fe0985f01179c177f1cf273d1eaa24282160d85`. Author final evidence `894aa91717e41619e6b8c140769fd41f1afee4ce`, tree `91c964216c6c7340090007382093997c66b78996`, changes no source/test bytes. Runtime and source connectivity remain **HOLD / UNRUN**.

## Reviewed scope

Base `283c30f2b0d9e990caa5d680843a19281318df9c`, isolated `/workspace/meri-disclosures-review-20261012`. Criteria commit `3774739` preceded candidate source. Initial independent controls `52bdda78e6040ea96761702d4b563b1edb31f5b6` preceded author freeze. Reviewer owns only the new independent test, this report and `disclosures-review/**`; all production repairs belonged to the author.

Accepted source is a private pure family for `search_sec_filings`, `search_fara_registrations`, `search_lda_filings`: `createDisclosuresValidators({validateShape})` returns `normalizeDisclosuresInput` and `assertDisclosuresOutput`. It reuses the canonical inert snapshot helper. The operation selector must itself be a primitive string. These global stored-source results retain their existing `tool/generatedAt/total/data` projections, plus LDA page/limit, with empty closed context. No invented tenant/client lineage wrapper or current authorization decision is introduced. Root owns canonical loader/catalog/binding integration; this lane changes no existing file.

## Independent findings, repairs and evidence

1. **Country/null relation:** initial independent **28/29 PASS,1 FAIL**. A nonempty FARA country selector accepted a returned null country. The source contains predicate cannot select SQLNULL, regardless of collation. The author added a narrow selected-country/null refusal. No JavaScript substring or database-collation implementation was added. Stable failed-source SHA256 and raw streams are in `prefreeze-source-*.json` / `prefreeze-independent.*`; exact failed source is additionally preserved in author evidence. Author independently reproduced **27/28 PASS,1 FAIL**, then passed28/28. An author positive fixture combining selected country with null country was corrected to a nonnull opaque label; its no-JavaScript-substring assertion remains.
2. **Operation coercion:** after that repair, the original29 independent groups passed and an added30th failed (**29/30 PASS,1 FAIL**). Object.hasOwn coerced a non-string operation object; its Symbol.toPrimitive getter returned the canonical SEC operation and normalization succeeded. The author added a primitive-string check before lookup. Exact preimage module/schema, hashes and raw output remain in `operation-coercion-source/**`, `operation-coercion-source.json` and `operation-coercion.*`. Author independently reproduced **28/29 PASS,1 FAIL**. No effects occurred beyond inert synthetic local counters.
3. The corrected exact source passes **59/59 groups**: unchanged30 independent controls plus29 author controls. No independent failing assertion was weakened or removed. Two synthetic fixture corrections occurred before the first execution, recorded in findings.md and the captured diff: a status value was shortened below the20-unit selector limit, and each row-bound example was made structurally valid to isolate that bound. Those were not executed source failures.
4. Independent audit **76/76 PASS**. All **5,473/5,473** original files remain byte-identical in source, author evidence and review trees. Nine private reference hashes/blob identities remain unchanged at both supplied Capiro commits. API/import boundaries, projected schema fields, uniqueness/date/storage metadata, source effect limitations, raw stream identities and source whitespace pass. No broad integration/public build or runtime check was run in this lane.

The exact-source command, run under the bounded owned subreaper wrapper:

```sh
node --test packages/contracts/test/retrieval-disclosures-independent.test.mjs packages/contracts/test/retrieval-disclosures.test.mjs
```

`exact-source-tests.*` records zero tracked source diff and exact reviewer ancestry; `audit.json` binds module/schema/test bytes to author source and metadata commits. Prefreeze tests used the explicit `MERI_DISCLOSURES_REVIEW_SOURCE_ROOT` path; final replay used this checkout directly. Fixtures are independent synthetic projections, never copied customer data or executed private producers.

## Source identities and authority

Private source commit `fd8765ec01d292013758606204f2c9d886cd31c1`; observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. All nine independent identities are in `reference-identities.json`. Discovery packet `d978dd3975ee1e08e7495dc2992593a7312c2442` supplied additional reference metadata; review independently re-read/hash-checked the exact objects. No private source bodies were copied, imported or executed.

| Owner | Pinned blob | Reviewed boundary |
| --- | --- | --- |
| Meri tools | `753b425b3e6b8cf55a7d0863aa961a3c9a696dea` | Registration, aliases/clamps/summary, direct SEC/FARA projection, LDA wrapper; global input-only calls |
| LDA service | `aa3948d594a1d422994ee64381c7bd476637e364` | Global filters, selected13 fields, separate row/count, nullable Decimal to Number |
| Prisma | `cdf1923217edae6e7624993796a5671922b61ac0` | Exact field nullability, Int32 IDs, unique projected keys and SEC/FARA date-only columns |
| Meri / LDA controllers | `598e9146e5568349f213cbd548de0213113dc924` / `f38f806bb78ca867c01cc1d29c7b06f34125d555` | RolesGuard and standard_user entry metadata, not a current source grant |
| Roles guard / decorator | `60fbbc8a1de21962a95af60842d25087f58a612d` / `ec576399d6ad69e4a42f8e87eb08df43663edde9` | Shared role-rank owner; no new role semantics |
| Tool secret guard | `0c51c7a5da122fcff2f2b5c4cef8b9c92765c35c` | Configuration-dependent HTTP service admission; not assumed qualified |
| Shared types | `62eb32931826f77abd985bc142f6a65adad6a23a` | Existing shared authority vocabulary |

SEC/FARA use explicit system-context stored-model reads. LDA getFilings reads the global LdaFiling model with no tenant field or per-client predicate. Its nullable numeric clientId is an external disclosure identity, never a Capiro client UUID. Inspected producer paths contain findMany/count reads and local projection helpers; no provider, ingestion or mutation call was found in those paths. This static finding does not qualify controller configuration, database access, cancellation, live grants or safe runtime effects. Current actor/tenant/source entitlement, budgets, deadlines and release checks remain trusted gateway/adapter obligations.

## Preserved semantics and limits

Text selectors trim then slice JavaScript UTF16 units, including split-surrogate edges; canonical aliases have precedence over fallbacks. SEC CIK/form and FARA status remain exact opaque strings. LDA issue membership/year are exact; case-insensitive substring semantics remain database-owned. FARA general query may match an unreturned description suffix, so a visible result match is not required. SEC/FARA summaries are whitespace-normalized strings bounded to300 UTF16 units; source null description becomes empty. The ellipsis is not a completeness or pagination flag.

Counts and rows are separate queries. Tests admit total0 with nonempty rows and a large total with an empty page. No total>=rows, atomic snapshot, no-match proof, nextCursor, hasMore or completeness relation is invented. Nonnull dates descend; equal times are allowed without a tie-breaker. Nullable dates retain null with no newly imposed application null order. SEC/FARA native date-only fields must identify midnight UTC; LDA posted timestamps are general nullable instants. generatedAt is not source freshness or an upper bound on subsequent observations.

All nullable projected fields remain required, and discarded storage fields are refused. Stored source identifiers stay opaque; unique projected identities are checked from actual model constraints. LDA amounts remain finite numbers/null: zero, negative values, rounded decimals and finite values beyond safe-integer precision are not replaced with strings or reconstructed decimals. Numeric disclosure IDs and filingYear preserve signed Int32 semantics. Opaque URL and period/state/status labels receive no guessed enum or resolver.

Typed admission deliberately refuses booleans/objects/numbers in optional text fields where legacy optionalString would silently ignore them. Numeric selector fields accept number/string/null; finite limit/page truncate and clamp, invalid numeric strings fall back, empty strings convert to zero and clamp to one. LDA converted zero/NaN year supplies no effective filter. Fractions, infinities and out-of-Int32 years refuse before source access; this is an explicit new typed boundary, not an asserted successful legacy database query. Generic text/array ceilings and bounded inert JSON are Meri transport limits, not producer maxima.

Original public contracts, all existing schemas/tests/locks, gateway/runtime/proxy/worker/frontend code, catalog and139-capability inventory rows remain unchanged in this lane. Root must register only accepted source, preserve unavailable handlers and run combined canonical tests. No native/SQL/database/provider/model/cloud/source calls or package actions were run. G1 remains open; acceptance is limited to these contracts.

## Cleanup and integration

All reviewer groups **159120**, **160241**, **160979**, **161758** are physically absent, with no timeout, kill or remaining owned descendants. This is local source-check cleanup, not native task teardown. Raw failures, final streams and negative source snapshots remain immutable evidence; no private source body or customer payload was logged.

Review-only commits in order: `3774739` (criteria), `52bdda78e6040ea96761702d4b563b1edb31f5b6` (independent controls/refs), `372c54f4695bd6c17440cca600acf9b972ee7220` (country failure), `934a33309ef2e49ed27da7a689e9f4539cc773e4` (coercion failure), and the final report/evidence commit containing this file. Parent should cherry-pick these after accepted author source/evidence. Skip reviewer ancestry merges `4963456bf179fe580eac8900b733874edbfc019a` and `1ce77b7505037a4e01e70e99baa710b8769e64c2`.

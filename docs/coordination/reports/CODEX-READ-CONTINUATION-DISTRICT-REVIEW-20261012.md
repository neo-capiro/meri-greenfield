# Independent District Nexus source review

**ACCEPT_SOURCE** for `c651a0ab75f416a06c91eff07a463d697adb0fa4`, tree `f1f1196c069c57a602520921651ae994a364de3f`.
Final author metadata `23c8ab5951b14766e001ff59b23371ffc41b60f4`, tree `adf77b3490cafce499dce00bcbdd7844995499d0`, leaves the source/test bytes unchanged. Runtime and source connectivity remain **HOLD / UNRUN**.

## Scope and identities

Independent base `fea47fdc68c7f0f22a335d3b16ba492c614b59d1`, dedicated worktree `/workspace/meri-district-nexus-review-20261012`. Criteria commit `8dfd007` preceded candidate source. Frozen independent controls commit `2cbe6fe291b6fabc783798afc91075444904cad5` preceded author freeze. Reviewer changed only the new independent test, this report and `district-review/**`; all production repairs belonged to the author. None was required.

The accepted family is two new private contracts for `get_district_nexus_context` and `get_district_nexus_changes`, using existing canonical inert snapshot, subject validation and hash comparison. It has no source imports/effects, gateway wiring, registry or catalog changes. Factory `createDistrictNexusValidators` returns the normalizer and result assertion. New `{binding,subject,data}` wrapper provides exact transport lineage, never an authorization or flag proof.

Ten relevant private reference identities were independently hashed at `fd8765ec01d292013758606204f2c9d886cd31c1` and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; all ten match and remain unchanged. Author independently retained fourteen discovery references, including adjacent families. No private bodies were copied, imported or executed. Full identities are in `district-review/reference-identities.json`.

| Private owner | Pinned blob | Review consequence |
| --- | --- | --- |
| District tools | `b868f3c03903fb291bc95d6b74805a55fd30ebcd` | Explicit selector grammar, disabled result,40facts/30gaps/20changes, inclusive since, descending time, ledger gap |
| R5 types | `9352d1eaa80c91844f1b7c28473a6c3755344434` | Exact fact/stage/basis/geography/coverage enums, nullable scalar fields |
| Context service | `a4d5f7bbccb8f1573fd03b1b98f607424d864259` | Same-tenant nonarchived client, source rail outcomes and gaps; no actor wall proof |
| R5 flag guard | `e831800b20113b0bca35b357d93e04e8140deae7` | Both explicit tenant flags remain live source-owner requirements |
| Prisma schema | `cdf1923217edae6e7624993796a5671922b61ac0` | Change/source/severity are bounded strings, not closed invented enums; nullable effective time |
| Tool/context tests | `e35d29ccfed6c3f317424122425ebdb6fa36e75d` / `0f2952f5683e8bc6e25a33fba995d0afe425e2bc` | Disabled/tenant/error outcomes and zero/null/stage characterization |

## Results and retained failure

- Initial independent **26/27 PASS,1 FAIL** at stable prefreeze source hashes. The failure assumed Scope.resourceId must equal the sole subject entity. Existing canonical `assertSubject` checks scope tenant/policy lineage, but deliberately does not establish that resource relation. This was a reviewer assumption, not a passing negative or a candidate defect.
- Corrected independent **27/27 PASS**, explicitly characterizing that structural limit and requiring exact returned subject plus tenant/policy lineage. The original assertion, raw failure and source hashes remain preserved in commit `2cbe6fe` and `prefreeze-independent.*`; correction is commit `3eb7ffb` with explanatory record.
- Exact frozen source **51/51 PASS**: unchanged corrected27 independent groups plus24 author groups. `exact-source-tests.*` records source merge and zero tracked source diff; `audit.json` binds source/test bytes to the exact author commit.
- Independent audit **62/62 PASS**: original-file preservation, exact source and metadata identities, private hash equality and enum/DB-width metadata, module/API limits, raw stream identities and cleanup. All **5,268/5,268** original tracked files remain byte-identical in author and review trees. Public contracts, original tests, schemas, locks, canonical registry/catalog and all runtime/gateway paths remain untouched.
- Source whitespace check passed. No broad integration, live flag, wall/grant, database, provider, Capiro or native/runtime checks were run in this lane.

Reproduce the scoped source replay from this checkout:

```sh
node --test packages/contracts/test/retrieval-district-nexus-independent.test.mjs packages/contracts/test/retrieval-district-nexus.test.mjs
```

The recorded runs used the owned `capture-reaped.py` wrapper. Prefreeze source selection used `MERI_DISTRICT_REVIEW_SOURCE_ROOT`; frozen replay imported this checkout directly. Test fixtures are newly authored synthetic projections, not production data or a copied producer.

## Behavioral acceptance and limits

Required trimmed clientId must match exactly one trusted client subject. State is normalized to uppercase two-letter syntax; district must already have two digits, including00. No active-conversation client fallback, state/FIPS recognition or model-supplied actor, tenant, role, flag or grant is introduced. Both source operations call the context service; it verifies tenant/client eligibility and rejects archived clients, not every status other than active. It receives no actor ID. Current membership, client wall, source grants and `district_nexus_v2` plus `district_nexus_r5_meri_tools` remain adapter obligations, with source flag lookup fail-closed behavior outside this pure contract. Meri validates request/context even if the legacy disabled path would return before parsing scope.

Facts preserve null versus zero, negative/scalar values, requested/enacted/obligated/awarded/forecast stages, source refs, as-of fields, geography, freshness, coverage and caveats. Individual `coverage:complete` remains a reported source fact; neither it nor `truncated:false` proves complete evidence. Date labels and opaque provenance strings are not upgraded into verified timestamps. New text/caveat ceilings are Meri transport limits, not claimed original producer maxima.

Context preserves at most40 facts and30 gaps. The source reserves one gap slot: exactly30 original gaps may return29 with `truncated:false`. No original total exists, so the contract cannot prove gap completeness or repair that source quirk. Full30 projected gaps require the reported fact-overflow condition; forty facts alone does not force truncation.

Changes preserve at most20 observations in descending observed time, allowing ties and inclusive since. Exactly20 rows report truncation without proving a21st. There is no cursor, total or no-change proof. Ledger failure stays `available:true` with an empty changes array and its error gap. Future effective dates remain valid; generatedAt need not bound a later ledger observation. Change/source/severity use database character widths, tested with Unicode supplementary characters; these are not JavaScript UTF16 truncation rules. The projected DTO omits observationKind and DB identities, so shape validation cannot authenticate baseline exclusion or the GSA FIPS/numeric-district query translation.

The canonical subject is structural metadata; an arbitrary valid scope resource can remain present if supplied by the trusted owner. Exact returned subject equality does not authenticate that supplied authority. Connectivity must remain unavailable until a qualified owner establishes current scope/grants/flags and source behavior. Root owns canonical loader/catalog registration and combined integration tests. No full selected-capability parity, gate advance or runtime acceptance is claimed.

## Cleanup and integration

All four reviewer groups are absent: **153341**, **153805**, **154054**, **154732**. Each receipt records physical process-group absence, no timeout, no kill and no remaining owned descendants. This is local source-check cleanup, not native task teardown. Author separately records groups153116/153761 absent. All raw streams are retained; no private body or customer data was logged.

Review-only integration commits in order: `8dfd007` (criteria), `2cbe6fe291b6fabc783798afc91075444904cad5` (controls), `3eb7ffb` (retained assumption failure/correction), and the final evidence/report commit containing this file. Parent should cherry-pick those after accepted author source/evidence. Reviewer-only merges `a53966bf607a1304029f0e2922bd45e1c7d4f208` and `fcb468ca453d49d17a2b1ddf2ca71492c7b03b22` are ancestry preservation, not additional review commits to cherry-pick.

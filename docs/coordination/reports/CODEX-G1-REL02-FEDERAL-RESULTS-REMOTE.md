# REL-02 federal-market result shapes — bounded remote source handoff

Base `3d496f6845bf2503cf623c353ea3b5b9fc307a00`, branch `task/remote-rel02-federal-results-20261011` (allocation commit `14b7f5d8`, which is this session's HEAD). One Hermes session. Codex owns independent review, integration and acceptance; nothing here is accepted. Frozen source reference `neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1`, read only through Git objects; the dirty `capirov2` working tree was never read or written.

## 0. Implementation outline (recorded before coding)

- **Responsibility split.** `federal-market.schema.json` owns structure only: the declared row/graph field sets, their declared nullability, the per-family source literals, the envelope closure and the required sets. `federal-market-validation.mjs` owns boundary behaviour: the existing input rules (unchanged) and one narrow, producer-derived paging consistency for the paged result shapes. Neither module authenticates, authorizes, loads a handler, reaches a source, parses a date or claims freshness.
- **Canonical owner.** The existing private retrieval-0.2 contract family, same `$id` `urn:meri:retrieval:federal-market:0.2.0` and the same single candidate document that already owns the five input shapes. No second catalog, registry, alias or availability mapping; the operation→output mapping is derived from the schema (below).
- **Reuse.** Existing pinned Ajv 8.20.0 (`ajv/dist/2020.js`) and ajv-formats 3.0.1; no new dependency, no lockfile, `package.json` or package-export change. Output validation is reached through the **already exported** `validateFederalMarketShape`, whose validator map is built from every `$defs` entry, so the module's published export surface is unchanged.
- **Input specification.** The prior seven-gap metadata report §6–§9 (`CODEX-G1-REL02-FOUR-GAP-METADATA-REMOTE.md`, whose proposal 2 is this follow-on read) plus the frozen result interfaces below.
- **Verification.** Focused test, full private contracts suite, repository `check` including the qualification session test, the package distribution check (`check:generated`, `typecheck`, `test:public`), `git diff --check`, exact changed paths inspected before commit — all on pinned Node 24.

## 1. Frozen identity re-verification (read-only)

`git -C C:/dev/capirov2 cat-file -t fd8765ec01d292013758606204f2c9d886cd31c1` → `commit` (exit 0). Facts came from `git show <commit>:<path>`; the working tree was not used.

| Frozen path | Expected blob | Observed blob | Raw SHA256 (observed) |
| --- | --- | --- | --- |
| `apps/api/src/federal-spending/federal-market.types.ts` | `33a7e55c09cc5c524bea85fc85eb749883279c18` | matches | `8002445accb857fd6d18f192058bac4f4dd009c921339ad6f40a50e1c7ffd2f4` (matches the packet) |
| `apps/api/src/federal-spending/federal-market-geography.service.ts` | `88cc4e7ac4264d7d0d40f2878c7c01a1a8ec6a5c` | matches | `9d7e7bf37b57c8d3b9e9bda9a46314b46faa46f0796ab389f97e8b8e0ea19e1e` (matches the packet) |
| `apps/api/src/federal-spending/federal-market-meri-tools.service.ts` | `7c5b09c86ca519996d63cecb8c95d7b54bad5c6b` | matches | `a370a3289b69911263905db7cc0ddbc4afda40d9fb73a54e5991ba424908a4b5` (matches the earlier reviewed value) |

Read directly at that commit: `federal-market.types.ts` (all five result interfaces, `FederalMarketPage<T>`, `FederalMarketGeographyResponse`), the geography composer (`geography`, L54–125, including the sentinel filter at L63–65 and the separate `stateSubawards` rail at L101–116), and the dispatch (`execute`, L207–272) with `pageResult` (L138–147), `pageOf` (L123–136, `MAX_TOOL_PAGE = 10_000`) and `limitOf` (L113–120, 1–25). `serializeFederalAwardDates` is imported from `../common/federal-award-date-serialization.js` — **outside the frozen file set**.

## 2. Owned files and exact bytes

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `packages/contracts/retrieval-0.2/federal-market.schema.json` | 40586 | `5ebd54c7a1e5d3a2ef99f5a69e76293aec227fbe50874f21ba69ea987417bada` |
| `packages/contracts/retrieval-0.2/federal-market-validation.mjs` | 8519 | `b1503ff5494593a92503830021f588328a51439df5fcfaaff1b84a583e75b8c6` |
| `packages/contracts/test/retrieval-federal-market.test.mjs` | 31578 | `8e9481d510c686a41b9e22fab0fa43658f91366496c6ac0c43833060513ff0e1` |

`git status --short --untracked-files=all` lists exactly these three modified tracked paths and nothing else. No shared `validate.mjs`, catalog, common schema, package export, lockfile, handler, source adapter or other tracked path changed. Ignored scratch (`.task-inputs/remote-rel02-federal-results-1/`) holds only the frozen-file reads and one throwaway probe; nothing from it is committed.

Diff shape: `+1117 / -8`. The only deletions are the module's header comment (4 lines → 6) and the `validateFederalMarketShape` docstring (2 → 3); every input definition, input rule and existing assertion is byte-identical.

## 3. Result shapes added

Fifteen new `$defs` entries (3 shared nullable field defs, 7 row/rail defs, 5 output defs); the five input definitions are untouched.

| Definition | Models | Closure |
| --- | --- | --- |
| `FederalContractMarketRow` | frozen `FederalContractMarketRow` (18 declared fields) | **open** (`additionalProperties: true`) — see §4.1 |
| `FederalSubawardMarketRow` | frozen `FederalSubawardMarketRow` (20 declared fields) | closed |
| `FederalVehicleMarketRow` | frozen `FederalVehicleMarketRow` (17 declared fields) | closed |
| `FederalForecastMarketRow` | frozen `FederalForecastMarketRow` (23 declared fields) | closed |
| `FederalMarketDistrictRow` | frozen `FederalMarketDistrictRow` (7 declared fields) | closed |
| `FederalMarketStateSubawardRow` | frozen `FederalMarketStateSubawardRow` (4 declared fields) | closed |
| `FederalMarketFutureSignal` | frozen `FederalMarketFutureSignal` (9 declared fields) | closed |
| `SearchFederalContractAwardsOutput`, `SearchFederalSubawardsOutput`, `SearchContractVehiclesOutput`, `SearchProcurementForecastsOutput` | `FederalMarketPage<T>` page fields + `pageResult`'s `hasMore`, `nextPage`, `paginationLimitReached` + dispatch `tool`, `generatedAt` | closed, 11 required fields |
| `GetDistrictFederalMarketOutput` | `districts`, optional `stateSubawards`, `futureSignals`, optional `futureSignalsAvailability`, literal `awardedMoneyIncludesFutureOpportunities: false`, `warnings`, `tool`, `generatedAt` | closed, 6 required fields (both optional rails excluded) |
| `FederalMarketNullableText` / `FederalMarketNullableAmount` / `FederalMarketNullableInteger` | declared `string \| null`, `number \| null`, nullable integer | shared nullable field defs |

Nullability follows the family's existing `anyOf` convention (`mail.schema.json`), not a `type` array. Every declared non-optional interface field is `required`; every `| null` field is required-but-nullable. `tool` is a `const` per operation, which makes the operation→output mapping derivable from the schema (the module and the tests both derive it rather than restating it).

## 4. Disclosures and boundary decisions

1. **The contract-award row is a declared-type candidate with an open shape.** The frozen dispatch maps that family's items through `serializeFederalAwardDates` in evidence-accuracy `enforce` mode, and that serializer is not in the frozen file set, so the exact runtime row serialization is **not established**. Per the task, the shape is marked `DECLARED-TYPE CANDIDATE` in its own description, its declared fields are modelled as declared, and `additionalProperties` is left **open** so an unestablished serialized field is not rejected. No field beyond the declared interface was invented. The other three paged row families and the three geography row families are passed through unchanged by the frozen dispatch, so they are closed on their declared field sets and are also labelled declared-type candidates (the row constructors live in the non-frozen `federal-market.service.ts`).
2. **`hasMore` is not re-derived from `total`.** The producer computes `hasMore = page * pageSize < total`, but enforcing that relation would assert that the reported total is exact and complete. The contract asserts no total accuracy: `total` is a declared `number` and the relation is recorded as a producer fact, tested by a case where `total` is 0 while `hasMore` is true.
3. **Narrow cross-field paging invariants only** (the frozen `pageResult`, L138–147), enforced in the module because JSON Schema cannot express `page + 1`: `nextPage` must be `null` when `hasMore` is false; `paginationLimitReached` requires `hasMore`; `nextPage` must be `null` at the pagination limit; and while `hasMore` is true below the limit, `nextPage` must be exactly `page + 1`. Nothing else is derived.
4. **The state-only subaward rail stays separate.** `stateSubawards` is an optional second array whose rows require the literal `geographyBasis: "source_state_place_of_performance"`; both rail shapes are closed, so a state rail row cannot masquerade as a district row (missing `districtKey`) and a district row cannot carry a rail basis. Future signals are never awarded dollars: `awardedMoneyIncludesFutureOpportunities` is a literal `false` and future-signal `source` is restricted to `sam_gov | agency_forecast`.
5. **No freshness, coverage, authorization, source authority or date parsing.** No `format` keyword appears in any result definition (asserted by test), `asOf`, `sourceUpdatedAt`, `date` and the other rolling date fields stay unformatted `string | null` (the family's uniform no-inferred-format rule), and no `coverage`, `freshness`, `authorized`, `grants`, `eligible` or `deadline` property is introduced. `generatedAt` is a plain `string` even though the frozen dispatch builds it with `Date#toISOString`; that runtime fact is recorded here rather than asserted as a format.
6. **Optional rolling fields are not forced present.** `stateSubawards` and `futureSignalsAvailability` stay out of `required`; a successful empty lookup (`available`) remains distinct from a failed one (`unavailable`) without making absence a failure claim.
7. **Only one clearly established negative invariant was added to a row:** the frozen composer drops statewide/non-voting sentinel districts, so the literal sentinels `90`, `98` and `ZZ` are refused on a district row. The composer compares case-insensitively after trimming while this structural check rejects only the exact literal forms; that narrower reach is stated in the property description. `00` and `AL` remain valid. No casing or two-letter pattern is asserted on emitted `state`/`district` because the composer filters without normalizing the emitted row.
8. **Envelope composition follows house style.** The family uses no `allOf` and no `unevaluatedProperties` anywhere (verified: 0 occurrences across `mail`, `retrieval`, `skill`, `common`, `catalog`), so the four paged envelopes restate the shared `FederalMarketPage<T>`+`pageResult` fields instead of composing them — the same choice the existing five input definitions already make for their shared fields. A shared-envelope composition via `allOf` + `unevaluatedProperties: false` is recorded as a proposal, not taken here.
9. **No new export, no handler, no availability mapping, no catalog registration.** Output validation is reached through the existing exported `validateFederalMarketShape`; the module's export surface, import specifiers and pure-import behaviour are unchanged (the existing pure-import test still passes unmodified). The four envelope closures and the row closures are structural; nothing here makes the tools callable.

## 5. Tests actually run (exact commands and exits, pinned Node 24)

All commands used the pinned runtime `C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` → **v24.19.0**.

- `node --test packages/contracts/test/retrieval-federal-market.test.mjs` → **exit 0; 18 tests, 18 pass, 0 fail** (12 pre-existing cases unchanged + 6 new).
- `node --test packages/contracts/test/*.test.mjs` → **exit 0; 117 tests, 117 pass, 0 fail.**
- `node --test packages/contracts/test/*.test.mjs evals/qualification/hermes-session.test.mjs` (repository `check`) → **exit 0; 122 tests, 122 pass, 0 fail.**
- `node generate.mjs --check` (package `check:generated`, cwd `packages/contracts`) → **exit 0**; the unchanged six distribution records (browser.mjs 466002 B, contracts.d.ts 4090 B, index.d.ts 85 B, browser.d.ts 166 B, metadata.mjs 533 B, metadata.d.ts 485 B).
- `node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext test/public-types.ts` (`typecheck`) → **exit 0.**
- `node --test test/public-package.test.mjs` (`test:public`, cwd `packages/contracts`) → **exit 0; 7 tests, 7 pass, 0 fail.**
- `git diff --check` → **exit 0** (no whitespace errors).

The six new cases cover: one distinct output definition per operation with the frozen envelope, `pageResult` fields, closure, positive-integer page bounds and the two rolling-optional fields kept out of `required`; one positive result per family including both optional rails present, each absent, and empty rails; declared result fields and nullability (missing required envelope and row fields, `| null` acceptance, string-to-number and non-integer refusal, non-nullable fields staying non-nullable) and per-family row source literals; the separate state rail (closed both ways, required literal, sentinel refusal, `00`/`AL` allowed, `awardedMoneyIncludesFutureOpportunities` literal, rail status and future-signal enums); the paging boundary (all four invariants, the 10 000-page limit case, and a `total`-inconsistent case proving no total derivation); and a no-fabrication static check (no `format` keyword, no forbidden claim keys, unformatted nullable rolling fields, no output definition in the catalog).

## 6. Runtime

Pinned Node 24 **is** installed on this host at the task-stated path and was used for every check above: `node --version` → **v24.19.0**, satisfying the repository `engines` field `>=24 <25`. The default `PATH` node is v26.7.0, which is outside the pinned range; it was not used for the reported results. No setup limit applies to this session's checks.

## 7. Limits

- **No runtime serialization is proven.** Every result definition is a declared-type candidate transcribed from the frozen interfaces and the frozen dispatch envelope. The `enforce`-mode award serializer and the row constructors in the non-frozen `federal-market.service.ts` are not read, so no emitted-row shape is claimed beyond the declared types.
- No handler, availability mapping, gateway, source adapter or active source connection was added or implied; the five catalog `originals` rows remain `pending` and no `operations` entry was created.
- No parity, runtime qualification, coverage, freshness, authorization, total accuracy or G1 acceptance is claimed. This is a candidate result contract for Codex review.
- No cloud, Docker, native/source/provider execution, customer data, network install, push, merge, deployment, delegation or background service was performed. The `capirov2` working tree was not read or written.
- The prior session's proposal still stands and is **not** attempted here: registering `federal-market.schema.json` in the family `validate.mjs` group array and pinning the five candidate definitions in `catalog.json` remain an integration-owner change for Codex to serialize.

## 8. Handoff

Codex: independently review the three owned files, confirm the exact changed paths, the base `14b7f5d8` and the returned commit SHA, and decide ACCEPT or HOLD. Suggested review focus: (a) the open `additionalProperties` on `FederalContractMarketRow` and the declared-type-candidate framing; (b) the four paging invariants and the deliberate absence of any `total`-derived `hasMore`; (c) the two rolling-optional geography fields; (d) that no input definition, input rule or existing assertion changed.

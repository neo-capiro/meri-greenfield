# Next selected read contracts — immutable discovery

Seven selected unmapped reads have concrete input/result reference boundaries
outside the current funding, client-document and economic/grants/awards lanes.
They are ready for separately authored **unavailable source-contract candidates**,
not accepted implementations or live sources. No catalog or mapping was changed.

Discovery base: Meri `e94865529c5a1e97c79893527895f0b4b73be35f`. The canonical
catalog remains the sole inventory: 139 originals / 96 selected / 43 deferred,
20 mapped unavailable / 76 selected unmapped, 21 typed unavailable operations.
Read AGENTS, implementation standards, adopted R2 and the current continuation
task. The administrator memory self-approval exception is already approved and
implemented in the canonical policy; it is not an outstanding decision here.
Clio-versus-portfolio evidence scope remains separate and unresolved.

## 1. District nexus: two related reads

Operations: `get_district_nexus_context`, `get_district_nexus_changes`.
Suggested future allocation: `district-nexus.schema.json`,
`district-nexus-validation.mjs` and one new family test in private retrieval 0.2.
The source owner is `R5MeriDistrictTools`; `R5DistrictContextService` owns assembled
facts and rail gaps, `R5FlagGuard` owns rollout, and the change-ledger schema owns
change scalar types. Do not copy the composer, scoring or query implementation.

- Both selectors use explicit nonempty trimmed `clientId`, uppercased two-letter
  state and trimmed two-digit district (`00` at large). Changes adds optional
  `since`, with a parseable ISO-like timestamp lower bound. The advertised tool
  schema mentions omitted client in an active-client conversation, but this
  actual producer requires it and does not resolve conversation scope. A new
  gateway must supply any trusted fallback explicitly; model omission is not
  authority. A two-letter shape alone does not establish a recognized state:
  the separate state-to-FIPS helper can return undefined.
- Shared disabled result: `available:false, reason:feature_disabled`.
  Context success returns availability, client ID/name, state/district,
  generatedAt, up to 40 facts, bounded gaps and reported truncation. Each fact
  carries identity/section/label/value/unit, amount stage, client-nexus versus
  public-context basis, source reference, as-of fields, geography, freshness,
  coverage and caveats. Unknown numeric values stay null; zero stays zero.
- Changes success returns availability, client ID, state/district, generatedAt,
  at most 20 changes, change-section gaps and truncation. Each projected change
  has `changeKind, source, sourceRecordId, observedAt, effectiveAt, severity`.
  Effective time is nullable. Only change observations qualify; first-ingestion
  baselines are excluded. Ordering is descending observed time, without a
  declared tie-breaker. `since` is inclusive. GSA geography uses FIPS/numeric
  district while other rails use abbreviation/two digits.
- A failed change-ledger read remains an available context with empty changes
  **and an unavailable-ledger gap**, never proof of no change. Twenty returned
  changes set truncation true even without proving a twenty-first row. No
  continuation or total is emitted.
- Preserve the context projection's gap caveat: it takes the first 29 gaps and
  may append one fact-overflow gap, but only original gap counts greater than
  30 set truncation. Thus exactly 30 gaps can lose one while truncation remains
  false. No result field supplies the original gap total. A source contract can
  represent this projection; `truncated:false` must not certify complete gaps.
  Any stronger completeness contract needs the producer/context owner to expose
  trustworthy counts or correct that boundary separately.
- Both explicit tenant feature rows (`district_nexus_v2` and
  `district_nexus_r5_meri_tools`) must be enabled; flag read errors fail closed.
  Context verifies same-tenant, nonarchived client before rails. It receives no
  actor ID: this does not establish actor-specific client-wall authorization.
  Current membership/client visibility and current source grants remain gateway
  and qualified adapter obligations, not new domain-validator authority.

References: wrapper input declarations `meri-tools.service.ts:1399`, dispatch
`:2705`; `r5-meri-district-tools.ts:12,24,58,70`; `r5-types.ts:13,34,76`;
`r5-flag.guard.ts:38`; `r5-district-context.service.ts:50`;
Prisma `DistrictNexusChange:14586`. Existing R5 tests explicitly preserve zero,
stage, gaps, disabled reads, tenant refusal and baseline filtering.

## 2. Stored state legislation: two small independent operations

Operations: `search_state_bills`, `get_state_legislator`. Suggested future
allocation: `state-legislation.schema.json`, `state-legislation-validation.mjs`
and one new family test. The stored StateBill/StateLegislator/EntityCrosswalk
owners supply data; the shared state-status vocabulary labels persisted status.

- Bill search inputs: optional query/state/session/status and limit. Frozen
  normalization trims/caps strings at 240/2/60/30 UTF-16 units, uppercases state,
  and defaults limit to 20 (1–50). Result is tool/generatedAt/local matching
  total/data. Row fields are id, state, display session, identifier, bounded title,
  chamber, subjects, persisted status and label, sponsor name/party/count,
  latest action date/text, official state URL and source URL. Nullable schema
  fields stay nullable. Status is a nullable persisted string, not only the
  advertised enum: shared labels include `superseded` and preserve unknown text.
  No pagination is exposed; latest-action ordering is not a source snapshot.
- Legislator inputs: query, optional state, limit default 5 (1–8); query trims
  and caps at 120, state at two uppercase characters. Result variants close:
  one match; zero matches plus explanatory note; or zero matches plus bounded
  `ambiguousLegislator` candidates and a clarification note. An exact external-ID
  crosswalk precedes name search and does not apply the state hint as a filter.
  Successful rows contain id/name/state/chamber/district/party, committees,
  active and matchedBy. Ambiguous rows omit committees/active/matchedBy.
  `committees` is stored JSON passed through by this producer; preserve bounded
  inert JSON rather than invent an array-of-committee DTO. It grants no access.
- The records are global public-source storage; current authorized gateway/source
  access remains required. No additional tenant role or client selector is
  established by these projections. Empty/ambiguous results do not establish
  global absence or authoritative identity. These two methods have no live
  designation fallback; their neighboring status/vote methods do (below).

References: tool input schemas `meri-tools.service.ts:1297,1320`, projections
`:5519,5842,5863,5894,5903,5920`, scalar models `schema.prisma:6651,6722`, shared
status label `index.ts:1546`, crosswalk/ambiguity/no-match tests in
`meri-state-bill-status-tool.spec.ts:216`.

## 3. Public report searches: three distinct projections

Operations: `search_cbo_cost_estimates`, `search_gao_reports`,
`search_crs_reports`. Suggested future allocation: `public-reports.schema.json`,
`public-reports-validation.mjs` and one new family test, keeping three separate
typed operations and their actual count/absence semantics.

- CBO: optional bill ID (40 characters), query (200), congress and limit
  1–25/default10. Bill ID is normalized lowercase. Return tool/generatedAt,
  estimatesFound and estimates; empty results include an explicit no-recorded-
  estimate note. Estimate fields: id, nullable billId, congress, billType,
  billNumber, title, nullable description, pubDate and cboUrl. estimatesFound
  counts the returned bounded window, not all estimates. No guessed cost figure.
- GAO: optional query (240), reportType (60), limit1–50/default20. Return
  tool/generatedAt, local matching total and data. Fields: id, title, URL,
  publishDate, reportType, topics, agencies, summary and recommendations count.
  The final count is nullable; it is not recommendation text. Dates/URLs/type
  remain nullable according to storage.
- CRS: optional query (240), limit1–50/default20, active records only. Return
  tool/generatedAt, local matching total and data. Fields: id, title, date,
  authors, topics, summary, PDF URL and HTML URL; date/URLs may be null.
- GAO/CRS titles and summaries are whitespace-normalized bounded excerpts:
  240/400 UTF-16 units with the source's ellipsis convention; null source summary
  becomes an empty projected string. Their projections do not return full text.
  Source Date values need explicit JSON wire serialization; do not confuse date
  storage, an observation instant and generatedAt. Local totals and empty
  windows prove neither public-corpus completeness nor current source health.
  No live fallback is present in these three projected reads.

References: `meri-tools.service.ts:1187,1292,1389` inputs and
`:4427,5471,6470` projections; shared input/summary helpers `:9948,10044,10285`;
Prisma `CboCostEstimate:4186`, `GaoReport:6619`, `CrsReport:7041`;
`meri-cbo-tool.spec.ts` confirms recorded estimates and explicit empty note.
New Meri closed input grammar and any stricter numeric admission must be declared,
rather than silently inheriting producer coercion/clamping.

## Real boundary to resolve before connecting neighboring state reads

`get_state_bill_status` and `search_state_floor_votes` have traceable result
projections too; missing named DTOs do not block their source-contract work.
However, a supplied designation invokes `resolveStateBillKey` (wrapper line
3727). A missing stored match can invoke `lookupStateBillLive`, whose documented
owner reserves shared LegiScan quota and persists a normalized bill. Failure
distinguishes provider unavailable from confirmed no stored match. The selected
read boundary does not authorize adopting that ingestion effect implicitly.

Exact owning interface: `meri-state-bill-live.ts:38` `StateBillLiveOutcome`
(`found` + billKey, `not_found`, `unavailable` + reason) and `:43`
`StateBillLiveDeps`, including provider and persist dependencies; the state tool
tests at line 311 pin live fallback and unavailable wording. A new passive
source adapter must state how designation resolution and unavailable/unknown
states are preserved without ingestion writes, or the owning ingestion/provider
lane must separately govern that effect. No current credentials, quota allowance
or ingestion authority is inferred. Merely restricting to canonical IDs would
leave designation coverage incomplete and must be declared, not counted as full
coverage silently. This is an effect/adapter boundary, not a ban on typing the
existing outputs while unavailable.

## Provenance, validation and limits

All 14 inspected reference identities are pinned to Capiro
`fd8765ec01d292013758606204f2c9d886cd31c1` and unchanged at observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Exact paths, Git blobs, SHA256s and
byte counts are in `reference-identities.json`; only derived interfaces/policy
findings are recorded here. The common wrapper blob is
`753b425b3e6b8cf55a7d0863aa961a3c9a696dea`, Prisma schema
`cdf1923217edae6e7624993796a5671922b61ac0`, shared index
`62eb32931826f77abd985bc142f6a65adad6a23a`. District tool/types/flag blobs are
`b868f3c03903fb291bc95d6b74805a55fd30ebcd`,
`9352d1eaa80c91844f1b7c28473a6c3755344434`,
`e831800b20113b0bca35b357d93e04e8140deae7` respectively. The live-fallback owner
blob is `01c312dfa17bfa0838c06e1ee2bc59fa6c58187f`.

Metadata verification passed **66/66** checks of exact immutable bytes, drift,
selected/pending status for every proposed ID and preservation of the canonical
catalog. Its owned local process group exited and was recorded absent. This is
discovery, not independent acceptance of future authored contracts. No private
source body, legacy implementation or customer data was copied; no source was
imported/executed. No native/proxy/runtime/worker/infra/frontend, SQL, service,
container, cloud, model, provider or external metadata action occurred. Simple
path discovery misses were corrected locally; they were not product failures.
All proposed source handlers remain absent and connectivity disabled.

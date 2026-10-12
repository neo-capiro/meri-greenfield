# Federal legislation stored-read boundary

## Outline before source edits

Exact base `bcf36777b6f3fab94bec144c129e9143c18c8857`; isolated branch
`task/meri-federal-legislation-20261012`. Author owns only the new federal schema,
validator, focused test and this report/evidence lane. Root owns shared loader,
registry, catalog and count changes. Prior author branches remain frozen.

Factory `createFederalLegislationValidators({validateShape,schema})` returns
`normalizeFederalLegislationInput(operation,raw,{defaultCongress})` and
`assertFederalLegislationOutput(operation,result,raw,{defaultCongress})`.
Definitions: `FederalBillStatusRequest/Input/Output` and
`FederalFloorVotesRequest/Input/Output`; schema ID
`urn:meri:retrieval:federal-legislation:0.2.0`. Root approved contextKeys
`['defaultCongress']`: an explicit trusted adapter calendar-derived value, never
model authority. The original helper uses local getFullYear, not an exact January3
Congress transition. No ambient clock, live designation resolver or ingestion is
introduced; ordinary canonical/explicit-Congress selectors retain precedence.

Reuse canonical inert `snapshotOperationData`; type-check operation strings before
property lookup. One cohesive schema/validator holds source projections and
correlations; only the focused test compiles Ajv until canonical root integration.
Independently describe the bounded bill designation grammar and typed DTO fields,
never import/copy the legacy producer, query implementation, stage derivation or
role machinery. Current actor/tenant authorization remains gateway-owned.

Preserve bill invalid-request, missing-bill and available branches, stored status
labels, nullable sponsor/action/status fields and source warnings. At most15
recent actions and15 bill floor votes,3 votes per governing rule; no fabricated
native governing-rule count bound. Floor-vote input retains optional filters,
limit10/default and25/max, explicit unknown/ambiguous member responses and
resolved member arrays; preserve bioguide/LIS crosswalk semantics without claiming
the result proves current identity or recreating a resolver. partyTotals stays
opaque JSON; never derive a tally, outcome, vote, status or completeness from it.

Source-only checks cover all nonempty/empty/refusal branches, counts/order/limits,
nullable fields, exact selector/tuple separation, trusted calendar context and
hostile inert-data admission. Preserve raw failures and exact source before
repairs, verify owned capture process exits, and independently verify old/current
reference identities. No source query, parameterized SQL, provider, database,
service, native/runtime, frontend/cloud action or dependency change. All future
descriptors stay unavailable/null/pending; source connectivity stays disabled.

## Results

Implemented the two private read boundaries and focused source tests. No existing
file changed. The shared helper allocation was added explicitly by root after
bill-text acquired a real second caller: `congressional-identity.mjs` owns only
`resolveCongressionalBillId(selector,defaultCongress)`. Helper-only commit
`621346846aeb7920bde674b6ce217df76942ced4` is the bill-text dependency; the federal
validator imports it. No circular dependency, new runtime, store or second
authorization implementation is introduced.

The API and definition names above are final. Bill normalization returns
`{billId:string|null}`. Floor normalization returns all seven keys: `billId`,
`query`, `member`, `bioguideId`, `chamber`, `congress`, `limit`; the member selector
and its resolved syntactic identifier remain separate.
Raw options are a closed object containing only `defaultCongress`. The source
adapter must supply this trusted context; gateway context wiring is not part of
this family. Root owns canonical registration and unavailable descriptors.

### Preserved source behavior and explicit admission differences

- Bill invalid-request, missing stored bill and available stored bill remain
  distinct. Owner/status labels describe this stored producer; they prove no
  currentness, external bill status or current actor authorization. The bill's
  stored `congress` column is independent of its identifier: no invented database
  cross-column constraint is imposed.
- The shared selector lowercases canonical identifiers without removing their
  leading zeroes. Designations normalize their numeric part, recognize eight
  types and an optional explicit Congress suffix. Each operation still owns its
  original UTF-16 selector cap. `defaultCongress` is mandatory positive Int32
  private context, not a claim that every admitted value describes today's
  Congress; upstream calendar derivation and current authority remain unqualified.
- Floor invalid bill/chamber selectors become absent filters, following the
  frozen producer. Member resolution is not reimplemented: direct Bioguide syntax,
  unresolved and ambiguous responses, and a source-resolved member are correlated
  without claiming the DTO authenticates the resolver. Up to eight ambiguity
  candidates; one resolved member may have multiple Bioguide/LIS position rows.
- A resolved-member vote must contain at least one selected position, matching the
  producer's member filter. If future relation reads race and produce no position,
  this private boundary withholds attribution. That is a fail-closed correlation,
  not a demonstrated native snapshot or concurrency guarantee.
- Floor limit is 10 by default and clamps numeric values to 1..25. Congress uses
  the producer's truthy numeric conversion: zero/empty/non-numeric strings remove
  the filter; signed finite Int32 values remain possible. Fractional, infinite
  and out-of-Int32 Congress values are refused by the new typed boundary rather
  than sent into a Prisma Int filter. Objects/booleans are never coerced.
- Preserve 15 actions, 15 bill votes and 3 votes per governing rule, descending
  stored timestamps with ties allowed. No native governing-rule count bound was
  observed. The 10,000-row maxima on otherwise unbounded arrays and 1,048,576 code
  point string maxima are Meri transport admission ceilings, together with the
  canonical inert snapshot budget; they are not source query limits.
- Distinct bill, governing-rule and floor-search vote tuples stay distinct.
  Nullable values, signed stored Ints and opaque `partyTotals` JSON remain. No
  vote count sums, outcome, stage or completeness is inferred. `votesFound` means
  returned rows only. No paging/total-count/snapshot guarantee is introduced.
- Serialized timestamps must use canonical ISO instants. Only the stored SQL
  `Date` latest-action field requires midnight; action and vote timestamps retain
  their time. This validates a projection, not freshness or source authenticity.
- Null, empty and ordinary unknown status strings retain their source labels.
  The frozen label helper uses inherited-key lookup; a status such as
  `constructor` yields an omitted wire `statusLabel`, not a raw fallback label.
  Root explicitly approved refusing all inherited Object.prototype names for
  this complete typed DTO. Neither an invented label nor an incomplete projection
  is accepted. The status has already passed inert/string admission before this
  predicate; it performs no caller coercion. No Capiro fix or policy change is
  claimed.

### Source trace

`reference-identities.json` independently verifies six relevant immutable blobs
at `fd8765ec01d292013758606204f2c9d886cd31c1`; all six match observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Private bodies stay in read-only Git
objects. Source metadata handoff `d47f85f40db38502830608a005bf53d1ab9173d7`
supplied the broader congressional trace; this lane independently checked its
relevant subset and found the inherited-status serialization edge below.

The service reference establishes request declarations, selector calls, refusal
branches and stored projections. Shared types establish the bill grammar,
calendar formula and status-label semantics. Prisma establishes CongressBill,
CongressBillAction, RollCallVote, MemberVote, BillRuleLink and CongressMember
field nullability/Int types and relevant identity uniqueness. The bill-status
contract test establishes governing-rule versus bill floor-vote distinction and
the failed-rule warning. Controller/roles references establish only the legacy
authenticated entry boundary. Global stored reads have no per-row tenant proof;
fresh Meri authority must still be implemented and qualified externally.

### Checks, retained failures and remaining gates

Initial focused checks passed 32/32. The shared helper extraction added one
direct admission check and passed 33/33. Both receipts and initial source copies
are preserved. The initial reviewer failures about exact warning fixtures and
bill-ID versus stored-Congress equality were reviewer assumptions, retained in
the independent lane; they are not producer defects.

The inherited-status counterexample then failed the newly added author control:
33/34 passed, 1 failed. `prototype-status-failed-source/**` preserves all four
exact source/test files before repair, alongside raw stdout/stderr and hashes.
The reviewer independently retained its corresponding 25/26 result. The narrow
guard repaired the actual contract defect; `prototype-status-repaired.json`
records 34/34 passed. Owned PGIDs 170446, 170618, 171033 and 171687 were absent
after their captures, with no timeouts or group kill required. Tracked diff hashes
in these precommit receipts do not cover then-untracked files; preserved exact
snapshots and the final source commit provide that binding.

Final source-commit replay, preservation manifest and independent verdict follow
as metadata-only closeout. No private source, service, SQL, native process,
provider, runtime, ingestion or deployment was executed. Parameterized querying,
calendar derivation, current authorization, member resolution and source truth
remain unqualified. These source tests do not pass any G1 runtime gate. No
descriptor/source connection is activated, no inventory count is changed here,
and no publication or merge is performed by this lane.

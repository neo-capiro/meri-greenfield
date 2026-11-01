# Federal market reads and procurement identity

`search_federal_contract_awards`, `search_federal_subawards`, `search_contract_vehicles`,
`search_procurement_forecasts` and `get_district_federal_market` (all `@0.2.0`) call their fixed
Core routes `POST /api/clio/tools/<id>` through the shared stored native read handler. The
existing control owner checks current execution, membership, conversation scope and result
release; a `clientId` argument is inert data that Core may narrow by and never widens access.
Forecasts keep their global public query scope.

## Semantics the model is told

Amounts are USD as the source supplies them (no conversion, no rounding, `null` is "not
supplied", never zero). `fiscalYear` is the federal fiscal year (October to September);
`actionDate`, `popStartDate` and the other date fields are calendar dates typed as opaque
strings by the frozen producer. `asOf`, `sourceUpdatedAt` and `generatedAt` are the citation
fields: `generatedAt` is query time, not source freshness. `total`, `hasMore`, `nextPage` and
`paginationLimitReached` bound every page; the district roll-up keeps awarded money apart from
future signals and state-only subawards and names `futureSignalsAvailability` and `warnings`.
An empty page is absence within its filters only. The worker's family guidance
(`apps/worker/conversation/reads/family-guidance.mjs`) carries this into the tool description
and routes counts, totals and cross-record filters to text-to-SQL first when it is mounted.

## Award identity (never PIID alone)

`award-identity.mjs` is the one owner of the full award identity: PIID plus awarding subtier,
plus the parent IDV PIID and parent subtier when the award is under an IDV (or a parsed,
agreeing `award_unique_id`). A PIID is not unique (the retained 31 October 2026 clone probe
counted 219 ambiguous PIIDs), and numeric or short PIIDs are legitimate identifiers that are
never quarantined. Resolution requires exactly one full-identity match and is invariant to row
order; zero matches, several matches, a partial parent and a claimed parent no candidate carries
each fail with their own code. Transaction keys depend on the resolved identity plus the
validated modification and transaction numbers (transaction `0` survives), encoded with
length prefixes so delimiters inside values cannot collide.

The contract-award receiver (`handler.mjs`) applies the page-level rule: rows are distinct by
their source row `id`; two rows sharing a PIID (`awardId`) are two awards, a numeric `awardId`
passes, and only a duplicate row id or a blank PIID is refused as an invalid result.

## Money Flow from serving-data shapes

`money-flow.mjs` reproduces Money Flow with the consumer semantics the Lane 6 correction review
required in place of the applied view's `DISTINCT ON (piid)` and physical-row sums: every award
keyed by full identity, every logical action keyed by identity plus modification/transaction,
and only the latest observation of each logical action contributing its obligation (a later
observation corrects, never adds; two different values at the same instant are a conflict).
Totals are reported per award, per vendor UEI and per awarding subtier, by federal fiscal year
of the action date, in USD, with the number of logical actions and physical observations each
line summarises. `test/money-flow.test.mjs` exercises it with fixtures only: two awards sharing
a PIID and modification, a re-observation, a correction, a numeric PIID and the fail-closed
cases. It is a reviewed source reference for the DB owner's forward migration, not a live read:
no clone population, DEV copy, re-key, quarantine or publishable total is produced here.

## Candidate selection with explicit materialization

`candidate-selection.mjs` composes the Lane 6 finite inventory candidate statement whose one
allocated attempt hit SQLSTATE 57014 under 15 s. The eligible ordered set (26 rows for that
allocation) is a `MATERIALIZED` CTE evaluated once, ordered by the full award identity and
limited by a bound parameter, and the projection joins it on the full identity, never on PIID
alone. Numeric and short PIIDs stay eligible. `test/candidate-selection.test.mjs` holds the
fourteen offline checks (materialization, bound parameters, total order, identity join, partial
parent exclusion, read-only text, no timeout increase, validated relation names, determinism).
Nothing here connects, runs `EXPLAIN`, changes an index or populates data; a fresh finite
allocation by the DB owner executes it.

## Tests

`test/handler.test.mjs` covers the fixed routes, closed arguments, paging, district rails,
opaque clocks, the identity discipline and the closed source-status meanings (401/403 denied,
404/501 unavailable, 429/5xx source unavailable, 400 invalid). Live serving populations, the
corrected producer and deployed acceptance remain outside this source.

# Disclosures private read contracts

## Outline recorded before implementation

Base `283c30f2b0d9e990caa5d680843a19281318df9c`, isolated branch
`task/meri-disclosures-20261012`. Exclusive new schema/validator/test and this
report plus `read-continuation-20261012/disclosures-author/**` only. Prior document
and district branches stay frozen; root owns loader, registry, catalog and counts.

One pure family describes `search_sec_filings`, `search_fara_registrations` and
`search_lda_filings`, using the pinned stored-source projections. Factory:
`createDisclosuresValidators({validateShape})`; functions:
`normalizeDisclosuresInput(operation, raw, options={})` and
`assertDisclosuresOutput(operation, result, raw, options={})`. Definitions:
`DisclosuresSecRequest/Input/Output`, `DisclosuresFaraRequest/Input/Output`,
`DisclosuresLdaRequest/Input/Output`. Schema ID:
`urn:meri:retrieval:disclosures:0.2.0`. Options must be an empty inert object;
root may bind `contextKeys:[]`. The existing `tool`/`generatedAt` result envelope
needs no invented client or policy wrapper. Current execution/release authority
remains owned by the gateway; global stored data is not permission to connect.

Reuse canonical `snapshotOperationData`; no copied reader/query, authorization
engine or compiler. A test-only Ajv harness compiles the new schema until root
registration. Preserve trimmed UTF-16 text limits and aliases, numeric/string/null
clamping, SEC/FARA defaults20 and maximum50, LDA default15/maximum50 and page1–100.
LDA uses effective integer database year filtering; invalid nonfinite/fractional
database year values fail Meri admission. Query count observations remain separate
from row retrieval: total can be smaller than returned rows and cannot certify
snapshot consistency, page completeness, no-match or source absence.

SEC/FARA descriptions are whitespace-normalized summaries of at most300 UTF-16
code units, never full-text evidence. LDA projects13 fields, preserving nullable
dates/IDs/period/state and finite number-or-null income/expenses after producer
Decimal conversion. Number/null cannot prove decimal precision or distinguish
missing values from nonfinite conversion. No custom decimal parser or new
pagination token is introduced. Exact selectors are correlated where the source
uses equality; free-text search/SQL collation remains source qualification.

Verification uses frozen private reference metadata, synthetic nonempty JSON
projections and mutation/refusal controls, no source implementation execution.
Test source family/defaults/aliases/bounds, independent counts, paging/null/date
semantics, closed output and inert hostile JSON. Preserve raw failures and exact
snapshots, use the existing bounded subreaper capture, and verify physical owned
process exit. No queries, native/runtime/services, provider/model/cloud activity,
dependencies, shared source, public contracts, frontend or infrastructure edits.
All future descriptors remain unavailable/null/pending with source disabled.

## Reference closure and interpretation

Discovery metadata freeze `d978dd3975ee1e08e7495dc2992593a7312c2442` was read and
all nine referenced blobs were independently read/hash-verified at Capiro
`fd8765ec01d292013758606204f2c9d886cd31c1`, then compared with observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. All nine are unchanged. The author
manifest records only paths, byte counts and blob/SHA256 identities; no private
source body is copied or executed.

| Source owner | Frozen blob | Contract evidence |
| --- | --- | --- |
| `meri-tools.service.ts` | `753b425b3e6b8cf55a7d0863aa961a3c9a696dea` | Declared inputs1203/1265/1271; LDA4737, SEC4864, FARA4903 projections; text/clamp/summary semantics9948/10044/10285 |
| `lda-intel.service.ts` | `aa3948d594a1d422994ee64381c7bd476637e364` | FilingFilters/PagedResult, getFilings152–200 and numeric conversion64–68 |
| `schema.prisma` | `cdf1923217edae6e7624993796a5671922b61ac0` | LdaFiling3867, SecFiling6167, FaraRegistration6195 field/null/storage types |
| `meri.controller.ts` | `598e9146e5568349f213cbd548de0213113dc924` | Authenticated standard-user route and guarded tool entry |
| `lda-intel.controller.ts` | `f38f806bb78ca867c01cc1d29c7b06f34125d555` | Separate authenticated standard-user global-data read entry |
| `roles.guard.ts` / `roles.decorator.ts` | `60fbbc8a1de21962a95af60842d25087f58a612d` / `ec576399d6ad69e4a42f8e87eb08df43663edde9` | Required-role metadata; unknown ranks fail closed |
| `tool-service-secret.guard.ts` | `0c51c7a5da122fcff2f2b5c4cef8b9c92765c35c` | Additional service identity, configuration-dependent enforcement |
| `packages/shared/src/index.ts` | `62eb32931826f77abd985bc142f6a65adad6a23a` | TenantContext and canonical role-rank declaration |

The producer reads only global stored models; SEC/FARA use explicit system reads
and LDA accepts filters without tenant scope. Its numeric clientId/registrantId
are disclosure identities, not Capiro tenant/client UUIDs. The traced producer
paths perform row/count reads, not ingestion, provider requests or writes. Entry
roles/service identity and active-request checks do not supply current Meri
authorization, source entitlement, cancellation/budget or release proof. The
contract never accepts caller-supplied roles/tenant/authority fields.

SEC preserves exact CIK/form filtering; it does not pad CIK or normalize form
case. FARA status remains an exact opaque string, with nullable unfiltered status
and country. A nonempty country selector cannot return a SQL-null country;
non-null contains/case-insensitive semantics remain database-owned. FARA query
can match a description suffix omitted by the summary, so output validation does
not require visible query text. The summary's ellipsis is not a truncation flag
or a way to reconstruct full text. LDA keeps exact issue membership and year;
no implicit currency, nonnegative amount or exact-decimal guarantee is introduced.

All projected dates are serialized JSON instants; SEC/FARA stored `Date` columns
retain UTC midnight and FARA can be null. LDA posted time is a nullable general
instant. Non-null dates descend and equal times are permitted; no secondary
sorting or new null-order contract is invented. generatedAt is a response stamp,
not a verified source freshness/as-of boundary. Unique projected record identities
remain distinct, but totals need not agree with row counts at the same instant.

### Explicit Meri admission differences

Optional text accepts string/null/omission; non-string legacy inputs would be
silently ignored, whereas Meri refuses booleans/objects/numbers in text fields.
Numeric selectors accept number/string/null; invalid string limit/page values
fall back, finite values truncate/clamp, empty strings convert to zero then clamp
to one. Booleans/objects are refused rather than silently defaulted. All JSON must
be inert and bounded; generous unspecified text/array ceilings are new transport
limits, not backend limits. Only model argument aliases are normalized, never new
operation compatibility aliases.

For LDA year, omitted/null/empty/numeric zero have no effective filter. Truthy raw
strings convert with Number; converted zero or NaN likewise produces no effective
filter in the pinned owner. Finite Int32 values, including negative values, are
accepted without inventing a positive-year policy. Fractions, infinities and
outside-Int32 values would reach invalid database numeric selectors; Meri refuses
them before any source access. This is explicit typed admission, not a change to
the original source or claim that its database was exercised.

## Checks and preserved defect

Initial author suite **27/27 PASS**, capture `initial-focused.*`, PG **158943
absent**, exit0/no timeout/kill. Exact initial new source/test snapshots and hashes
are retained under `initial-source/` and `initial-source-identities.json`; the
tracked diff was then empty because these files were still untracked.

Independent review found a real correlation defect: selected FARA country could
return a null country. The reviewer retained **28/29 PASS** and its failing
control. Author independently added a regression and retained **27/28 PASS** in
`country-null-reproduction.*` with PG **159432 absent**. Exact failed source/test
bytes are preserved in `country-null-failed-source/` and associated identities.
The repair adds only the selected-country/null refusal. An existing positive
author fixture incorrectly combined null country with a selected country; its
country changed to an opaque non-null label while preserving the intended
assertion that no JavaScript substring/collation implementation is introduced.

Repaired author suite **28/28 PASS**, `country-null-repaired.*`, PG **159567
absent**, exit0/no timeout/kill. Original failure outputs/assertions stay in the
evidence packet. Exact committed-source checks and preservation follow below.

Independent review and canonical root integration remain separate. Live source
queries, role/entitlement adapters, providers, database, native execution and G1
runtime qualification are **UNRUN**. Source acceptance is not runtime acceptance;
descriptors stay unavailable/null/pending and connectivity stays disabled.

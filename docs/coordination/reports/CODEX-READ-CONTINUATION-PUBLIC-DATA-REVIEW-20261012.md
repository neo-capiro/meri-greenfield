# Public data reads: independent discovery and review

**ACCEPT_SOURCE** for root candidate `31093cd5b6aaaf246a870eb4f473a6639cc2a7df`,
tree `d3e75ff6046a0e1b51aeb4c3644c7670b94f1d22`: the economic, grants and legacy
awards schema, validator factory and date-consistency module. Root owns production;
this review changes only independent tests and review documentation/evidence.
Canonical loader/catalog/gateway integration is not part of this verdict. All
source adapters remain unavailable and native/runtime acceptance remains **HOLD**.
Reviewer base `e94865529c5a1e97c79893527895f0b4b73be35f`, frozen criteria `2f5af2e`
and adversarial matrix `bbe0c5c` precede inspection of the candidate.

Independent controls pass **59/59**; read-only reference, source preservation and
receipt audit passes **80/80**. The original author receipt independently verifies
**27/27** at the exact candidate. Test-only Ajv compilation uses the candidate
factory and existing canonical inert JSON admission; it does not substitute for
later canonical dispatch integration. Raw streams and receipts remain in
[public-data-review](../../qualification/candidates/read-continuation-20261012/public-data-review/).
Every owned process group is confirmed absent; no cleanup failure occurred. The
full whitespace check exits 2 on two whitespace-only lines in the original raw
failure stream; that result and those bytes are preserved. The authored-file
check passes with only raw stdout/stderr excluded. No shared attributes or checks
were changed by this reviewer.

The first independent replay was **57/58**, caused by an expectation of exact
legacy Unicode normalization: uppercasing `ßß` produces `SSSS`, which the new
normalized state schema refuses. The owner explicitly confirmed narrower typed
admission: reject post-uppercase overflow of the two-character state or 16-character
PE bound, without a second truncation or an ASCII-only policy. No valid geographic
or PE selector regression was identified. The original test and raw failure are
preserved in `independent-first.test.mjs.txt` and `independent-first.*`; the final
controls characterize this disclosed restriction and separately accept expansion
within the typed bounds. This is an intentional compatibility limit, **not** exact
legacy behavior for arbitrary Unicode. Census state is plain Prisma `String`, not
a database length constraint; award PE storage is `@db.VarChar(16)`. Malformed
selector scalar/year refusal is likewise stricter than legacy permissive coercion.
See `compatibility-decision.json`; no production repair or output-type relaxation
was made to pass this review.

Twelve exact path/blob/size/SHA references are recorded in
[reference-identities.json](../../qualification/candidates/read-continuation-20261012/public-data-review/reference-identities.json).
They match Capiro `fd8765ec01d292013758606204f2c9d886cd31c1` and are unchanged
at observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Inspection used Git data,
TypeScript AST parsing and schema metadata only; no private source was imported,
compiled, executed, or copied into this repository.

## Actual operation boundaries

`queryEconomicData` in `apps/api/src/meri/meri-tools.service.ts:6486` contains
three anonymous but explicit projections. Census, BLS and BEA use stored public
data via `withSystem`; no direct provider call appears in these read paths.
Names use the shared trim/UTF-16 truncation helper. Source defaults to census;
comparison is case-insensitive. Limit defaults to 20 and is clamped to 1–50.
Census state is uppercased after its two-unit truncation; district is at most ten
units. BLS additionally accepts `seriesId` (60 units) and `query` (240); its nested
recent data points are limited to 12. BEA accepts `datasetName` then `dataset`
fallback (60), `query` (240), and a truthy numeric-converted year filter. Zero or
NaN does not establish a year filter in the frozen producer. Irrelevant selectors
must not be described as filtering another source variant. Exposing the actual
BLS/BEA selectors is an explicit extension beyond the narrower registered tool
input, supported by this frozen producer interface.

Prisma `CensusDistrict`, `BlsSeries`, `BlsDataPoint` and `BeaData` establish field
scalars. Census `topIndustries` is JSON with no closed industry DTO. Census
statistics are nullable integers/floats; no percentage or positive-only guarantee
was found. BLS values are required floats; BEA values and units are nullable.
No currency/unit conversion, year range, freshness or full enumeration follows
from those field names. An unsupported economic source returns its separate
error projection, not a fabricated empty success.

`searchFederalGrants` at line 5355 accepts optional query/agency (240 units),
status (30) and limit 1–50/default20. It returns the frozen `FederalGrant`
projection, generatedAt/asOf sharing one instant, and a separately observed
count. It has no offset continuation. Monetary values are nullable floats,
URLs nullable strings, and eligibility an array of strings. The exact Prisma
`@db.Date` annotation supports UTC-midnight serialization of open/close dates;
`FederalAward.id` has `@db.Uuid`. Title summaries
are limited to 240 UTF-16 units. Query data and count use separate `withSystem`
calls; their combination proves no atomic snapshot or authoritative absence.

Legacy `searchFederalAwards` at line 4954 is distinct from the already reviewed
federal-market rail. It calls
`FederalMarketService.listLegacyGlobalContracts(query: LegacyFederalAwardQuery)`
in `apps/api/src/federal-spending/federal-market.service.ts:159`; the interface is
in `federal-market.types.ts:16`. The owner reads synced `FederalAward` data/count,
not a live provider or tenant/client-scoped `listContracts` path. Query/agency
limits are 240 units, peCode 16 and uppercased by the lower owner, limit 1–50/
default20, and page 1–10000/default1 with decimal digit-string compatibility.
Paging signals derive from page, pageSize and reported total, with no next page
past the cap. Award Decimal amounts are converted to number or null; description
summaries are limited to 240 UTF-16 units. Do not invent decimal-string output,
positive monetary ranges, snapshot guarantees or a current contracting identity.

## Policy, time and truthful output

Grants and legacy awards call the tenant/surface evidence-accuracy resolver.
Its wrapper and core rollout owners are pinned. The proposed explicit trusted
`evidenceAccuracyMode` context (`off`, `shadow`, `enforce`) belongs to current
policy, never model arguments. An authenticated `TenantContext` and active request
control enter the original tool dispatcher; these global read methods do not
supply independent client visibility or fresh gateway authorization. A qualified
Meri gateway and source adapter still own current access and source entitlement.

Grant legacy `deadlineStatus` compares the UTC close-date calendar day with the
current New York calendar day. In enforce mode, truthy `responseDateDesc` forces
structured **unknown**, even if its text looks like an ISO datetime, and retains
raw text. Otherwise `closeDate` is normalized as a date-only New York end-of-day
deadline. Legacy and structured status can legitimately differ. The reviewer's
earlier claim that response text was parsed was incorrect; the exact recheck and
correction remain in
[discovery-corrections.json](../../qualification/candidates/read-continuation-20261012/public-data-review/discovery-corrections.json).

`NormalizedDeadline` and time-zone owners distinguish unknown, explicit datetime
and date-only end-of-day records. Days remaining use the observed asOf and a
ceiling over elapsed 24-hour units; this is not a fresh current deadline check.
Award enforce mode adds a structured date block; unknown latest/base dates stay
null and cannot be filled from actionDate. Synchronization time is not award
signing or source modification time. All explanatory strings remain reported
text, not authority.

Catalog binding and its independent integrated review remain pending. Source
connectivity remains disabled; this family verdict does not activate a handler. No runtime, native fixture,
service/database/provider/model/cloud action or customer data access is authorized
by this discovery; G1 remains OPEN and G2–G7 unentered.

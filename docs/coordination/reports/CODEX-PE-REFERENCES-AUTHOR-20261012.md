# PE reference private read contracts

## Outline before implementation

Base `2aa0a33bdaf36af1224cfdb840bc493e53cea9f3`; dedicated branch
`task/meri-pe-references-20261012`. Scope: get_pe_contractors, get_pe_bills,
get_pe_report_language. Root owns canonical registration/catalog/counts. This
lane owns new pe-references schema/validator, the cohesive contractor-correlation
module, focused test and this report/evidence. Prior branches remain preserved.

Root approved `createPeReferenceValidators({validateShape,schema})` returning
`normalizePeReferenceInput(operation,raw,{})` and
`assertPeReferenceOutput(operation,result,raw,{})`; contextKeys `[]`, closed empty
options. Definitions: `PeContractorsRequest/Input/Output`, `PeBillsRequest/Input/Output`,
`PeReportLanguageRequest/Input/Output`; ID `urn:meri:retrieval:pe-references:0.2.0`.
Required peCode string trims and caps32 UTF-16 units, normalized `{peCode}`.
Typed admission rejects malformed/missing selectors rather than pretending a
source error is a successful DTO. Reuse canonical snapshotOperationData and
primitive operation admission; no query/parser framework or private imports.

Keep raw output envelopes: only report language echoes the PE. Bills/contractors
cannot prove request linkage from their DTO. Current actor/tenant/source authority
remains external; global source reads do not establish it. All descriptors remain
unavailable/null/pending, source disabled. Required complete keys mean DTO shape,
never complete source coverage.

Preserve contractor missing-table fallback, top10 award rows, top25 named exhibit
performers, distinct R-3 compatibility money versus24-month award obligations,
direct/candidate/unmatched buckets and literal unmatched-not-inventoried caveat.
Source groups by contractor name; a grouped row with any direct award is classified
direct, so that row's category is not proof each contributing award was PE-coded.
Preserve negative dollar adjustments, nullable exhibit values and original sort.

Preserve up to100 bills, independent stored columns, nullable link/package,
non-rejected link semantics including versioned fallback, and specificity/date
ordering. Reports preserve deduped provision identity, accepted/candidate links,
match-basis-derived scope, accepted/basis/FY/confidence ordering,50 cap, required
program-level caveat and loaded-source-only empty note. A DTO cannot verify the
winning omitted candidate or prove source truth, completeness or current policy.

Trace immutable projection/types/policies/tests at fd8765ec against4be13b0b using
metadata hashes only; no private bodies in Git. Local tests use a test-only Ajv
compiler until root integration; preserve raw failures and exact failed source,
prove owned capture process exit. No SQL/DB/service/provider/model/native/cloud
or runtime action. Local dependency copies only; no locks/dependencies changed.

## Results

Implemented all three private boundaries in the allocated files. The factory and
definition names above are final. The main validator owns operation/selector,
bill and provision correlations; the contractor helper receives already inert,
shape-validated data and owns only returned-row arithmetic and attribution.
The schema owns closed tuples, nullability, literal labels and source caps. No
existing file, dependency, public contract, registration or source handler changed.

### Exact reference trace and qualifications

Ten relevant reference identities independently verified at
`fd8765ec01d292013758606204f2c9d886cd31c1` match observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; see `reference-identities.json`.
The discovery metadata handoff is `b3c405d15742f85a33743658a885fd024236b191`.
The service owner blob is `d507cb15aaf58744b32488f77cb4a0334ed99738`:
getBills1363–1500 and versioned linkage1569–1585,
getContractors1588–1829, ProvisionItem90–117/getProvisionsForPe2726–2829.
Meri wrappers5280–5313 establish the exact raw output envelopes. Prisma establishes
stored scalar/nullability and identity constraints; the shared funding helper
establishes bucket labels; defense-budget and source-coverage helpers establish
the warning text. Relevant contract tests corroborate accepted/candidate report
links and the full provision projection. Private implementation is neither
imported nor executed; private source bodies remain outside this repository.

No current actor, tenant, source freshness or availability is proven by a shape.
Legacy controller/role prerequisites remain distinct from new gateway admission.
The traced methods read global stored data, including parameterized SQL for
awards and versioned links; they do not call providers or ingest data in these
paths. This statement does not cover unrelated methods on the legacy service.
Source-query, current-authority, deadline/cancellation and data-adapter qualification
remain unrun. Meri descriptors remain unavailable; root owns their registration.

### Behavior retained and intentionally bounded admission

- Request strings trim/cap32 UTF-16 units and preserve case. Missing, blank,
  non-string, extra-key and effectful values refuse before any source use. Raw
  source error/NotFound behavior is not represented as a successful empty result.
  `generatedAt` and award `asOf` are canonical serialized instants, not freshness
  receipts. Bill latest-action SQL Date is midnight; nullable dates remain null.
- Bills retain nullable whole links and packages, string evidence on present
  links, and versioned `qualified` status. The source excludes only `rejected`;
  unknown other status strings are not silently upgraded or discarded. Stored
  bill IDs/type/number/Congress remain independent columns. Returned IDs are unique
  because one CongressBill row owns each ID. Specificity (`peCodeCount`) then
  date order matches the source's post-sort, including null-as-epoch comparison.
  Missing versioned/current link or package is not absence of legislation.
- Award grouping produces unique exact contractor names, top10 by amount. Group
  counts are stored SQL Int32 results, but their returned aggregate is a larger
  safe integer; no invented Int32 aggregate overflow. Negative amounts remain
  valid adjustments. Finite floating sums follow the source's row/category
  accumulation order; no decimal precision, currency accuracy or full-population
  reconciliation is claimed.
- Named primes remain a separate top25 projection. Null costs are compared using
  the source's `-1` sentinel, so no stronger claim of null-last ordering is made
  when negative values occur. No uniqueness by projected display name is imposed:
  source dedup uses an unreturned normalized performer key. Publisher/FY/page
  attribution preserves null defaults and page truthiness, including zero.
- Exhibit totals correlate only named primes. Award totals/buckets correlate only
  returned grouped award rows. The 24-month query window and R-3 report-year
  fields remain separate; no common fiscal-year cohort is invented. Literal
  provenance labels are producer claims, not new attestation. Unmatched zeros
  expressly mean not inventoried, and the evidence note is retained verbatim.
- Report dedup selects strongest basis first (`pe_code`, then `project_title`,
  then other), independently of review status; a candidate stronger match may
  survive a weaker accepted one. The contract checks unique returned IDs, not
  the unreturned competitors or correctness of the chosen winner. Final ordering
  is accepted first, basis, descending FY and confidence, with ties permitted.
  Exact stored statuses are `accepted` and `candidate`; generic "pending" is
  not substituted. Unrestricted finite confidence and signed stored Ints remain.
- `pe_code`/`project_title` imply `pe_specific`; every other basis implies
  `program_level` with the exact per-row caution. Any program-level row requires
  the aggregate note. Empty report language retains the pinned loaded-coverage
  caveat, including unsupported/blocked source families. That historical registry
  wording is not a claim about today's source coverage. No completeness or
  absence proof is added at50 rows,100 bills,10 contractors or25 named primes.
- Stored free-text fields have a new private transport ceiling of1,048,576 JSON
  code points in addition to canonical snapshot limits. This is not a native
  source-column or query cap. Full provision text is retained within that ceiling,
  not silently summarized/truncated. The selector alone follows the pinned cap.

### Preserved checks and repairs

Initial28/28 focused checks passed. Subsequent source scalar review found that the
new schema and one positive fixture incorrectly allowed null evidence inside a
present bill link. The whole link may be null, but both direct stored evidence and
the versioned SQL projection are strings. A new regression produced28/29 passing,
one failing; exact initial/failed source and raw receipts are preserved. The schema
was narrowed and only the incorrect positive fixture value was changed, without
removing an assertion; repaired29/29 passed.

A second author counterexample found reused Int32 limits on derived award totals.
Two valid grouped counts can sum above Int32. The original29 checks remained
passing and the new positive failed (29/30). Its exact four-file source snapshot
and raw failure are preserved. Aggregate totals/bucket counts now admit safe
integers, while each grouped SQL count retains its Int32 bound; repaired30/30
passed. No legacy producer defect is claimed by either repair.

Captures used the existing Linux subreaper helper. PGIDs184728,185209,185243,
185431,185465 were absent afterward, with no timeout or kill required. Initial
tracked diff hashes do not cover then-untracked files; exact copied source
snapshots and the final commit bind the corresponding receipts. Independent
review and immutable-source replay follow; source acceptance does not close G1.

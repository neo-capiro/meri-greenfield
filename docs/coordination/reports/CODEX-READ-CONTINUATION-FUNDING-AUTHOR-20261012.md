# Funding reads: author source submission

Base `e94865529c5a1e97c79893527895f0b4b73be35f`; source freeze
`256248fee5be45e5f203bbc74cc5b0c0e2f738f7`, tree
`53800b1b138121dcc39971bad722c8da94cbfc30`. Dedicated worktree:
`/workspace/meri-funding-reads-20261012`, branch
`task/meri-funding-reads-20261012`. Independent acceptance is pending at submission.
Root owns the canonical loader/catalog and release of any integration candidate.

This source adds five private read contracts: `search_funding_opportunities`,
`get_funding_opportunity_requirements`, `get_funding_opportunity`,
`get_opportunity_client_context` and `get_opportunity_government_landscape`.
There is no handler, adapter, current authorization decision, provider client,
extractor, review mutation, background work or model loop. Import is inert.
All source connectivity and operation availability remain disabled.

## Ownership and interfaces

The new schema owns the five closed request/result definitions and their shared
funding DTOs. `funding-opportunities-validation.mjs` owns the factory, admission,
normalization and operation/request binding. `funding-envelope-validation.mjs`
owns shared envelope, summary, search, client and landscape relationships.
`funding-requirements-validation.mjs` owns the distinct requirement-page/span
relationships. These modules import only the existing canonical
`snapshotOperationData` and their allocated siblings; no legacy implementation
is imported or copied. Ajv remains injected by the canonical loader; this lane's
compiler exists only in its test harness. The evidence schema-construction
script contains derived interface declarations, not upstream source bodies.

Factory: `createFundingOpportunitiesValidators({validateShape,schema})`.
Exports/result methods:

- `fundingOpportunitiesSchemaId`: `urn:meri:retrieval:funding-opportunities:0.2.0`.
- `FUNDING_OPPORTUNITY_OPERATION_IDS` with exactly the five selected reads.
- `fundingOpportunitiesInputDefinition(id)` and
  `fundingOpportunitiesOutputDefinition(id)`.
- `normalizeFundingOpportunitiesInput(id,request,{asOf})`.
- `validateFundingOpportunitiesShape(definition,value)` for closed shape and
  common envelope admission, and
  `assertFundingOpportunitiesOutput(id,value,request,{asOf})` for the complete
  operation/request consistency boundary. Integration must call the latter.

Definition pairs are `FundingSearchInput/Output`,
`FundingRequirementsInput/Output`, `FundingOpportunityInput/Output`,
`FundingClientContextInput/Output`, and
`FundingGovernmentLandscapeInput/Output`.

Root explicitly allocated private `contextKeys:['asOf']`. `asOf` is required
trusted context, a finite canonical ISO instant, and must be echoed byte-exactly
by the output. Model arguments cannot set it. It does not establish current
actor/client visibility, flag enablement, document entitlement or expiry.
Normalization returns frozen `{input,metadata}`; metadata preserves `asOf` and
explicit false `authoritative`, `sourceConnected`, `producerQualified` and
`absenceEvidence` fields. The real canonical resolver retains the immutable
original request and computes the normalized argument digest.

Search defaults are query `''`, page 1, pageSize 5 and activeState `active`.
Query length is measured in UTF-16 before trimming, at the frozen 500-character
bound. The source accepts page 1–100000 and its canonical nested normalizer
clamps it to 10000; this contract preserves that effective selection. Absence of
source remains distinct from selecting either supported rail. Requirements
normalize to offset 0/limit 10 (limit at most 25); detail normalizes to summary
position 0/limit 1200 (at most 12000). No clock is synthesized. Refusal states
remain available for supported-shaped requests that cannot be satisfied, including
unsupported source strings. Unknown request fields and coercion are refused.

## Preserved semantics and limits

The envelope retains all six states: available, disabled, denied, not_found,
unsupported_source and invalid_request. Refusal data must be null and cannot
carry truncation. Denials keep the identical client-existence-neutral sentence.
The 24000 ceiling is `JSON.stringify(envelope).length`, in JavaScript UTF-16
characters, not UTF-8 bytes. Validation refuses oversized output; a qualified
producer must produce the established bounded refusal, never truncate JSON.

Closed projected fields use their declared DTO compatibility, including nullable
recommendation/acquisition structures and the legacy nullable decision audit
fields. The currently reachable v2 compatibility projection emits null for
recommendation and acquisitionPosition; accepting the declared DTO does not
claim it currently produces every admitted shape. Raw nested provider, workflow
and arbitrary property bags are excluded. The projected place-of-performance
DTO stays closed to city/state/zip/country string/null leaves; an upstream
compatibility spread cannot widen it. This is deliberate Meri boundary admission.

Search rows are capped at five and bound to the effective client, source and
criteria. Unknown/capped totals, current source freshness, profile gaps and
matched-page coverage remain distinct. Full matched-page coverage requires
first page, a known uncapped total and no continuation; the omitted upstream
`catalogComplete` fact cannot be proved from this projection. Validation can
reject contradictions but cannot prove that every authorized match was found.
The legacy top page range also permits a producer to advertise nextPage 10001
from page 10000 while a subsequent request normalizes back to 10000. No automatic
paging loop or progress guarantee is implemented; that producer-bound edge needs
qualification before claiming exhaustive traversal.

Notice summaries use exact UTF-16 character ranges and clamp a beyond-end
request to the held text length. Returned characters, nextOffset, truncation,
sourceUpdatedAt and missing/link-only/available state remain consistent. This
page has no content hash or retained prior-page binding, so multiple accepted
pages do not establish one immutable source snapshot. The contracts do not
verify the held source text or materialize it.

Grant program funding, award floor/ceiling and expected count remain separate
from contract estimated value. Null is not zero; source-backed and unstated
contract values cannot be relabelled. Relevance, eligibility, machine
recommendation, human decision and workflow status remain different fields.
Unknown eligibility is not a disqualifier. Missing-fact disclosure and the
source-specific requirements handoff are checked without inventing amounts.

Client-context grants/contracts each retain the five-row cap and their source
identity; broad source counts are not inferred from those rows. Optional
structured deadlines preserve off/enforce projection mode. `nextDeadline` and
the 30-day count describe only the returned sampled rows, not every client
opportunity. The real current query samples five combined records; the declared
DTO compatibility retains the two independently bounded output arrays and their
per-collection truncation disclosures. No global earliest-deadline claim is made.

Requirement pages preserve source/opportunity identity, tenant-specific review
status, supersession, document text availability, extraction method/model and
confidence. Quoted spans use UTF-16 and remain bounded to 2000 characters.
Total may be null or stale because page and count are separate reads; no
snapshot-consistency inequality is invented. A known positive total keeps an
exhausted page `available`. No-documents, no-text and read-none-found remain
separate coverage reports, not proof of no conditions. Pending/rejected entries
are not promoted, accepted entries are not independently re-verified, and
superseded entries remain represented. The read DTO deliberately lacks document
bytes and the extraction artifact's content hash: quote location/currentness and
mandatory-condition truth cannot be proved here. Requirement type/method/
confidence retain the read DTO's declared strings rather than pretending this
read is the stricter extraction-artifact admission endpoint.

Landscape admits the existing eleven source reports and three wired sources,
with at most forty retained items. Available counts and truncation describe the
full packet before slicing. The full packet fingerprint is retained and
structurally checked, not recomputed or authenticated from the truncated slice.
Source-backed and inferred items stay distinct. Denied packets cannot masquerade
as successful empty results. Available SAM landscapes require the frozen composer UUID-on-trim request
boundary. The projected landscape result omits the original client/source/id envelope, so request lineage still needs the trusted adapter.
No geocoding, causal district inference or absence evidence is created.

## Authority and reference evidence

All twenty metadata-pinned references match frozen Capiro
`fd8765ec01d292013758606204f2c9d886cd31c1` and observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`, with no relevant blob drift.
Exact paths, blobs and locators are in
[`reference-identities.json`](../../qualification/candidates/read-continuation-20261012/funding-author/reference-identities.json).
The primary adapter blob is `ce2ec030bbadc55e102d9fb54384b1c592c4ff5f`.
References include the actual result projections, imported legacy/v2 DTOs,
requirements service/schema/pagination tests, landscape types/coverage, shared
deadline DTO, current client visibility and flag guards. No private source body
was stored in this repository or executed.

The frozen adapter checks the master funding flag and Meri funding flag first,
then role at least standard_user, then the current visible-client wall. The
visibility owner excludes archived/inactive clients and requires the actor's
memory-wall grant where applicable. Requirements separately require the document
flag and readable opportunity before their tenant review lookup. The landscape
composer independently rechecks visibility. Route-level landscape flag declarations
do not prove that the Meri adapter checks that distinct flag; this contract does
not silently invent such an authorization decision. All current policy, source
entitlement, freshness, error and identity checks remain adapter/gateway work.

No change is made to the approved memory administrator self-approval exception,
Clio-versus-portfolio scope, mutation policy, Claude SDK/Temporal responsibilities,
public contracts or source availability. Raw results have no Meri RunBinding/
subject envelope and cannot be promoted into an authorized gateway release merely
because they pass this family validator.

## Verification and preservation

Focused tests first stopped at strict Ajv compilation: a refusal `not.required`
conditional lacked its local property declaration. The correction uses a false
property schema for refused truncation; strict compiler settings were preserved.
The exact failed source diff, raw output, command, exit and cleanup are retained.
The next run passed 38/38. A source-review improvement removed object-property-order
sensitivity from sampled deadline comparison and added its reordered-object control;
the pre-review focused check passed **39/39**. All baseline tests/assertions
remain unchanged.

At the initial source freeze `c7e6b15ecd99f5a185cb3826f9b471d2438854c8`,
`npm run check` passed **534/534**, and public distribution checks passed
generated-byte/type checks plus **7/7**.

Independent review then exposed two actual defects against that preserved freeze:
a short requirement page could invent continuation without a larger known total,
and an available landscape could lack the composer's SAM UUID request boundary.
The reviewer retains the unchanged controls and original **47 pass / 2 fail**
result. Repair `19bfb022a40e635215c182b5f6d754682cd1d2f6` enforces the
short-page source basis while preserving full-page stale/null totals. The author's
own stale-total test fixture had been too permissive and was corrected to a full
page; its original bytes and passing receipt remain preserved. Repair
`256248fee5be45e5f203bbc74cc5b0c0e2f738f7` requires the exact UUID-on-trim
boundary only for available landscapes, retaining invalid-request refusals and
uppercase/whitespace compatibility. Focused checks passed **40/40**, then
**41/41**. The complete original source suite was rerun after both repairs; its
final result is **536/536 PASS** at the repaired source freeze. The public surface is byte-identical to
the previously checked source, so its passing check was not repeated. These are local source
checks, not native RC1/tool-budget fixtures or runtime admission. All receipts
record exact commands and raw bytes, source hashes, and owned process groups
confirmed absent without timeout or kill. The broader checks reaped seven exited
descendants in total, including the original preserved runs. No daemon, native database, provider, image or model was executed.

The offline packet verifier passes **161/161** identity, raw-receipt, source and
preservation checks. All 5267 original Git paths are byte-identical; exactly five allocated source/test
files were added. Public package metadata, lockfiles, schemas, canonical loader,
catalog and shared tests are unchanged. Root supplied physically copied existing
dependencies; this lane performed no install or lifecycle script. The captured
unmodified subreaper belongs to the existing evidence mechanism. Failed evidence
remains preserved rather than rewritten. Root independently reviews and integrates
the new family, descriptors and count updates before any mapping claim.

The baseline ledger remains 139 original/96 selected/43 deferred, 20 mapped
unavailable and 76 selected unmapped, with the partial action-item operation
separate. This author commit changes no mapping. G1 remains OPEN and G2–G7
unentered. All runtime/current authority/connected source gates remain unrun.

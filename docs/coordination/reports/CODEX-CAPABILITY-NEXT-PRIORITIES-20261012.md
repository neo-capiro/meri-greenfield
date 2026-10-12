# Concrete selected-read continuation priorities

Authority and baseline: accepted PR22 at
`4cdabab9ae3ef5f44e2a1eb10ae1a8a6622fa640`. Canonical counts come from
`packages/contracts/retrieval-0.2/catalog.json`; this report is a work order,
not another capability registry. The base has 14 mapped originals and 82
selected unmapped originals, including the partially bound action-item read.
All production operations remain unavailable.

## Current disjoint source slices

| Priority | Selected original operations | Established backend boundary / owner | Source work |
| --- | --- | --- | --- |
| 1 | `lookup_client_registry` | `MeriToolsService.lookupClientRegistry`, immutable result projection plus `LdaPick` and Prisma scalar declarations | Closed lookup input/result, candidate identity checks, canonical unavailable binding; no client creation authority |
| 2 | `get_business_development_context`, `get_business_development_evidence`, `get_business_development_recent_changes` | `meri-bizdev-tools.service.ts` projections, business-development evidence/alert types and persisted prospect scope owner | Separate typed results in one domain family; preserve scope, partial coverage and provider caveats |
| 3 | `get_research_portfolio`, `get_research_portfolio_changes` | Shared `research-portfolios.ts` DTOs, portfolio Meri scope/access/change services | Current trusted conversation/portfolio subject, detail/change contracts and unavailable bindings |

Only independently accepted complete selected boundaries reduce the unmapped
count. All six can be represented from frozen fields and policies. No source
transport, entitlement, producer execution or runtime qualification follows.

## Next implementable source slices

1. `get_funding_opportunity_requirements` and
   `get_opportunity_government_landscape`: the frozen
   `meri-opportunity-tools.adapter.ts` projections plus `RequirementsResponse`
   and `LandscapePacket` close these two SAM read boundaries. Keep document
   access separate, requirement extraction/review status explicit and pagination
   non-snapshot-stable. Landscape fingerprint/counts cover the packet before the
   40-item truncation; denied/not-wired sources are not absence.
2. `get_funding_opportunity`, `search_funding_opportunities`, and
   `get_opportunity_client_context`: same adapter owns the projected facts,
   criteria, provenance, nullable totals, freshness and profile gaps. Search and
   context cover a five-row page. Context's next deadline is not catalog-wide;
   grant funding and contract value remain distinct. Preserve the producer's
   24,000 JSON-character result refusal ceiling and current client wall.
3. `read_client_documents`: follow the already pinned document-reader result
   construction and extraction/readability types. Existing tests establish
   list/read modes, query/content-bound continuation, UTF-16 ranges, hashes and
   current wall checks. Finish tracing the metadata projection before allocating
   a contract; an `unknown` declaration alone is not a missing backend contract.
4. Economic, grants and legacy awards reads: immutable producer projections are
   valid evidence. Preserve source-specific periods/units, deadline modes, raw
   storage serialization and paging semantics. Do not substitute the distinct
   federal-market rail for `search_federal_awards`. SAM and regulatory reads
   still require tracing their forwarded/spread producer rows. This is remaining
   source discovery, not an established need for a new backend interface.

The initial discovery pass incorrectly treated the absence of separately named
result DTOs as a blocker. Frozen result projections are expressly permitted by
the existing task standards. That finding is corrected; no owner approval for
ordinary contract authoring is required where the actual fields/policy close.

## Exact scope/policy issues for coordination

`get_research_evidence`: accepted D012 describes Research Portfolio evidence,
but the immutable operation routes to actor-owned Clio research-session and
attachment snapshots. Owner interfaces are `MeriToolsService.getResearchEvidence`
and `meri-research-evidence.helpers.ts`, whose blob is
`1679ab8e36345772c41eaf7426c736e7a038ab58`. Binding that producer under the current
portfolio boundary would change source inclusion and ownership semantics.
Parent/dot must decide whether to amend the accepted boundary for this original
ID or name a portfolio-evidence producer. Until then its original row stays
pending with null replacement; the two true portfolio reads can proceed.

Acquisition personnel: current DTO/read-test changes add contact fields and
restrict uploaded contact data and historical values to `capiro_admin`. Before
targeting the current producer, the Acquisition Personnel read owner must freeze
the intended projection and privacy treatment of open metadata. Merely removing
new email/phone fields does not prove metadata redaction. Historical and current
blob drift must remain explicit. Contact-use classification grants neither read
nor outreach authority.

The prior memory approval conflict remains separate: producer administrator
self-approval and wrapper independent-reviewer semantics are not reconciled by
any read-contract change. No approval mutation is introduced here.

## Evidence and authority limits

All inspected references use Capiro
`fd8765ec01d292013758606204f2c9d886cd31c1`, with relevant drift checked against
observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Domain reports retain exact
paths/blobs and derived findings, never private bodies. Source tests are local
fixtures only. The approved native owner's 33-case RC1 sequence and all reserved
runtime/proxy/worker/qualification paths remain untouched. No paid provider,
database, cloud, frontend, security, deployment or main-merge action is included.

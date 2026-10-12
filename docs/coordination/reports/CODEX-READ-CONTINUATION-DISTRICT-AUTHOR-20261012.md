# District Nexus private read family

## Outline recorded before implementation

Base: `7b0ad6fe7afdeed5124d69b751ede10a42531f47`; isolated branch
`task/meri-district-nexus-20261012`. Only the two allocated private family files,
their new focused test and this author evidence/report are owned here. Root owns
the canonical loader, registry, catalog, counts and combined integration.

The new schema independently describes the frozen context/changes projections.
The pure `createDistrictNexusValidators({validateShape, assertSubject,
canonicalSha256})` factory returns `normalizeDistrictNexusInput(operation, raw,
{binding, subject})` and `assertDistrictNexusReadResult(operation, page, raw,
{binding, subject})`. Definitions are `DistrictNexusContextInput/Selection/Result`
and `DistrictNexusChangesInput/Selection/Result`; schema ID is
`urn:meri:retrieval:district-nexus:0.2.0`. The lineage wrapper `{binding,subject,data}`
is an explicit new Meri contract, not a legacy wire field or current policy proof.

Reuse canonical `snapshotOperationData`, subject validation and hash comparison;
the only compiler is the test-only Ajv harness until root registration. Require
one trusted selected client and an explicit matching trimmed raw client selector.
Normalize state to uppercase and district to two digits; changes since is null
when omitted or a normalized UTC instant under the producer's parseable ISO-prefix
grammar. Do not resolve an omitted client from conversation state or accept model
role, tenant, flag, authorization or completeness fields.

Preserve disabled results, at most 40 facts, 20 changes and 30 gaps; fact stages,
zero versus unknown, provenance, geography, freshness and reported coverage.
Preserve inclusive since, descending observation timestamps with unspecified tie
order, omitted baseline observations, unknown-source strings and ledger gaps.
Context gap truncation has an existing boundary caveat: exactly 30 source gaps
can return 29 with `truncated:false`. No result field certifies full source coverage.

The source projection checks same-tenant client existence and rejects archived
clients; it does not itself require every client to have status `active`, and it
receives no actor ID. Current actor/client wall authority remains a trusted
gateway/source obligation. Both explicit tenant flags (`district_nexus_v2` and
`district_nexus_r5_meri_tools`) are required by the source owner; lookup failures
fail closed. A reported disabled/available shape neither reads nor proves flags.

Verification: metadata-only old/current reference identities, synthetic nonempty
DTOs and each branch, bounds, selectors, lineage, hostile JSON, temporal ordering,
since boundaries and truth-preservation refusals. Preserve failures, use the
existing bounded subreaper capture and verify owned process-group exit. No Capiro
implementation is imported/executed or published. No source, database, provider,
service, native runtime or external action is authorized. All bindings remain
unavailable/null/pending and source connectivity false; source tests do not pass G1.

## Frozen source references and behavior

`district-author/reference-identities.json` independently verifies all 14 original
discovery references at Capiro `fd8765ec01d292013758606204f2c9d886cd31c1` against
observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; all 14 blobs are unchanged.
The file contains paths, blob IDs, byte lengths and SHA256 only. Private source
bodies and implementation are not copied into this packet or executed.

| Reference owner | Frozen blob | Boundary established |
| --- | --- | --- |
| `r5-meri-district-tools.ts` | `b868f3c03903fb291bc95d6b74805a55fd30ebcd` | Scope grammar, disabled/available result projection, fact/gap limits, changes lower bound/order/limit and ledger failure |
| `r5-types.ts` | `9352d1eaa80c91844f1b7c28473a6c3755344434` | Fact, gap, amount stage, provenance, geography, freshness and coverage declarations |
| `r5-district-context.service.ts` | `a4d5f7bbccb8f1573fd03b1b98f607424d864259` | Same-tenant/non-archived client, source rail gaps, reported zero/null/stage values and legitimate supplier fact coverage `complete` |
| `r5-flag.guard.ts` | `e831800b20113b0bca35b357d93e04e8140deae7` | Explicit dual tenant flags; lookup errors fail closed |
| `schema.prisma`, `DistrictNexusChange` | `cdf1923217edae6e7624993796a5671922b61ac0` | Global source ledger; string field widths; observed/effective times; baseline/change distinction |
| `r5-meri-district-tools.spec.ts` | `e35d29ccfed6c3f317424122425ebdb6fa36e75d` | Disabled branch, foreign client refusal, source parity, since/baseline filtering and ledger failure |
| `r5-district-context.spec.ts` | `0f2952f5683e8bc6e25a33fba995d0afe425e2bc` | Zero/unknown/stage preservation and rail failure as gap |

The schema preserves the projected fields, not entire database records. In
particular, changes contain no observation discriminator, tenant, old/new value,
ledger ID or deduplication key; baseline exclusion and GSA FIPS/numeric district
translation remain qualified source-adapter obligations. Equal observation times
are accepted without inventing a secondary ordering. Effective timestamps can be
future-dated, and generatedAt can precede the ledger query's returned observations.
Change/source/severity strings keep database width limits without a guessed enum.

The source computes changes truncation from exactly 20 returned rows, with no
21st-row probe, cursor or total. The failure branch keeps `available:true` with
empty changes and a changes-section ledger-unavailable gap; it is not an absence
statement. Both empty and nonempty successful results may contain other source
gaps. Context gap truncation remains a reported flag, including the exact-30
underreporting caveat; individual fact `coverage:complete` is not whole-result
completeness. Neither fresh-looking strings nor lineage authenticate source truth.

The request uses the actual producer's required explicit client selector despite
the advertised optional active-conversation description. Meri validates closed
request/context even when a disabled result is later returned; the source's
earlier flag check is not copied into the contract. State syntax alone does not
establish a recognized state/FIPS crosswalk. Text/caveat ceilings and canonical
JSON ceilings are explicit Meri transport admission limits, not source maxima.
Source date-only metadata remains a string; only generated/observed/effective
instants and normalized since require a finite timestamp.

## Checks and retained evidence

- Initial author suite: **24/24 PASS**, raw streams and receipt retained as
  `initial-focused.*`. Three exact new source/test snapshots are retained under
  `initial-source/`, with byte identities in `initial-source-identities.json`.
  The capture's tracked diff is empty because those files were then untracked;
  the separate snapshots bind that first run honestly.
- Capture process group **153116 absent**, exit 0, no timeout or kill required.
- Metadata reference verification: **14/14 identities match**, all 14 current
  blobs unchanged. No private body persisted.
- A test title was clarified after the first run: DTO shape does not prove
  baseline exclusion. Its original assertions were preserved unchanged.
- Exact source freeze: `c651a0ab75f416a06c91eff07a463d697adb0fa4`, tree
  `f1f1196c069c57a602520921651ae994a364de3f`. Frozen focused capture:
  **24/24 PASS** with empty tracked source diff, exit 0, process group **153761
  absent**, no timeout/kill required. `frozen-focused.*` retains raw streams and
  receipt; `source-freeze.json` binds source bytes and original-file preservation.
- **5268/5268 original tracked files unchanged** against the allocated base.
  No original tests or failing assertions were changed. Independent reviewer
  owns its original prefreeze failure, identified as an incorrect assumption
  about canonical scope resource-ID validation; this author does not claim it
  as a source defect or a passing independent acceptance result.
- Independent exact-source acceptance remains the reviewer's decision. Source
  freeze and report/evidence commits are separate; evidence adds no source change.

No runtime, source read, dual-flag service, current wall/grant adapter, database,
provider, native process or source connectivity qualification was run. Root must
register this family and unavailable descriptors and run combined canonical
resolver checks. The family itself grants no source permission and changes no
registry, catalog, lock, existing schema, public contract, original test or count.
G1 remains open; source acceptance is not runtime acceptance.

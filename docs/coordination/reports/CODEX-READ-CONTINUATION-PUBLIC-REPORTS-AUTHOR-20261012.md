# Public-report selected reads: author source freeze

Source candidate `d86c0710b534fad7626856075bb873715e54b596`, tree
`51c25cd183d7ef0c529bf1da0e2c09516444bb2a`, adds the three established stored
public-report read contracts. It is based on
`dd1433d164b4144f6f9d9ed14187459e7c9761f4`. No existing source was edited.
This is source qualification, with no source client, active handler, policy
admission, provider call or runtime evidence. Root owns canonical registration;
this author lane does not change the capability ledger or certify execution.

## Interfaces and projection boundaries

`createPublicReportsValidators({validateShape,schema})` uses the unchanged
canonical `snapshotOperationData` admission helper. The injected compiler in
tests is strict Ajv; no new production compiler or generic JSON walker exists.
The factory returns `publicReportsSchemaId`, `PUBLIC_REPORT_OPERATION_IDS`,
`publicReportsInputDefinition`, `publicReportsOutputDefinition`,
`normalizePublicReportsInput`, `validatePublicReportsShape`, and
`assertPublicReportsOutput`. Schema ID is
`urn:meri:retrieval:public-reports:0.2.0`.

| Operation | Input/output definition stem | Distinct preserved result meaning |
| --- | --- | --- |
| `search_cbo_cost_estimates` | `CboCostEstimateSearch` | `estimatesFound` is exactly the returned window; empty window requires the original no-estimate disclosure. No guessed cost/score fields. |
| `search_gao_reports` | `GaoReportSearch` | `total` is a separate concurrent local count and may be smaller than the returned rows. Nullable stored fields and signed recommendation Int remain distinct from projected summary text. |
| `search_crs_reports` | `CrsReportSearch` | Separate local total, nullable URLs/date, bounded excerpts. Pinned producer selects active rows, but the result does not independently prove that filter ran. |

Definitions have `Input` and `Output` suffixes. Normalization returns immutable
`{input,metadata}` with explicit non-authority/source-disconnected/producer-
unqualified/absence-unproven metadata. CBO retains its original trimmed and
UTF-16-clipped bill label only in metadata for note correlation. Its effective
bill filter is lowercased then trimmed; Unicode lowercasing may expand length.
The canonical resolver independently retains the immutable original request and
computes the normalized-input digest. Tests exercise that real resolver path.

There are **no context keys**. A model-supplied `asOf`, actor, tenant, active flag,
offset or cursor refuses. Producer `generatedAt` is a reported timestamp, not a
trusted clock, read snapshot, freshness claim or authorization decision.

## Deliberate admission and coverage limits

- String normalization matches the source's trim then UTF-16 clipping: CBO
  bill40/query200, GAO/CRS query240, GAO reportType60; blank strings are omitted.
  CBO note matching uses the original case, including a trailing space introduced
  by clipping. Excerpts preserve UTF-16 title240/summary400 bounds and normalized
  whitespace. Source summary null becomes the required empty string. Exact-max
  literal content need not end in dots; a surrogate-half prefix is admissible.
- Numeric admission is deliberately stricter than legacy coercion: limits are
  integers1..25/default10 for CBO and1..50/default20 for GAO/CRS. Numeric strings,
  fractions, booleans, null, nonfinite values and out-of-range clamp inputs refuse.
  Optional CBO congress is a signed32-bit integer; negatives are preserved and
  zero means no filter. This is not full legacy-input equivalence.
- Date wire admission is canonical RFC3339/JSON ISO string form with finite
  comparable timestamps; stored GAO/CRS `@db.Date` values require UTC midnight.
  CBO `@db.Timestamptz` values may contain time-of-day. Nullable dates stay null.
  Extended/negative-year JavaScript ISO strings outside the date-time format
  grammar are not admitted. No claim covers every possible historical DB date.
- Primary-key duplicates and ascending non-null date subsequences refuse.
  Nullable-date placement is deliberately not inferred from the DTO. Exact
  CBO bill/congress and GAO report-type filters are checked. Query matching,
  current source ownership and CRS active selection remain adapter obligations.
  The contract does not reimplement database matching or a retrieval algorithm.
- No full source text accompanies the excerpts, so the validator cannot prove
  which original bytes preceded an ellipsis. Empty output/note reports the local
  selected window, not corpus absence or policy-complete search. URLs are stored
  strings, not fetch permission. Neither generatedAt nor a count grants authority.

The original request-active guard and GAO/CRS system-read owner remain execution
prerequisites. Shape validation grants neither. No roles, approval semantics,
private policies, network permissions or task identities are introduced.

## Source evidence and checks

Metadata-only identities are retained for the exact frozen producer projection,
Prisma scalar/null models and CBO contract test in
`docs/qualification/candidates/read-continuation-20261012/public-reports-author/reference-identities.json`.
All three match both Capiro `fd8765ec01d292013758606204f2c9d886cd31c1` and
observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Producer bodies were only
read locally and were not retained, copied as implementations, imported or run.
The separate fourteen-reference discovery is pinned at
`d34da1a39aa68dd6f8af41ca5caee730ad1cdbfe`; this lane does not claim to have
independently read every unrelated reference from that broader inventory.

| Check | Actual result |
| --- | --- |
| Focused contract/factory/resolver tests | 31/31 pass, initial staged source bytes archived |
| `npm run check` at source freeze | 526/526 pass |
| `npm run check:contracts:distribution` | Generated-file and type checks pass; 7/7 tests pass |
| Original-file preservation | All5268 original Git blobs unchanged; exactly3 new source/test files |
| Independent reviewer preliminary replay | 31/31 pass at exact source freeze; separate final review owns acceptance |
| Native, DB, provider, connected authority, runtime | UNRUN; no gate advance |

Commands and stdout/stderr are retained under the author evidence directory.
Each test command used the existing Linux child-subreaper capture unchanged,
with a120-second limit. All owned process groups were absent afterward, with no
timeout or group kill. Five exited descendants were reaped across the broader
checks. Existing copied dependencies were used without installation or lifecycle
scripts and remain untouched. No new source failure occurred in this lane.
Reviewer preserved its initial two non-midnight date fixture failures and their
correction independently; those are not represented as production defects.

Public0.1, the existing canonical registry/loader, locks and every original test
remain unchanged. The139-original/96-selected/43-deferred ledger remains the
root-owned scope; the new family alone is not three runtime-qualified tools.
Root must integrate only reviewed bindings as unavailable/null/pending with
source connectivity false, then verify combined source. G1 runtime and all
later qualification gates remain open.

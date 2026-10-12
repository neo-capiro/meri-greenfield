# Independent PE references review

**ACCEPT_SOURCE** for `c9770ef235ae220159500b12bd1ab885f9ba9b45`
(tree `c06472d82474b129799169f01b0de7f83129f463`), with metadata-only author
head `3348a42ff4275c6e60b195f8af03a7c017ced3a4`
(tree `43c0b460898a98db4b785040f755c356ad2a8a68`). Runtime and source
connectivity remain **HOLD / UNRUN**.

Exact base `2aa0a33bdaf36af1224cfdb840bc493e53cea9f3`; dedicated worktree
`/workspace/meri-pe-references-review-20261012`, branch
`review/meri-pe-references-20261012`. Independent criteria preceded candidate
acceptance. Reviewer authored only its new test, report and evidence directory;
exact author source/evidence were merged for replay, never edited here.

## Source contract and authority boundary

Reviewed `get_pe_contractors`, `get_pe_bills` and `get_pe_report_language`, their
private schema/factory, cohesive contractor-correlation helper and focused tests.
The factory reuses canonical `snapshotOperationData`; its helpers perform only
inert projection validation. No querying, award identity engine, matching engine,
model loop, storage or authorization system is introduced. Root owns canonical
registration and unavailable descriptors.

Twelve relevant immutable reference blobs at
`fd8765ec01d292013758606204f2c9d886cd31c1` were independently hashed and match
observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. These cover wrappers,
read owner, funding and report-note helpers, coverage registry, Prisma models,
entry/control/role policies and relevant existing specs. Discovery
`b3c405d15742f85a33743658a885fd024236b191` supplied locators; this review independently
followed the selected owner projections. Reference bodies were read as Git object
data only; no private implementation was imported, executed or copied into Git.

The source-only boundary deliberately preserves these distinctions:

- All three inputs require a string PE selector, trim it and retain its first32
  UTF-16 units without case normalization. Empty or mistyped selectors refuse.
  Closed empty context admits no actor/tenant/authorization hints.
- Only report language echoes the requested PE. Bill and contractor envelopes
  cannot attest request linkage; accepting their shape does not authenticate
  the PE returned by a future adapter.
- Bills retain the source's100-row window, independent stored fields and nullable
  sponsor/date/link/package values. Sorting is PE specificity then action date;
  null dates use the source's comparison convention. Stored bill identifiers do
  not manufacture consistency among congress/type/number. Link status excludes
  `rejected`, not every non-accepted value; arbitrary finite stored confidence
  does not become an authorization probability. A present link's evidence is
  text, including versioned fallback evidence; the entire link may be null.
- Reports retain `accepted` and `candidate`, deduplicate by provision identity,
  and stop at50. Source dedup chooses stronger match basis before subsequent
  status/basis/FY/confidence ordering; it does not always prefer an accepted
  weaker match over a candidate stronger match. The DTO cannot verify omitted
  candidates or the correctness of the underlying matching process.
- `pe_code` and `project_title` bases imply `pe_specific`; other bases imply
  `program_level`. Any program-level row requires both the per-row attribution
  caveat and the aggregate note, including mixed result sets. Empty results
  retain the loaded-source coverage warning. Neither branch proves global
  absence, exclusive attribution or coverage completeness.
- Contractors distinguish the missing-award-table fallback from a normal result.
  Normal results retain at most10 grouped award rows and25 exhibit performers.
  Source grouping by contractor name can classify a mixed group as direct when
  any contributing award is direct. Returned grouped labels do not reconstruct
  or authenticate each underlying award.
- Twenty-four-month federal obligations, candidate program-linked amounts,
  unmatched zero buckets and report-FY R-3 exhibit values remain separate.
  Exhibit values retain compatibility-table provenance; they are not promoted
  to canonical government budget or award obligations. The unmatched zero is an
  explicitly un-inventoried response bucket, never complete attribution proof.
- Negative finite dollar adjustments, null exhibit values and signed stored
  scalar values are preserved. Summed counts may exceed one Int32 row while
  remaining safe integers. Floating-point addition correlates the returned
  projection; no exact decimal accounting or unreturned-universe proof is claimed.
- Serialized timestamps, fixed provenance labels and source caveats are projection
  fields, not independently verified currentness, provider identity or live
  retrieval. Traced owner methods are global stored reads; current actor/tenant,
  source entitlement, query binding, budget, cancellation and release authority
  remain separately qualified gateway/adapter obligations.

The proposed source path leaves every existing public contract, catalog, ledger,
runtime file, lock, migration and original assertion unchanged. Schema transport
ceilings and strict inert admission are Meri boundaries rather than new claims
about producer query limits or source correctness.

## Preserved findings and countercontrols

Original reviewer controls passed29/29, but their positive bill-link fixture
incorrectly used null evidence. The direct Prisma projection and versioned
`FederalEvidenceMention.evidence` both establish non-null String. The author
independently caught this scalar mismatch and preserved an author28/29 failure
before narrowing the schema. The reviewer changed only that positive fixture's
evidence to synthetic text and added an explicit null-evidence negative. The
original test is preserved in `d439343a` and the raw initial receipt.

The author also reproduced29/30 when two grouped Int32 award counts summed to
`4294967294`: the initial aggregate Int32 schema bound was too narrow. The repair
keeps individual row counts Int32 and uses safe-integer aggregate counts. No
source aggregation, SQL, monetary semantics or ledger changed.

The expanded32 independent controls replayed the exact retained initial three
source files and produced **30 PASS / 2 FAIL**, precisely those two defects.
The unchanged32 then passed against the repaired source and exact final freeze.
`initial-source/**` matches every hash in `prefreeze-source-before.json`.
`replay-initial.py` uses a temporary copy of those new-Meri files and the preserved
canonical inert helper, removes its temporary directory, and never imports
private Capiro code. The initial delayed after-hash was sampled after author
repairs, so it differs; the retained preimage replay, rather than an assertion
of unchanged mutable source during that whole interval, binds the failures.

Two metadata path guesses returned Git128 path-not-found without private body
output: `program-element.service.ts` resolved through its real import to
`program-element-read.service.ts`; `pe-source-coverage.ts` is under shared/src,
not the application program-element directory. These were source-location
corrections, not failed production behavior. An early coordination shorthand
said dismissed/pending; subsequent immutable trace established the exact
`rejected` exclusion and `accepted`/`candidate` values before controls froze.

## Verification and owned cleanup

- Exact freeze: **62/62 PASS**, comprising **32 independent +30 author** groups.
  Checks cover all output branches, extra/hostile data, PE echo limits, source
  status and provenance, nullable versus required fields, report attribution,
  counts/order/window limits, money separation, negative adjustments and both
  reproduced scalar defects.
- Exact source/reference audit: **90/90 PASS**. All **5,730** original base files
  are byte-identical in author source, author closeout and review integration.
  Four source/test files match the exact commits and replay tree. All12 private
  reference pins match observed revisions; author followup is metadata only.
- Source whitespace passes. Raw stream and initial-source hashes verify; captured
  stderr is empty. Failed stdout remains byte-for-byte intact under scoped raw
  evidence attributes.
- Owned process groups **184898**, **186134**, **186618**, **188255** and **188381**
  were physically absent after their subreaper captures. No timeout or kill was
  required, and no other owner's process was touched. This evidence concerns
  local source-check cleanup only, not native task teardown.

Exact replay commands from this worktree:

```sh
node --test packages/contracts/test/retrieval-pe-references.test.mjs packages/contracts/test/retrieval-pe-references-independent.test.mjs
python3 docs/qualification/candidates/read-continuation-20261012/pe-references-review/audit.py c9770ef235ae220159500b12bd1ab885f9ba9b45 3348a42ff4275c6e60b195f8af03a7c017ced3a4
```

The committed capture wrapper supplies owned process groups, raw streams and
exit receipts; its labels are write-once. Prefreeze runs explicitly selected the
author root with `MERI_PE_REVIEW_SOURCE_ROOT`; exact replay uses local committed
source with no override. A future authorized rerun must use new receipt labels.

## Integration and remaining gates

Accept only the exact source and metadata heads above. This is a pure contract
review, not connected adapter or runtime acceptance. No database/SQL, service,
provider, native fixture, model, cloud, frontend or dependency installation ran.
Descriptors/source activation, current authorization and full G1 gates remain
unavailable and unqualified. Root retains inventory, canonical registration and
combined integration ownership.

Reviewer-only order: `2021d4326bf965bd7487b5ce5e0f9e8cb91b6370`,
`e8650d8df2f65e1b22aa2f1e2d4f335e7ad28471`,
`d439343a63be721c592348c0dc895f228625af21`,
`920606d870a4c32bb6afaeb3493bf685f38ccf94`, then this final review closeout commit.
Skip merge commits `4f6a3833` and `b3c77c5a`; integrate accepted author source
separately. `review-manifest.json` hashes all final owned deliverables and
excludes itself to avoid a circular checksum.

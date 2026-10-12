# Independent certification status review

**ACCEPT_SOURCE** for `fa59df3739a2c43310b86de416d2f455a8715dce`
(tree `6dcc5ddff9b5e04aa64fd084104eb168825c8dca`), with metadata-only author
head `1142bbd7dabd927653ec5c810b86f8ecba89f0ba`
(tree `7725e16e434a709a8aeeeb0386d50d44ee521dc0`). Source connectivity,
provider execution and runtime acceptance remain **HOLD / UNRUN**.

Base `4566cef6417428d46274a14f7937ca11df66ae9d`; isolated worktree
`/workspace/meri-certification-status-review-20261012`, branch
`review/meri-certification-status-20261012`. Criteria preceded candidate
acceptance. Reviewer edited only its independent test, report and evidence;
accepted author source and metadata were merged unchanged for replay.

## Reviewed boundary

This accepts only the private `get_certification_status` schema and pure factory.
It reuses canonical inert `snapshotOperationData`, introduces no provider client,
parser, status-provenance engine, model loop or authority implementation, and has
no source/runtime initialization. Root owns registration, catalog and unavailable
descriptors. A supplied result passing these checks is not verified evidence.

Eight relevant private reference blobs were independently hashed at
`fd8765ec01d292013758606204f2c9d886cd31c1`; all match observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. References cover the wrapper,
FedRAMP client/parser and tests, source controller/request/role boundaries and
separate status-provenance checks. Only metadata and derived contract behavior
are retained. No private source implementation was imported, executed or copied.

The projection and source limits are explicit:

- Input is exactly `{program:'fedramp',query}` with a trimmed nonblank string.
  The query is not truncated or case-normalized in the returned selection. The
  declared Meri transport ceiling is separate from the source's lack of an
  application selector cap.
- Trusted `comparisonLocale` is required, canonically spelled and supported by
  the installed ICU locale admission check. Comparison uses it explicitly;
  no model locale or ambient default is accepted. These checks do not prove it
  matches the source adapter's actual default-locale casing. That correspondence
  remains a runtime qualification prerequisite. Turkish versus English cases
  demonstrate that this distinction changes observable matches.
- Exact product ID comparison takes precedence over CSP/CSO name substring
  matching. Observable result mismatches are refused. An exact-ID record cannot
  remain in an ambiguous result, but a partial DTO cannot prove that no unreturned
  exact-ID record exists elsewhere in the fetched dataset.
- Single, ambiguous and no-match variants remain distinct. They contain neither
  a query echo nor a generatedAt field. `searchedEntireDataset` and
  `evidenceOfAbsence` remain original source assertions about its fetched snapshot;
  they do not grant current authority or independently prove complete coverage.
- Ambiguity returns `min(candidateCount,10)` records while count describes all
  matched rows. Duplicates remain possible because the parser does not deduplicate
  product records. There is no invented source sorting or uniqueness guarantee.
- Product identifiers are case-sensitive FR-plus-digits wire values. Six exact
  status and five impact vocabulary values remain schema-owned. Nonempty provider
  names and agency strings retain whitespace and duplicates where the parser
  does; fields are not silently trimmed into different identities.
- Each record retains nullable authorizationDate, agency list, fixed marketplace
  URL and canonical observation timestamp. Authorization dates are general
  instants, not invented date-only fields. Candidates share one source observation.
  These shapes do not authenticate provider origin, present-world status or time.
- No-match sourceUrl/observedAt are paired optional wire keys derived from the
  first source record. Both omitted remains the declared wrapper projection;
  this does not claim the normal fetching parser, which rejects zero valid records,
  actually completed an empty fetch. Missing keys are not fabricated.
- The separate legacy provenance owner requires more than self-reported fields
  before accepting status or negative claims. This contract does not recreate or
  satisfy it. Current tenant/actor/operation entitlement, source authentication,
  locale correspondence, budgets and release/cancellation authority remain
  separately qualified gateway/adapter responsibilities.

The traced client has actual HTTP effects, a15-second per-fetch timeout, declared
and post-read8MiB checks and one retry except identified non-server HTTP errors.
It allocates the full response arrayBuffer before checking actual byte length.
Those are source facts, not evidence of bounded streaming, a shared retry deadline,
physical cancellation or native security. No fetch or provider operation ran in
this review; the client remains unavailable.

## Controls, failures and non-findings

Independent controls were committed before final source acceptance. The first
reviewer harness run failed **0 PASS /1 FAIL at module initialization** because a
local constant named URL shadowed the global URL constructor. No contract assertion
ran. The exact test commit, two source preimages and raw error are preserved.
Only that local test variable was renamed. The next **26/26** passed with matching
before/after hashes of both candidate source files. One additional unsupported-
locale control was then frozen, bringing the independent final total to27.

A prospective concern that a dollar-anchored FR regex might admit a final line
terminator did not reproduce in the pinned Node engine. The independent negative
used an ordinary matching name query, so mismatch rejection did not hide the ID
check. The author also verified LF/CR/CRLF/U2028/U2029. No source repair or defect
is claimed. Similarly, canonical locale spelling alone was treated as insufficient
admission, not as a reproduced native-casing mismatch; the root-approved supported
locale refinement still leaves actual source-locale qualification open.

## Exact checks and cleanup

- Exact-source replay **58/58 PASS**: **27 independent +31 author** groups. These
  exercise variant boundaries, exact-ID/name matching, Turkish/English comparison,
  bounded versus full counts, duplicates, optional provenance pairing, required
  fields/nulls/vocabulary, malformed timestamps, forbidden authority additions
  and hostile getters/proxies/symbols/cycles without effects.
- Exact-source audit **81/81 PASS**. All **6,001** original files are byte-identical
  in author source, author closeout and review integration. Public contracts,
  catalogs, ledgers, runtime source, locks, migrations and original tests remain
  unchanged. Three allocated source/test files match exact commits and replay
  tree; author closeout is report/evidence only. All eight reference pins match.
- Raw streams, initial preimages and stable behavioral replay hashes verify;
  captured stderr streams are empty. Source whitespace passes. Failed harness
  output is retained byte-for-byte under scoped raw evidence attributes.
- Owned groups **192209**, **192342**, **193968** and **194049** were physically
  absent after subreaper captures. No timeout or kill was required, and no other
  owner's process was touched. This is local source-check cleanup evidence only,
  not native task teardown or G1 acceptance.

Exact replay commands from this worktree:

```sh
node --test packages/contracts/test/retrieval-certification-status.test.mjs packages/contracts/test/retrieval-certification-status-independent.test.mjs
python3 docs/qualification/candidates/read-continuation-20261012/certification-status-review/audit.py fa59df3739a2c43310b86de416d2f455a8715dce 1142bbd7dabd927653ec5c810b86f8ecba89f0ba
```

The committed capture wrapper owns/reaps its check group and retains raw streams;
labels are write-once, so any authorized rerun needs a new label. Prefreeze tests
explicitly used `MERI_CERTIFICATION_REVIEW_SOURCE_ROOT`; exact replay uses local
committed source with no override.

## Integration and remaining gates

Only this source packet is accepted. No HTTP/SQL/database/service, native fixture,
provider/model/cloud, frontend or dependency installation action ran. Current
source authenticity, real locale comparison, source/operation authority, connection
and full G1 runtime gates remain open. No production activation is introduced.

Reviewer-only order: `df4feac991109026a262ca61d0da6a1099fa2c54`,
`75182874f32651106fe38e6ee771e063be8dc3ec`,
`b65401fda898287699341c3b0ac8423d8e96b22a`,
`5c78c79f27cd711d084a6072544351a7a017521f`, then the final closeout commit.
Skip merge commits `32dd33aa` and `5ab375ed`; root integrates accepted author source
separately. `review-manifest.json` hashes final owned deliverables, excluding
itself to avoid a circular checksum.

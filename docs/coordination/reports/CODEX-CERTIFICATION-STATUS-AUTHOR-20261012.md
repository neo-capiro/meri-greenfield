# Certification status private snapshot contract

## Outline before implementation

Base `4566cef6417428d46274a14f7937ca11df66ae9d`, isolated branch
`task/meri-certification-status-20261012`. Own only new certification schema,
validator, focused test and this report/evidence lane. Root owns canonical
registration, catalog and counts. Prior accepted PE/federal branches remain frozen.

Root approved `createCertificationStatusValidators({validateShape,schema})`
returning `normalizeCertificationStatusInput(raw,{comparisonLocale})` and
`assertCertificationStatusOutput(result,raw,{comparisonLocale})`. Definitions
`CertificationStatusRequest/Input/Output`, ID
`urn:meri:retrieval:certification-status:0.2.0`. Raw input is closed
`{program:'fedramp',query:string}`; query trims only and must be nonblank. A new
declared private transport ceiling bounds strings without truncating selectors.

The exact wrapper uses default-locale lowercasing. Root allocated trusted
`comparisonLocale` context for deterministic locale-sensitive comparison;
canonical BCP47 admission, no ambient locale default. The source adapter must
qualify that this is its lookup locale. It grants neither source truth nor actor
authority. Reuse canonical inert snapshotOperationData, no copied client/parser,
legacy orchestration, status inference or parallel source registry.

Preserve no-match, ambiguous and single-record variants, searchedEntireDataset
and evidenceOfAbsence as source snapshot assertions only; no query/generatedAt
echo is invented. Preserve exact FedRAMP status/impact vocabularies, FR-digit
identity, names, nullable authorization date, agencies and marketplace provenance.
Candidate count describes matched source rows, with first10 returned; no inferred
global completeness or uniqueness. Validate observable query correlations only;
whole-dataset exact-ID precedence stays a qualified-adapter obligation when the
omitted dataset cannot establish it from this DTO.

Read immutable schema/type/policy/test/projection metadata at fd8765ec, verify
against observed4be13b0b, retain hashes without private bodies. The source live
HTTP fetch,15-second per-fetch abort,8MiB declared/actual body checks and one retry
are UNRUN. Do not import/execute the producer or fetch the marketplace. These
per-fetch properties do not establish a shared retry budget, physical cancellation
or streaming memory bound. Source descriptors remain unavailable/null/pending.

Focused local tests use a test-only Ajv compiler until root integration. Preserve
raw failures and exact source before repairs; use existing capture helper and
verify owned process exit. No DB/SQL/service/native/provider/model/cloud/security
or infrastructure action; local dependency copies only, no locks changed.

## Results

Implemented the approved private family with its final API/definitions above.
The schema owns exact source vocabularies, closed branch tuples and literal
snapshot markers/notes; one small validator owns inert admission, explicit
locale admission and observable selector/candidate correlations. No public
contract, registry/catalog, dependency/lock, existing source/test or other lane
changed. Root owns unavailable descriptor registration and context filtering.

### Exact trace and admission distinctions

Eight reference blobs at `fd8765ec01d292013758606204f2c9d886cd31c1` independently
match observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; hashes, bytes and paths
are in `reference-identities.json`. The wrapper3849–3900 establishes program/query
admission, exact ID precedence, candidate slicing and the three raw projections.
The client12–21/53–122 establishes record fields, FR-digit IDs, fixed marketplace
URL, parse refusal, timestamp serialization and HTTP boundaries. Its contract
test preserves the exact official strings and refusal/retry cases. The tool test
corroborates bounded ambiguity and unchanged exact-ID record strings. The
grounding status-provenance owner supplies six status/five impact literals; its
tests explicitly distinguish source assertions from verified evidence and require
authoritative complete coverage for negative claims. Legacy controller/roles
remain prerequisites, not new Meri authorization. No private body was published
and no reference implementation was imported, transpiled or executed.

- `program` must be exactly `fedramp`; there is no casefold/default/null alias.
  Query is a nonblank string after trim, with no legacy truncation. The new private
  1,048,576-code-point ceiling and canonical snapshot budget refuse excessive
  data instead of silently changing the selected product. Agencies have a new
  10,000-item transport ceiling, not a marketplace population/capacity claim.
- Context is an inert closed object with only `comparisonLocale`. Canonical BCP47
  spelling and runtime locale support are separate checks. Root explicitly
  approved refusing canonical-but-unsupported tags using
  `Intl.Collator.supportedLocalesOf(...,{localeMatcher:'lookup'})`. This is a new
  private admission restriction, not a legacy bug or proof that lowercasing uses
  any particular native locale. The adapter must qualify its effective case
  comparison against this declared context and runtime Unicode/ICU behavior;
  a display locale alone does not prove that equivalence. No ambient locale is
  inferred. Turkish dotted/dotless-I controls distinguish explicit contexts.
- Normalized input preserves trimmed query spelling. Result checks compare using
  the explicit locale. A single returned exact product ID need not match either
  name. Otherwise CSP or CSO name must match the query. An observable exact ID in
  an ambiguous page is refused; unseen dataset rows cannot prove global absence
  of an exact ID and remain an adapter responsibility.
- Ambiguity retains the full matched row count and exactly min(count,10) returned
  records, never auto-selecting a product. Source parsing has no ID deduplication,
  so duplicate product IDs are preserved. Names/agencies retain the parser's
  truthiness semantics: nonempty whitespace strings and duplicate agencies are
  not silently normalized. No relevance/sort or status/date relationship is
  invented. Unknown status/impact literals stay `Unknown`, not upgraded labels.
- One parsed response uses one observation timestamp. Returned ambiguous records
  must share it; dates must retain canonical ISO serialization. Authorization
  date remains nullable and no status relationship is derived from it. The fixed
  marketplace URL and timestamp validate producer projection only, not a signed
  retrieval, freshness or current certification proof.
- No-match preserves searchedEntireDataset/evidenceOfAbsence and exact source
  note as unverified assertions about the fetched snapshot. Its optional
  sourceUrl/observedAt are both present or both omitted because both come from the
  same first complete record; absent wire keys are not replaced by null or a
  fabricated clock. The normal pinned parser refuses an empty parsed dataset,
  so omission is not evidence that an empty live fetch successfully completed.
  No query/generatedAt, trusted subject, authority or verification flag is added.
- No-match, ambiguity and single record remain structurally exclusive. Client
  parse/fetch errors and bad selectors remain refusals, never successful
  evidence-of-absence responses. Shape admission cannot transform these source
  booleans into current/global negative authority or a dataset-completeness grant.

### Checks and preserved failure

The first local capture failed during test module initialization: a test-only
`URL` constant shadowed the global constructor used to locate the schema. No
assertion ran (0 passed/1 file failure). `initial-harness-failed-source/**` and
its hashes preserve all three exact new files plus the raw receipt/streams.
Renaming the fixture constant repaired that harness error; no production defect
was claimed. The separately approved supported-locale restriction and its control
were then added, and the repaired focused run passed30/30. PGIDs191818 and192133
were absent after captures, no timeout or kill required. Precommit tracked diff
hashes omit then-untracked files; exact snapshots and the final source commit bind
the evidence. Independent source review and exact-source replay follow.

A prospective final-line-terminator ID concern did not reproduce: the supplemental
ordinary-name-query control passed for LF, CR, CRLF and Unicode line separators
under the pinned Node regex behavior. All31 author controls passed unchanged;
PGID192769 was absent. This was a cross-regex-engine assumption, not a source
defect, and no production repair was made. Its exact passing receipt is retained.

### Remaining gates

Live HTTP, redirects, retries, body parsing and8MiB allocation are UNRUN. The
pinned client has a15-second abort per fetch, declared-size and post-arrayBuffer
actual-size checks, and one retry except known nonserver HTTP errors. This does
not prove a shared total retry budget, parent cancellation propagation, bounded
streaming allocation, physical cancellation or fresh release authority. Governed
egress, source integrity, full-dataset coverage, current actor authorization and
locale equivalence still require a qualified adapter. The descriptor stays
unavailable and source connectivity false. No provider/model, native/runtime,
SQL/DB, service/cloud or infrastructure action occurred; no G1 gate, deployment,
publication or inventory count change is claimed by this lane.

## Immutable author closeout

Source commit `fa59df3739a2c43310b86de416d2f455a8715dce`, tree
`6dcc5ddff9b5e04aa64fd084104eb168825c8dca`, passed31/31 on its exact-source
replay. PGID193759 was absent, without timeout or group kill. All6,001 original
Git file identities are unchanged; the three-file source SHA256 manifest matches
the committed source. Eight private reference identities match both pins.
Whitespace checks passed before source commit. Independent prefreeze26/26 passed;
final independent acceptance remains reviewer-owned. The metadata closeout changes
no tested production code or test assertion.

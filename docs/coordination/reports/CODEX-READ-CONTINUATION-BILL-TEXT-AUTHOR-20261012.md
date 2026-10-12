# Congressional bill search and text: author source qualification

Final source is `079c9fd8c88375f55d6f3d5cadd16763c98e63c7`, tree
`292208a5a5909a8be5713b8560673383ea635fcb`, based on
`01c75641b62bb586d130feda3468c0ddb4286e8f`. Independent reviewer
`698f545e0410bb5a9c72be8593375c70b76f796e` returns **ACCEPT_SOURCE** for
these exact bytes, with78/78 independent controls,45 metadata checks and54
preservation/capture checks. This acceptance does not activate a source or
qualify a runtime. Parent owns canonical registration and integration replay.

The four new owned files separate closed JSON shapes, domain assertions,
continuation decoding and focused tests. One shared identity helper is reused
without edits: original owner commit `621346846aeb7920bde674b6ce217df76942ced4`,
local cherry-pick `03db5092332f61d4e9c509d14957be35ed122173`. Its independent
source acceptance is recorded by its own owner. The existing bounded inert
`snapshotOperationData` admission is reused; there is no copied legacy service,
search algorithm, SQL, tokenizer, generic JSON walker or production compiler.

## Interface and trusted selection

`createBillTextValidators({validateShape,schema})` returns `billTextSchemaId`,
`BILL_TEXT_OPERATION_IDS`, `billTextInputDefinition`,
`billTextOutputDefinition`, `normalizeBillTextInput`,
`validateBillTextShape`, and `assertBillTextOutput`. Schema ID is
`urn:meri:retrieval:bill-text:0.2.0`. The operation/definition pairs are:

| Operation | Input/output definition stem |
| --- | --- |
| `search_congress_bills` | `CongressBillSearch` |
| `read_bill_text` | `BillTextRead` |

Both operations require separate trusted `contextKeys:['defaultCongress']`:
a positive Int32, never inferred from an ambient clock or model argument.
Normalization returns frozen effective `input` and `metadata`; the canonical
resolver owns immutable original request and digest. Assertion takes the
original request and same context. Metadata explicitly denies authority,
source connectivity, producer qualification, absence evidence and current
pointer qualification. Strict Ajv compilation is a test seam only.

Search preserves query then search-alias fallback, trim and UTF-16 caps:
query/search240, policyArea120, activeSince30 and textQuery300. Page defaults1,
limit defaults20 for metadata or8 for text search; admitted limits1..50 become
at most10 for text search. Congress zero/null is absent; signed Int32 values
otherwise remain explicit. Read resolves the trimmed/capped60-unit bill
selector through the shared helper; versionCode32 and query300 are optional.
A nonblank locator query and cursor conflict. Typed numeric admission refuses
legacy numeric-string, boolean, fractional, nonfinite and clamp-only values;
this is not full legacy coercion equivalence.

## Preserved result meanings and limitations

- Metadata returns all stored CongressBill scalar columns, including nullable
  dates/text/JSON, without ORM relations. Count and rows are separate observations;
  count can be smaller than returned rows. Direct designation success has one
  exact row, total1/page1 and source `resolvedBy`, and preserves the source's
  ignored metadata filters. A designation miss may use metadata fallback.
  Fallback checks page/limit, Congress, non-null descending updateDate subsequence
  and activeSince against **latestActionDate**, not updateDate. Matching,
  collation, nullable ordering and source visibility remain adapter obligations.
- Text search retains its distinct result envelope, exact disclosures, returned
  count, separate totalBills and omitted count. Paging uses the original listed
  count before response trimming, reconstructed from returned plus omitted.
  The producer can remove extra passages before dropping groups. Group version
  belongs to the first row; other passages may carry a different version's
  cursor. No unsupported group-wide version equality is imposed. Snippets
  preserve normalized whitespace; zero-offset readCursor is null.
- No-current-complete-revision is an explicit unavailable read outcome with
  exact requested version/disclosure/coverage. It does not prove that Congress
  has no such text, that a provider is fresh, or that access is authorized.
- Sequential reads bind bill/version/revision/hash and UTF-16 offsets, a9000-unit
  page with the source's possible nonfinal surrogate adjustment, exact next
  cursor and coverage relationships. A final resumed page remains truncated;
  complete/pageComplete is not a claim that a single resumed page contains the
  whole bill. Valid source-issued continued and terminal pages remain admitted.
- Locator reads preserve at most6 passages of at most1000 UTF-16 units each,
  nonoverlapping source order, query/matched-term relationships, exact rendered
  framing and per-passage cursors. Locator coverage remains incomplete with
  no top-level continuation cursor. The validator does not recompute matching,
  rank, headings, original text or full-corpus coverage.

Cursor decoding preserves canonical byte-to-base64url round-trip and the
source's JSON tuple syntax, including valid whitespace within tuple JSON. It
requires the exact v4 UUID/lowercase64 hash/safe offset1..30000000 source
cursor grammar, at most1024 characters. Output stored revision IDs are general
UUIDs, including nil and non-v4: Prisma/migration impose UUID storage, not a
version predicate. A first terminal/zero-offset result therefore need not
satisfy the separate continuation grammar. Lowercase64 output hashes follow
the immutable writer's SHA-256 hexadecimal convention; CHAR64 storage alone
neither enforces that convention nor proves current-row provenance.

Explicit compatibility boundaries are retained:

1. Text-search output admission refuses JSON.stringify results beyond10500
   UTF-16 characters, including a possible single oversized producer result.
   This ceiling is a fail-closed contract limit, not a claim that the producer
   always meets it.
2. Continued output version must equal the tuple version even when the caller
   omitted versionCode. This parent-approved constraint refuses forged version
   substitutions that the legacy revision selection did not independently bind.
3. Successful metadata fallback activeSince admits ISO dates or explicit-zone
   date-times using existing Ajv formats. Legacy prose and zone-less dates are
   deliberately refused. Direct and text-search ignored-filter behavior remains
   unchanged; there is no host-timezone or ambient-clock fallback.
4. Output date-time admission uses canonical comparable four-digit JSON dates;
   stored date-only columns require UTC midnight. Broader Date ranges and
   arbitrary database mutations are not claimed as compatible wire values.

## Evidence and repairs

Ten directly relevant source/model/helper/test/policy/hash-writer references
are pinned at `fd8765ec01d292013758606204f2c9d886cd31c1` and compared with
observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; all ten identities match.
`reference-identities.json` records paths, blob IDs, sizes, hashes and locators,
without private source bodies. Hash writer observations are restricted to
persistence.ts95-96/427-428; no legacy persistence implementation is imported.
Original `outline.json` precedes source implementation; later source and
compatibility decisions are recorded here and in `results.json`.

| Preserved check | Actual result |
| --- | --- |
| Initial focused source | 24/24 pass at initial candidate patch |
| Author selector counterexamples | 24 pass/2 fail at0bdd1ce plus appended tests |
| Selector repair7caaac3 | 26/26 pass; full954/954 pass |
| Approved ISO-date counterexample | 26 pass/1 fail before date repair |
| Date repair4980080 | 27/27 pass; full955/955 pass |
| General stored UUID positive counterexample | 27 pass/1 fail before UUID repair |
| Final UUID repair079c9fd8 | 28/28 focused pass, exact patch bound to final commit |
| Independent final review | 78/78 pass; separate reviewer retains its original failures/corrections |
| Initial full source/public distribution | 952/952; generated/type checks and7/7 public tests pass |
| Final broad integration replay | Parent-owned; full955 predates the narrow UUID repair |
| Runtime/SQL/provider/source execution | UNRUN |

The two selector fixes correlate already accepted output branches with their
actual selectors. The date change implements the explicitly approved narrower
wire admission. The UUID fix removes an unjustified output-v4 assumption while
preserving source cursor-v4 admission. All original24 test bodies are unchanged;
four regressions were appended. Earlier commits, raw failures and exact patches
remain available. No failure was normalized into a pass receipt. Full evidence whitespace checking
reports four preserved patch context-line spaces (exit2, raw550-byte result
retained). Source whitespace passes; those source-bound raw patches are not
normalized to silence the evidence-only check.

All eleven source check captures used the unchanged120-second Linux subreaper,
restricted to each newly owned process group. Receipts retain exact command,
head/diff hashes, output bytes and exit. Every owned group is absent, no timeout
or group kill occurred, and nine exited descendants were reaped. Root-supplied
physical dependencies remain untouched; no install, lifecycle script, service,
SDK, browser, renderer, database, model, provider or cloud execution occurred.
Final packet verification is ordinary local stdlib work, not a runtime gate.

All5651 original Git blobs remain unchanged. Only four allocated family/test
files and the separately owned shared helper are new source paths. Public0.1,
canonical catalog/loader, locks, existing tests, proxy, worker, runtime, frontend
and infrastructure remain unchanged. Root owns reviewed unavailable/null/pending
bindings and the139/96/43 ledger; these contracts alone do not reduce its unmapped
count. Current authorization, immutable source/current-pointer binding, budget,
retention/release and live producer qualification remain required before use.

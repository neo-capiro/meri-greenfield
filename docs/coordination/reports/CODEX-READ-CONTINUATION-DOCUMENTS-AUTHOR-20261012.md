# Client document contracts — author result

Source freeze `6e37343f7289ed8374b722d638f5d6e467f9808a`, based on
`e94865529c5a1e97c79893527895f0b4b73be35f`, branch
`task/meri-client-documents-20261012`. Independent source acceptance remains
separate. This work creates no source connection, extractor or runtime approval.

## Implemented boundary

New private `client-documents.schema.json` and
`client-documents-validation.mjs` describe the selected `read_client_documents`
operation's list and read modes. The module reuses canonical
`snapshotOperationData` and injects the one loader's `validateShape`,
`assertSubject` and `canonicalSha256`. Importing it starts no work or IO.
No shared loader, registry, catalog, original test, public export, lock or
runtime/native source was edited. Root owns canonical integration.

Factory: `createClientDocumentsValidators({validateShape, assertSubject,
canonicalSha256})`. Its functions are `normalizeClientDocumentsInput(raw,
options)` and `assertClientDocumentsResult(page, rawRequest, options)`.
Options contain exactly the existing canonical `binding` and `subject`; the
subject must be a selected client with canonical actor/tenant agreement. Raw
`clientId` is required and must match it. Caller-supplied JSON cannot establish
that these facts are trusted or current.

Schema ID: `urn:meri:retrieval:client-documents:0.2.0`.
Registered definition names are `ClientDocumentsInput`,
`ClientDocumentsSelection` and `ClientDocumentsResult`. The normalized selection
contains `mode`, `clientId`, nullable `documentId`, `query`, `section`,
`characterOffset`, `limit`, nullable `cursor`, nullable decoded `cursorBinding`
and nullable `listAfter`. List defaults to 25 files (maximum 50); read defaults
to 5,000 UTF-16 code units (maximum 6,000). Section defaults to 1 and offset to 0.
Numeric nullish defaults follow the pinned parser; optional text null/blank
refuses. UTF-16 text-selector bounds are checked explicitly rather than relying
on JSON Schema's Unicode code point lengths.

Results use a **new Meri** `{binding, subject, data}` wrapper, not alleged legacy
wire fields. Data is the exact list or read projection. List results retain
filename-query scope, counts, continuation, readiness and extraction metadata.
Read results retain document/section/range identities, text, provenance, hashes,
readability, extraction truncation and continuation disclosures. Mode mismatch,
unknown structural fields, foreign lineage and inconsistent correlations refuse.

Read cursors are closed version-1 records correlated with document, client,
content hash, query, section, offset and optional section hash. Same-section
continuation keeps the section hash; next-section continuation resets offset
and omits that hash. List cursors encode an identity only; they do **not** bind
query, client, snapshot or a grant cryptographically. Every use still requires
current source authority. The contract does not sign, authenticate or issue
cursors, read bytes, search files or reproduce the legacy reader.

UTF-16 range lengths and returned reference IDs are checked, as is the 6,500
serialized-JavaScript-character text ceiling. A fully returned section permits
recomputing its reported section hash; a partial section does not expose the
unseen body needed to verify that hash. Original-byte `contentHash` is a
reported binding value, not something this contract can authenticate without
the source bytes. Zero-record results similarly do not expose every section
hash or the extraction source variant; only disclosed fields can be correlated.

## Frozen references and policy limits

[Source references](../../qualification/candidates/read-continuation-20261012/documents-author/source-references.json)
record exact paths, Git blobs, byte counts and SHA256s for 12 immutable files at
`fd8765ec01d292013758606204f2c9d886cd31c1`. All are unchanged at observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Private bodies were not published,
imported or executed. Only type/policy/contract-test and narrow output/default
projection observations informed this independently written contract.

- `meri-document-read.helpers.ts` establishes input/cursor declarations and
  output range, hash, paging, search and completeness fields; its tests retain
  late text, empty PDF, physical sections, query scope and changed-source cases.
- `meri-tools.service.ts` supplies the advertised input and actual list
  projection, current client visibility and ethical-wall checks.
  `meri-tools.firmdata.spec.ts` covers owner refusal, file metadata pagination
  and wall revocation before cursor use.
- `engagement.service.ts` supplies current parent/client/viewer access,
  nonsuperseded version/readiness checks and the extraction projection. The
  document-read tests cover current access, malware, server byte hash, scan
  disclosure, cancellation and blank-section versus whole-file metadata.
- `AttachmentTextSection`, `DocumentReadability` and `ReadinessVerdict` close
  source/section kinds, optional spreadsheet coordinates, readability states
  and all blocked-reason machine codes. Section and PDF tests characterize
  late sections, row coordinates, partial output and credential/cache isolation.

**Actual source behavior has additional effects.** The pinned extraction owner
can invoke an OpenAI PDF visual fallback and writes extraction outcomes. The
list owner can also construct authorized download/preview URLs internally,
although this selected result projection excludes them. Read-only user intent
does not authorize provider calls or state writes. None occur in this pure
contract, and an eventual adapter needs explicit side-effect admission and
qualification before enabling the operation.

Client walls, parent/viewer ACLs, current version, scan/readiness, byte hashes,
source freshness and release-time currentness remain source/gateway owner
obligations. Metadata may report a usable but unscanned attachment with a
disclosure; usability does not establish clean scanning. Listing files does not
read their contents. Complete extracted text does not establish visual/diagram
coverage, source authenticity or global absence. PDF unreadability stops
automatic continuation, retains the gap and may identify a next explicit page;
a no-match result applies only to the searched section.

Opaque extraction metadata remains bounded inert JSON because the list's
persisted JSON and helper's `unknown` metadata are not universally one DTO.
When section-read metadata is present, its declared range/readability fields
must agree with coverage. No opaque nested claim becomes authorization.

Meri intentionally closes unknown structural fields, strictly admits inert JSON,
requires finite timestamps/safe integers, applies private transport ceilings
and rejects malformed/non-base64url cursor encodings. These are explicit Meri
admission limits, not identical backend maximum-size or cursor-security claims.
Reported search matches additionally require a returned record containing the
literal query case-insensitively. Independent arithmetic shows a legacy Unicode
edge: lowercasing `İ` expands its length, so applying a lowercased index to the
original text can produce a claimed match whose returned slice lacks the query.
The new contract refuses that false evidence rather than claiming the frozen
producer universally guaranteed this relation. No Capiro code was run to
characterize this edge.

## Checks and preserved failures

- Initial focused capture: **23/24 PASS, 1 FAIL**. Unqueried text could exceed
  a small requested limit because the 240-character query-context allowance
  was applied even without a query. Exact initial schema/module/test snapshots
  and raw streams remain under `documents-author/initial-source/` and
  `documents-initial.*`. The narrow fix applies that allowance only to queries.
- Excerpt repair: **24/24 PASS**. Initial owned group 146345 and repair group
  146520 are absent; no timeout or kill was needed.
- Independent prefreeze query controls: **22/24 PASS, 2 FAIL**. The candidate
  accepted a reported match without matching returned text, or with no record.
  Reviewer's `query-controls.*` and exact source hashes retain those failures.
  Both correlations were repaired, with focused negative controls and the
  Unicode characterization above. Source inspection also tightened empty versus
  readable status and PDF-method/source consistency; no unobserved runtime
  failure is claimed for those inspection refinements.
- Revised focused suite: **27/27 PASS**, owned group 147892 absent, no timeout
  or kill. It uses a test-only pinned Ajv compiler while root registration is
  pending. Exact committed-source replay is recorded in `documents-exact-freeze.*`.

The initial captures' Git diff field omits then-untracked new files; the initial
failure snapshot and final committed source identities bound the evidence.
Root integration, independent review, existing-source preservation and canonical
unavailable dispatch checks remain separate. All actual source/extractor,
provider, database, native runtime and release qualification checks are UNRUN.
No mapping or passing synthetic check enables connectivity or closes G1.

Exact committed-source replay: **27/27 PASS**, exit 0, no timeout; group
**149014 absent**. `source-freeze.json` records all **5267/5267**
original tracked files unchanged, plus exact new source hashes. Source/document
whitespace checks passed. Independent review has not yet been claimed here.

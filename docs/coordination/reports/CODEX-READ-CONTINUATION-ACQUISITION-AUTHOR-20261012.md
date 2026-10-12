# Acquisition-personnel read contracts: author source qualification

Final source is `fbe72ed67b953a991f590ed40767e27c17ee114b`, tree
`a0d9132e46baf413f36441b2fe8d0c6c1797e43d`, based on
`ec960fa92ad01836a5df8f6220e67a88a657eab1`. It adds two closed private read
contracts and their tests without editing an existing source file. Initial
source `2a35e072d13fe93e3b57a9d47544df472cdcd8d4` and the independent alias
failure remain preserved. Source validation does not activate either operation.

## Explicit current-policy scope

Inventory identity remains Capiro `fd8765ec01d292013758606204f2c9d886cd31c1`.
The root explicitly authorized the **producer and privacy projection** at
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace` after three of eight relevant
references were found to have drifted: the read owner and both DTOs. The
historical owner passed detail metadata through unchanged. The current owner
adds role-gated contact fields and removes two metadata containers for non-admin
callers. This change is recorded in metadata-only `observed-drift.json`; no
private implementation bodies are retained. Original `outline.json` remains
unchanged, followed by `scope-revision-current-policy.json` with the explicit
scope correction. No previously accepted acquisition contract was replaced.

The current projection requires trusted `actorRole` context for **both**
`search_acquisition_personnel` and `get_acquisition_person`. Only exact
`capiro_admin` may receive non-null top-level `email`, `phone`, `parentOffice`,
or `department`; other declared TenantRole values require null. These are
privacy projection constraints, not permission to call the service. Existing
current identity, membership, route role minimum, request-active checks and
source authorization must still be established and rechecked by the trusted
execution owner. In particular, accepting a known role's shape does not grant
that role route access.

Non-admin detail **object** metadata must omit the top-level keys
`uploadedDirectoryContact` and `uploadedDirectoryPrevious`, including keys
whose value is null. Arrays, primitives and null retain the source's passthrough
semantics; nested and source-mention metadata are not recursively redacted.
Admin detail keeps opaque metadata, and the three uploaded contact projections
must equal its trimmed nonempty string values or null. Stored email remains
nullable text without a guessed formatting rule. List `headshotUrl` is opaque
inert JSON because the producer's TypeScript cast performs no value-type check.
These boundaries are not a universal PII, URL-safety or contact-use guarantee.

## Interfaces, inputs and result meaning

`createAcquisitionPersonnelValidators({validateShape,schema})` exports a factory
result containing `acquisitionPersonnelSchemaId`,
`ACQUISITION_PERSONNEL_OPERATION_IDS`,
`acquisitionPersonnelInputDefinition`, `acquisitionPersonnelOutputDefinition`,
`normalizeAcquisitionPersonnelInput`, `validateAcquisitionPersonnelShape`, and
`assertAcquisitionPersonnelOutput`. Schema ID is
`urn:meri:retrieval:acquisition-personnel:0.2.0`; definition pairs are
`AcquisitionPersonnelSearchInput/Output` and `AcquisitionPersonDetailInput/Output`.
Normalization and output assertion accept the separate `{actorRole}` context;
both canonical bindings require `contextKeys:['actorRole']`. Output assertion
also receives the immutable original request. Root owns those shared bindings.

The unchanged canonical `snapshotOperationData` handles inert JSON admission.
There is no second JSON walker or production schema compiler. Strict Ajv is a
test seam, and tests exercise the actual canonical operation resolver for
original-request preservation, effective selection digests and context filtering.
Normalization metadata explicitly denies authority, connectivity, producer
qualification, current authority qualification and absence evidence.

- Search keeps `query` and established `q` fallback: a nonblank query wins,
  otherwise q is used; null/empty/blank selectors are absent. The effective
  input drops q. Strings use source trim and UTF-16 caps: query/q240,
  service60, organization200, role60 and peCode32. The owner's final trim of
  the fuzzy selector is preserved. Equal query/alias selections have one
  canonical digest. No `sort`, `pe_aligned`, `include_superseded`, `pe_code`,
  actor or tenant arguments are exposed.
- Limits are strict integers1..50/default20 and pages1..100/default1. Numeric
  strings, nonfinite values, fractions, booleans, null and clamp-only values
  refuse. Other optional string selectors are string-only; null/non-string
  fallback compatibility is deliberately limited to query/q. These typed
  boundaries do not claim full legacy coercion equivalence.
- Successful detail input is the trimmed/capped required string constrained by
  the stored UUID identity, normalized to lowercase. Nil and arbitrary UUID
  version/variant hex groups remain valid. Output identity compares that actual
  UUID identity, including uppercase request/lowercase stored equivalence.
  Invalid UUID source-error paths are refused at input admission. There is no
  successful `person:null` branch: source not-found is an exception.
- Search total with an effective query is the length of the already paged fuzzy
  candidate ID list before remaining filters. Returned rows may be fewer; total
  cannot exceed limit or be smaller than returned rows. Without a query, count
  and rows are separate observations and total may be smaller than returned.
  Neither total proves corpus completeness, hasMore, or terminal absence.
- Service/role/PE exact selectors and page/limit echoes are checked. Fuzzy name
  matching, organization collation, soft-superseded exclusion and row ranking
  remain source-adapter obligations. Personnel role is not caller role.
- Detail sources retain the complete producer array without an invented50-row
  cap, ordered by observedAt descending with unique UUIDs. Canonical resource
  budgets may reject oversize results; there is no fabricated truncation page.
  Finite float confidence has no invented0..1 bound, nor is firstSeen<=lastSeen
  asserted. Timestamp wire admission requires canonical comparable four-digit
  JSON/RFC3339 dates; broader historical Date ranges are not claimed.

Both source reads await unconditional `auditLog.create` inside `withTenant`.
Detail audits even a missing lookup before its outer not-found exception. Audit
failures propagate; these are not effect-free adapter calls. Contract validation
neither writes audit records nor proves transaction, current-role, budget,
retry/error, or release behavior. Those execution dependencies remain HOLD.

## Verification and preserved failure

Independent review found the initial schema omitted the established `q` alias.
The root confirmed that narrowing had not been approved. Repair `fbe72ed` admits
the closed typed alias and exact precedence/fallback, adds a regression, and
replaces the old alias-negative assertion with a truly unsupported-selector
negative. Original test bytes remain in the initial commit and archived patch;
reviewer raw20-pass/1-fail evidence remains under its separate ownership.
No privacy control was relaxed to repair this compatibility failure.

| Check | Actual result |
| --- | --- |
| Initial focused source | 26/26 pass, before independent alias failure |
| Repaired focused source | 27/27 pass |
| Initial full source checks | 851/851 pass |
| Repaired full source checks | 852/852 pass at clean repaired source freeze |
| Public distribution at initial source | Generated/type checks pass; 7/7 pass; public bytes unchanged by repair |
| Independent repaired controls | Original21/21 and expanded25/25 pass; separate reviewer owns final acceptance |
| Source and complete evidence whitespace | Pass, including preserved raw patch bytes |
| Preservation | All5544 original Git blobs unchanged; exactly3 new source/test files |
| Reference identities | Eight exact reference pairs; three material current drift entries retained |
| Native/source/SQL/audit/provider execution | UNRUN |

Every source check used the unchanged Linux child-subreaper helper, bounded to
120 seconds and restricted to its owned process group. Raw outputs, staged
patch hashes and source identities are retained. Existing supplied physical
dependencies remain untouched, with no install or lifecycle script. The final
capture receipts confirm every owned process group absent, no timeout or group
kill, and seven exited descendants reaped across the broader checks. Failures
remain visible without inferring acceptance from an exit code alone. No unowned process or resource was touched.

Public0.1, shared registry/loader, original tests, locks, runtime, proxy, worker,
frontend and infrastructure remain unchanged. Root owns reviewed canonical
unavailable/null/pending registration and the139/96/43 ledger. These two source
contracts do not close current authorization, audit, source connectivity, G1
runtime or later gates.

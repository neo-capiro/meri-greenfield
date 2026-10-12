# Five funding reads: independent review

**ACCEPT_SOURCE** at repaired author commit
`256248fee5be45e5f203bbc74cc5b0c0e2f738f7`, tree
`53800b1b138121dcc39971bad722c8da94cbfc30`. This accepts the five standalone
private contracts, not canonical registration, producer connectivity, current
policy, result release or runtime qualification.
The final author evidence packet is
`09bab225cbfe55c24cb40ea79e9578ba72799e40`; all 42 manifest members were
independently hash-verified. Its manifest SHA256 is
`271262e7e9d2e5d19fecdecfe6dea4024760d89ad620dbb7bf06a78d8cfa9dd2`.

The isolated reviewer branch is `review/meri-funding-reads-20261012`, based on
`e94865529c5a1e97c79893527895f0b4b73be35f`. Criteria were frozen at
`f87516a14c3bfd2850588912d693a5bbc3719089` before author source inspection.
Reviewer changes are limited to the new independent test, this report and
[`funding-review/`](../../qualification/candidates/read-continuation-20261012/funding-review/).
The exact author commits are retained in review ancestry; no reviewer production
edit occurred.

## Findings and repairs

Two independent source counterexamples required author repairs:

1. At initial source `c7e6b15ecd99f5a185cb3826f9b471d2438854c8`, a short
   requirements page could assert another page without either an extra fetched
   row or a larger known total. Returned 1 / limit 10 / total null, 0 or 1 /
   hasMore true / nextOffset 1 was incorrectly accepted. The actual producer's
   retained short page excludes its extra-row branch. Repair
   `19bfb022a40e635215c182b5f6d754682cd1d2f6` requires a supporting larger
   count for short-page continuation. Full pages retain valid stale/null totals;
   exhausted empty pages can remain available when a separate total is positive.
2. The initial source accepted an available SAM landscape for a non-UUID record
   identifier. The actual composer validates the trimmed UUID before source
   ports; the adapter reports invalid_request on failure. Repair `256248fee`
   applies the existing hex-group UUID grammar through a named private schema
   definition only on the available landscape path. Refusal envelopes remain
   admissible; uppercase and whitespace behavior is preserved without new UUID
   version/variant restrictions.

Both failing controls are unchanged in the final 49-test replay. The source
repair changes only two additive validator guards and one named schema
constraint. Author regressions were appended. Its earlier stale-total positive
fixture now contains a full 10-row page, retaining the assertions and original
failure-era file in Git. The schema hash assertion changed to the new bytes.
All other initial author test lines remain identical.

The first independent replay also had five reviewer-fixture failures: a generic
denial explanation conflicted with the producer's nondisclosing denial text.
Only the positive fixture was corrected, and an explicit client-disclosure
negative was added. These are separate from the two production defects.

## Pinned producer and policy trace

The reference receipt independently binds 22 paths at Capiro
`fd8765ec01d292013758606204f2c9d886cd31c1`; all match observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. It records locators, blob IDs,
byte lengths and SHA256s, without private bodies. Read-only type/AST inspection
covered the adapter, v2 query/detail and legacy projections, requirements read
and artifact rules, landscape composition/types, client visibility, feature
flags, document text state, source identity, recommendation/acquisition types,
shared v2 criteria/freshness/workflow and deadline owners. No producer executed.

- All five operations retain distinct closed input/output pairs and the six
  actual envelope states. Refusal data stays null; denial does not disclose
  client existence. The 24,000 serialized JSON-character ceiling measures
  JavaScript UTF-16 units, including astral characters.
- Required trusted `asOf` is canonical ISO and echoed exactly. It is neither a
  model argument nor evidence of current grants. Search generation time belongs
  to a separate source clock and is not forced to equal this observation time.
- Search preserves the five-row cap, raw query limit before trimming and
  effective page clamp: the adapter admits up to 100,000, while the shared query
  normalizer caps the effective page at 10,000. Criteria cannot add filters.
  Nullable/capped totals and partial source health do not establish absence.
- Detail summary ranges count UTF-16 and clamp an offset beyond the end to the
  full text length. Record/client identities, source-update echoes and disclosed
  missing fields remain bound. Program funding, per-award bounds and contract
  estimates remain distinct. Unknown contract value is not silently zero.
  Declared DTO compatibility is broader than every currently reachable v2 row;
  this does not qualify nonnull recommendation/acquisition data as a live result.
- Requirements preserve quoted spans, paging, nullable attachment provenance,
  rejected/superseded rows and separate tenant review statuses. The read DTO's
  type/method/confidence fields remain strings rather than the extractor's
  narrower enums. SQL ordering is source-owned; no id-only ordering or snapshot
  consistency is invented. Counts and rows may race. Shape/span validity cannot
  verify document text, current mandatory conditions, or approval authority.
- Client context keeps nullable broad counts and separate five-row top lists.
  Deadline statistics describe its sampled rows. Legacy decision audit fields
  remain nullable; no new human decision or machine recommendation is inferred.
- Landscape retains all 11 declared source reports, three wired sources,
  pre-truncation item counts, the 40-row slice and the original full-packet
  fingerprint. The fingerprint is not recomputed from the slice or authenticated
  by shape validation. Inference, unavailable wiring and source-backed reports
  retain their distinct meanings.

Current role, tenant and visible-client checks, nonarchived clients with active profiles,
wall grants, funding flags, matched-record visibility and the documents feature
remain server/source-adapter prerequisites. Their source declarations do not
prove their live enforcement here. Landscape data omits the requested record
identity; no absent lineage is fabricated. A qualified adapter must retain that
binding before release. The standalone assertion validates an inert snapshot
and returns the original object; immutable result transport belongs to the
canonical resolver/gateway integration.

## Verification and preservation

| Check | Result |
| --- | --- |
| Initial independent replay | 34 pass / 5 reviewer-fixture failures, retained |
| Corrected fixture plus expanded controls | 47/47 pass |
| Short requirements counterexample | 47 pass / 1 source failure, retained |
| Added invalid landscape identity | 47 pass / 2 source failures, retained |
| Exact repaired independent replay | **49/49 pass** |
| Exact repaired full source suite | **585/585 pass**, no skips |
| Exact repaired public distribution | generated check, types, **7/7 pass** |
| Source/receipt preservation audit | **35/35 pass** |
| Final author packet member verification | **42/42 pass** |

All 5,267 original base paths remain byte-identical. The family adds exactly its
five allocated files. Original tests, prior descriptors, catalog/loader, public
0.1 distribution and dependencies/locks are unchanged. Schema SHA256 is
`0d31594c3aaecd707da722cfb8cd951e7f42802c13c86805aaedb9397dc9d56b`;
all five source hashes are recorded in `source-preservation.json`.

Raw failures and initial successful broad checks remain alongside final receipts.
The author also preserves its strict-required compiler failure and exact source
patch. Its whole-evidence whitespace failure is attributable to retained raw
patch context; its authored source/metadata check passed. Neither raw patch nor
failure output was normalized away.
Stderr contains retained npm update notices, not failed tests. Every owned check
process group was confirmed absent without timeout or kill; the final full and
public checks reaped two and three exited descendants respectively. Prepared
physical dependencies were left untouched; no installation ran.

## Remaining gates

Root owns canonical loader/catalog/binding/resolver/gateway composition and its
independent integrated review. This isolated freeze changes no 139-original /
96-selected / 43-deferred accounting, nor the current 20 mapped unavailable /
76 unmapped originals. The partial client-action binding remains separate.

Source/current-authority adapters, client/document entitlement enforcement,
source freshness and attribution, provider semantics, budgets, cancellation,
result release and actual runtime remain unqualified. No private producer,
customer read, provider/model, database/service, native fixture, worker/proxy,
cloud/image or frontend action ran. All handlers/connectivity remain unavailable;
G1 stays OPEN and G2–G7 unentered. The approved memory administrator exception
remains settled and unrelated to funding authority.

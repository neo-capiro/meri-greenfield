# Independent acquisition-personnel review

**ACCEPT_SOURCE** for `fbe72ed67b953a991f590ed40767e27c17ee114b`, tree
`a0d9132e46baf413f36441b2fe8d0c6c1797e43d`, including the narrow query-alias
repair over initial `2a35e072d13fe93e3b57a9d47544df472cdcd8d4`. Final author
packet `bf212799ce1c601c361577aaf5af7ac48ec4db73` independently verifies 31/31
manifest members. Source acceptance does not qualify current authority, audit
writes, source access or runtime.

Review base is `ec960fa92ad01836a5df8f6220e67a88a657eab1`. Initial source criteria
were frozen in `11172f7381256726e113ea1818c279a47ac8b914`; the explicit current
privacy revision in `a5d7f9c385c8c043cf616e13ac3bf539050456ca`; independent tests
in `7a58c323cfa22a1d2b97d7296cba1f9346366316`. Both criteria versions and all
original tests/failures remain in ancestry. The reviewer authored no production
repair and touched only its allocated new test/report/evidence paths.

## Current projection and authority boundary

The original inventory identity remains Capiro
`fd8765ec01d292013758606204f2c9d886cd31c1`. The read owner and both DTO files
have material changes at observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`.
Root explicitly revised the projection/privacy scope before source acceptance.
This is not an assertion that frozen and observed source were equivalent.

Eight paired reference identities were independently hashed, with exactly three
changes; an additional direct-controller reference was independently read and
is unchanged. Locators, sizes and hashes are in `reference-identities.json`,
`current-reference-identities.json` and `supplemental-controller-reference.json`.
Reviewed source includes both Meri projections, actual list/detail owner,
current upload/redaction helpers, both DTOs, Prisma models, shared TenantRole,
Meri/direct-controller guards and RolesGuard. No private bodies or personal
paths were retained and no legacy producer was imported or executed.

Both operations require separate trusted `actorRole` context. Only exact
`capiro_admin` permits non-null top-level stored email or uploaded phone,
parentOffice and department. Every other declared role requires all four null.
A personnel-role search selector confers no caller privilege. Known-role shape
admission does not grant route access: existing context, membership, minimum
role/request-control and source authorization remain external prerequisites.
The canonical resolver test verifies that an admin-normalized request cannot
release contact values when output is checked with a current non-admin role.
The context is excluded from model arguments, not taken from their claims.

Non-admin detail object metadata excludes exactly the top-level
`uploadedDirectoryContact` and `uploadedDirectoryPrevious` keys, even if their
values are null, false, empty or arrays. The actual current helper preserves
nonobject metadata, arrays, nested same-name keys and source-mention metadata.
The contract preserves that shallow behavior rather than claiming recursive
redaction or universal removal of contact information. Admin detail retains
opaque metadata and correlates uploaded contact projections with trimmed
nonempty strings or null. Stored email has no invented formatting constraint.

List headshotUrl remains inert arbitrary JSON: the actual producer performs a
TypeScript cast, not a runtime scalar check. Contact-looking values inside that
opaque field are not proof of permission or privacy. Detail has no top-level
headshot field. Unchanged canonical `snapshotOperationData` rejects hooks,
proxies, cycles, unsupported primitives and oversized structures before domain
inspection. No parallel JSON walker, source client or production compiler was
introduced. The schema and one cohesive family validator remain separate.

## Preserved source semantics

- Query has precedence only when nonblank; otherwise q supplies the effective
  fuzzy selector. Both admit string/null, omit blank/null pairs and collapse to
  one normalized query/digest. Source trim/UTF-16 caps and the owner's additional
  fuzzy trim are preserved. Other optional selectors remain strict strings;
  full legacy coercion equivalence is not claimed.
- Limits/pages use declared strict numeric ranges/defaults. Exact service,
  personnel role, PE primary-or-secondary and echoed page/limit are bound.
  Organization collation, fuzzy ranking and soft-superseded filtering remain
  adapter obligations; hidden owner-only selectors are not exposed.
- Fuzzy total counts the already paged candidate IDs before remaining filters,
  so rows may be fewer, total cannot exceed limit and cannot be below rows.
  Without a query, independent concurrent count/row reads may disagree. No
  total, empty page or absent continuation proves universe completeness.
- UUID admission preserves PostgreSQL hex identity without invented
  version/variant constraints, including nil and uppercase-request/lowercase
  stored equivalence. Detail must match the requested identity; person:null is
  not a successful source branch.
- Nullable stored fields, arbitrary reported status and finite Float confidence
  remain distinct. No 0..1 confidence or firstSeen<=lastSeen rule is invented.
  Timestamp admission uses finite canonical four-digit JSON date-time strings;
  extended historical JavaScript Date ranges are not claimed.
- Detail source arrays retain the unpaged producer projection and descending
  observedAt/unique-UUID constraints. The independent 51-source positive case
  prevents a fabricated 50-row cap. Canonical data/output budgets may refuse
  oversize results; no truncated/completeness envelope is invented.

Both source owner paths await unconditional auditLog.create inside withTenant,
without local error suppression. Detail also audits a missing lookup before the
outer not-found exception. These effects were established by source inspection,
not by executing SQL or claiming successful auditing. A schema cannot replace,
waive or qualify the audit write, transaction semantics, current-role check,
budget, retry/error behavior or result-release decision.

## Independent failure, repair and checks

Initial immutable source omitted the established q alias. The independently
frozen control failed with an additional-property refusal: **20PASS/1FAIL**.
Root confirmed that narrowing was not approved. Author repair admits typed
query/q precedence and null/blank fallback without changing privacy checks.
The unchanged 21 controls then passed; four added controls exercise nullable
alias/count semantics, nested hostile metadata and the real canonical resolver.

The initial source, raw failure and test prefix remain preserved. Inverse audit
recovers the entire initial validator/schema after removing only the alias
repair. Initial author test bytes recover after removing the added regression
and restoring the single superseded q-negative fixture from query_alias. No
other original assertions changed. This was an actual source compatibility
repair, not a reviewer fixture correction.

| Check | Result |
| --- | --- |
| Initial independent controls | 20PASS/1FAIL, preserved |
| Unchanged controls after exact repair | **21/21 PASS** |
| Expanded independent controls | **25/25 PASS** |
| Full source suite | **877/877 PASS**, no skips |
| Public distribution | generated/types PASS; **7/7 PASS** |
| Source/reference/receipt and inverse preservation audit | **55/55 PASS** |
| Final author packet | **31/31 members PASS** |

All 5,544 original base Git blobs are unchanged. The source adds exactly the three
allocated family/schema/test files. Public0.1, original tests, registry/loader,
locks and dependency declarations are unchanged. Final schema SHA256 is
`7407ecb11c145fca7c75a88360a118f1db2870dd45cf9d1c85756e5427b37fa2`;
all source hashes are in `source-preservation.json`.

All captured local check groups were confirmed absent without timeout or kill;
full/public checks reaped five exited descendants total. Prepared physical
dependencies were used without installation and left untouched. Raw failures
and npm update notices remain preserved. No other session/resource was touched.

## Remaining gates

Root owns canonical bindings with trusted role context for both operations,
source-disabled/null handler registration, ledger updates and independent
integrated review. This family does not alter 139-original/96-selected/43-deferred
scope or complete source/runtime acceptance. The approved memory administrator
exception is settled and unrelated to acquisition contact projection.

No private producer, customer data, SQL/audit/database/service, native/runtime,
provider/model, proxy/worker, cloud/image or frontend execution occurred. Current
identity and contact-use authority, source freshness/provenance, audit durability,
revocation, budgets, release/cancellation and real integration remain HOLD.
G1 is OPEN; G2–G7 remain unentered. All production availability/connectivity
remains disabled.

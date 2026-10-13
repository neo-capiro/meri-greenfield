# Qualified fixture compatibility repair

Base b5243ae164f68c7591b039e8365d9897390543d2. Source/scripted checks only; no database or container execution.

Approved implementation outline: preserve the existing host/port client dial tuple and add optional paired serverAddress/serverPort for exact engine observations. Both Node pool configuration and Python connection admission retain dial equality. Optional closed schemaScope {mode: preserve-declared-evidence, namespaces:[{name,owner}]} explicitly enumerates at most128 unrelated evidence namespaces; absent scope retains strict empty-database semantics. Public relations remain strictly empty before install. Canonical namespaces must be absent before install and owned by qualification_owner afterward.

Reuse unchanged six migrations, PostgresBudgetStore transaction owner, canonical inert JSON and shared original-deadline lifetime. A cohesive schema-preservation module will snapshot supported catalog metadata without row contents, sequence values or function bodies, reject unsupported object classes, and bind before/after/reconstruction fingerprints. Unknown acknowledgement remains terminal; borrowed pool stays open. No policy, grants, migration or activation change.

Verification: exact mapped server172.17.0.2:5432/dial127.0.0.1:55432,25 unrelated namespaces, wrong server/dial/owner/collision/allowlist, metadata mutation, legacy behavior and Node/Python admission parity. Preserve original assertions, failures and immutable migration bytes.

## Result and exact source

Candidate source **f41ec1a78191bff882f1dbc7310e3d69a99bc111**. Ordered source commits:25ddfcec8e5896e868572e443f9dd32a004d40a2; fixture-only7b9e23eced0dcde266221bd88adb127532d66dcd; sequence precision c70698fa207b86771996c2bde5384bef1cfaceb1; namespace identity f41ec1a78191bff882f1dbc7310e3d69a99bc111. Independent review pending at packet preparation; no native acceptance claim.

Both Node schema admission and fixed Python bridge now distinguish trusted engine serverAddress/serverPort from exact host/port/database/user dial configuration. Node schema and lifecycle share fixtureDescriptor validation. Python accepts the same optional paired fields and closed schemaScope; full fixture serialization remains in canonical admissionSha256. Existing legacy schema hashes remain migration+catalog hashes; optional mapped/scoped compatibility and preservation observations additionally bind new hashes.

New schema-preservation.mjs owns fixed metadata queries and fingerprint checks; schema.mjs retains installer transaction/deadline/accounting ownership. Explicit declared schemas are exactly matched by name/owner and immutable namespace OID/ACL, their supported metadata observed before/after, and their fingerprint checked on reconstruction. Public relations remain strictly empty before install, public target type collisions refuse, canonical target schemas are absent initially and ownership checked afterward. No SQL body or migration was copied, generated, changed or applied.

The exact native-owner descriptor example is in apps/control/qualified-application/README-schema.md. Parent supplied only the reproducible compatibility tuple172.17.0.2:5432 server /127.0.0.1:55432 client. Native owner must supply actual25 schema names/owners and existing engine facts privately. No native receipt was opened, published or inferred.

## Checks and retained failures

- Final affected Node schema suite163/163:45 new compatibility,36 original author,69 preserved prior independent and13 original boundary tests. Raw namespace-identity-repaired receipt binds final source diff; no test assertions were weakened.
- Actual fixed Node/Python lifecycle and application scripted composition14/14, including mapped descriptor+25 names crossing the unchanged fixed child transport. Python lifecycle+compatibility17/17.
- Offline preservation audit63/63;11411 original Git entries checked, all unallocated entries exact. Six migration identities unchanged. Original test files/prefix and Python fixture-only inverse verified.
- Initial compatibility baseline0/2 retained. Sequence bigint SQL-contract negative0/1 retained, repaired by text casts for exact int64 settings. Reviewer namespace OID finding independently reproduced0/1 and repaired; same-name empty namespace recreation now refuses.
- Earlier145/146 focused result retained: an existing independent fixture intercepted the first DDL before recording its private ddl array, so the new post-DDL namespace observation lacked targets. Fixture now derives observations from its actual captured query log; all assertions unchanged.
- Earlier10/11 lifecycle/application result retained: the inherited application harness required MERI_REVIEW_SOURCE_ROOT. Corrected environment-only replay14/14; no assertion changed.
- Source diff whitespace check PASS. Every capture has a180-second owner timeout and recorded owned group absence; no group required kill. Seven owned dependency links removed; donor untouched.

## Limits

All SQL observations were scripted ports; actual database execution remains a separate owner action. These checks do not prove native catalog syntax, row-data preservation, current policy, durable runtime or deployment. The implementation invokes only the six preexisting migrations on canonical targets and no cleanup/drop/reset/retry. Existing unknown acknowledgement and original deadline behavior is retained.

Supported evidence metadata: ordinary tables/views/indexes/sequences, automatic composite/array types, namespace and object identities/ACL, columns/defaults/constraints/indexes/view rewrite definitions, sequence parameters (lossless strings), internal triggers/dependencies/comments/labels. Custom routines/types, partitions/inheritance, foreign/materialized/extension objects, row policies, user triggers/non-view rules and other namespace-dependent object classes refuse. No row contents, current sequence values or function bodies are read; physical TOAST storage, external dependency definitions and volatile relation statistics/freeze counters are excluded. Inert JSON limits and the existing1024-row/1MiB result bound remain. Fingerprints bind exact retained database metadata/OIDs, not portable equivalents or concurrent DDL protection. No native schema names or private evidence bodies enter this packet.

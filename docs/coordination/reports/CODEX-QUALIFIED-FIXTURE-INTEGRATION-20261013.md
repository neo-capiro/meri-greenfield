# Qualified fixture compatibility — ACCEPT_SOURCE / runtime HOLD

Base PR49: `b5243ae164f68c7591b039e8365d9897390543d2`. Independently accepted author source: `4f4da0b67d0b062a84b9196a4b70b012df30f213`; author packet: `fe51a6c75bd3a0878e786a2f9b2af64d4271871c`. This continuation is separate from document workflow PR50 at `a0614e7e16d6f92d0ca6eaa192cea7c5def21ec8`.

## Result and native handoff

The fixed qualification schema and Python lifecycle distinguish the exact client dial `127.0.0.1:55432` from the reported server `172.17.0.2:5432`. Optional paired `serverAddress`/`serverPort` bind engine observations; `host`/`port`/database/user continue to bind the actual client configuration. System identifier, server startup/version, fsync, synchronous_commit and full lifecycle admission hashing remain mandatory.

An optional closed `schemaScope:{mode:'preserve-declared-evidence',namespaces:[{name,owner}]}` permits exactly the trusted owner's declared evidence namespaces. The native owner supplies its 25 names and owners privately. No namespace is discovered into authority. Without this descriptor, the prior strict behavior remains. Public relations must still be empty before installation, public target type names must not collide, and canonical target schemas must be absent initially and owned correctly afterward.

The new `schema-preservation.mjs` module fingerprints supported catalog metadata before and after installation and at reconstruction. It includes namespace identity/owner/ACL, relation and type identities, columns/defaults/constraints/indexes/views, lossless sequence parameters, dependencies, comments and labels. Its fixed catalog OID literals and builtin casts are explicitly pg_catalog-qualified. Unsupported object classes refuse before migration; no row contents, sequence current values or function bodies are read. The receipt returns only preservation hash/count/coverage. This is a metadata observation, not concurrent-DDL exclusion or row-data proof.

Use [README-schema.md](../../../apps/control/qualified-application/README-schema.md) for the exact descriptor and exclusions. The integration `source-blobs.json` packet lists five production files and their exact Git blob and SHA-256 identities; add the new preservation module to the native driver's pinned source closure. All six migration bytes and every other canonical owner remain unchanged. Retain the returned schema hash for reconstruction; never reset or reapply an uncertain installation.

## Verification and preserved failures

- Independent review: ACCEPT_SOURCE, 72 Node controls, 33 Python controls and 145 preservation assertions passed. The reviewer independently reproduced missing namespace identity, lossy sequence metadata and temporary-schema catalog/type resolution failures against earlier source, then verified the repairs.
- Root replay: 225/225 composed Node checks and 17/17 Python checks passed. After the final catalog-qualification changes, all 237 affected Node schema controls passed. Root separately replayed 70 earlier independent Node and all 33 independent Python controls; later source changes are confined to the preservation SQL and its tests.
- Original deadline, cancellation, uncertain commit, borrowed pool cleanup, legacy hash and application reconstruction controls remain. No original assertion or migration was weakened. Exact source, complete original-tree preservation, capability scope, manifests, captured outputs and fresh process-group absence are checked by the integration audit.
- Raw failures remain in author, reviewer and root packets. Root's initial composed run omitted the required explicit source-root environment and produced four import refusals (200 passing checks); its corrected captured command passed. Reviewer asynchronous cleanup timing, synthetic worker grammar and new SQL spelling/scanner fixture mistakes are retained with their exact corrections. Raw output whitespace is preserved.

## Remaining gates

No native PostgreSQL, native private packet, AWS, worker, Clerk, customer data, provider or paid model operation ran here. Actual catalog execution and compatibility with the native fixture's 25 schema object classes remain unproven. Custom routines/types, partition/inheritance, foreign/materialized/extension objects, policies, user triggers/non-view rules and unrecognized namespace-dependent classes require a separately bounded source follow-up if the native owner encounters them.

G0 remains accepted; G1 OPEN; G2–G7 unentered. Source connectivity and all 97 production catalog operations remain unavailable. Scope remains 139 original capabilities, 96 selected/43 deferred, with 96 mapped source records. Runtime identity/authentication, expiry/revocation, durable budgets/checkpoints, recovery/stale rejection, sandbox/egress/teardown, artifact inspection and approved execution/security/budget inputs remain separate gates. No approval semantics, infrastructure placement, database/network state, main branch or frontend was changed.

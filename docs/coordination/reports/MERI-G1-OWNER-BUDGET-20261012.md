# G1 control owner and durable budget continuation — 12 October 2026

**ACCEPT_SOURCE** from preserved PR14 `1e6d430cf9c239caca4198aea42a762f13021cd5`. Branch `task/meri-g1-owner-budget-20261012`; isolated worktree. Integrated source commit `1355c0ab9b0cb6162efef3b9d8ba4e3230a16ed9`, tree `37336310a7773e93464e15404fb7907ae34dc09a`. Subsequent report/receipt commits contain evidence only. G0 remains accepted, G1 OPEN and G2–G7 unentered. No runtime gate advances.

## Accepted source and concrete behavior

The actual private control composition now exposes `stopRun({context,peer})`. It snapshots the closed inert owner input, closes the exact full-binding admission gate synchronously, cancels matching local handlers and invokes the existing canonical registry's one-way revocation. Repeated and reentrant calls share one attempt. An unknown acknowledgement remains visible after handler settlement; a timed-out revocation remains tracked until its late outcome. Close stops local admission and refuses clean resource release while operations or unknown liabilities remain.

This bookkeeping is process-local. Raw registry admission/replacement remains compatible; close does not enumerate or automatically revoke all admitted runs. The trusted owner must explicitly stop each intended binding. No restart reconciliation or uncertainty-clearing API is added, and no deployed broker/Temporal caller is claimed. Existing Temporal activities remain inert compatibility fixtures. Claude Agent SDK remains the sole model loop.

The durable budget candidate composes the existing single-call dispatcher with an actual PostgreSQL transaction adapter and a separate trusted invocation identity. The canonical gateway entry adds a hard-disabled composition; original entry behavior and all capability availability stay unchanged. Allocation validates the actual private0.2 manifest body/hash/limits, allowed operations and canonical catalog identity. A positive immutable schedule defines conservative fixed-per-dispatch budget charges, not provider prices or measured actual usage. Missing charges refuse.

Qualification migration0002 adds immutable allocation/grant correlations, unique invocation slots and a shared model/tool liability view under the original aggregate budget lock. Replay with a fresh reservation UUID cannot redispatch. Both global and installed run ceilings include settled and UNKNOWN liabilities; all invocation attempts count toward tool-call limits. Complete task/capability/policy mapping and fresh database time constrain admission. Historical exact settlement can account for liability after revocation; it cannot renew execution authority. Unknown outcomes never cause automatic retry or refund.

The old model ledger explicitly depends on migration0002 after this source change; missing state fails closed. The new migration method is explicit and never called by the old migration loader. Original engine-test setup only adds that explicit migration and the new foreign-key tables to its synthetic reset; original test bodies remain intact. No SQL migration or database connection ran. Runtime package assembly, real driver/pool configuration, persisted invocation producer and Temporal recovery remain unqualified.

## Independent decisions and preserved failures

| Work | Author freeze | Independent decision |
| --- | --- | --- |
| Actual control stop/cancellation/uncertainty | `357251ee531bf4da9778116090ec22a4a8ee27a3` | ACCEPT_SOURCE; reviewer `fd68053a0eb044d5031cabaa4c27a45d1337651b` |
| Durable budget and canonical entry | `d58a2b1c51c43420fa64c1036c509ab14d872996` | ACCEPT_SOURCE; reviewer `58714267430500f66565e0e73b7729555227c9f0` |
| Ubuntu package/security evidence | `7f6154e8a2f518a7860bc2421dd6853ff358e156` | Root ACCEPT_SOURCE_EVIDENCE_ONLY; immutable recipe/image HOLD |
| Conditional native interpreter packet | `32ce5d9bfa67ab8487e159d252acf0f1707bc72e` | ACCEPT_SOURCE_PACKET; reviewer `41e676712387bcca37a740f1039362768f5fc782`; execution HOLD |

Owner failures retained: effectful top-level getters before snapshot; synchronous abort reentry starting a second stop; reviewer cross-worktree AWS class-identity harness mismatch. Corrections preserve their raw before/after evidence and original assertions.

Budget review retained failed transaction-client lifecycle controls, including unsafe healthy release after uncertain BEGIN/rollback/COMMIT and lost commit classification during release failure. Deadline controls retain the missing shorter manifest, grant and schedule expiry propagation and parked allocation/handler/settlement cases, plus a mutant that removes propagation. Dependency-layout and reviewer fixture errors are preserved separately from behavior failures. All ten original review commits, including criteria, HOLD and failures, are integrated and their original branch is published.

## Combined local verification

| Root replay | Result |
| --- | --- |
| Gateway, including all original 101 cases | 139/139 PASS |
| Independent budget dispatcher/store controls | 29/29 PASS |
| Actual Python model-ledger source / independent accounting controls | 7/7 + 5/5 PASS |
| Root contracts/session suite | 244/244 PASS |
| Public distribution generation / types / cases | PASS / PASS / 7/7 PASS |
| Integrated owner controls before disjoint budget integration | 26/26 PASS |
| Ubuntu offline packet / separate positive-VEX version checks | 301 PASS / 22 exact matches |
| Native packet author / independent controls | 7/7 PASS / 58 checks + 6 negative controls PASS |
| Original source preservation | 3,209/3,215 files unchanged; six allocated existing edits; all 23 original PostgreSQL test-method ASTs exact |

`integration-manifest.json` SHA256 `175673cd33387547cf00514894026e563fe4042cc91e7cefdeaf262e7dad85af` seals 19 root command receipts and their raw streams. Seventeen changed/new source paths exactly match the independently accepted owner and budget freezes. All owned groups are absent; no timeout or group kill occurred. Five esbuild descendants were reaped with zero status. The unchanged owner review additionally preserves 64 focused, 83 prior independent and 244 root passing cases; the budget review preserves 107 exact source-preservation checks.

The full `git diff --check` exits2 solely for preserved raw output/patch whitespace; its failure is retained. The scoped source/report whitespace check passes. Prior legacy builder evidence remains 35 PASS / one fixed Windows-owner ERROR; that unchanged suite was not rerun. No real PostgreSQL or native test is counted as passed.

## Ubuntu remains an evidence proposal

All 54 original obligations remain OPEN, with original severity/cohort retention. Official frozen Canonical VEX records give 18 fixed, four scoped not-affected, 12 under-investigation and 20 unresolved observations. Root independently matched all 22 positive statements to exact observed resolute package versions; these are not installed-copy or image dispositions. All 35 direct functions, six Main/Universe indices and seven Python metadata records are retained. Offline author verification passes 301 checks.

Known-vulnerable/deferred zlib, critical GnuTLS/TIFF gaps, gcc-16-specific applicability, archive-key/signature authentication, an accessible dated snapshot, solved dependency closure and supported lxml linkage remain prerequisites. Current cp313 bundled parser evidence cannot qualify uninspected cp314 bytes. No Ubuntu recipe or package pin was created. Original Debian and license evidence remains intact, and the rejected old image must never launch.

## Exact next interpreter prerequisite

The parent reports an already existing ordinary Astral/uv Python3.11.15 candidate with version/registration and plain ancestor metadata. The private discovery ZIP is reported as12,009 bytes, SHA256 `a5f05e1ae1087d9d36687a149f2e602c874ef61311f3352c64552eac79cc3ecd`; it is not materialized or independently decoded here. This supports preparing a candidate packet, not running it. Host identity is not inferred from the personal path.

Complete executable bytes/SHA256, actual distributor/build provenance, regular single-link/stability evidence, exact private host/path/cwd/argv and reviewed supervisor/receipt-slot identity first. Then obtain authority for at most one unchanged `docs/qualification/candidates/native-ancestor-diagnosis-20261012/inspect-ancestor-metadata.py`:6,297 bytes, SHA256 `9514b8e8ad0aff24e1eea7e782dd32178d856011fafcb750ce2c0f9a715c6efd`, flags `-I -B -S`, original `--repository` and `--original-output` arguments,10-second cooperative and15-second external bounds,32,768-byte source stdout maximum. The proposed separate32,768-byte stderr cap still needs supervisor review. Require raw streams, sizes/hashes, both EOFs, exit/elapsed/timeout/overflow/kill and verified physical exit.

A pass establishes only the diagnostic's current directory predicates. Broader metadata has a separate1MiB stdout cap; selected inventory has separate60-second/16MiB-per-file/256MiB-total bounds. Capture includes an AWS CLI version child and a12-helper profile; current binding expects10 helpers. The historical builder still requires its distinct fixed Python3.12.14 identity. No automatic follow-up, collector retry, reparse relaxation, build or G1 authority follows from this packet.

## Scope, evidence and remaining gates

The canonical inventory/catalog remain the sole scope registry:139 originals,96 selected/43 deferred,14 bound but unavailable/82 selected unmapped,14 named skills unqualified. This continuation adds no capability qualification. Public0.1/private0.2 remain separate. No frontend or capirov2 source was edited, and original branches and failures remain preserved.

Root local receipts are in `docs/qualification/candidates/g1-owner-budget-20261012/integration/`. Each owned test command uses a Linux subreaper, bounded wall time and raw stdout/stderr hashes, and records process-group absence. These are local source checks, not native physical task teardown evidence.

Real PostgreSQL execution/concurrency/restart durability, live task identity/expiry/revocation, native task-A/B checkpoint recovery and stale rejection, actual Temporal histories, supported patched images, sandboxed browser/renderer, egress/watchdog/teardown and artifact inspection remain UNRUN/HOLD. Existing Aurora selection is unchanged. The private host/Hermes policy and unreconciled aggregate model allowance still block affected operations; no paid/provider call, native runtime, cloud build/push/launch, resource/credential/security/network/database/customer-data action or main merge occurred. Independent source work does not require those execution approvals.

The next source work is runtime packaging and trusted owner composition for the accepted adapters, a durable invocation producer and recovery mapping under Temporal, and SDK turn/recovery-limit wiring. Those require separate exact source review and do not confer runtime authority. Native execution needs the completed one-action identity/supervisor packet above. Publication metadata is recorded separately under this candidate's `publication/` directory; preserved PR14 and all earlier base branches are not rewritten.

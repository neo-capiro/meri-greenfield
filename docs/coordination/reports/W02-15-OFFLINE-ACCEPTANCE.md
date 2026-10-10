# W02-15 focused decoder: owner offline acceptance

Codex integration owner, 10 October 2026 UTC. **ACCEPTED for offline module extraction only.** Final source `aa368244ee9fce8244ec7ee1997c506bd08e143a` preserves the accepted W02-13 decoder behavior and public API. It is integrated as `0f9d7bd` plus `62380a6`; the distinct actual Hermes review `6f545c3bafcef3a9bd1bb98e6194995a47bbe778` is preserved unchanged at `26b344e`. This grants no runtime, security, transport, enforcement or G1 acceptance.

The user explicitly requested focused code and avoidance of god files. [AGENTS.md](../../../AGENTS.md) now requires cohesive modules, small entry points and clear interfaces without generic frameworks or arbitrary file-size quotas. The original 54,006-byte decoder is now a 46-line entry and eight modules: protocol, strict JSON records, privacy, request semantics, capture validation, filesystem operations, artifact output and CLI composition. The dependency graph is acyclic; imports are inert; the original entry exposes exactly its previous 26 names. The largest module handles capture validation, rather than unrelated infrastructure responsibilities. This is a scoped follow-up to [W02-13 acceptance](W02-13-OFFLINE-ACCEPTANCE.md), not a silent rewrite of other accepted packages.

## Implementation and primary correction

Actual installed Hermes implementation session `20261010_000251_200a94` started clean at `22bf30ea049276ae1573aa79cc7872228ef095da`. Its first bounded phase (30 turns/1200 seconds) completed extraction and captured 61 passing canonical tests, nine syntax checks and an API/import-graph comparison, then exhausted its turn budget without a report or commit. The owner inspected the closed process and owned-only dirty state before an explicit ten-turn/600-second closeout resume of the same session. That phase wrote the report and committed `bdcf817a0f5e4c5950344d83264c103106ecc3f0` without replaying unchanged tests. Misplaced report-directory creation and its confined removal are retained in the implementation history.

Codex then read all nine source files, the original decoder and retained evidence. Independent source review found a real extraction defect: `capture-validation.mjs` had lost the original lexical `TextDecoder` import and instead resolved the mutable global. Function-body equality and the canonical suite did not expose that binding change. The owner's separately written positive-capture witness replaced `globalThis.TextDecoder` with a throwing class: the original accepted the fixture while the first extraction rejected it. This failure remains in `.task-inputs/W02-15-primary-witness-before-1/`.

Owner correction `aa368244…` restores `import { TextDecoder } from 'node:util'`, preserves all function bodies and records attribution and report corrections. A first atomic patch failed to match and changed nothing; the corrected patch and all subsequent evidence remain. The source change justifies the new checks below. No frozen producer, canonical test, public contract, dependency or native code changed.

| Primary check after correction | Result |
| --- | --- |
| Unchanged canonical suite, once, 60-second outer bound | 61/61 pass, 0 failures; Node duration 205.6647 ms |
| Owner lexical-binding witness | Original and corrected extraction both accept under the throwing global override |
| API/function/constant/import-graph comparison | 26 identical public exports; body/arity/value checks and acyclic graph pass |
| Changed module syntax | Pass |

Primary capture: `.task-inputs/W02-15-primary-checks-1/results.json`. Canonical stdout SHA256 `7baab7b6108be0789a0f435427e3bdba7a6431316f21bdcdab94d6a39479b6a7`; lexical witness stdout `e0c7984f5ac1859902a1381aebd98f35af524d1268a0937e40ce8873002dff49`. No producer, native SDK, provider, network or AWS execution occurred.

## Distinct actual Hermes review

New reviewer session `20261010_002710_910905` independently reviewed exact `aa368244…` in `review/w02-sdk-decoder-modules-1`. It ran 04:27:08.617664–04:30:24.312298Z within its 30-turn/1200-second limit. The process exited zero; readers finished; process-tree absence and cleanup were confirmed with zero capture/cleanup errors. Its sole tracked change is [the review report](W02-15-SDK-DECODER-ORGANIZATION-REVIEW-1.md), SHA256 `2f05be11f1be4fe4ded624cc44a9846f382728383784329b02f7b5ad6aba2486`.

The reviewer read all source modules and compared the original surface, graph, lexical bindings and behavior. Its unchanged canonical suite passed 61/61 once; all nine syntax checks passed. Its own positive capture and real confined file-reader witnesses both survived the throwing-global override. It also ran the supplied owner witness, explicitly labelled as supplied rather than independently designed.

The reviewer's combined private audit exited **1**, preserved as a failed process: its heuristic scan matched `crypto` inside the import specifier string `'node:crypto'`. The owner read the entire private audit and output and confirmed this is the sole reported problem, not an unbound identifier use. API, graph and lexical witness results passed. No unchanged audit rerun was requested or relabelled as exit zero. The review correctly discloses this qualification.

The review's informational claim that the implementation table calls `decodeBody` an export is imprecise: that table explicitly lists responsibilities, not exports. `decodeBody` is module-private and the entry surface is correct. The owner preserves both reports and records this qualification here. Function-string comparisons and heuristic scans are limited evidence; full source and free-variable inspection plus concrete witnesses support acceptance.

## Integration and remaining limits

Before integration, the owner verified clean pinned branches, the review's report-only direct-parent diff, all nine source bytes plus both reports against Git blobs, and process closure. After the three sequential cherry-picks, all eleven files matched the reviewed working copy and committed blobs exactly; integration was clean. Machine evidence: `.task-inputs/W02-15-integration-hash-proof-1/manifest.json`. Unchanged tests were not replayed after byte-identical integration.

Inherited W02-13 limitations remain: trusted-local pathname TOCTOU, Windows `O_NOFOLLOW` absence and disclosed injected symlink fixtures, SUMMARY-only SDK result evidence, absent producer end-manifest hash, and unqualified complete CloudWatch/F10/controller delivery. This extraction neither repairs those limitations nor proves native wire behavior, sandbox, cleanup, application functionality or release readiness. W02-14 surviving enforcement and all relevant live gates remain open.

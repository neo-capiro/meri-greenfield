# Meri successor review record — 15 October 2026

**Complete-product and release disposition: HOLD.** This successor records the three complete independent reports supplied by the central coordinator and its explicitly incomplete P2b review transfer. Frontend acceptance is limited to the bounded source corrections below; no complete-product implementation, runtime, contract, image or deployment acceptance follows. Fable retains implementation ownership; comprehensive repair package two remains pending. The seven original audit files and prior HOLD records are preserved.

## Complete reports and execution attribution

- [Corrected frontend review](CORRECTED-FRONTEND-REVIEW.md): bounded source ACCEPT; independent desktop/SSR execution evidence pending.
- [Corrected capabilities review](CORRECTED-CAPABILITIES-REVIEW.md): P2a source/contract HOLD, with narrow repairs and separate-receiver direction accepted.
- [Corrected browser review](CORRECTED-BROWSER-REVIEW.md): P2c source HOLD and independently held activation, with narrow original fixes accepted.

These reports retain their reviewers' exact source pins, synthetic substitutions, executed checks, expected-negative failures, blocked checks and unrun live gates. The documentation lane verified assembly, identities, ancestry and publication bytes; it did not rerun the source probes or qualification. P2b has no complete final report in this delivery: its stopped review is recorded only to the extent supplied by the coordinator.

## Exact candidates and ancestry

The documentation lane independently resolved these Git identities and ancestry, without duplicating the four source reviews. Named branch tips matched these pins at the ancestry observation. Both repository `main` heads were rechecked unchanged while preparing this draft.

| Candidate / branch | Commit | Tree | Relationship to prior candidate |
|---|---|---|---|
| Frontend `meri/figma-34-ui` | `78b1c12691541a32aa82039d2518b91a5e780ce5` | `0dc355ce7f81bb43b20202dd44facbefd004e988` | +5/−0 from `9b4de0583d5300183a2582fcc70350b3114200cd`; +6/−0 from originally reviewed `a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b` |
| P2a `fable/p2a-capability-policy-sandbox-20261015` | `ff52b9ea0cfb5c0280ea95baea6396554a6eed7d` | `1e5c3ce700199a04d93063af908efa96b16363ce` | +7/−0 from P1a `6d9bb391005f73c8be6ec636c346a05381b5bd98` |
| P2b `fable/p2b-download-links-live-20261015` | `e046be844fbc4e56a8111dbfa28c330169e4536e` | `083d4c21b3aa6d46847cf596fe74730e5c45dedc` | +5/−0 from P1b `06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40` |
| P2c `fable/p2c-browser-default-on-20261015` | `31ed4a732e81000c1962765ff1d16cdcdf16ecaf` | `ed63c90bfe4c71700e8aebd61b626f8fac9c965c` | +3/−0 from P1c `e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4` |

Frontend main remains `02c02d95bdf3949662b9123f425271c6491ffdab` (+380/−0 to the frontend candidate). Meri main remains `8b123bea4c90794dc2d766814b6ddbdbfe0928bc` (+2508/−0 to P2a, +2505/−0 to P2b, +2504/−0 to P2c). Each main is the corresponding comparison's merge base. The three P2 branches diverge from common merge base `ba40647c5b6f1f81773869e41ce82c099d64d505`; none integrates the other two. These are candidate findings, not merged-main behavior.

## Successor dispositions

| Candidate | Current disposition | Corrections and remaining findings |
|---|---|---|
| Frontend | **ACCEPT source corrections; runtime qualification pending** | The coordinator reports independent verification of canonical provenance and inverse edits, all source pins, `generate-pins --check`, four existing Settings tests and 22 synthetic keyboard edge checks. These checks were not rerun by this documentation lane. They do not qualify real desktop/browser behavior or SSR. |
| P2a | **HOLD source and contract freeze** | Original hook-latch and implicit-Bash defects have narrow source acceptance. Existing plugin aliases/foreign-fragment injection are corrected, but a missing workspace beneath a symlinked parent still bypasses disjointness (P2a-R2). Readiness can ignore success-result usage or later startup failure and attest available (P2a-R1). The separate telemetry receiver is accepted in architectural direction only; digest/bounds/cursor/fencing semantics and implementation remain unfrozen. Preserve UIEvent 0.1.0 unchanged. |
| P2b | **HOLD; independent review incomplete** | The reviewer confirmed the financial-liability correction and reported independently rerunning 15 budget tests with one real-PostgreSQL skip. A remaining pre-response retention/authorization synchronization issue and stale candidate proof rows were reported. The review session stopped with a service safety error before its final report. Preserve these returned non-sensitive findings; do not infer a complete review or acceptance, retry that session or work around the stop. Native PostgreSQL behavior remains unqualified. |
| P2c | **HOLD source; activation/live qualification independently HOLD** | Narrow original pre-execution permission, synchronous download-claim, held-entry-point and profile/disposal corrections are accepted in source. H1–H5 remain: malformed OOXML/PDF accepted by validator/grader; unmatched ZIP headers/data-descriptor/path checks; effective origin allowlist absent from mandatory redirect/egress criteria; invalid tenant booleans silently coerced; unbounded pending approval cancellation. No deployed bypass is claimed. Browser ON remains desired, with destination deny-by-default; existing eight activation measurements are insufficient. |

Fable's **95 desktop cases, 52 units and Linux SSR 18/18** at frontend `78b1c126…` remain **owner-reported, not independently verified runtime evidence**. The receipt is owner-held with reported SHA-256 `1d7b867567ce988514762f39dec396432f101e5bbcf562fa3aa8be28138b31e6`. This lane has neither inspected that artifact nor verified its bytes or reproduced its results. The prior 15-pass/3-fail SSR result remains historical; neither result is silently replaced by the other. Portable exact-pin artifacts or reproduction are still needed for independent runtime qualification.

The tenant-budget migration is reported authored at the [reserved product-budget `0002` path](https://github.com/neo-capiro/meri-greenfield/blob/1b61483d2a9e554fa4818533c5cb09eb952af3de/docs/coordination/tasks/CODEX-TENANT-BUDGET-0002-ALLOCATION-20261015.md); real PostgreSQL was skipped and candidate provenance remains owner-held. This draft does not independently attest the SQL, effective privileges, isolation or execution. Product-budget `0001` and separate conversation `0011`/conditional custody `0012` boundaries remain unchanged.

Independent execution limits matter: the frontend reviewer passed canonical provenance/pins, four Settings tests and 22 synthetic tree checks. The P2a reviewer passed 8/8 pure policy and 5/5 source-proof tests; readiness/path probes used injected ports and substituted hashing/shape dependencies as disclosed. The P2c reviewer passed 4/4 structure tests and 59 policy/permission/disposal assertions, while **ten malformed expected-negative cases were incorrectly accepted**. Four authored browser test files failed to load for missing `ajv`; the owner's 28/28 was not independently reproduced. None of these results supplies actual SDK ordering, browser/renderer isolation, native Office, database or deployment qualification.

## Historical records and remaining owner actions

Preserve the immutable [P1a](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FABLE-P1A-6d9bb391-20261015.md), [P1b](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FABLE-P1B-06b2f499-20261015.md), [P1c](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md) and [frontend](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FRONTEND-a0b58a2b-20261015.md) HOLD records at their original pins. Successor dispositions apply only to the candidates and evidence above. The [comprehensive audit](README.md) remains the wider product/release gap record.

1. **Fable — repair source blockers at new exact pins.** P2a: reconcile every observed SDK usage/result/error and shutdown outcome before readiness; reject or correctly resolve missing workspaces under aliased parents. P2c: use genuine structural parsing, validate coherent ZIP headers/descriptors and safe names, reject invalid raw settings, and enforce bounded approval expiry/cancellation. Return focused negative regressions and preserve failed/skipped results.
2. **Fable with canonical owners — close shared boundaries.** Freeze the telemetry receiver's exact digest/bounds/cursor/idempotency/fence semantics before wiring it; do not widen UIEvent. Make effective platform/tenant/role origin policy mandatory at every relevant destination/redirect, including public-allowlisted → public-unlisted, subresources and WebSockets. Bind approval scope, current authority, input digest, expiry and replay to the canonical approval owner. Direction acceptance does not freeze local proposed wire/storage.
3. **Fable — retain P2b HOLD and incomplete status.** Address the returned serving synchronization and stale provenance findings through ordinary owner changes and new reviewable evidence. Do not retry or work around the stopped review session. Keep real PostgreSQL/privilege/isolation and provenance qualification pending; authored SQL or reported tests are insufficient.
4. **Frontend owner — supply portable qualification evidence.** Use the checklist below; update or label the stale historical FileTree adoption/qualification summaries without rewriting current canonical provenance or prior receipts. Keep Settings/full-product integration and mobile boundaries separate.
5. **Image/runtime/integration owners — qualify one integrated candidate.** Reconcile proposed image packages and trusted immutable plugin preparation with the existing candidate owner. Keep browser activation held for effective egress, SDK pre-execution approval, sandbox/profile/task cleanup and ingest qualification. Independently re-review new pins; the three divergent P2 branches and accepted frontend source corrections do not constitute integrated repair package two.

## Portable frontend evidence checklist

- Supply unchanged SSR `receipt.json` bytes matching the reported digest, plus its bound `fixture.cjs`, `fixture.cjs.LEGAL.txt` and `metafile.json`; include preparation commands/environment/logs and the actual exact-pin 18-test result. A receipt or artifact preparation alone is not a test pass.
- Include the actual bound installed dependency bytes and matching Node/platform/architecture for canonical `verifySSRReceipt`; independent reproduction also needs the verified official esbuild 0.28.2 tool package and root-lock dependencies. Do not rewrite receipt identities or pins to fit another environment.
- Supply the 95-case Playwright JSON report, exact invocation/spec/filter list, attached axe results and relevant traces/screenshots, plus the 52-unit, full typecheck and architecture logs bound to the same clean commit. Review axe incomplete results and actual audited states; do not generalize finish-state checks to every transition or manual accessibility acceptance.

## Delivered-report integrity

All ten chunks were present and untruncated. Only the XML delivery envelope was decoded; chunk content was concatenated without added separators or headers. Each assembled report matches the coordinator's supplied SHA-256 exactly:

| Report | Bytes | SHA-256 |
|---|---:|---|
| `CORRECTED-FRONTEND-REVIEW.md` | 11,959 | `5b916464d2d9f2837eb1b8c063f9bec2b9711f8a52e90d9a0bb93659e5f92da8` |
| `CORRECTED-BROWSER-REVIEW.md` | 20,445 | `c2f4fd415873f8f511b1dcf0fb0017cf35afd7d3487bd12b1fb060a5d5cf594b` |
| `CORRECTED-CAPABILITIES-REVIEW.md` | 19,255 | `0755a79df86539a1fecb3afd17d2d301d6d084a4c6331a582480bae3e39cf0aa` |

Reviewer host/scratch paths and companion filenames in the verbatim reports identify evidence locations; those evidence files, the host-only SSR receipt and installed dependencies are not part of this delivery. No independent verification of unavailable companion bytes is claimed.

Browser destination deny-by-default and consequential-action controls remain separate from the desired ON default. Mobile remains deferred. Publication is limited to these four documentation files in the already approved directory. It supplies no product changes, new security actions, model/provider calls, database migrations, activation or deployment authority. The comprehensive audit's other product/release HOLD findings remain unchanged.

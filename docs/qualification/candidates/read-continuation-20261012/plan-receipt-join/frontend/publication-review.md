# Final publication audit — ee01be3

**PASS: the final publication summaries agree with the completed raw local qualification, source identities, bounded row mapping, and preserved evidence. No outstanding summary/disposition inconsistency was found after the two wording corrections below.** This is a read-only publication audit, not another qualification run or native acceptance. No tests, browser/server/build, dependency, source, provider, or cloud action was performed. The prior completed integration review and its evidence remain unchanged.

Reviewed `/workspace/capiro-followup/docs/followup-20261012/{README.md,STATUS.json,SOURCE.json,SCOPED-FACETS.json,REMAINING.md,VISUAL-SCOPE.md,EVIDENCE-COPY-PART-1..4.json}` against copied `evidence/integration/final-ee01be3` receipts, logs and browser result JSON, archive receipts, original triage and existing integration audit. Final input hashes are in `final-input-hashes.json`; initial README/STATUS snapshots are retained separately from corrected final copies.

## Exact source and completed local gates

All eight command receipts bind source `ee01be3b2c5c64a53744994ae4ad0d992a111054`, root tree `bce79ae8c0f526e113468b885fc2c7a5515ac7b9`, and `apps/web` tree `17385e9404d12baa01e695c72584a375f4842813` before/after, with empty source diffs and `sourceChanged=false`. SOURCE records the matching `apps/web/src` tree `7b269ad4ecdd3071acb0a0fec9775a2190458388`. Summary commands, durations and exit codes equal their raw receipts.

Verified outcomes:

- Clean install:847 packages. Combined check: **1,432 tests =58 root +21 transport +1,243 Portfolio +110 Capiro**; zero errors,76 lint warnings, formatting/type/public-package checks passed. Architecture retains416 signals,392 reviewed,24 inherited-unreviewed,zero blocking/boundary errors.
- Elements: initial invocation **12 passed/3 failed**, exit1, because the required prepared SSR receipt was absent. Its raw failed log and receipt remain. The prepared exact-source receipt hash is explicitly passed on the resolved invocation; **15/15**, exit0, with unchanged source. This is accurately described as setup resolution, not a hidden clean first attempt.
- Modules: **182/182 passed**, one worker,182 cases at60,000ms, every result retry index0; skipped/unexpected/flaky all zero.
- Portfolio/Meri: **1,051/1,051 passed**, three workers,1,047 cases at60,000ms plus four existing slow cases at180,000ms; every result retry index0; skipped/unexpected/flaky all zero.
- One recorded production build, exit0. Build ID `YeRpCYwLZ8c5jqEhEYTc5` matches the current output. Actual standalone smoke: **11 HTTP checks, four viewport/theme states, two cross-mode/history checks, zero page errors**. Its raw scope explicitly excludes live sign-in/credentials/service interception; summaries preserve that limit.

## Evidence copies, archive and preservation

All **1,446 distinct copied destinations** match their declared byte lengths and SHA-256, with no duplicates or aggregate discrepancies: Part1 628 files/55,971,028 bytes; Part2 140/16,720,234; Part3 165/30,330,495; Part4 513/108,061,537. Available original files match too. Historical generators, failed attempts, and pre-qualification checkpoint reports remain evidence; this audit did not rerun or rewrite them.

Canonical and independent full-source archive receipts agree with SOURCE: **8,211 tracked blobs**,8,212 ZIP members including marker,1,145,563,434 tracked payload bytes. A fresh read-only hash of `/tmp/capiro-source-ee01be3/source-ee01be3.zip` confirms **770,461,228 bytes**, SHA-256 `6d9297afed3c0447783472c4d3e19a9b20ee50b8c8729321d27b369eeac5b61e`. This audit inspected both prior verification receipts and rehashed the archive; it did not rerun either verifier. The ZIP binds the qualified ee01be3 source, not the later evidence-only publication commit. No upload is claimed.

The PR11 assessment, d5dd successor packet, and visual-closeout folders remain unchanged from fd117. The previous integration review remains SHA-256 `3f55192e254f1d7bbb1eb72dc36a4563139c55b73e5af8ef95af2606c2faedf5`, including its then-pending gate disposition and fresh d5dd archive check. That historical pending status is correctly superseded only by the final current summaries, not edited retrospectively. Frozen d5dd shipping/source/archive identity remains separate.

## Row/native/visual boundaries

SCOPED-FACETS retains exactly nine findings mapped to eleven original rows, with local qualification passed but every facet marked `NOT_RUN_FOR_THIS_FACET` and `NO_NEW_FULL_ROW_ACCEPTANCE`. CP-03 remainsP3. The original337 in-scope rows/eight exclusions and individual status references are unchanged; no blanket native or full-row acceptance is introduced.

REMAINING lists the same eighteen original findings/priorities: four source, four source/design, ten design; none is relabeled backend-only. MS07–MS09 retain their supplementary Modules scope without invented Portfolio row IDs. Staging prerequisites, read-first checks, local Undo versus separately authorized real rewrite, and disposable-file DELETE approval remain distinct. No native/provider/model/storage/security/deployment/AWS completion is claimed.

VISUAL-SCOPE accurately separates lane and integrated screenshots, bounded viewport/keyboard observations, and unauthenticated production smoke from full Figma/native/screen-reader acceptance. Integrated image references and hashes are preserved by the copy manifest; this audit verifies those bindings and scope statements rather than claiming a new pixel review.

## Corrections verified and remaining publication step

The initial README incorrectly generalized that production styles were unchanged. The final text now specifies shared styles and route entry points and explicitly acknowledges email/Work feature styles. Its initial Portfolio browser table also omitted the four inherited slow budgets; final README and STATUS now record the exact1,047/4 distribution and preserved declarations. Both corrections match source diff/raw result JSON and are verified in the final snapshots.

The only remaining publication step is the integration owner's intended committed-blob verification and evidence-only commit/draft publication. This audit does not claim that those external steps already occurred, nor authorize merging or deployment.

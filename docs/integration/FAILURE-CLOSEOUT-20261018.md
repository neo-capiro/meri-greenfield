# Remaining Meri failure closeout — 2026-10-18

> Query-date correction: valid explicit offset forms and ineffective nested timezone controls were found after this checkpoint. [The reviewed follow-up](QUERY-DATE-OFFSET-FOLLOWUP-20261018.md) fixes the validator and requires real child execution. The earlier standard/worker/type receipts below remain historical; their timezone-control claim is superseded.

The **48 original test failures and all 21 TypeScript diagnostic occurrences are resolved** in this source-only follow-up to [PR180](https://github.com/neo-capiro/meri-greenfield/pull/180). Independent worktree lanes were reviewed and consolidated into one branch, `fix/remaining-audit-failures-20261018`. The reviewed local code commit is `e79ceba058343f2a78c655c50c82006604dda4e7`; its published equivalent is `3ce470a28be602499406359f40fd2b5998d0c58e`, with identical complete tree `859f84abf40d0ed565088b621f5c26a6f824877d`. The final documentation commit adds evidence only.

Four additional inherited retention/history fixture failures remain named dependencies on dot's integration lane. This is not complete release qualification. The deployment/chat hold remains active.

## Exact comparison and environment

| Pin | Exact commit | Standard | Focused worker | Runtime / control diagnostics |
| --- | --- | --- | --- | --- |
| Requested PR180 candidate | `a1876afaeaa59d9da47729487d490cba8cfc9d9c` | 4,357 pass / 32 fail / 4,389 | 4 pass / 16 fail / 20 | 3 / 18 |
| Immediate Git parent | `1aa5c66e9283024e78ad6f26f5450cbc61a37659` | 4,357 pass / 32 fail / 4,389 | 4 pass / 16 fail / 20 | 3 / 18 |
| Receiving PR179 parent | `141f2ada6378382f2bf7462d8a2c5dc7758230d0` | 4,356 pass / 33 fail / 4,389 | 4 pass / 16 fail / 20 | 3 / 18 |
| Final combined source | `3ce470a28be602499406359f40fd2b5998d0c58e` | **4,391 pass / 0 fail / 4,391** | **20 pass / 0 fail / 20** | **0 / 0** |

All final required commands exited 0, with no skipped, cancelled or TODO tests. Two new date-normalization tests account for the standard count increasing by two. All 48 exact original failing names occur as passing tests in the final logs. The two policy errors appear in both projects: 21 emitted occurrences represent 19 unique path/location/code diagnostics. All 48 failures and 21 occurrences are inherited at both parents; the receiving parent also has the already-repaired history fingerprint failure. **No newly introduced failures remain** in the required combined checks. The four broader dependencies below are unchanged, not new failures.

Supported environment: Node **v24.19.0**, npm **11.9.0**, TypeScript **5.9.3**, Linux, `TZ=America/Toronto`, `NODE_OPTIONS` unset. All 14 lockfiles were byte-equal across pins. Existing matching dependency installs were reused without installation or tracked changes; contracts dependencies were copied and every worktree resolved its own local public package. Initial missing Zod/Temporal dependency-link attempts are preserved and classified as setup observations, excluded from product counts. Exact lock hashes, per-pin trees, command times, exit codes and logs are in the [baseline reproduction](audit-closeout-evidence-20261018/baseline/BASELINE-REPRODUCTION.md) and [machine-readable inventory](audit-closeout-evidence-20261018/baseline/baseline-reproduction-inventory.json).

The supplied `Capiro-Meri-Audit-Evidence-2026-10-18.zip` has SHA-256 `761712caae2671d5dc8c56cb49c1126d01b6373f89a99ebeaa923efe966947e8`. Its 80-entry evidence manifest verified with zero mismatches (82 archive members). Its focused-worker supplement measured local `43db1dfac9663962efb0e49fa24ec7ddea10f9d0`, published `7e4e75828abcd870137ea8f72ff5fbea08fa25a6`, tree `ca3f3a59e556e191a2a76c74c5deb87cc356af5a`; it did not measure the requested newer candidate. All eight relevant worker/service/store/fixture source hashes match `a1876afa`, and fresh candidate/parent runs independently reproduce 32+16 distinct failures and 3+18 diagnostics. See [supplement](audit-closeout-evidence-20261018/bundle-references/tests-worker-supplement.md), [source pins](audit-closeout-evidence-20261018/baseline/worker-source-pins.json) and [bundle source state](audit-closeout-evidence-20261018/bundle-references/source-state.json).

## Required final commands

Run from the final code tree, with exact captured argv, UTC timestamps, source tree and SHA-256 log hashes in [final-run-metadata.json](audit-closeout-evidence-20261018/final/final-run-metadata.json):

```sh
env -u NODE_OPTIONS TZ=America/Toronto npm run check
env -u NODE_OPTIONS TZ=America/Toronto node --test apps/worker/conversation/test/options-trust.test.mjs apps/worker/conversation/test/activity.test.mjs apps/worker/conversation/test/terminal-settlement.test.mjs
env -u NODE_OPTIONS TZ=America/Toronto node apps/runtime/node_modules/typescript/bin/tsc --noEmit --pretty false -p apps/runtime/tsconfig.json
env -u NODE_OPTIONS TZ=America/Toronto node apps/runtime/node_modules/typescript/bin/tsc --noEmit --pretty false -p apps/control/conversations/tsconfig.json
```

The standard script is `node --test packages/contracts/test/*.test.mjs evals/qualification/hermes-session.test.mjs`. No ambient experimental VM flag was added to that gate. The one browser-isolation test now invokes its bounded child explicitly with `--experimental-vm-modules --input-type=module`, retaining empty import resolution and original isolation assertions. No mock flag is required by the focused-worker group. The four required final commands were each run once on the combined source. Full scrubbed [standard](audit-closeout-evidence-20261018/final/standard.scrubbed.log), [worker](audit-closeout-evidence-20261018/final/worker-focused.scrubbed.log), [runtime](audit-closeout-evidence-20261018/final/runtime-types.scrubbed.log) and [control](audit-closeout-evidence-20261018/final/control-types.scrubbed.log) outputs are retained; successful typecheck outputs are correctly empty.

## Repair contracts and independent review

- The synthetic action demo now uses the canonical task-bound signed-source fixture, actual `/api/clio/tools/actions.query` route and `{input,metadata}` envelope, preserving selector/cursor scope. The 23 receiver tests reach their unchanged success/refusal assertions. Production authority is unchanged. Focused owner verification: 162/162; independent overlapping review: 98/98.
- The 16 worker failures occurred before SDK execution because the fixture attempted an obsolete implicit initial-input path. Both worker files now opt into the canonical initial-input fixture and explicitly allocate that exact input before submission. Existing worker and terminal assertions are unchanged. Final group: 20/20.
- Six stale expectations were checked against accepted descriptor/package releases and the actual task HTTP owner before updating exact expected versions/routes. Historical versions/hashes remain checked; assertions remain strict.
- The browser VM probe is self-contained and bounded (10 seconds / 1 MiB), with no Node globals or external imports. The missing VM constructor was a test-runner setup defect, not evidence that the public browser module was broken.
- Initial-input provenance was audited before running its canonical generator. Only the pre-existing PostgreSQL-store hash and byte count changed; generated browser JavaScript, schema and declarations remain byte-identical to the candidate. This is a shipped generated-metadata defect, not a reason to relax the provenance assertion. Dot's later PostgreSQL source changes will need canonical revalidation during integration.
- Public query dates without a zone were being interpreted in the host timezone despite the UTC normalization contract. The focused production fix uses UTC for those accepted inputs and preserves explicit-zone instants and previous rejection behavior. It is classified as a product defect, correcting the earlier report's environment-only characterization. New regressions include a 132-case explicit-zone reference matrix under UTC/Toronto/Tokyo. Review found offset/comment edge regressions in intermediate lane commits; those failed controls are preserved, and the corrected final date implementation passed independent 198/198 contract tests. Only the corrected final date diff is consolidated here.
- Worker capability and egress types now express validated operation references, exact optional UID handling, unknown-error narrowing, concrete socket generics, complete SOCKS greeting bytes and nullable reader wake callbacks. Unused UID plumbing was removed. No blanket casts, broad `any`, suppression comments or typecheck disabling were added. Egress owner verification: 33/33; capabilities: 30/30 plus four SDK/plugin security checks; independent overlapping reviews: 14 socket and 25 capability tests. Both final project typechecks pass.

The combined source review verified exactly 18 changed code/fixture/generated files (147 insertions / 41 deletions), no dependency/manifests/lockfiles/type-config changes, no removed assertions, skips or weakened isolation. Ownership lanes used separate worktrees and no dot-owned production or fixture files were edited. Source `git diff --check` passes. Counts from focused reviews overlap and must not be added to the final suite totals.

## Exact failure and diagnostic mapping

[Before/after inventory](audit-closeout-evidence-20261018/BEFORE-AFTER-INVENTORY.md) lists **every original failing name, location and assertion**, its individual classification/cause, published fix commit and verification. [JSON](audit-closeout-evidence-20261018/before-after-inventory.json) additionally retains full original diagnostics and expected/actual values. All 21 TypeScript occurrences include project, file/line/column, code, full message, fix and final result. The [evidence manifest](audit-closeout-evidence-20261018/evidence-manifest.json) hashes the scrubbed logs, including failed baseline, dependency-setup, intermediate and review-control results. Scrubbing replaces only local workspace/temp paths; assertions and fixture values remain visible.

## Dot-owned integration dependencies and remaining limits

A bounded additional two-file check freshly reproduces **16 pass / 4 fail / 20**, identically on final code, `a1876afa` and `1aa5c66e`. All five implicated test/composition/guard file hashes are identical across these pins. These four cases are outside the reported 48 and are recorded separately rather than silently omitted:

| Exact failing test | Exact failure | Named dependency |
| --- | --- | --- |
| through the watermarked journal, an advance whose commit is unknown leaves the projection standing and closes the serving fence | `apps/control/retention/test/postgres-watermark.test.mjs:50`; `RETENTION_CONFIGURATION` because inner fixture omits required `journal.withTransition` | Dot: retention-fence/pool integration; fixture at line 52, requirement in `recovery-watermark.mjs:32` |
| trusted startup composes canonical session, submit and membership history, with missing lifecycle owners refused before writes | `apps/runtime/test/startup-history.test.mjs:35:107`: actual `503`, expected `200` | Dot: history membership/Core authorization; fixture lacks `conversationCurrentness` |
| membership revision changing during assembled transcript read withholds reload response | `apps/runtime/test/startup-history.test.mjs:85:10`: actual `503`, expected `409` | Dot: history membership/Core authorization; same incomplete fixture |
| scripted worker delta streams publicly and reloads from the membership transcript | `apps/runtime/test/startup-history.test.mjs:100:109`: actual `503`, expected `200` | Dot: history membership/Core authorization; same incomplete fixture |

```sh
env -u NODE_OPTIONS TZ=America/Toronto node --test --test-reporter=tap apps/control/retention/test/postgres-watermark.test.mjs apps/runtime/test/startup-history.test.mjs
```

This command intentionally remains exit 1; [all three scrubbed logs and exact metadata](audit-closeout-evidence-20261018/dot-dependencies/metadata.json) are retained. No module-mock flag is needed. No fixture repair is made in those owned files.

Dot also retains Control CA/kickoff diagnostics, retention connection-pool starvation, SDK/proxy model identity/stream-settlement parsing and Portfolio/Modules preview integration. The focused worker fixture repair reaches the existing mocked SDK assertions but does not establish live model identity or stream correctness. Real PostgreSQL contention/pool-pressure qualification remains unrun; no server/container toolchain was available and none was provisioned. These are integration/release blockers, not passing claims from this source audit. No live PostgreSQL, AWS mutation, model call, migration, credential change, deployment, merge or frontend edit occurred.

PR175 remains `993f52a97e5d9edcf65c9f89423c097aa52831c7`; PR98 remains `5c784e3e46114816ba57db17ad7a2c2013a8d81a`, preserving its composer fixes. PR180 itself remains `a1876afaeaa59d9da47729487d490cba8cfc9d9c`. The new draft is stacked on PR180 for dot to review and integrate.

## Published source commit mapping

GitHub's connected Git Data publication recreates commit metadata, so local/published SHAs differ. Every complete tree was compared before moving the new branch; no force-push or another branch update occurred. The final suite ran on the exact local code tree whose published equivalent is shown above.

| Reviewed local commit | Published fix commit | Change |
| --- | --- | --- |
| `3e6e12636c58b55514d4b640680e6085a5b4dcb7` | `1ec3c56a51be5fdd5973ca459f30c3dc59aa0d1f` | Repair worker activity fixtures with canonical initial input allocation |
| `32000910ae0ad60c3fc10d1d2f2a08095ed47750` | `f205fb6bdfed3f0e07118aec70d714bcc72c1c43` | Align synthetic action demo with task-bound signed source contract |
| `e52eb92623d24e4d0e04c7dfa45c570c21061ce6` | `e2dba6dd3e8ea40fac29fdc73fc98a8f94c49cf4` | Correct egress socket and SOCKS reader type boundaries |
| `75bc0a3841e41deb564d3fb95df77ffd79d7b9da` | `f8ecabc14847925391c923e979650248e21008c4` | Type validated capability policy and skill plugin boundaries |
| `5a046ceb48de0b970d9ff4451269b353231707cc` | `74a1c9de931d203e66d045beff5c83c7fe7ac35a` | Align independent contract fixtures with accepted versions and task route |
| `a87b8b10605fc006629f8183150449a09213320f` | `d912ab77a978ab11a4852b49ba78704fbf12a30d` | Run standalone document receiver isolation in bounded VM subprocess |
| `23a515445a3b5f8610e35cf469b9d8848d2b51b6` | `49a2f2a72263dafafc1ce919bc73f3861ec57b6c` | Refresh audited initial-input PostgreSQL provenance only |
| `e79ceba058343f2a78c655c50c82006604dda4e7` | `3ce470a28be602499406359f40fd2b5998d0c58e` | Normalize unzoned query dates in UTC while preserving explicit instants |

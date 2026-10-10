# W02-14 candidate 3: primary verification findings

Codex integration owner independently inspected the closed candidate `234a08ed38f57ebeb783fedf0bf8368b968e931f` (`032c92b` source repair and a report-only addendum). **UNACCEPTED.** No source integration, deployment, native run, security waiver or gate promotion follows from the author's passing checks.

Actual implementation session `20261010_001742_5efe2a`, phase 3, closed at 2026-10-10T05:01:17.720931Z with exit 0, empty process tree, finished readers, confirmed cleanup and no capture/cleanup errors. All eight allocated tracked files are committed; the worktree is clean. Owner copied and compared their raw bytes with the exact Git commit, plus the complete private phase-3 evidence, into `.task-inputs/W02-14-owner-candidate-snapshot-3/`. Manifest SHA256: `6dbf101542f2ed434fd72469c0dc4305404bd6e45bd745dfef5550e6da913df4`.

The owner read the five modules, canonical test, README, author report and private harness. The entry point composes cohesive binding, expression, workflow and infrastructure modules. This respects the user's focused-code requirement; it does not establish behavioral acceptance.

## Checks and measured blocker

Owner checks ran once against unchanged candidate bytes at 05:05:53.761445–05:05:59.182780Z, with independent 60/120-second process bounds and no AWS calls:

- Canonical `node --test scripts/test-native-enforcement.mjs`: 31 PASS, exit 0. Captured stdout SHA256 `6b72daac39ba578e1888af6bd5cec829f65beb1de9ba16382a2537c81a5a3ef1`.
- Composed actual JSONata 2.0.6 replay: 293 expressions parsed, zero syntax failures, 144,567 evaluations; **25 PASS / 2 FAIL of 27**, exit 1. It includes the author's 25 cases and two owner extensions. Captured stdout SHA256 `4651de1e9254c98de9a2d0c8294f33f070aec64876f91d23c22888689d1731f9`.

Retained private directory: `C:/dev/main/meri-greenfield-worktrees/w02-native-enforcement/.task-inputs/W02-14-primary-checks-3/`. Its `results.json` records commands, time bounds, exit codes and six source hashes before/after execution. Owner harness SHA256: `3ee979a0bb60764faf47b51c8979f4492f3144f1b1d9e7d52d2ace1fdd42f114`. The retained runtime hash is `8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b`; synthetic clock/AWS responses and post-admission state injection are explicitly labelled. This is neither AWS execution nor IAM/service validation.

Both new cases start with valid attachment data, introduce a contradictory observation, then return valid data:

1. ENI attachment `details` becomes the string `malformed`.
2. An `ATTACHED` ENI has an empty details array.

The candidate attempts one scoped stop and confirms terminal cleanup in both cases, but incorrectly emits `RUNTIME_CHECKS_ONLY_NOT_NATIVE_ACCEPTED` instead of sticky qualification `FAILED`. `attachmentsPending` in `lib/expressions.mjs` checks counts of named details without requiring a well-typed pending attachment. These observations therefore take `NetworkUnknown`, which does not preserve a contradiction as sticky failure. The existing author malformed case concerns the outer attachments value and misses this nested case. A separate read-only Codex reviewer independently identified the same source defect before the owner replay.

## Evidence qualifications

The author's retained 25/25 traces and 31/31 canonical tests remain passing evidence for their stated cases. Both broad repository checks failed for the pre-existing missing `ajv` dependency; the owner did not replay those unchanged failures or install dependencies.

The author report overstates the harness's measurement coverage: Task/Catch paths measure newly assigned values, omit resolved Output measurement, and do not measure merged whole persistent variables. Execution starts at Initialize; canonical GuardInput coverage establishes a structural synthetic refusal, not evaluated admitted context predicates. `commitCtx` checks the proposed context but does not separately check its compact fallback; records bound individual fields rather than the assembled output. No reachable oversized fallback/output has been demonstrated. These remain proof/coverage limitations, distinct from the two measured classification failures.

The fallback preserves both positive ledgers and sticky hold. Pending stop dispatch precedes terminal polling. StopTask permission still depends on current resource tags; synthetic stop responses do not qualify real authorization, tag propagation or survival.

## Next gate

A distinct actual Hermes reviewer examined exact `234a08e` in `w02-native-enforcement-review-1` (query SHA256 `64b7877e1b0ad01e876dd697258f170eed16f958b72119ad691851403fcf7d71`, start 05:04:54.862049Z, PID 47668, at most 40 turns/1800 seconds). Session `20261010_010457_186e99` CLOSED at 05:14:39.942397Z, exit 0, empty process tree, finished readers, confirmed cleanup and no capture/cleanup errors. Report-only commit `c8a4c94f5672e880354819ecccbedacb40cbba46` is preserved at root integration `e5a73b9`; [the unchanged actual report](W02-14-NATIVE-ENFORCEMENT-REVIEW-1.md) has SHA256 `f5d7ea86e6e6d597721a16e3ef6fd20199b29db75ff9a714953ac2feb5787ccc`. Its source-level PASS does not override the owner's measured failures or cover the two nested-detail cases. Preserve the candidate and all failures; any repair must receive bounded implementation, new relevant verification and a separate exact-commit actual review.

The owner inspected the review's retained verifier, result JSON, stdout, report and closure, preserving an audit at `.task-inputs/W02-14-owner-review-1-audit/audit.json` (SHA256 `06e6562fbaeb5374e003dca006e8f80d0016125375b5cd103d39161e79fbd421`). It records 19 composed cases, nine static checks, 139 assertions, 293 parsed expressions and 134,284 evaluations. The verifier's fake stop function references a module-scope `foreignStop`, while the asserted flag is local to each trace. A foreign stop would throw before logging and be caught as a fake API error, leaving the local flag false; that assertion alone cannot establish absence of foreign stop attempts. This is a verifier defect, not evidence that source issued a foreign stop. Task/Catch Outputs are resolved but unmeasured; merged-variable bounds and worst-case fallback coverage remain limited. The report's maxima (context 11,409 / variables 13,196 / Output 14,834 / Assign 11,417 bytes) differ from the actual result JSON (11,409 / 16,338 / 14,837 / 12,995). Preserve the actual report unchanged and use the raw results for those measurements.

Actual ASL validation/TestState, wire casing/context, deadlines/error behavior, IAM, managed-service survival, physical cleanup, native SDK/Office/browser qualification and security admission remain open. G1 stays OPEN; no new native task has launched. Current Meri is untouched and no cutover is authorized.

## Additional actual-definition integration finding and repair allocation

The independently reviewed definitions-only registration subsequently supplied actual SDK:1/Office:1 JSON. A primary local witness using those exact cached task-definition bodies and synthetic other authority rejects candidate234a08e at `exact volumes/single worker`. Independent data/source review confirms reordered environment/volume arrays, explicit empty Linux/logging/container defaults and `placementConstraints:[]` trigger later strict comparisons as well. Registration properties remain consistent with the reviewed template. These readback differences require an explicit, fail-closed adapter; they do not authorize ignoring unknown or nonempty fields. Full raw bytes/hash references must remain bound.

After exact closed candidate/source/process inspection and absence of a worktree lock, the owner explicitly resumed author `20261010_001742_5efe2a` for bounded phase 4 at 05:15:41.591362Z. It owns the previous eight paths plus NEW `infra/native-enforcement/lib/task-definition.mjs`, separating task-definition readback validation from binding/evidence. Query SHA256 `58af07238c1562f808e3889f9a2fe3b30cea6daa8515b90731d5614d1e8ce8ed`; input manifest SHA256 `66fde8beeb4dca402a607abcc6e5dd349a241e08213ec3db3ed1edbaa56194a1`; PID 27432; at most 40 turns/1800 seconds, final eight turns reserved for checks/report/scoped commit. Phase 4 CLOSED at 05:25:21.704963Z, exit 0 with confirmed empty process tree/readers/cleanup, at clean candidate `c0623278707b033beec8e4e4640324d0fb3df9a1`. [New primary findings](W02-14-PRIMARY-CANDIDATE-4-FINDINGS.md) keep that candidate unaccepted. Review 1 is closed on its separately pinned candidate `234a08e`; any new repair requires its own exact-commit review and independent owner replay.

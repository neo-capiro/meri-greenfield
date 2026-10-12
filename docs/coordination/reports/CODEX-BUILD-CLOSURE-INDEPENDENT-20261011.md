# Independent build-closure source review — 11 October 2026

**ACCEPT_SOURCE_ONLY_PARTIAL. No executable build, runner, security, runtime or G1 admission.**

Reviewed source commit `c0cef1430d3a0e2bd6b441a599f8fa8c3c0987fa`, tree `8eff53f0ea6178c78a22fce9f05f30a58172aed9`, against parent `a5c41c7afdd9ec235ac3a0184a96e4c457ef2f90`, tree `3181f8e0d75299e39fc45a738baff4c41e01463e`. Review used a separate frozen local worktree and `GIT_NO_LAZY_FETCH=1`; no network, cloud, Docker or provider operation was performed.

## Source and module review

All 21 changed paths were reviewed. Six are qualification implementation/test files; the remaining fifteen are task/report and retained evidence files. No application, dependency lock, upstream package, component/license pin or infrastructure resource was changed.

`worker_image_manifest.py` is the single owner of source/archive membership. It derives the existing 53 context paths plus assembler, collector, its own transported module and buildspec. Publication adds publisher and cleaner. Independent guarded import inspection confirms 57/59 source records and 58/60 archive members. Preparation requires exact canonical names; load continues to require exact entry count, name set, regular-file mode, size and bytes. Collector membership validation occurs before per-file reads/output creation and retains byte/hash and historical assembler checks. Missing, extra or duplicate names cannot satisfy the set/count checks.

`worker_build_binding.py` owns proposal/review validation separately from filesystem measurement, AWS identity capture and dispatch. It validates closed JSON fields, bounded records, exact helper membership, hashes, target identity fields and canonical path shapes. Root binding review requires the exact proposal/source/closure/authority references and a bounded UTC validity interval. It remains a proposal contract: it does not prove a complete physical runtime closure, authentic STS, filesystem link safety or action-approval provenance by itself. Those remain requirements for the unimplemented trusted fresh-runner adapter.

The CLI branch is thin and inspect-only. Missing binding configuration exits 2 without a slot or cloud call; help exits 0 and documents the distinct status. Prepare/execute/reconcile reject runner overrides. A valid proposal cannot enter execution through this candidate. Import checks with process, socket, data-open and directory-allocation guards pass for both new modules and the owner CLI module. Module ownership and dependency direction remain cohesive; no parallel orchestration or authorization implementation was introduced.

## Independent verification

| Check | Result |
| --- | --- |
| Focused contracts | 18 PASS |
| Nine pre-existing publisher cases, separately rerun | 9 PASS; overlaps focused cases |
| Full owned builder/publisher suite | 45 tests: 43 PASS, one FAIL, one ERROR |
| CLI help / missing binding | Exit 0 / exit 2 |
| Guarded import and membership inspection | PASS |
| Committed source diff whitespace | PASS |
| Protected implementation functions | Ten AST-identical to parent |
| Protected source/pin/cleanup files | Six byte-identical to parent |

The full-suite FAIL is the unchanged current-context-versus-historical-authority assertion: current `da96000546d9688bafd50ffb5d6101ce5a76300e65a47bfb5ea55a1273bd13a4` differs from historical `18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`. The ERROR is the unchanged fixed Administrator Windows/Python runtime guard on this Linux reviewer. Both failing test functions are independently AST-identical to the parent. These are open source/execution gates; they are not skipped, weakened or waived.

The changed positive source-byte fixtures explicitly inject the observed current assembler hash only inside the fixture. Their original external-hash, source-drift and publication-repository negatives remain. Production assembler/context/Python/caller pins are unchanged. This fixture injection does not establish current context or assembler admission.

Ten protected functions (`pins`, `validate_authority`, `check_review`, `recipe`, `dispatch`, `execute`, `reconcile`, `validate_repository`, `validate_build`, `start_input`) are AST-identical. Component pins, context assembler, source-pin generator, host authority/source owners and credential cleaner are byte-identical. Current assembler `48f065d0…` still differs from historical pin `67c1cf55…`; the candidate does not conceal that gap.

## Acceptance limits

No source-review blocker was found for this bounded partial change. The source prerequisite packet remains `NOT_EXECUTABLE_MISSING_PREREQUISITES`. Fresh runner observation/preparation/load/execution integration, complete current source authority, exact build approval/cost/cleanup binding, security/license disposition and actual image/runtime qualification remain unfinished. The full historical build path remains unsuitable for the new capirocli/Python 3.11.15 runner. No provider budget, fence or deployment approval is created by this review.

Evidence lives in [independent-review](../../qualification/candidates/build-closure-20261011/independent-review/): raw stdout/stderr, bounded command receipts, protected source identities, import inspection and unchanged-failure classification. These are source/fixture checks; they are not actual AWS or native image execution evidence.

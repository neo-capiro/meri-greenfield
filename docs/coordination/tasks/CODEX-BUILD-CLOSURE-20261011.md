# Source-only build closure repair — 11 October 2026

Base: `a5c41c7afdd9ec235ac3a0184a96e4c457ef2f90`, tree `3181f8e0d75299e39fc45a738baff4c41e01463e` (source-equivalent remote publication `415a55827b3f6343a0835e1d0e30fa0c69d673e6`). Dedicated worktree and branch: `meri-build-closure-20261011`, `task/build-closure-20261011`.

## Implementation outline

- `worker_image_manifest.py` owns canonical archive membership, deriving it from `worker_context.MEMBERS` and named assembler/collector/recipe/publication files. Build preparation and collector input validation reuse it. Exact membership, bytes and hashes remain mandatory.
- `worker_build_binding.py` owns a separate new-runner proposal contract and exact root review binding. It validates source/tree, full helper/runtime closure, expected capiro-dev/capirocli identity and bounded validity. It supplies no cloud transport or execution authority.
- `worker_image_build.py` remains the CLI/preparation/dispatch adapter. Its existing historical executable/version/hash/principal guards remain intact. A new inspect-only action may validate a fresh binding proposal but cannot dispatch it.
- Existing tests preserve their assertions. Current-source fixtures explicitly inject source-only assembler/context identities; fixed historical identities are separately tested for refusal. New negative cases cover membership, proposals, reviews, expiry and unchecked closure.
- Historical evidence, protected manifests, runtime pins and admission decisions are not rewritten. No AWS, Docker, provider, SQL or fence actions are permitted. Runtime authority, infrastructure cost, new image security and full integration remain external gates.

Baseline reproduction: the publisher's nine tests produce eight PASS / one ERROR (`exact source/recipe records`). The collector assumes 49 publish / 47 build records, but the current context has 53 files before assembler, collector and recipe. The corrected expected source-record counts are derived, not separately hardcoded. The immutable assembler/context pins must still refuse unreviewed current identities.

Owned changes: builder, publisher (if needed), collector (root explicitly allocated), their two existing tests, the two new cohesive modules above, this task, matching report and `docs/qualification/candidates/build-closure-20261011/**` evidence. No recursive workers or background schedulers. Root independently reviews this return before acceptance.

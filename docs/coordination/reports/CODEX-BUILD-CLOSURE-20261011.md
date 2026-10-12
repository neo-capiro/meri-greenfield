# Build closure source prerequisite return — 11 October 2026

**PARTIAL_SOURCE_PREREQUISITE_HOLD. No runner/build/security/runtime/G1 admission.**

Base/source ownership and outline are in `../tasks/CODEX-BUILD-CLOSURE-20261011.md`. Retained check receipts, preservation proof and missing-input packet are in `../../qualification/candidates/build-closure-20261011/`.

## Implemented

`worker_image_manifest.py` is the canonical owner of source/archive membership. It derives records from the existing 53-member `worker_context.MEMBERS`, explicitly named assembler, collector, manifest owner and recipe, plus publisher/cleaner for publication. Preparation/load and collector validation reuse it; missing, extra and duplicate paths are refused before source/output work. The transported module must itself be included, giving **57 build / 59 publish source records and 58 / 60 ZIP entries**. These are derived results, not new magic constants. Strict regular-file, byte, hash, Git/current identity and archive checks remain.

`worker_build_binding.py` is a separate, import-safe proposal/review contract for the new Windows capiro-dev/capirocli runner. It requires exact commit/tree/context/assembler/authority hashes, full caller fields, canonical absolute paths, file bytes/hashes, unique runtime records and exact helper membership. A distinct root binding review pins the full proposal/closure and a maximum ten-minute UTC validity interval. Future execution must supply matching fresh runtime/helper/caller observations. This module contains no AWS transport, runtime scanner or dispatch.

`worker_image_build.py inspect-binding --runner-binding-file <file> --runner-binding-sha256 <hash>` checks the proposal only. It returns `SOURCE_ONLY_BINDING_PROPOSAL_NOT_EXECUTABLE`, `runnerQualified:false`, `buildAuthorized:false` and zero AWS calls. Missing configuration exits 2 before a slot or cloud call. Preparation, execute and reconcile reject runner overrides. Existing actions still require their evidence slot; CLI help documents exits 0/2.

**An approved new binding cannot yet drive prepare/execute.** The historical fixed Administrator Python 3.12.14/hash and hermes-cli principal are preserved. Their failure on the shipper's Python 3.11.15/capirocli runner remains an implementation gap. The proposal validator does not prove runtime closure completeness, authentic STS or approval provenance by itself; trusted fresh measurement and independent root review remain required.

## Verification and preservation

- Baseline publisher reproduction: **8 PASS / 1 ERROR**, caused by obsolete 49/47 record cardinality. The first attempt to invoke unittest from the repository root failed import-path discovery; the correct scripts/qualification cwd reproduced the real baseline.
- Current focused contracts: **18 PASS**, including all nine publisher cases and their original publication/source-drift assertions, binding negatives, and membership/source-drift cases.
- Full owned builder/publisher suite: **45 tests, 43 PASS, 1 FAIL, 1 ERROR**. The unchanged context identity assertion observes current `da96000546d9688bafd50ffb5d6101ce5a76300e65a47bfb5ea55a1273bd13a4`, while the immutable historical context pin remains `18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`. The unchanged actual owner runtime test refuses this Linux runner at `fixed owner Python runtime`. These are open gates, not skipped or weakened tests.
- Current assembler SHA is `48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851`; historical collector pin remains `67c1cf554e80c62eeb56b6dcb9be00106adf9b1b8b40beba85249de662b835eb`. Positive current-source fixture tests inject an observed assembler hash only within the test; production pins remain unchanged. Those byte-preflight fixtures do not establish context admission.
- An initial new negative CLI test errored because its test module omitted `sys`; adding that import corrected the test. No production guard or assertion was removed.
- CLI help PASS; missing binding exits 2; whitespace check PASS. Actual stdout/stderr and hashes are retained in `checks.json` and its referenced streams.
- `preservation.json` verifies ten existing builder functions are AST-identical to the pinned base: `pins`, `validate_authority`, `check_review`, `recipe`, `dispatch`, `execute`, `reconcile`, `validate_repository`, `validate_build`, `start_input`. Six protected source/manifest/cleanup owners are byte-identical. No protected pin manifest, upstream dependency, license record or historical evidence changed.
- No AWS, Docker, model, SQL, fence, network resource or runtime action was made. No recursive worker or background process was started. Local Git reads used `GIT_NO_LAZY_FETCH=1`.

## Bounded follow-up design

1. Obtain the shipper's actual executable bytes/hash, exact Python version/base-prefix, complete stdlib/native-engine/runtime closure and helper/source observations. Recover fresh full STS and complete project/role/KMS/repository captures. They are not supplied by this candidate.
2. Add a distinct fresh-runner preparation/load adapter with injected validated runtime measurement and trusted STS capture. It must call the new proposal, root-review and observation checks; keep historical `pins()`/authority execution available only for its original profile. Do not replace historical constants with the shipper's path or trust model/UI-provided facts.
3. Qualify a new explicit input/authority profile binding reviewed current context/assembler, canonical membership, final source commit/tree, recipe, archive hash, helper/runtime closure and immutable upload version. Older source/archive evidence remains a separate identity. Never reuse the consumed historical approval or its context pins.
4. Make the exact one-build review independently bind the fresh runner/source/authority/recipe/archive request and approved infrastructure cost bound, UUID, supervision, no-retry reservation and cleanup plan. A runner review alone never authorizes a build, publication or deployment.
5. Verify negative cases and a local fake transport, then return the source candidate for root acceptance. Only the separately authorized AWS shipper can qualify the actual new build and PostgreSQL/native-library/browser/runtime checks. Security applicability, patched components, licenses and all admission gates remain open until measured evidence exists.

The packet `next-build-prerequisites.json` records required inputs and all admission flags false. It is reviewable source preparation, **not an executable AWS action packet**.

# W02-12 repair notes - Codex owner completion

Base 6176ce11217213f1f3b30801349864106c85a21a. Candidate remains unaccepted.

Installed Hermes session 20261009_223026_1720da, PID 45940, ran 2026-10-10 02:30:16.420174-02:39:13.483518 UTC with 40 turns/1800 seconds. It hit the turn limit and returned partial files without a commit. Launcher exit0 and confirmed empty process tree/readers did not establish source acceptance. The actual author reported 26 cleanup fixtures passing after two fixture repairs; v3 tests were not run; README/repair notes were missing.

Codex received ownership of exactly eight new paths. Five still-original partial files were copied to private WT .task-inputs/W02-12-returned-partial. The cleanup helper had already received one owner patch and was not reconstructed as original. Its original 12,286-byte SHA was 783c7a320ca5e6fd36194deea57b104ae1d57a7eb1242b4695ad93e7ce4f996d. Full actual session stdout remains private evidence.

Codex first run: 31 cleanup tests (one precise-error regex failure); 30 v3 tests (one missing-receipt fixture failure and nine subcase errors). Token-based shortening mistakenly changed standard-library .digest() to .dg(); the receipt fixture modified the wrong mocked surface. Both code/fixture problems were repaired and logs retained. Second run passed 31+30. Root-open metadata and config-inclusive entry-budget checks then passed 33+30. The tracked-spec source-binding correction justified one final 30-test replay, passing. No replay occurred without source/fixture change.

A pre-test pure representation attempt measured 25,852B and was rejected before writing the spec; it was not an AWS/build attempt. JavaScript template-construction errors occurred before those scripts executed.

## Complete v2 differences

Only five dispatch-helper function ASTs change: expected_content, archive_bytes, request_for, check_review, build_input_for. Every other function AST, including execute, full-project/identity validators, reservation ordering and defaults, equals frozen v2. Additional constants/docs select the tracked adjacent v3 spec and exact inventory/cleanup pins.

expected_content replaces a rejected-inventory blacklist with exact corrected bytes/SHA, pins cleanup bytes/SHA, checks tracked spec against exact Git bytes, and adds cleanup contract fields and truthful REVIEWED_INLINE_OVERRIDE placement. archive_bytes protects cleanup and spec. request_for/check_review bind cleanup version/SHA; build_input_for checks matching request/content. No arbitrary helper/spec path option is added.

The spec adds mktemp device:inode binding, invokes the exact archive-verified build-host source helper, retains failure-trap cleanup failure, captures stdout receipt exclusively, and moves strict cleanup before final result publication. The result validates absolute auth-root absence and directory/inode binding. Source verifier protects cleanup and tracked spec plus cleanup contract fields. At this base 25 protected records include 22 unchanged worker files.

Previously repeated fixed assumed-role prefix, KMS ARN and result bucket are factored to literal exports R/K/B. Role checks use re.escape(R) and the same bounded session suffix. Fresh identity equality before push/upload, exact full-project snapshot, conditional checksummed versioned source/result writes, immutable repository and all deadlines remain.

Five Python heredocs remain five. The local identifier mapping below saves representation bytes without changing JSON keys, literal paths or limits. External .digest() and self.raw spellings are restored/preserved after the first failed run. Reversing declared local names and comparing full ASTs proves the entire tar-copy reader and entire image/container/inventory verifier equal frozen v2. The other source/result/identity blocks intentionally change bindings/constants; exact private unified diffs and composed fixtures are preserved instead of a false whole-block equality claim.

- expected -> ex; unused mapping names cause no source change.
- contract -> ct; unused mapping names cause no source change.
- validation -> va; unused mapping names cause no source change.
- copied -> cp; unused mapping names cause no source change.
- cleanup -> ac; unused mapping names cause no source change.
- privilege -> pr; unused mapping names cause no source change.
- observed -> ob; unused mapping names cause no source change.
- record -> rr; unused mapping names cause no source change.
- records -> rs; unused mapping names cause no source change.
- names -> ns; unused mapping names cause no source change.
- member -> mb; unused mapping names cause no source change.
- remaining -> rem; unused mapping names cause no source change.
- reader -> rd; unused mapping names cause no source change.
- before -> bf; unused mapping names cause no source change.
- opened -> op; unused mapping names cause no source change.
- chunks -> cs; unused mapping names cause no source change.
- summary -> sm; unused mapping names cause no source change.
- entries -> es; unused mapping names cause no source change.
- raw -> rb; unused mapping names cause no source change.
- image -> im; unused mapping names cause no source change.
- images -> ims; unused mapping names cause no source change.
- container -> co; unused mapping names cause no source change.
- candidates -> ca; unused mapping names cause no source change.
- candidatesCount -> cc; unused mapping names cause no source change.
- digest -> dg; unused mapping names cause no source change.
- written -> wr; unused mapping names cause no source change.
- trailing -> tr; unused mapping names cause no source change.

No assertion or evidence was deleted to fit. Original tar payload/stream bounds, exclusive one regular member, no-start creation, before/after readbacks, positive container-removal readback before push, complete inventory hashes/roots/aliases/privilege validation, nonroot readonly/dropALL/NNP/network-none inert container configuration and digest/IID bindings remain. Native package-fetch networking remains available to the reviewed build only. No worker start/run/exec is added.

Final compact ASCII spec with one LF: 25,538 bytes, 62 below 25,600. The existing guard precedes archive/evidence preparation, reservation/S3/dispatch. Future edits must remeasure, never trim gates.

## Frozen authority proof

All six v1/v2 files matched base Git bytes and integration-root files. Root operational helper/spec still exactly match v2. All 22 worker source files remain unchanged. Protected records increase from 23 to 25 because new cleanup and tracked spec are included.

| Frozen file | Bytes | SHA256 |
| --- | ---: | --- |
| docs/qualification/worker-build-v1/start-reviewed-worker-build.py | 30974 | c905283c7606daeb1cc3fb6369a935f3db5d3d32d9a86d9d406e180a890a2ca5 |
| docs/qualification/worker-build-v1/test_start_reviewed_worker_build.py | 49835 | 35c2200137b390cd8852bf02e27bb45128fe3d154571371316fe0b6090be0830 |
| docs/qualification/worker-build-v1/worker-buildspec.json | 25900 | e055dff0860fa465087050fc2a9c7c6c318f94927fb4c16ac1115a89830cb356 |
| docs/qualification/worker-build-v2/start-reviewed-worker-build.py | 31925 | 6b4b17a3531ea190d3abf1402a99c06e2a2d99009b90a0dc027c1d85d757905b |
| docs/qualification/worker-build-v2/test_start_reviewed_worker_build.py | 52740 | 4484d845620b9d02887bee742ed723309da35cc0ccb4cf52b4581f41c14924f2 |
| docs/qualification/worker-build-v2/worker-buildspec.json | 25592 | cdd6edb8282f3fbf931162451493ee13e11d74e59fff0523cdd1f084609edd9c |
| ROOT operational C:\dev\main\meri-greenfield-kickoff-20261009\.task-inputs\start-reviewed-worker-build.py | 31925 | 6b4b17a3531ea190d3abf1402a99c06e2a2d99009b90a0dc027c1d85d757905b |
| ROOT operational C:\dev\main\meri-greenfield-kickoff-20261009\.task-inputs\worker-buildspec.json | 25592 | cdd6edb8282f3fbf931162451493ee13e11d74e59fff0523cdd1f084609edd9c |

Private WT evidence: codex-v2-v3-helper.diff, codex-v2-v3-spec.diff, codex-v2-v3-proof.json, codex-owner-representation-proof.json, codex-cleanup-tests-1/2/3.txt and codex-v3-tests-1/2/3/4.txt. Failed logs remain retained outside Git.

## Limits

Residual failed-build contents are UNKNOWN; Buildx state is a hypothesis. Pure fixtures do not prove real POSIX descriptor behavior, Bash timeout/redirection, CodeBuild tool availability, Docker logout races, actual Linux cleanup or actual secret absence. The trusted root build host/filesystem are prerequisites; this is not containment against malicious host root. Directory-count limits are checked after enumeration, not a preallocation guarantee. Outer timeout bounds process duration. Windows real deletion is refused.

No AWS, Docker, Bash/Linux, network, model/provider, real cleanup, build or application/source call occurred during Codex completion. Both prior reservations remain consumed. Independent exact-commit review and fresh explicit build admission remain open. Image NOT ADMITTED; G1 OPEN.

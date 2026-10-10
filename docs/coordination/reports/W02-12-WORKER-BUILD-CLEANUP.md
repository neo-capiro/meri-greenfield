# W02-12 - Worker build auth/state cleanup candidate

Status: **Codex owner source completion; UNACCEPTED pending independent exact-commit review**. Base 6176ce11217213f1f3b30801349864106c85a21a. Eight new paths only; this report is eighth. Installed Hermes returned partial source, explicitly closed, then Codex authored completion. This is not independent review or cloud admission.

## Observed failure

Build meri-greenfield-qualification-build:c30be2bc-c0d1-45ac-b0a8-c23ab360f3f8; source 6176ce1; archive 6c2362459d46824ce2f9411e7cfc926a7416e9ecd187f0c6d091798ea202e230; run 87890e41-3f88-4b4d-b1d3-aaa9b85aaa9b. Event 2713 pushed digest sha256:527e6d80d0e0cb9b3369f7f75d22475b96615bee171fb6fb6d57f31ce925d74e; events 2714/2715 reported auth-directory rmdir not empty. Build FAILED 2026-10-10 02:23:17 UTC. Residual contents were unobserved. Old result upload preceded cleanup, so a manifest may exist despite failure and is NOT ADMITTED. Both prior reservations remain consumed.

## Completion and evidence

The trusted build-host helper confines no-follow FD-relative cleanup to one root-owned 0700 directory under unchanged root-owned 1777 /tmp, bound by canonical nonce and mktemp device:inode. Metadata/count/depth/byte/deadline policy fails closed. Credential contents are never opened; no arbitrary receipt path/UID override exists. Missing config/already-absent bound root permit trap replay. Final absence/parent identity are checked; receipt separates observed result from policy.

V3 binds cleanup version/SHA, archive and tracked inline override. Its 25 protected records include 22 unchanged worker files. Cleanup after push/logout and independent absolute DOCKER_CONFIG lstat-absence verification precede successful final manifest publication. AuthCleanup receipt and sourceSHA remain in the result. Trap helper failure retains failed/unknown outcome. Existing immutable target, complete project snapshot, fresh STS, source version/checksum, one-attempt reservation, no-start inventory copy and positive removal gates remain.

Pure Python 3.12.14 final checks: **33 cleanup tests PASS and 30 transaction/spec tests PASS, no skips**. Injected fake filesystem/AWS/image data and actual embedded Python validator bodies only. Native Bash/Docker/AWS/build/provider and real deletion never ran. First owner failures remain:31 cleanup tests (one regex failure),30 v3 tests (one fixture failure/nine errors, including mistaken .digest rename). Repairs justified later passes. [Repair notes](../../qualification/worker-build-v3/REPAIR-NOTES.md) detail failed 40-turn history, full differences, mappings and frozen-source proof.

Entire tar-reader and entire inventory/container-verifier ASTs equal v2 after declared local-name reversal. Changed source/result/identity blocks retain exact private diffs and adversarial fixtures. Five heredocs remain. Final spec: **25,538 compact ASCII bytes with LF; 62-byte margin**. No assertion/evidence removal was used to fit.

Actual Hermes session 20261009_223026_1720da/PID 45940 closed 02:39:13.483518Z after 40 turns, no commit; process-tree/readers cleanup confirmed. Five original partial files are preserved privately. Original cleanup helper hash is known but untouched bytes were not separately copied before first owner patch. Session and failed owner logs remain private.

## Candidate files

| File | Bytes | SHA256 |
| --- | ---: | --- |
| scripts/clear-qualification-docker-config.py | 13489 | fbf5e0c23ac13fe75342f1488d84fdc446cb3d7b36a098adaf8dc5c0aefb191f |
| scripts/test_clear_qualification_docker_config.py | 18210 | 0865593071225eeda024fd7fd22aa44b0daa83e3d907ab7c58aa12b50e986399 |
| docs/qualification/worker-build-v3/start-reviewed-worker-build.py | 33809 | 3d778752724ade2f3406f2e6496b75ec8725dc40d605090eb3686c1d14fe5db2 |
| docs/qualification/worker-build-v3/test_start_reviewed_worker_build.py | 56399 | 4033c71412acf9551b07ab18c30a704eb08dad63fdca229d28080830dff7e0b7 |
| docs/qualification/worker-build-v3/worker-buildspec.json | 25538 | 0914c999976a2581795a62267960f8b1a361b38e6d5c05f926912accce66eeee |
| docs/qualification/worker-build-v3/README.md | 4446 | efb0c8dd1a760a3af9fc87fe9c6b636c14087bfffd63c823e8168ce4abda5310 |
| docs/qualification/worker-build-v3/REPAIR-NOTES.md | 8965 | c70279d673109580678a40251f812dd279b2375a6013dba7b1cec8f49a2296b6 |

Report hash/resulting commit are returned after commit; no circular self-hash is embedded. Frozen v1/v2 and root operational files remain byte-exact. Worker recipe/probes/pins/permissions unchanged.

## Open gates

Independent exact-commit source review; actual Bash/POSIX/CodeBuild compatibility and bounded live cleanup; fresh source/archive/review/build admission; registry digest/inventory/security review; separate runtime/application qualification. Never reuse consumed reservations. Windows real deletion unsupported. Pure fixtures cannot establish actual Linux cleanup or cloud safety. **Image NOT ADMITTED. G1 OPEN. Current Meri unchanged.**

# Independent Codex review: host-assets build v3

Closed 2026-10-10T15:05:19.702885+00:00. **PASS for the exact offline source/request scope; APPROVE_ONE_HOST_ASSETS_BUILD_V3**. Root must separately admit a fresh dispatch after its current-authority checks. No AWS, provider, Docker, build, host, asset or browser execution occurred during this review.

I did not author the current repair. I authored historical W02-12 cleanup-helper completion; its unchanged source is an explicit reviewed dependency, so this is independent review of the new support-build integration, not a claim of independent authorship review of that original helper.

## Exact bindings and scope

| Item | Exact identity |
| --- | --- |
| Recipe commit | `b0d92dbe19d281e099cc6573ec4d7d410b390aba`, only host-assets.buildspec.json changed |
| Helper commit | `6dc111c33f286189a8f9df78b21948c4be8b30dd`, exactly host_assets_build.py, host_assets_source.py and test_host_assets.py changed |
| Prepared request | `54015b517820d93e82b7f5c7612749612ade96c53dca5c0caea8d98423b29b83`; UUID `c54dc03c-779c-4571-8b71-2044e7e23d0c` |
| ZIP | 243466B, 28 entries, `0a06002d45579c809207e8f8d205c11e13960faa5f036c97229114de14a8ee01` |
| Exact inline override | 14943B ASCII JSON, `dc453d5636f4894285bf92b0eb1eeaa79e45a84360a92f8081d262068b4040df` |
| Cleanup helper | 13489B, `fbf5e0c23ac13fe75342f1488d84fdc446cb3d7b36a098adaf8dc5c0aefb191f` |
| Review JSON | 1612B, `a1127fa7c213fbd6ed929183bca055ba56801258feb23fdfe9ba6d7483653e24` |

The prepared directory is `docs/coordination/private-evidence/CODEX-G1-host-assets-b0d92db-owner-v3-1/`. It remains local preparation plus this review; no consumed execution reservation or build was created here by the reviewer. The request/expected input/result schemas are all version 3. The older configured worker buildspec remains hash-bound evidence and is forbidden for this support build; the exact reviewed override is mandatory.

I independently compared every one of the 28 fixed records against the actual ZIP, fresh raw Git blob stream at the recipe commit and current checkout. The retained prepare Git streams/envelopes match independently captured raw data; all modes and deterministic ZIP reconstruction match. All 5 imported helper pins match request/current/raw Git at the helper commit. Input/source hashes are DATA bindings, not a fresh STS or live project attestation. The helper refreshes those authorities before mutations.

The unchanged FROM scratch Dockerfile copies exactly 14 reviewed bootstrap/Python/profile assets. There is no RUN, ADD, CMD or ENTRYPOINT. The cleanup helper is record 28 outside the image COPY set. The recipe only creates an inert container with network none, read-only root, dropped capabilities and no-new-privileges; never starts it; checks created state before/after copy, byte-compares all 14 assets and requires positive removal plus empty removal readback before push. No worker image is built.

## Cleanup and publication review

The auth root is freshly mktemp-created at `/tmp/meri-worker-auth.<8 alphanumeric>` with 0700/root ownership and admitted device/inode. The existing helper removes config.json before state enumeration without reading or opening credential contents. FD-relative no-follow traversal enforces owner, mode, hardlink/special-file refusal, 4096 entries, depth 16, 64MiB aggregate, 16MiB per file and a 25s internal deadline; each invocation additionally has a 30s external timeout.

On success Docker logout precedes the pinned helper. The actual embedded verifier requires CLEANED, rootObserved true, verifiedAbsent true, exact admitted root/policy/bound identity and an independent absolute lstat FileNotFoundError. Shell nonexistence/non-symlink checks precede trap disarm, result construction and S3 publication. The result includes the actual cleanup receipt and expected cleanup source SHA. `ownedCredentialsPurged` refers to this owned Docker auth/state root; it is not a claim that the CodeBuild service-role credentials or all build-host state are erased. Failure/interrupt cleanup is bounded best effort and retains nonzero/unknown failure. Auth/state cleanup failure precedes successful-result construction/publication. A later upload or upload-response check failure can still leave an unadmitted result; image push also precedes cleanup and can leave an unadmitted image after failure.

Only three build-helper function ASTs change: request_for, load_prepared and check_review (schema/record/review bindings). Execute, reconcile, identity, full-project checks, source-version/checksum handling, activity/refusal, reservation/idempotency, returned-build authority and mutation ordering remain AST-identical to v2. The complete identity, image, extracted-assets and upload Python verifier blocks are unchanged. All 7 embedded Python bodies parse; Git Bash `bash -n` passes. Syntax checks do not execute Bash or Linux syscalls.

## Independent offline checks and retained failures

Python 3.12.14 from the verified Codex runtime ran **24 fake-AWS tests once and 33 fake-filesystem cleanup tests once: all 57 pass, no skips**. The fake-AWS suite uses real bounded local Git fixture repositories; AWS capture is replaced by a fail-if-real-call fake. Cleanup tests never perform real recursive deletion. All binary stdout/stderr and direct-child envelopes are retained under `.task-inputs/CODEX-G1-host-assets-v3-owner-review-1/`.

| Run | Exit / elapsed | Raw stderr SHA256 |
| --- | --- | --- |
|24 fake-AWS |0 /16.109s |`a9b54e5bd30522b906288423462ee5f4a145427cbbb7c755b27d771463cd4e9f` |
|33 cleanup |0 /0.141s |`baf7e6c9b5aee69f65f717ae4ded3766e1a980278e96c5bd482feb715042126d` |

Both stdout streams are empty. A deliberate Windows UNSUPPORTED_PLATFORM receipt appears inside the passing cleanup test; it is not a Linux cleanup pass. Static/data corroboration has 149+111 passing assertions, including raw-capture remeasurement and final current pins. These counts describe finite checks, not independent universal security properties.

Two private static-audit attempts failed solely because my navigation assertions treated initial Dockerfile comments as its first instruction and then treated the inert `/meri-never-start-host-assets` path as a Docker start command. Both failure JSON and raw captures remain. The corrected private third audit uses instruction/token boundaries and passes; no candidate source changed and neither offline suite was replayed. Parent also retained its earlier `python -I` sibling-import setup failure before IO and corrected `-B` local prepare/AWS 0; this review does not relabel the failed invocation successful.

## Conditions and remaining gates

The accepted helper assumes a trusted privileged build host, reviewed recipe/daemon and **no mount or bind mount beneath the freshly created auth root**. No-follow FDs do not prohibit mounted foreign trees, and this review does not claim containment against host root. Directory-count policy is checked after enumeration; process capture on Windows supervises only the direct child and buffers output in memory without a streaming cap. Real CodeBuild tool availability, POSIX deletion/races, Docker logout state and absence of credential remnants are live evidence obligations.

The prior support build `meri-greenfield-qualification-build:e81b9c38-064a-4324-ac16-5e5a60f2dbb0` failed with auth-root Directory not empty after pushing digest `sha256:4bb191b4d2a9e0faa3a4580404ae6cd71e7437bc07c863628c72dc97a73ad353`. It remains permanently UNADMITTED and its reservation consumed. Residual contents were UNOBSERVED; Docker/BuildKit state remains a hypothesis. This review permits neither retry nor reuse of that build/image/request.

This exact new request still needs root-owned fresh STS/repository/project/activity validation, single conditional source upload/version/checksum, one consumed StartBuild attempt, successful remote completion with positive cleanup/result evidence and independent registry digest/config/layer verification. The helper uses 10min build + 5min queue bounds and bounded CLI calls; no mutation retry or poll loop is added. Missing matches/uncertain dispatch remain reconciliation-only and cannot prove no build. **No image security acceptance, browser-host launch, runtime admission, source activation or G1 pass is granted. Current Meri is untouched.**

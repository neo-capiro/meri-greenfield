# Codex support-build v2 helper

Source-only helper implementation and local preparation are ready for independent owner review. No AWS, build, image push, host/native execution or provider/model call occurred. Only the four allocated paths changed in this session: `scripts/qualification/host_assets_source.py`, `host_assets_build.py`, `test_host_assets.py`, and this report. The shared `aws_evidence.py` and its validator dependencies were read and used unchanged.

## Focused implementation

`host_assets_source.py` is a Git-only reader and deterministic package builder. Its literal 27 size/SHA256 records were frozen from reviewed browser source `e23667a351ed3daaac9b2f95219e9c06f0510027`: fourteen payload files, ten owner JS/config files, and three recipe/authority files. The exact v2 content schema is `meri-host-assets-build-input/2`. It never reads source from the ambient working tree, requires no globally clean checkout, and accepts a later integration commit only if all fixed public blobs still match. A source commit is always an explicit lowercase 40-hex Git commit.

The reader uses the fixed Git executable, argument arrays, disabled hooks/fsmonitor and stripped ambient GIT settings. It checks the literal tree/modes/sizes before a bounded fixed-object batch read, verifies each blob hash, then emits a deterministic ZIP containing exactly those 27 files. It does not archive the repository, `.task-inputs`, private evidence, dependencies or secret/config files. Committed symlinks, missing files and same-size drift refuse. The generated source manifest is DATA for the reviewed v2 loader and is not an extra image payload member.

`host_assets_build.py` owns the single support-packaging transaction. Default invocation only prepares local evidence. It binds the exact archive, v2 buildspec, full normalized builder configuration and five helper/dependency files into a canonical review request. The immutable builder evidence is `qualification-build-context/project.json`, SHA256 `4a4279a20d8a9b4c3dff4088c560b2f1e340ce0fdbac66966e719d684b7788e6`. The configured legacy worker buildspec is pinned as historical metadata and must never execute: the dispatch always supplies the exact v2 override from the frozen Git blob.

Execution requires a separately authored review JSON with exactly `decision`, `requestSha256`, `sourceCommit`, `archiveSha256`, `buildspecSha256`, `helperFilesSha256`, `reviewer`, and `notes`; decision must be `APPROVE_ONE_HOST_ASSETS_BUILD_V2`. The exact review-file SHA256 is also mandatory. The request/source/archive/helper/authority bytes are recomputed before a permanent exclusive reservation is written and fsynced. Any failed or uncertain attempt leaves that reservation consumed. No mutation retry is implemented.

Using the existing owner-only capture adapter, dispatch checks fresh capirocli STS identity, immutable/KMS repository identity, every builder configuration field except observational created/modified timestamps, and complete bounded builder activity. Only environment/tag ordering is normalized; JSON boolean/number substitutions refuse. It uploads one checksum/KMS-bound immutable S3 version with `If-None-Match:*`, verifies its exact HEAD checksum/metadata/version, then performs one StartBuild with exact source version, v2 buildspec, five fixed environment overrides, ten-minute build timeout, five-minute queue timeout and the reserved UUID token. Full project and identity checks repeat immediately before StartBuild. Returned build authority/environment/source/override drift refuses; a successful response remains `DISPATCHED_NOT_ACCEPTED`.

The separate read-only reconciliation mode captures fresh identity/project/activity and S3 source observations after uncertainty. Matching builds are validated and reported as observations only. An empty match never means no launch, and reconciliation never reopens the reservation or retries a mutation. No polling loop, worker build, host launch or acceptance action exists.

## Relevant checks

Fixed bundled Python 3.12.14 ran `python -B scripts/qualification/test_host_assets.py` with real AWS capture patched to fail if accidentally invoked. Test transactions always received a finite fake adapter. Temporary Git repositories contain the fixed public fixture bytes only; OS symlinks are not created. Tests cover:

- Exact 14/10/3 schema, exact 27-entry deterministic ZIP, excluded private-looking scratch, dirty working-tree independence, missing/same-size changed/nonregular committed sources and invalid commit selectors.
- Full project, secret-environment, boolean/number, helper/archive and review-binding drift; duplicate JSON keys; exclusive output directories.
- Literal v2 override/source/version/timeout shape, successful fake upload/dispatch, active builder refusal, checksum/version/returned-role/malformed-build-ID refusals, permanent consumed reservations, and timeout-before/after-launch uncertainty with read-only reconciliation and zero mutation retries.

Initial suite: **20/20 passed**, 15.495 seconds, exit0. Self-review then added canonical returned UUID validation, evidence junction resolution refusal, strict JSON type comparison and read-only S3 uncertainty observation, with three targeted regressions. Final suite: **23/23 passed**, 17.483 seconds, exit0; outer timeout180 seconds. Both raw captures remain preserved. No failed test or discarded retry is hidden. These are overlapping unit controls, not 23 AWS workflows.

The actual default local preparation ran once under a 120-second wrapper, exit0 in0.312 seconds, AWS calls0. Its output is `docs/coordination/private-evidence/CODEX-G1-host-assets-e23667a-local-1/`:

- `review-request.json`: 12,465 bytes, SHA256 `80c5fd542bc819266e0ca191e8aff0502d23db5032e93f4ffb09272d65988fcf`.
- `source.zip`: 228,520 bytes, SHA256 `17bc24622d3b67b08bc670e688e23b7d789b582b432570bcdcbdab89a0c00aaa`.
- Three complete readonly Git captures; exact v2 buildspec bytes; `prepared.json` says PREPARED_LOCAL_ONLY. No reservation, upload/start attempt, StartBuild input or outcome exists.

A separate author DATA-only reader verified all27 archive/content records against the independently frozen accepted-source data, all five current helper pins, recipe bytes and the raw Git capture envelopes. This is author readback, not the required distinct owner review. Local evidence `.task-inputs/CODEX-G1-host-assets-helper-1/manifest.json` binds31 payload files across the local check and preparation roots: 6,325 bytes, SHA256 `71a51ba797c530798f4176ef3e8f327805398e28000464b4f4c1f3bf0ae9ad7e`.

Final source pins before commit: source helper 9,928 bytes/SHA256 `b155582eb764bf1c72e00d3240baa9182df67b8d01db9205ebb4c9557a9a6620`; build helper21,682/`d738fb6451288af2baaed35740d02d01f2cd17deac8dcaacb4a05e6f2ffae234`; tests20,732/`31329667e9ec920f0c8dddf3c5650f3d656c9eaa0445591019643951e95510b7`. All six source/dependency files stayed byte-identical across each suite.

## Owner use and remaining gates

Local-only preparation: `python -B scripts/qualification/host_assets_build.py --source-commit <exact40SHA> --evidence <new fixed private-evidence directory>`; directory basename must start `CODEX-G1-host-assets-`. Only after independent exact-source/request review, use `--execute --evidence <prepared> --review-file <review.json> --review-sha256 <exact64SHA>`. `--reconcile --evidence <prepared>` is read-only. No author approval file was created.

Before any support-only dispatch, the owner must independently review this commit and actual local request/archive, freeze the review, and verify fresh builder-role/KMS/project and other required live authority. A helper/dependency change invalidates the prepared request. A new source revision outside the fixed27 bytes requires separately reviewed pin advancement. An uncertain mutation requires read-only reconciliation; do not retry upload/StartBuild or reuse its reservation.

Evidence writes and Git reads assume the trusted local owner checkout; this is not hostile-filesystem resistance or an AWS atomic lock. Shared capture retains binary failures/timeouts, uses fixed profile/region and strips endpoint/proxy/credential overrides, but its PIPE memory is not byte-capped and direct-child timeout does not prove descendant-tree cleanup. Those limits are explicit. Actual AWS schema/permissions, S3 checksum/KMS behavior, CodeBuild overrides and physical build cleanup remain unqualified by unit tests. A completed support image will still require independent digest/config/extracted-byte verification and every browser/renderer, network, native Office/SDK, cleanup, security and G1 gate. Current Meri and all shared contracts remain untouched.
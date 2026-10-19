# Independent review: PR193 measurement packet

Status: **Final generated request and version-pinned payload packaging review PASS.** Prior code review findings are resolved. The exact reviewed final request is recorded in the stage-two section below. Live measurement acceptance remains dependent on terminal results, authenticated artifact joins, physical cleanup and the canonical launch gates.

Scope: independent offline review of `pr193-retention-measurement-packet/{prepare-measurement.mjs,measurement-payload.mjs,finalize-measurement.mjs,measurement-build-wrapper.py,receipt-joins.mjs,verify-measurement.mjs,receipt-joins.test.mjs}`, the canonical source interfaces they call, and the actual generated payload/request. Read-only structural inspection, hashing and pure generator reconstruction were performed. No AWS, Docker, network, build, or test-suite execution by this reviewer. No source or packet implementation edits.

## Initial findings communicated to author/root

1. The wrapper initially allowed 600 seconds of work plus cleanup, while this job is limited to 10 minutes. Its bootstrap timeout was 780 seconds. Work and cleanup therefore could be interrupted by the outer job timeout. The author is changing the work budget to 420 seconds and bootstrap timeout to 540 seconds so cleanup has explicit headroom.
2. The wrapper and final joins initially checked only Linux and privileged execution, omitting the actual SMALL compute type, standard 7 image, measurement timeout 10, queue timeout 5, zero automatic retries, and final `buildComplete`. The initial packet also did not create a bounded StartBuild request. The author is adding an offline exact request and authenticated checks; product build timeout remains 30 minutes.
3. The final verifier initially took the measurement build ID from its downloaded provenance and accepted local result files without binding them to the operator's actual StartBuild result and immutable S3 artifact download receipts. A successful build readback and matching claimed build ID do not themselves authenticate those result bytes. The final acceptance path must join actual submission ID, expected artifact location, exact object versions and content hashes to the downloaded files.

## Checks already supported by inspected code

- Request source is fixed to `5b395d4ce9218b872b21c420dc00a3af31739824`; canonical verifier hash is fixed and checked before import. The wrapper downloads actual pinned source/archive versions, checks their hashes, invokes canonical verification, and matches raw source member hashes.
- The image is a digest URI; fresh ECR tag, digest and COMPLETE scan with zero HIGH/CRITICAL findings are checked before pull. Final receipt joins compare producer pins, image labels, RepoDigests, runtime package/native measurements, runner bytes, Node executable and native CLI measurements.
- Measurement uses the canonical complete shipped-module command. Container argv has no host mounts, forces user `1000:1000`, network `none`, read-only root, all capabilities dropped, no-new-privileges, bounded memory/PIDs and one tmpfs. Container Node execution receives an empty environment.
- Canonical generation requires the reviewed C baseline at `5a42ec962677e70e76db5433330b52fd34db5bcd`, only changes the image/source pins, preserves absent features/profile/active-read options, and retains 3 turns / 1 tool. The full canonical runtime-values assembler is used after independent joins.
- Child stdout/stderr are bounded by the pinned command adapter; credential output is confined to stdin for Docker login. Credentials are held in a task-local private directory. Receipt files are published only after owned-container absence, Docker logout, image-reference absence and physical temporary-directory removal succeed.

## Resolution verified against stabilized code

1. `measurement-build-wrapper.py` uses a 420-second work deadline, bounded 15-second cleanup commands, and the generated bootstrap has a 540-second timeout inside the 10-minute job.
2. `measurementStartRequest` produces only the existing project's S3 source/version, exact buildspec, fresh attempt token, 10-minute work / 5-minute queue / zero-retry overrides, and unique encrypted artifact prefix. Preparation hashes those request bytes, and verification reconstructs and compares the complete request. The wrapper and receipt joins require the fixed existing project/role, Linux SMALL standard 7 privileged execution, exact source version/location and bounded runtime. Acceptance requires both builds terminal and SUCCEEDED, distinct build IDs, product timeout 30, measurement timeout 10, queue 5, and zero retries.
3. Verification now requires the filtered authenticated `measurement-start.json` response `{ "id": "<actual build.id>" }` and joins its actual build ID to the terminal readback and measurement provenance. It checks the actual CodeBuild artifact prefix and requires six root-authenticated selected-version download records in `artifact-downloads.json`. Each record's expected bucket/key, non-null version, size and SHA-256 is joined to the corresponding local raw file before parsing or assembly. These records must be produced by the root from actual S3 calls; the code explicitly does not pretend a handwritten record authenticates itself. Unfiltered AWS records must not be retained because they may contain environment variable values.

The author reports 34/34 focused synthetic join/request tests, Node syntax checks, and Python AST parsing passed. This reviewer read the changed assertions and fixtures, including independent fixture copies and negative cases for substituted build IDs, source versions, artifact keys/bytes, timeout/retry changes, nonterminal producer, unknown cleanup, digest drift, inventory truncation and altered actual buildspec. No tests were run by this reviewer; synthetic tests do not establish live measurement acceptance.

## Historical reviewed bytes before public-payload packaging

| File | SHA-256 |
| --- | --- |
| `prepare-measurement.mjs` | `fbbdd9094ec89620345bf37f04e9b622d039ba5b84dd69a8b28b1e2116332184` |
| `measurement-build-wrapper.py` | `8afb2093090a80c92f50f6988e21d182cf8a98fce61d5923674bb60db2d5d93c` |
| `receipt-joins.mjs` | `eeaeedab4c44aa8138fc3060d4acf5814ae678d424115d6106c10b5af551ef17` |
| `verify-measurement.mjs` | `5aa33bcc17bf48bf365e08844e339258553b1369360b70cf62633f268cdf740f` |
| `receipt-joins.test.mjs` | `1a6fa2e5fa647d130c3ece325e5e341d1da2013dc66219f54a3f398e81f5dd40` |

The subsequent bounded delta changes the StartBuild receipt to the safe `{id}` projection and adds a producer-buildspec join. Preparation derives `productBuildspecSha256` with the canonical `createProductImageBuildRecipe(request)`; final joins compare it with the authenticated product build's `source.buildspec` bytes. The wrapper bytes remain unchanged. These code changes preserve the previous checks and add no AWS invocation.

For terminal BatchGetBuilds records, retain only `builds[]` with `id`, `buildStatus`, `buildComplete`, `timeoutInMinutes`, `queuedTimeoutInMinutes`, `projectName`, `serviceRole`, `sourceVersion`, `source.{type,location,buildspec}`, `environment.{type,privilegedMode,computeType,image}`, `autoRetryConfig.{autoRetryLimit,autoRetryNumber}`, and `artifacts.{location}`. Preserve those nested names for the verifier. Environment variable arrays, credentials, tokens, and other unneeded record fields are excluded.

The saved README's actual query was reviewed and preserves the required nested verifier shape while projecting only the listed public build metadata and automatic-retry metadata; it never projects environment variable arrays. Its StartBuild projection is exactly `{id:build.id}`. The README explicitly preserves the two-job/$5 allocation, no third job, and stop-on-uncertain submission or cleanup. README SHA-256: `3df0a5cf15678c522660ff6745e4cc4e96ca5972ea2cf2769e70f455458c9da0`.

The author's post-delta evidence was read: 34 tests, 34 passed, 0 failed/cancelled/skipped, plus recorded Node syntax and Python AST success. Evidence SHA-256: `96699a3a01de244bedb7c22e46532cdfade49ad321b579e8a5416021079f17c4`. This reviewer performed no additional execution or broader checks. Bounded delta review remains PASS.

## Remaining operator gates

The root remains the sole AWS operator. This reviewer has completed the actual generated-request gate below; root retains final submission authority and fresh operational preflight. Before allocating job two, require the first build's successful authenticated receipt/scan, exact source and upload versions, fresh measurement attempt and result prefix, no active build, and the existing project/role/bucket/KMS configuration. Preserve the max-two-job / $5 allocation; this measurement consumes the second job and has no automatic retry authority.

After submission, retain the actual StartBuild response and selected-version downloads. Any uncertain submission, timeout, nonterminal state, missing or invalid artifact, failed scan, or incomplete physical cleanup stops acceptance and any further job. Do not replace uncertainty with a new attempt. Only successful terminal readbacks plus byte joins, complete canonical launch gates and the canonical assembler can establish measurement completion. This review performs no deployment or live admission and grants none.

No unresolved implementation finding remains in the reviewed bytes. Live build/runtime behavior remains unverified by this reviewer. No denied or uncertain reviewer action occurred.

## Public payload stage one

The actual inline buildspec was too large; raw UTF-8 and concatenated-byte encoding attempts remained above 25,600 bytes (26,725 and 26,418 bytes respectively). They refused before output/submission. Root selected one conditional upload of a nonsecret measurement payload to the existing qualification bucket and KMS key, followed by a small exact-VersionId/hash bootstrap. No second build was started by those preparation attempts.

Independent read-only inspection of `pr193-retention-measurement-prepared` passed:

- Payload: 76,918 bytes, SHA-256 `3587ebafba8f379e944845d80f43c2c2046496c85d67b37f576bd7257a0628c7`.
- Exact reconstructed plan: 42,088 bytes, SHA-256 `66b5956d6ca139a2e4159b827a096bb8b739d72712671ac8a149b35440e36298`.
- Exact reconstructed wrapper remains reviewed SHA-256 `8afb2093090a80c92f50f6988e21d182cf8a98fce61d5923674bb60db2d5d93c`.
- Plan request and product receipt equal the root's authenticated files, and the product recipe hash matches the exact successful buildspec. The image is `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:ea0e9ad4cfcec1052c33b39ae2f41c1df6e591b7ab2e74c762a1f68f54990b49` from build `meri-greenfield-qualification-build:2d0c9e04-a170-46d2-9d0b-f4094e6a48e8`.
- All 12 plan source-member pins independently match raw Git objects at `5b395d4ce9218b872b21c420dc00a3af31739824`.
- The deployment equals the raw-byte-pinned C baseline with only image/source changed. Policy and allocation equal canonical source, retain 3 turns / 1 tool, and preserve absent features/profile/active-read selectors. The exact complete command matches `launch-overrides.json`.
- The payload contains only its schema, plan and wrapper base64 bytes, sizes and hashes; those decoded bytes are the reviewed public plan and wrapper.

Upload review PASS applies only to bucket `meri-greenfield-qual-build-967807252336-us-east-1`, key `inputs/launch-measurement/5b395d4ce9218b872b21c420dc00a3af31739824/113ba3cc0d3f4baf978e157a347c9654/measurement-payload.json`, the payload bytes above, and the existing KMS key. Actual immutable version/checksum/KMS readbacks and the finalized request were reviewed separately in stage two.

## Public payload stage two: final generated-request gate PASS

The root's actual conditional PUT and exact-version HEAD/GET receipts in `pr193-retention-measurement-operator` agree on payload VersionId `s2LyKxvj0w39XEMmWWKZ1oKI1HEKbPFS`, 76,918 bytes, SHA-256 `3587ebafba8f379e944845d80f43c2c2046496c85d67b37f576bd7257a0628c7`, and checksum base64 `NYfrr7qPN56USEXYD0PCwgRklshdZ7N/V2vXJXoGKMc=`. The authenticated downloaded payload is byte-identical to the prepared payload. The records confirm `aws:kms`, the existing exact key `arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042`, and matching source/attempt metadata. Parsed operator and prepared payload pins are equal.

The final actual packet in `pr193-retention-measurement-prepared` was independently inspected and the reviewed pure generator reconstructed its exact buildspec:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `measurement-buildspec.json` | 3,867 | `38340a4f678d8000fa5fae237cea8f6d67a6bbf34e78b19a098f79501db56c54` |
| `measurement-start.request.json` | 4,771 | `dd581fab794c42ed9aeeed683bbd4ac0c02943caf6ba9b4ddfc14ff964ddaed4` |

The buildspec is below the 25,600-byte inline limit. Its embedded pin matches the actual immutable payload version. The complete StartBuild object equals an independently constructed allowlisted request: existing project, exact source location/archive version `wzj36s_GpR.73i.Gs6_AwP5BiWHAvXtw`, inline buildspec, attempt/idempotency token `113ba3cc0d3f4baf978e157a347c9654`, timeout 10 minutes, queue timeout 5 minutes, automatic retries 0, and encrypted S3 artifacts in the existing bucket at `results/launch-measurement/5b395d4ce9218b872b21c420dc00a3af31739824/113ba3cc0d3f4baf978e157a347c9654`. There are no environment overrides or extra request fields. Manifest version remains `JSV4IDhthFSNgfIaqNXWEcYsumTN45iP` in the unchanged product request/plan.

The authenticated product readback is terminal SUCCEEDED with `buildComplete: true` and the expected product build ID and canonical buildspec hash. Authenticated ECR records match the exact digest/tag and report scan COMPLETE with empty finding counts. The stage-one source, image, C baseline, complete command and absent-optionals bindings remain unchanged.

The bootstrap verifies the canonical source helper's fixed raw hash before import, then uses its bounded command adapter for exact-VersionId HEAD/GET with 20-second call limits and one AWS attempt. It checks selected version, length, SSE/KMS, downloaded SHA-256 and the separately pinned plan/wrapper hashes and sizes before invocation. KMS validation now requires equality to the exact existing key, including refusal of another same-account key. Fetch and wrapper invocation share a 540-second total deadline; wrapper invocation requires at least 500 seconds remaining for 420 seconds of work and bounded cleanup. Temporary payload files use a private directory; fixed phase-only failure markers avoid arbitrary diagnostic disclosure. Failure or uncertainty cannot satisfy the existing final acceptance gates.

Final executable hashes supersede the historical table above:

| File | SHA-256 |
| --- | --- |
| `prepare-measurement.mjs` | `f9de66d0184a8d247a25217ecf48314baf530423f5bca6fd37fafd920f0d61e1` |
| `measurement-payload.mjs` | `3a175c37092a21e128d3286e7ce611fc90621b3b972ed2281c4443140119e5aa` |
| `finalize-measurement.mjs` | `1a9b8385bc6209febd336a58d9c9135159abe00d3fc6c3c1317367e714b365e4` |
| `verify-measurement.mjs` | `6397bf5b3a788f4937561766ae5d51688753d825291f2e86bf5bcbd94ec1e459` |
| `measurement-build-wrapper.py` | `8afb2093090a80c92f50f6988e21d182cf8a98fce61d5923674bb60db2d5d93c` |
| `receipt-joins.mjs` | `eeaeedab4c44aa8138fc3060d4acf5814ae678d424115d6106c10b5af551ef17` |
| `receipt-joins.test.mjs` | `1a6fa2e5fa647d130c3ece325e5e341d1da2013dc66219f54a3f398e81f5dd40` |

The author's payload evidence records 12/12 focused tests passing, including actual generated-bootstrap execution with AWS adapter and wrapper invocation replaced: exact byte reconstruction, incorrect HEAD version, tampered downloaded bytes, temporary cleanup, fixed failure markers and remaining-deadline handling. This reviewer read that evidence and the bounded packaging delta; no test suite or live operation was run. These results support the offline review and do not establish live measurement completion.

No generated-request or packaging blocker remains for these exact bytes. Root was sent PASS before report publication. Only root may submit the authorized second job after fresh duplicate/resource checks. No third job or automatic retry is authorized, and any uncertain submission/state/cleanup stops further work requiring a job. Live measurement results and final canonical acceptance are still pending.

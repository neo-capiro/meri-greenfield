# Product runtime image recipe (unmounted)

The repository contains a runnable recipe and offline source verifier. Authoring, importing, sealing and testing these files grants no AWS build/deployment authority. This source change ran no Docker build, registry login, AWS call, service, task, provider request or database operation. Final source/archive/base/object-version pins and a separately approved bounded build request remain required.

## Canonical runner measurement

`apps/runtime/native-authority/ecs-prepared-task-proof.mjs` owns `productRunnerMeasurement`, `measureProductRunner` and `assertProductRunnerMeasurement`. Contract `meri.runner-entrypoint.v1` is SHA-256 of the **complete raw bytes** of `/opt/meri/apps/runtime/conversation-runner.mjs`. No newline normalization, BOM removal, metadata or JSON wrapper is included. A measurement has exactly `{contract,path,runnerSha256,bytes}`; `path` is `apps/runtime/conversation-runner.mjs`, and the file must contain 1 through 1,048,576 bytes. The reader rejects symlink files/ancestors, uses bounded positional reads plus one byte to detect growth, checks file metadata again, closes its handle and honors cancellation. It reads no environment/configuration.

`assertProductRunnerMeasurement({expectedSha256,root?,signal?})` refuses missing/malformed pins or different actual bytes. The default root comes from the module location; only trusted callers/tests may override it. The product CLI checks the conversation runner immediately after parsing configuration and before reading runtime secrets or starting network activity. `MERI_RUNNER_SHA256` is its expected declaration; that value alone never establishes measurement.

The ECS proof measures local shipped entrypoint bytes before borrowed ECS reads, then brackets the exact running task/task definition with immutable image checks. The existing prepared-runtime owner compares the measured receipt to `preparationIntent.runnerSha256`. This joins intent, startup check, image receipt and task image. It is **not remote filesystem attestation**: the deployment owner must verify control and runner use the same approved immutable image. The image digest and verified source archive independently pin all other source/dependency bytes; `runnerSha256` measures only the named entrypoint. The Node executable has a separate receipt measurement.

## Module owners and offline preparation

- `image-build-source.py`: offline Git sealing, ZIP membership/mode/byte verification, sealed-request validation and CLI help. It has no AWS/Docker execution path.
- `image-build-producer.py`: Linux CodeBuild identity/source checks, exact S3 downloads, verified extraction, Docker build/probes, private ECR login/push/readback/scan and cleanup. Importing it is inert.
- `image-build-recipe.mjs`: inert `createProductImageBuildRecipe(request)` returns exact `buildspecJson`, `buildspecSha256` and `requestSha256` without I/O. The bootstrap authenticates both Python module byte hashes before executing either.
- `image-provenance.mjs`: compares narrow independently authenticated projections, including producer `runnerMeasurement` and independent top-level `measurement` from the selected image. Its result remains `METADATA_MATCH_ONLY`.

Seal an actual reviewed full 40-character commit from a trusted local Git object database. Both output paths must be absent:

```sh
python3 -I -B -S infra/product-preview/image-build-source.py seal \
  --repository . --commit "$SOURCE_COMMIT" \
  --archive /absolute/product-source.zip --output /absolute/product-source-members.json
```

The sealer enumerates the complete Git tree, preflights member and aggregate sizes, rejects symlinks/submodules/private credential paths, compares every payload to its exact Git blob object, and writes portable deterministic ZIP modes from the Git tree. This avoids Windows Git ZIP mode loss and ambient newline conversion. The manifest is sorted UTF-8 JSON with an LF terminator: `{contract:'meri.source-members.v1',sourceCommit,files:[{path,sha256,bytes,mode}]}`. Archive attributes that omit/rewrite tracked files fail. Working-tree changes cannot substitute for the selected commit.

After separately authorized upload and independent checksum/version readback, author nonsecret `product-build-request.json` with exactly these fields:

| Field | Required binding |
| --- | --- |
| `sourceCommit` | Reviewed full Git commit |
| `archive`, `manifest` | Each `{bucket,key,versionId,sha256}` with actual non-null S3 version/raw hash |
| `dockerfileSha256` | Raw `apps/runtime/Dockerfile` bytes in that commit |
| `verifierSha256`, `producerSha256` | Raw bytes of the two Python modules in that commit |
| `runnerSha256` | Raw canonical entrypoint bytes in that commit |
| `nodeImageUri`, `nodeVersion` | Reviewed `public.ecr.aws/docker/library/node@sha256:<64 hex>` and actual exact `v24.<minor>.<patch>` |
| `runtimeUser` | Expected measured nonzero numeric UID:GID |
| `codeBuildProjectArn`, `ecrRepositoryUri` | Approved project/repository in `967807252336`, `us-east-1` |
| `imageTag` | Unique `product-<full commit>-<32 lowercase hex attempt ID>` |

Verify the downloaded inputs without AWS/Docker:

```sh
python3 -I -B -S infra/product-preview/image-build-source.py verify \
  --request product-build-request.json --archive /absolute/product-source.zip \
  --manifest /absolute/product-source-members.json
```

The verifier checks raw archive/manifest hashes, strict sorted records, commit binding, every regular file's bytes/mode and all four source pins. It refuses unsafe/duplicate/case-ambiguous members, symlinks, extra/missing/altered files and size violations before Docker starts. Extraction uses only verified regular members in a fresh private directory, never the ambient checkout.

Generate the reviewable override from repository root:

```sh
node --input-type=module -e "import {readFileSync,writeFileSync} from 'node:fs';import {createProductImageBuildRecipe} from './infra/product-preview/image-build-recipe.mjs';const r=createProductImageBuildRecipe(JSON.parse(readFileSync('product-build-request.json','utf8')));writeFileSync('product-buildspec.json',r.buildspecJson,{flag:'wx'});console.log(r.buildspecSha256);"
```

Both Python CLIs return 0 for success/help and 2 for handled invalid input, failed check, unavailable command or timeout. Missing configuration allocates no external resource. Test discovery is `node --test infra/product-preview/image-build.test.mjs`; set `MERI_IMAGE_BUILD_TEST_PYTHON` if default Python is unavailable. Tests use synthetic Git repositories and mocked producer boundaries without Docker/AWS.

## Separately approved execution

Review the exact request/override bytes/hash, caller, project role, object prefixes/versions, repository, budget and one idempotency token. Use [StartBuild](https://docs.aws.amazon.com/codebuild/latest/APIReference/API_StartBuild.html) with exact S3 location/version and returned override; explicitly bound build to 30 minutes, queue to 5 minutes, one attempt and zero automatic retries. The recipe neither starts a build nor alters its project. Python 3, Docker and AWS CLI must exist in the approved Linux builder. Recheck the actual existing builder/repository and its selected-object/build-readback/ECR permissions; names alone do not establish authority. [CodeBuild environment identity](https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html) is cross-checked with authenticated build readback.

The producer checks project/build/source identity and repository immutability/scan-on-push, then checks the exact S3 versions' object sizes before downloading and verifies their bytes and hashes afterward. It builds the existing Dockerfile for Linux amd64 with only the reviewed immutable Node build argument and source/base labels. Locked npm installs retain `--ignore-scripts`; no provider/database/Temporal credentials or secret build arguments are supplied.

Before registry authentication it inspects image identity/size, runs CLI help and imports all three roles in bounded network-disabled, read-only probes. It measures actual entrypoint bytes using the runtime reader, numeric UID:GID, exact Node version and executable SHA-256. Different bytes/user/version or failed role imports refuse before authentication/push. Import closure does not prove native Temporal workflow bundling, real SDK/model execution or live isolation; those remain separate gates.

Only then does the producer obtain the authorized role's ECR password in memory and pipe it to Docker stdin. Authentication uses a task-owned mode-0700 Docker directory. Subprocess output, environment and credential values are not logged. Push uses the unique immutable tag; digest readback and a completed scan with zero HIGH/CRITICAL findings are mandatory. A scan hold leaves that immutable image unadmitted and emits no success receipt; it neither deletes nor retries it.

The producer has a 25-minute command budget, individual command deadlines and a live combined stdout/stderr cap for each subprocess, including cleanup. It checks local image/container names are absent before allocating them. Cleanup removes only those owned names, independently checks physical absence, logs out and physically deletes temporary authentication/source directories. Unknown cleanup refuses a success receipt. The receipt is written only after cleanup completes. The recipe starts no service/task/provider operation and makes no database, security or deployment changes.

## Receipt and remaining gate

The only success artifact is `product-image-receipt.json`: commit/archive/member-manifest/Dockerfile/base/verifier/producer pins, authenticated build ID/source version, ECR digest, actual `runnerMeasurement`, executable SHA, measured numeric user and completed scan counts. Artifact destination/encryption/retention belongs in the later approved request; this source creates none.

Independently authenticate CodeBuild/ECR records, compare reviewed override bytes/hash, verify archive membership against the Git commit, and measure the canonical entrypoint from the selected immutable image. Supply narrow projections to `compareProductImageMetadata`, including independent `measurement` and producer `runnerMeasurement`; they must match fixed contract/path, hash and byte count. Independently check the receipt's other fields before projection. A matching result is metadata evidence only.

No final reviewed source ZIP/S3 versions, acceptable Node base digest, finalized override hash, producer receipt or image scan is supplied by this source work. The three-role preview remains disabled. Obtaining these inputs and separate bounded build approval remains the next image gate.

# Resume the Meri image qualification

## Current ownership: Meri resumed at 01:34:09 UTC

**Neo reversed only the Meri stop/handoff at 2026-10-17 01:34:09 UTC. Codex/dot retains Meri qualification and shipping preparation and continues without waiting for Fable. Codex/dot owns shipping coordination. The immutable frontend/Core handoffs remain technical checkpoints from their source owners; their Fable assignment is historical. Dot retains step 3: the real authenticated prompt, streamed answer, saved conversation and reload acceptance.**

The 01:19:23 UTC Meri stop and the later local-seal inventory below are historical pre-start checkpoints. Their no-upload/no-StartBuild and unused-reservation statements describe that cut, not current live operations. The root Meri thread and its exact later operation receipts are authoritative for subsequent attempt identity, upload, start, terminal result and budget consumption. This document update does not start or approve any operation.

These are reviewable Meri resume commands for the current Codex/dot owner after reconciling the root thread and exact later operation receipts. They were not executed during the outgoing safe-stop checkpoint. The outgoing lane sealed source only: it did not issue a build attempt ID, upload this source, or call StartBuild. Do not run consumed scripts from earlier private packets. A network timeout or uncertain upload/start outcome requires readback, not another write or build.

## Current action boundary

The source `38f52df9` inputs and attempt below were subsequently consumed once as build `5b67476a-5b30-43a7-9957-d83c72525aa2`. It is terminal FAILED; scan COMPLETE has 3 HIGH findings and image acceptance is HOLD. **Do not execute these example upload/start steps with the consumed packet or allocation.** They describe the review protocol for a future separately allocated, corrected source after the exact cause and corrective delta are accepted. [Current operation record](MERI-TERMINAL-QUALIFICATION-20261017.md) supersedes pre-start statements.

## 1. Preserve checkouts and select exact source

Use an existing authorized GitHub session. Do not create credentials, alter filesystem permissions, add Git trust exceptions, or reset another checkout. The three repositories are:

```text
https://github.com/neo-capiro/capiro-frontend.git
https://github.com/neo-capiro/capiro-backend.git
https://github.com/neo-capiro/meri-greenfield.git
```

For an existing Meri repository, inspect `git status --short`, fetch the exact source branch, then create a separate worktree. Example in an authorized Linux shell, with unused target paths:

```sh
git fetch origin codex/meri-image-diagnostics-20261016
git show --no-patch --format=fuller 38f52df94b1738649776792b2a28aac743801c19
git worktree add --detach ../meri-shipping-38f 38f52df94b1738649776792b2a28aac743801c19
cd ../meri-shipping-38f
git status --short
node --version
python3 --version
aws --version
```

The image pins official Node **v24.21.0**, UID/GID **1000:1000**, and base `public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63`. The jump box's bundled Node is v24.19.0 for source checks; do not use an unrelated system Node implicitly. Existing AWS CLI profile `default`, region `us-east-1`, and the existing authorized principal were used by the outgoing owner. No credential value belongs in this repository or handoff.

On this Windows jump box, use the explicit bundled executables listed in [the qualification checkpoint](MERI-QUALIFICATION-CHECKPOINT.md). Docker daemon access was denied; no ACL or trust bypass was performed. Fresh protected CIM memory reads were denied, so current memory/commit capacity is unknown. C: had about 2.5 GiB free at the handoff inventory. Avoid a duplicate full frontend checkout/install on that volume. The isolated PG16 Windows fixture and production Aurora are different environments.

## 2. Check source behavior and seal

These focused source commands are supported by the selected tree. They do not establish a Linux image pass:

```sh
MERI_IMAGE_BUILD_TEST_PYTHON="$(command -v python3)" node --test --test-reporter=tap infra/product-preview/image-build.test.mjs
python3 -B -m unittest -v infra/product-preview/test_image_build_diagnostics.py infra/product-preview/test_image_build_linux_checks.py
git diff --check
```

Use a new task-owned output directory. The sealer refuses existing output paths and unsafe/private archive members. It creates a full source archive even from a sparse checkout.

```sh
mkdir ../meri-38f-inputs
python3 -I -B -S infra/product-preview/image-build-source.py seal \
  --repository . \
  --commit 38f52df94b1738649776792b2a28aac743801c19 \
  --archive ../meri-38f-inputs/product-source.zip \
  --output ../meri-38f-inputs/product-source-members.json
```

The already sealed Windows files are in the approved private workspace `C:\Users\Administrator\Documents\Codex\2026-10-16\task\meri-image-w08-qualification-20261017`. If reusing those exact files, require ZIP **138,070,049 bytes**, SHA-256 `64e499360f5df74d2544922890c1cc1fe787d651f8acb30bfb2860b076cc1e69`; manifest **3,781,316 bytes**, SHA-256 `d0c5cea1b61c2e4053db1fa64e73f010d237d9b1dbc38162a3cc87ae7ba93939`, **18,395 members**. If a reviewed reseal produces different ZIP bytes, retain the new exact archive/manifest hashes and independently verify every member against the same source commit; do not label the new bytes with an old checksum.

## 3. Reconcile the unused allocation and existing resources

The last central reservation is **$335/$400**, including one **unused $4 Meri attempt**, Core's included $5 bundle, and the frontend continuation. Actual billed spend is not reconciled. Codex/dot must confirm this historical reservation against the current root ledger and exact later operation receipts, and check whether it has been consumed since the checkpoint. Limits remain **one start, 30-minute build timeout, 5-minute queue timeout, zero automatic retries**. This is not an additional $4 reservation.

Before any upload or start, read back the existing project, role/trust/policies, repository, KMS and latest builds. Use selected metadata; never print project environment values or credential material. Resource IDs and exact historical expectations are in [the checkpoint](MERI-QUALIFICATION-CHECKPOINT.md). The full fresh resource capture was not completed at the stop; an STS success alone does not pass it.

```sh
export AWS_MAX_ATTEMPTS=1
export AWS_PAGER=""
aws --profile default --region us-east-1 sts get-caller-identity
aws --profile default --region us-east-1 codebuild list-builds-for-project \
  --project-name meri-greenfield-qualification-build --sort-order DESCENDING --max-items 10
aws --profile default --region us-east-1 ecr describe-repositories \
  --repository-names meri-greenfield/qualification-worker
aws --profile default --region us-east-1 iam list-role-policies \
  --role-name MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H
aws --profile default --region us-east-1 iam list-attached-role-policies \
  --role-name MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H
aws --profile default --region us-east-1 kms describe-key \
  --key-id arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042
```

Fetch each returned build ID with `codebuild batch-get-builds` and a query containing only ID, status, phase, sourceVersion, timestamps and retry configuration. Require the latest predecessor `meri-greenfield-qualification-build:8ac10ea2-a7c3-4420-bdb4-c39b359918d2` to remain terminal FAILED/COMPLETED at source version `dlRui9s0N4oEIKK5_DCANdyiJX0ZbVQH`; reconcile any newer or active build before proceeding. Do not replay old attempt IDs.

The approved role policy baseline has 15 statements. Preserve role trust, boundaries, attached/inline policy set, project configuration and KMS ownership. Do not expand them to make a failing preflight pass. Historical full baselines and failed/resume capture intents are private evidence, not reusable live approval. Review or replace the prepared local helper pair before execution; it was not qualified end to end.

## 4. Upload two immutable source objects

After the current owner approves the exact upload plan, use the existing bucket `meri-greenfield-qual-build-967807252336-us-east-1` and distinct keys:

```text
inputs/product-runtime/38f52df94b1738649776792b2a28aac743801c19/product-source.zip
inputs/product-runtime/38f52df94b1738649776792b2a28aac743801c19/product-source-members.json
```

For each file, compute its full SHA-256 and base64 encoding of that digest. Record a durable exclusive intent before one conditional write. The exact AWS CLI operation is:

```sh
aws --profile default --region us-east-1 s3api put-object \
  --bucket meri-greenfield-qual-build-967807252336-us-east-1 \
  --key "$REVIEWED_OBJECT_KEY" --body "$REVIEWED_LOCAL_FILE" \
  --if-none-match '*' --checksum-algorithm SHA256 \
  --checksum-sha256 "$REVIEWED_DIGEST_BASE64" \
  --server-side-encryption aws:kms \
  --ssekms-key-id arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042
```

The three variables are deliberately unresolved until the owner joins the reviewed local bytes and object key. Do not substitute guessed values. Retain the returned VersionId and verify it independently:

```sh
aws --profile default --region us-east-1 s3api head-object \
  --bucket meri-greenfield-qual-build-967807252336-us-east-1 \
  --key "$REVIEWED_OBJECT_KEY" --version-id "$RETURNED_VERSION_ID" \
  --checksum-mode ENABLED
```

Require matching VersionId, byte count, FULL_OBJECT SHA-256, SSE-KMS and the exact KMS key. On an uncertain write, reconcile the key/version first. Do not retry a conditional write blindly.

## 5. Build the exact reviewed request and start once

Create `request.json` with the closed contract accepted by `image-build-source.py:validate_request`: `sourceCommit`; `archive` and `manifest` each containing bucket/key/verified VersionId/SHA-256; Dockerfile, runner, verifier and producer SHA-256 values from their exact member rows; the pinned Node base/version and `1000:1000`; existing CodeBuild project ARN and ECR repository URI; and `imageTag=product-<full source commit>-<fresh 32-hex attempt ID>`. Generate the fresh attempt ID once, after source/resource/budget approval, and persist it. No such ID had been generated at the preserved pre-start cut. Never create another ID merely because this historical document lacks a later one.

```sh
python3 -I -B -S infra/product-preview/image-build-source.py verify \
  --request ../meri-38f-inputs/request.json \
  --archive ../meri-38f-inputs/product-source.zip \
  --manifest ../meri-38f-inputs/product-source-members.json
```

Use the reviewed recipe, not a replacement shell build:

```sh
node --input-type=module - ../meri-38f-inputs/request.json ../meri-38f-inputs/product-buildspec.json <<'NODE'
import {readFileSync, writeFileSync} from 'node:fs';
import {createProductImageBuildRecipe} from './infra/product-preview/image-build-recipe.mjs';
const pin=JSON.parse(readFileSync(process.argv[2], 'utf8'));
const recipe=createProductImageBuildRecipe(pin);
writeFileSync(process.argv[3], recipe.buildspecJson, {flag:'wx'});
console.log(JSON.stringify({buildspecSha256:recipe.buildspecSha256, requestSha256:recipe.requestSha256}));
NODE
```

Construct and independently review a `start-build.request.json` using the exact archived source VersionId, exact generated buildspec, existing project, S3 source location, 30/5 limits, `autoRetryLimitOverride:0`, the same persisted attempt ID as `idempotencyToken`, and encrypted S3 artifacts under `results/product-image/<source>/<attempt>/`. The successful prior packet demonstrates this API shape; its IDs/intents are consumed and must not be copied as new identities. Require no existing tag, active conflicting build or prior build using the new immutable input. Record an exclusive flushed start intent containing request/buildspec hashes before issuing exactly one command:

```sh
aws --profile default --region us-east-1 codebuild start-build \
  --cli-input-json file://start-build.request.json
```

Retain the returned build ID immediately. Verify returned source location/version, exact buildspec, role, project, timeouts and `autoRetryConfig:{autoRetryLimit:0,autoRetryNumber:0}`. An uncertain outcome is not permission to start again. Reconcile recent project builds and the persisted idempotency token first.

## 6. Monitor, retain and qualify

```sh
aws --profile default --region us-east-1 codebuild batch-get-builds \
  --ids "$EXACT_RETURNED_BUILD_ID" \
  --query '{builds:builds[].{id:id,status:buildStatus,phase:currentPhase,sourceVersion:sourceVersion,start:startTime,end:endTime,autoRetryConfig:autoRetryConfig},buildsNotFound:buildsNotFound}'
```

Monitor that one build to terminal. The recipe requires the nonroot networkless sandbox, readonly root, dropped capabilities, no-new-privileges, bounded PID/memory and noexec tmpfs; ten source-verified read-only fixture mounts; presence/hash preflight; B6/R6/W12 **24/24**, zero unknown/skipped/duplicate outcomes; source/image/runner/Node/user measurements; cleanup; immutable ECR readback; and completed scan with zero HIGH/CRITICAL findings. It runs the three complete suites as one strict gate; a W08-only result is not image acceptance.

On failure, retain the fixed case/stage/check ID/exception/code and primary/cleanup status. W08 has check IDs 1–30 in [the check map](W08-CHECK-MAP.md); do not strip it back to an aggregate unknown outcome. Read the explicit `product-image-failure.json` from the exact results prefix with VersionId, checksum and KMS verification. Native managed artifacts can be absent on failure; the explicit conditional encrypted receipt exists for that case. Preserve raw/scan evidence privately. Diagnose and correct reviewed source without starting an unallocated retry.

On success, get the immutable digest and complete scan evidence by digest:

```sh
aws --profile default --region us-east-1 ecr describe-images \
  --repository-name meri-greenfield/qualification-worker \
  --image-ids imageTag="$EXACT_REVIEWED_IMAGE_TAG"
aws --profile default --region us-east-1 ecr describe-image-scan-findings \
  --repository-name meri-greenfield/qualification-worker \
  --image-id imageDigest="$EXACT_RETURNED_IMAGE_DIGEST"
```

Retain every scan page and prove completeness, digest and source binding. Store raw findings privately; publish only the approved digest, counts/status and receipt references. Use `compareProductImageMetadata` in `infra/product-preview/image-provenance.mjs` to join authenticated narrow metadata, then independently measure the selected image's runner. Its `METADATA_MATCH_ONLY` result is not deployment or live-chat acceptance. Continue through the ordered integration gates in the primary handoff and return the exact step-3 evidence package to dot.

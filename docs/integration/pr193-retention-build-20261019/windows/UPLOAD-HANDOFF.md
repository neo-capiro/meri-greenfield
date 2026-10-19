# Neo-only upload handoff — held for parent release

## Status and scope

The source and offline review are complete. **Do not run the upload until the parent has checked Neo's render receipt and current operation claims and released one sole Neo writer window.** This packet prepares that action; it does not authorize or perform it.

Neo's successful local render used `15639bd0eb8ee52d3ca225cb79af438ddfb01e16`. Reuse that exact private `$out` directory, its receipt and its five bundles. The approved metadata is [NEO-UPLOAD-MANIFEST.json](NEO-UPLOAD-MANIFEST.json), SHA256 `870bc3e9abd6a53f6da97d220261ccb83ff5f9947ec1be5c8d0623fe54c19c50`. It contains the exact five role/ARN/path/byte-count/SHA256 records supplied in Neo's receipt. Seven public file-hash joins, including stage3, were independently checked against the published packet. The actual private bytes remain local to Neo; the wrapper checks them before any put.

The only proposed writes are five new versions on the five existing secret ARNs, each explicitly staged `FIRST_CHAT_20261019D`. Current versions, their KMS identifiers and every original version ID/stage are checked. No stage-removal/movement API, credential creation, deployment, task-definition registration, build, SQL, IAM or network change is part of this handoff. Local bindings and deployment require their own subsequent handoff.

## Exact pins

| Input | Pin |
| --- | --- |
| Runtime source | `5b395d4ce9218b872b21c420dc00a3af31739824` |
| Public packet | `b79d4b0c4b1027757e1d3ad5ca2ed0cbdf05e527` |
| Original render readbacks | `05b73a61cb4f2bbfa52eae38ea23e44598c33e9f` |
| Original readback manifest SHA256 | `adc81416f2b4c93d3fe3ee4694fbe3160e7a5180182a4b482e892d9e922ff613` |
| Fresh upload-readback manifest SHA256 | `5e7eaf9f51df1aba405995a969b9d4c3eec1bdeb97e4c991c80e78701c91536a` |
| Upload executable SHA256 | `df9442e4960c605bc50a4c0fe25f8e934a3e84da71ddf42d53a27a4fe2e75bb5` |
| Offline test SHA256 | `eecad3ec9e14af59934d5eed664f3b76aca0b057cc2549751aecf568dfd19005` |

The published completion message supplies the exact Git commit containing this operator packet. Export that commit's `docs/integration/pr193-retention-build-20261019/windows` tree; retain `Pr193Common.ps1` and `NEO-UPLOAD-MANIFEST.json` alongside the entry point. The fresh readbacks corroborate the original render inputs; they do not replace or rebind them.

## Read-only AWS refresh

Snapshot: **2026-10-19 21:15:42.6315364–21:16:25.1582312 UTC**, account `967807252336`, region `us-east-1`, existing `jump-cli` identity. [Evidence manifest](../windows-upload-readbacks/FILE-MANIFEST.json) and [review](../windows-upload-readbacks/REVIEW.json).

- All ten Meri services: desired/running `1/1`, pending `0`, rollouts `COMPLETED`.
- Complete ACTIVE plus INACTIVE revision maxima and foundation output map match the original render. `latest.tsv` is byte-identical.
- `FIRST_CHAT_20261019D` is absent on all five secrets. AWSCURRENT and KMS identifiers match the original readback. Complete explicit version pagination returned 34 versions each for control, worker, owner and proxy; 35 for issuer. No private values were read and no AWS mutation occurred.

| Family | Current/latest revision | Proposed candidate revision |
| --- | ---: | ---: |
| control | 33 | 34 |
| temporal-worker | 32 | 33 |
| temporal-issuer | 32 | 33 |
| model-owner | 31 | 32 |
| model-proxy | 31 | 32 |
| runner (latest definition) | 18 | 19 |

These revisions are observations, not reservations. Current Node image digest is `sha256:9bff84ba24959130e63e64b2ac72783144053084168fcf14f4344f4dd8583717`, with ECR source tag `a16cc40d2a7ca3695eb6cc5a8d45440d0c40d040`. The qualified candidate `sha256:ea0e9ad4cfcec1052c33b39ae2f41c1df6e591b7ab2e74c762a1f68f54990b49` exists with source tag `5b395d4ce9218b872b21c420dc00a3af31739824` and is not deployed. Proxy main and Temporal server image pins remain unchanged. Only the two already allocated build jobs were used; this handoff allocates no additional build.

## Operator invocation after parent release

Use Windows PowerShell 5.1, the existing AWS CLI/profile, the existing private `$out`, and the existing public cache. Once the exact operator tree has been exported to `$uploadOps`, the invocation is:

```powershell
$uploadAws = @(Get-Command aws.exe -CommandType Application -ErrorAction Stop)[0].Source
$uploadProfile = if ($env:AWS_PROFILE) { $env:AWS_PROFILE } else { 'default' }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $uploadOps 'Invoke-Pr193PrivateUpload.ps1') `
  -OutputDirectory $out `
  -PublicCacheRoot (Join-Path $env:LOCALAPPDATA 'Meri\pr193-public') `
  -ReadbackCommit '05b73a61cb4f2bbfa52eae38ea23e44598c33e9f' `
  -AwsExecutable $uploadAws -AwsProfile $uploadProfile -NeoApprovedPrivateUpload
if ($LASTEXITCODE -ne 0) { throw 'UPLOAD_STOPPED_KEEP_EXISTING_OUT_AND_STATE' }
Get-Content -LiteralPath (Join-Path $out 'upload-receipt.json') -Raw
```

If Neo's existing authorized profile is explicitly named differently, use that same name. The wrapper checks the account before mutation. Do not create or copy credentials. Do not display bundles or private input files. The final receipt contains metadata only; share it with the parent for the next step.

Success emits `PR193_PRIVATE_UPLOAD_VERIFIED_BIND_READY` and writes metadata-only `upload-receipt.json` plus the canonical five-role `secret-versions.tsv`. This status means upload verification only. Stop there for parent review; it does not release local bindings or deployment.

## Preservation, uncertainty and limits

Before any put, the wrapper captures all five complete version lists and persists a UUID token for each role. It refuses a preexisting D label, changed current/KMS, malformed metadata or an existing version count of 100 or more. Every later snapshot must retain all original IDs/stages and may add only that role's persisted token. The bundle is locked against writes/deletion during hash validation and AWS file consumption. The process captures provider output and returns constant failure codes.

An uncertain or refused run stops immediately. Keep the same `$out`, bundles, receipt, state and tokens. Report the constant code. A subsequent parent-released retry uses this same command and state; it reconciles existing tokens and skips completed puts, or resubmits identical bytes with the same token. Never delete state, regenerate the render, change labels or create replacement tokens to get past a refusal.

AWS supports idempotent same-token/same-value puts. Explicit version stages avoid default AWSCURRENT assignment. **Label absence is not an atomic server-side condition:** a competing writer can claim the label between metadata read and put, and attaching an existing label can move it. Therefore the parent must confirm the sole operator window immediately before release. [AWS PutSecretValue contract](https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_PutSecretValue.html).

Postchecks establish version IDs and stages. Hashes establish the local bytes submitted through the AWS file argument; no remote secret value is reread. The wrapper refuses at the version-count threshold to avoid causing historical-version cleanup; existing staged and deprecated IDs are checked after each put and again before final success. [AWS version retention behavior](https://docs.aws.amazon.com/secretsmanager/latest/userguide/whats-in-a-secret.html).

## Verification and remaining gate

The upload author ran the focused fake suite on actual Windows PowerShell 5.1. Root independently inspected the upload context, metadata normalization, durable state, recovery workflow and output boundary, then independently reran that suite: **281 assertions PASS**, exit 0. Coverage includes before/after mutation uncertainty, unchanged tokens, completed-put reuse, historical-version/stage drift, foreign versions, capacity refusal, exact reviewed manifest, explicit pagination and bundle locking. These are fake adapter checks, not evidence of a live upload.

The upload-specific module composes the existing common ACL/hash/process adapter. No runtime source, canonical renderer, dependency lockfile or deployment plan changed. Unpublished local-bind work and unrelated README edits remain separate.

**Remaining gate: parent release after receipt and operation-claim review. Status is pending, not denied.** No upload has been attempted, so there is no uncertain live mutation outcome to reconcile.

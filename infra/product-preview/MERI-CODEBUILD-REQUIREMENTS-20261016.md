# Meri runtime image: one-attempt CodeBuild requirements

Read-only source and AWS preparation, 2026-10-16. This records an approval-ready
delta for the existing builder. It does not authorize uploading source, changing
IAM, starting CodeBuild, pushing an image, or deploying a task. The reviewed
product source is `e4fc10347c7bf557eff93423e42816834b009a4e`; that exact
commit is sealed locally for this image attempt. The earlier local seal at
`245e116899ebbcacbb29918292759d63306c31d4` cannot represent the later
proxy/Temporal composition or Linux test gate.

## Exact observed resources

Named read-only `us-east-1` calls identified account `967807252336` and caller
`arn:aws:iam::967807252336:user/jump-cli`. This is an observed caller, not an
allocation of build or upload authority. A fresh read-only STS call and the
three actual readbacks below reconfirmed this identity at approximately
2026-10-16 22:30 UTC. The task sandbox has no ambient credential access; these
reads used the existing normal escalation path without reading or displaying
credential values.

| Surface | Observed value and scope |
| --- | --- |
| CodeBuild project | `arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build`; S3 source currently points to `meri-greenfield-qual-build-967807252336-us-east-1/inputs/qualification-source.zip`. The default qualification buildspec is not the Meri product recipe. |
| Build environment | `LINUX_CONTAINER`, `aws/codebuild/standard:7.0`, `BUILD_GENERAL1_SMALL`, privileged Docker, 30-minute build and 5-minute queue timeouts, `NO_CACHE`, no VPC configuration. Validate Linux/Python 3/AWS CLI/Docker capacity at execution; SMALL does not prove this image build fits. |
| Service role | `arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H`. Trust is `codebuild.amazonaws.com`, constrained by account `967807252336` and the exact project ARN. No permission boundary or attached managed policy was observed; its one inline policy is `BuilderRoleDefaultPolicy8E4A45D4`. |
| S3 source/result bucket | `meri-greenfield-qual-build-967807252336-us-east-1`, versioning enabled, default SSE-KMS key `arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042`. Existing builder IAM covers `inputs/*` reads and `results/*` puts; actual object versions and resource-policy/action-time access are still unobserved. |
| ECR destination | `arn:aws:ecr:us-east-1:967807252336:repository/meri-greenfield/qualification-worker`, URI `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker`. The repository reports immutable tags, scan-on-push and the same KMS key. Existing qualification image findings do not qualify a new Meri image. |
| Logs and artifacts | Existing CloudWatch group `/meri-greenfield/qualification/build`, with builder role `logs:CreateLogStream`/`logs:PutLogEvents` on its stream ARN. The project has `NO_ARTIFACTS`; the generated product buildspec's `product-image-receipt.json` will not be delivered without a per-build S3 `artifactsOverride`. |

The exact offline `e4fc1034` seal contains 18,380 regular Git-tree members:

| Local input | Bytes | Raw SHA-256 |
| --- | ---: | --- |
| `product-source.zip` | 137,989,013 | `356266e4d4879abb29fff9cf5f1f789716d8bf8bb10aebf96da7dcdcbb1f13c0` |
| `product-source-members.json` | 3,778,823 | `0e6b2bdab75ec852fd12a4a659e4d44d8766c6af41881c6b6612f04e34962e5c` |

The local packet is `task/meri-image-input-e4fc1034/`; its
`offline-source-receipt.json` reports `VERIFIED_SOURCE_ONLY` after full archive
membership verification. `product-image-job.pending.json` fixes the proposed
keys and job settings below. Both VersionIds and the dependent buildspec remain
null because no upload occurred. `finalize-upload-readbacks.mjs` refuses to
generate a runnable job until real independent version/hash/KMS readbacks,
shipping principal, base approval and resource-reuse approval are supplied.
The older `245e1168` seal cannot represent this pin. Later owner-channel,
credential-delivery, token-writer and existing-Aurora source changes are also
outside this frozen `e4fc1034` archive and need a new seal to qualify them.

## Shipping caller and builder are different principals

The shipping caller is exactly `arn:aws:iam::967807252336:user/jump-cli`.
Actual read-only calls under that identity succeeded for all three actions:

| Action | Exact target used for the readback | Observed result |
| --- | --- | --- |
| `codebuild:BatchGetBuilds` | `meri-greenfield-qualification-build:f78dc8c3-a0d9-45b1-a893-9abb1f403287`, authorized through `arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build` | Returned the named historical build, its project, source location/version and `SUCCEEDED` status. |
| `ecr:DescribeRepositories` | `arn:aws:ecr:us-east-1:967807252336:repository/meri-greenfield/qualification-worker` | Returned the selected URI, immutable tags, scan-on-push and KMS key. |
| `ecr:DescribeImageScanFindings` | The same repository, digest `sha256:caf50825160f27f2ca112c8f3ab3a5efaa06e1fc5619fc3e18b075d20c80f0d2` | Returned completed scan, including 2 CRITICAL and 48 HIGH findings on that old image. |

The Core shipping owner can use this existing caller path for independent
project/build/repository/scan readback. **No additional IAM grant to
`jump-cli` is requested for these reads.** The historical build and scan only
prove read access; neither supplies a product image or qualifies its contents.

The current reviewed `image-build-producer.py` additionally performs these
operations *inside CodeBuild*, using the project's service role. Before
downloading or building, it calls `BatchGetBuilds` to authenticate its own build
and exact S3 source version, then `DescribeRepositories` to require immutable
tags and scan-on-push. After push it calls `DescribeImageScanFindings` before
emitting any success receipt. An external shipping read does not satisfy these
in-process checks. No gate is removed, no shipping credential is delivered to
the builder, and no external attestation substitute is implemented here.

## Builder-role IAM delta for the current producer

The producer in `image-build-producer.py` calls `codebuild:BatchGetBuilds` to
recheck its own project/source version, `ecr:DescribeRepositories` to require
immutable tags and scan-on-push, and `ecr:DescribeImageScanFindings` after the
push. The exact target principal is
`arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H`,
whose observed inline policy is `BuilderRoleDefaultPolicy8E4A45D4`. Fresh
role inventory reconfirmed this is its only inline policy, with no attached
managed policy and no permission boundary. Its conditioned trust remains
limited to the selected CodeBuild project. Current IAM simulation against
that role returned `implicitDeny`
for exactly these three calls on the following resources. **Conditional on
retaining the exact `e4fc1034` producer for the separately approved build**, the
following is the minimum proposed identity-policy delta for the **existing
builder role**. This packet requests review; it does not recommend or authorize
applying IAM now. Avoiding this role change would require a separately reviewed
producer/recipe change and new source seal that preserves authenticated
provenance and scan acceptance; shipping pre/post reads alone cannot replace
the current runtime calls.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOwnProductBuildIdentity",
      "Effect": "Allow",
      "Action": "codebuild:BatchGetBuilds",
      "Resource": "arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build"
    },
    {
      "Sid": "ReadSelectedProductRepositoryAndScan",
      "Effect": "Allow",
      "Action": ["ecr:DescribeRepositories", "ecr:DescribeImageScanFindings"],
      "Resource": "arn:aws:ecr:us-east-1:967807252336:repository/meri-greenfield/qualification-worker"
    }
  ]
}
```

A separate earlier read-only attempt to simulate this hypothetical policy as
custom input returned `InvalidInput` before evaluation. No hypothetical allow
result is claimed. The fresh existing-role simulations supplied the policy's
unrelated `kms:ViaService=logs.us-east-1.amazonaws.com` condition context and
returned `implicitDeny` with no missing context for each exact action/resource
pair. Simulate the actual effective role after its owner applies the reviewed
statement; no action-time call under the builder role or role assumption was
performed by this task.

There is **no proposed S3 or ECR push expansion** for this selected bucket and
repository. The current inline policy already permits `s3:GetObject*` on
`inputs/*`, `s3:PutObject` on `results/*`, KMS decrypt/data-key on the observed
key, ECR auth (`Resource: "*"`), push-layer/PutImage and DescribeImages on the
selected repository. Exact-key IAM simulation allowed `s3:GetObject` and
`s3:GetObjectVersion` for proposed archive/member keys, `s3:PutObject` under a
product receipt result prefix, KMS decrypt, and ECR auth/push/readback on the
selected ECR repository. The current inline policy also lists the existing
CloudWatch logging rights. AWS maps versioned `GetObject` to
`s3:GetObjectVersion`; `HeadObject` needs the relevant object read permission.
These identity simulations do not prove the S3 bucket policy, KMS key policy,
organization controls or future selected version will allow the operation.

AWS's [CodeBuild IAM example](https://docs.aws.amazon.com/codebuild/latest/userguide/auth-and-access-control-iam-identity-based-access-control.html)
scopes `BatchGetBuilds` to a project ARN. Its
[ECR push policy](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-push-iam.html)
scopes push actions to a repository ARN while keeping `GetAuthorizationToken`
on `*`. The [S3 operation map](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-policy-actions.html)
sets object/version/put action semantics, and the
[S3 HeadObject API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)
identifies its read and optional KMS-checksum permissions. No secret or policy
credential value was read.

## Exact per-build shape to review after the source seal

### Reusing Meri build resources preserves product provenance

The observed project, bucket, KMS key, builder role and ECR repository belong
to the independent Meri qualification stack; they are not Capiro/frontend
build resources. Their `qualification` names do not establish or disprove
the source of a newly built image. The approved source validators require
the fixed account/region, owner-selected project/repository pins and unique
`product-<full-commit>-<32-hex-attempt>` tag; their product-named test fixtures
do not require creation of another project or repository. Reuse remains an
explicit reviewed selection under the repository's independent-environment
rule, as recorded in `CAPIRO-DEV-CHANGE-SET-20261016.md`.

This attempt must build `apps/runtime/Dockerfile` from the sealed full tree at
`e4fc10347c7bf557eff93423e42816834b009a4e` using the product override, new exact
S3 versions and a fresh immutable tag. The unchanged default project buildspec
still builds the qualification worker and must not run for this request.
Existing qualification task definitions are digest pinned. No old image is
retagged, relabeled, substituted or admitted; authenticate the new build's
source/version/override, image digest, actual runner/Node/user measurements
and scan before admitting the resulting product source image.

The exact pending keys in the observed bucket are
`inputs/product-runtime/e4fc10347c7bf557eff93423e42816834b009a4e/product-source.zip`
and
`inputs/product-runtime/e4fc10347c7bf557eff93423e42816834b009a4e/product-source-members.json`.
They are proposed immutable uploads with `If-None-Match: *`, not uploaded
objects. Record each returned non-null `VersionId`, raw SHA-256,
size, SSE-KMS key and independent readback. The builder's S3 source is the ZIP;
the producer separately calls versioned `HeadObject` and `GetObject` for both
pins, checks raw hashes and complete archive membership, then extracts only
verified regular files. CodeBuild's `sourceVersion` for S3 is the ZIP object's
VersionId, not the Git SHA.

The nonsecret `product-build-request.json` must have exactly the fields in
`image-buildspec-design.md`: full `sourceCommit`, both `{bucket,key,versionId,sha256}`
pins, Dockerfile/verifier/producer/runner byte hashes, an independently
reviewed `public.ecr.aws/docker/library/node@sha256:<digest>` base and exact
`v24.x.y`, `runtimeUser` `1000:1000`, observed project ARN and ECR URI, plus a
unique `product-<full-commit>-<32-hex-attempt>` image tag. The exact new
source tree must include the Linux-only prepared-bootstrap and remote-runner
tests; the producer's in-image test gate must pass **before** ECR login/push.
These Windows fixture cases remain unrun until that Linux build. Generate
`buildspecOverride` with `createProductImageBuildRecipe(request)`, freeze and
independently compare its exact bytes and SHA-256. It authenticates the
producer and verifier module hashes before execution. No credential, model
request, DB connection, Temporal secret or Docker build argument beyond the
pinned Node base belongs in this request.

The pending attempt/idempotency token is
`183a205323404cabb1820f4e45723c8c`, and the exact image tag is
`product-e4fc10347c7bf557eff93423e42816834b009a4e-183a205323404cabb1820f4e45723c8c`.
The sealed recipe pins are:

| Source bytes | SHA-256 |
| --- | --- |
| `apps/runtime/Dockerfile` | `3418bc4304686ff455566652ad54900b616671fb11f955ef0afcacb5dc740518` |
| `image-build-producer.py` | `95fd504d49199051cee528760347250979fda91b5b54ed7fc730eca658df7b05` |
| Canonical runner | `b7c29dcbd6679815c4731244697228736c3dfd7094fb26b27db92aa18009e45d` |
| Source verifier | `07e5dcd2749c0d782b383efad45e6ce303d3fc074d640d8d5838a3d81ff04c55` |

Public registry metadata read at 2026-10-16 22:32:36 UTC independently matched
the retained upstream Node bytes. The proposed direct Linux amd64 base is
`public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63`,
with config `NODE_VERSION=24.21.0` and requested runtime version `v24.21.0`.
This is a verified metadata candidate awaiting approval, not a native image
measurement or scan result. No layer pull or Docker build occurred.

For the single approved `StartBuild`, bind `projectName` to the observed
project, `sourceLocationOverride` to the exact selected `bucket/key`, and
`sourceVersion` to the ZIP VersionId; provide the reviewed inline
`buildspecOverride`, `timeoutInMinutesOverride: 30`,
`queuedTimeoutInMinutesOverride: 5`, `autoRetryLimitOverride: 0`, and one
caller-owned idempotency token. Keep the observed service role, standard 7.0
Linux image, privileged mode, no cache and no VPC override. AWS documents the
[per-build override fields](https://docs.aws.amazon.com/codebuild/latest/APIReference/API_StartBuild.html)
and [S3 source-version format](https://docs.aws.amazon.com/codebuild/latest/userguide/sample-source-version.html).

Because this project reports `NO_ARTIFACTS`, include a reviewed
`artifactsOverride` of type `S3`, `location` the observed build bucket,
`packaging: NONE`, `namespaceType: NONE`, `encryptionDisabled: false`,
`path: results/product-image/<full-commit>/<attempt>`, and `name: /` so the
single `product-image-receipt.json` lands under that unique prefix. Confirm
that exact override with the shipping owner, then verify the actual
`build.artifacts.location` and returned S3
version after completion; do not infer a receipt from `SUCCEEDED` alone.
AWS documents [ProjectArtifacts path/name and packaging](https://docs.aws.amazon.com/codebuild/latest/APIReference/API_ProjectArtifacts.html).
Keep logs in the observed CloudWatch group and inspect them only with secret
redaction. A failed scan, cleanup, test or upload leaves any pushed immutable
tag unadmitted and yields no accepted receipt.

The observed project has **no VPC configuration**. A build would use its
managed network to pull the pinned public Node base and locked npm packages,
as well as reach the AWS S3/KMS/CodeBuild/ECR/Logs APIs. Do not describe this
as private-only or offline. If the approved architecture requires restricted
egress or dedicated private endpoints, allocate and qualify a different
project/network revision before build. The build role has no proposed
provider, product database, Temporal, deployment, ECS or IAM mutation grants.

## Before one scoped approval

1. The exact `e4fc10347c7bf557eff93423e42816834b009a4e` seal and offline
   verification are complete. Confirm this deliberately frozen source scope;
   it does not include later unmounted interface/Aurora changes.
2. Approve the selected reuse/base and exact immutable uploads, then supply real
   VersionIds and independent source/output KMS readbacks. Finalize and compare
   the buildspec bytes/hash and artifact destination. Name the one-attempt
   spend ceiling and rollback/cleanup owner before `StartBuild`.
3. If retaining the exact `e4fc1034` producer, obtain the separate scoped
   approval for only the three-action delta to the exact **builder role**
   above. After any approved owning-stack change, recheck effective
   authorization, trust, bucket/key
   policy, KMS and project drift. Source upload and `StartBuild` need separate
   exact-action authorization by the shipping caller; role simulation is not
   that authorization. The existing `jump-cli` monitoring reads need no grant.
4. The approved build proves Linux tests, image entrypoint/user/Node and digest,
   completed zero-HIGH/zero-CRITICAL scan, credential/source cleanup and
   versioned receipt readback. This is an image qualification gate, not a
   service start, first-chat acceptance or deployment permission.

Current state: **no Meri runtime S3 upload, IAM change, CodeBuild run, ECR
product image, or deployment** from this workstream.

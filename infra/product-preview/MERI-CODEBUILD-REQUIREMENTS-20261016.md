# Meri runtime image: one-attempt CodeBuild requirements

Read-only source and AWS preparation, 2026-10-16. This records an approval-ready
delta for the existing builder. It does not authorize uploading source, changing
IAM, starting CodeBuild, pushing an image, or deploying a task. The current local
seal at `245e116899ebbcacbb29918292759d63306c31d4` is **source only**;
subsequent proxy/Temporal composition and the Linux test gate require a new
reviewed commit and seal before any build request.

## Exact observed resources

Named read-only `us-east-1` calls identified account `967807252336` and caller
`arn:aws:iam::967807252336:user/jump-cli`. This is an observed caller, not an
allocation of build or upload authority.

| Surface | Observed value and scope |
| --- | --- |
| CodeBuild project | `arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build`; S3 source currently points to `meri-greenfield-qual-build-967807252336-us-east-1/inputs/qualification-source.zip`. The default qualification buildspec is not the Meri product recipe. |
| Build environment | `LINUX_CONTAINER`, `aws/codebuild/standard:7.0`, `BUILD_GENERAL1_SMALL`, privileged Docker, 30-minute build and 5-minute queue timeouts, `NO_CACHE`, no VPC configuration. Validate Linux/Python 3/AWS CLI/Docker capacity at execution; SMALL does not prove this image build fits. |
| Service role | `arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H`. Trust is `codebuild.amazonaws.com`, constrained by account `967807252336` and the exact project ARN. No permission boundary or attached managed policy was observed; its one inline policy is `BuilderRoleDefaultPolicy8E4A45D4`. |
| S3 source/result bucket | `meri-greenfield-qual-build-967807252336-us-east-1`, versioning enabled, default SSE-KMS key `arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042`. Existing builder IAM covers `inputs/*` reads and `results/*` puts; actual object versions and resource-policy/action-time access are still unobserved. |
| ECR destination | `arn:aws:ecr:us-east-1:967807252336:repository/meri-greenfield/qualification-worker`, URI `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker`. The repository reports immutable tags, scan-on-push and the same KMS key. Existing qualification image findings do not qualify a new Meri image. |
| Logs and artifacts | Existing CloudWatch group `/meri-greenfield/qualification/build`, with builder role `logs:CreateLogStream`/`logs:PutLogEvents` on its stream ARN. The project has `NO_ARTIFACTS`; the generated product buildspec's `product-image-receipt.json` will not be delivered without a per-build S3 `artifactsOverride`. |

The exact offline `245e1168` seal is a 137,929,543-byte ZIP with SHA-256
`6a3a5dc2f9435ae3d40b77b5ca654e1842148b2de3f05cec57570c40ab9c04fc`
and a 3,775,367-byte member manifest with SHA-256
`29831b21ae7a678fbd8212ce8698d0515ce2dd2c2e1b1ac34fe1732a7ae0ecd2`.
Its local receipt is `task/meri-image-input-245e1168/offline-source-receipt.json`.
Neither object has an observed S3 key or VersionId. These hashes must never be
presented as a later source pin.

## Builder-role IAM delta

The producer in `image-build-producer.py` calls `codebuild:BatchGetBuilds` to
recheck its own project/source version, `ecr:DescribeRepositories` to require
immutable tags and scan-on-push, and `ecr:DescribeImageScanFindings` after the
push. Current IAM simulation against the named role returned `implicitDeny`
for exactly these three calls on the following resources. Add only this
identity-policy statement set to the **existing builder role**, subject to the
owning stack/policy reviewer and an action-time effective-policy check:

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

A separate read-only attempt to simulate this hypothetical policy as custom
input returned `InvalidInput` before evaluation. No hypothetical allow result
is claimed; simulate the actual effective role after its owner applies the
reviewed statement. The existing-role implicit denies above were confirmed.

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

## Exact per-build shape to review after the successor seal

The reviewed shipping owner must select **two new versioned source objects**
under the observed bucket's `inputs/` path: the successor full Git-tree ZIP
and its exact member JSON. For example, reserve unique keys
`inputs/product-source-<full-commit>.zip` and
`inputs/product-source-members-<full-commit>.json`; these names are proposed,
not uploaded objects. Record each returned non-null `VersionId`, raw SHA-256,
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

1. Complete proxy/Temporal source composition, Linux test recipe and review;
   commit and reseal that exact successor. The `245e1168` seal is not a build
   input for those changes.
2. The shipping owner supplies exact source object keys, VersionIds, independent
   hashes, Node base digest/version, buildspec bytes/hash, artifact destination,
   source/output KMS readback, unique attempt/idempotency token, one-attempt
   spend ceiling and rollback/cleanup owner.
3. The stack owner reviews and applies only the three-action builder-role
   delta above, then rechecks effective authorization, trust, bucket/key
   policy, KMS and project drift. Source upload and `StartBuild` need separate
   exact-action authorization by the shipping caller; role simulation is not
   that authorization.
4. The approved build proves Linux tests, image entrypoint/user/Node and digest,
   completed zero-HIGH/zero-CRITICAL scan, credential/source cleanup and
   versioned receipt readback. This is an image qualification gate, not a
   service start, first-chat acceptance or deployment permission.

Current state: **no Meri runtime S3 upload, IAM change, CodeBuild run, ECR
product image, or deployment** from this workstream.

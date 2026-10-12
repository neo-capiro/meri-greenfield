# G1 dedicated SDK checkpoint infrastructure source review

**Decision: ACCEPT template source-only; deployment and G1 HOLD.** This
candidate synthesizes a standalone bootstrapless stack named
`MeriGreenfield-QualificationSdkCheckpoint`. It creates exactly one new
versioned, bucket-owner-enforced, public-blocked checkpoint bucket with a new
KMS key, seven-day governance Object Lock, TLS enforcement and retention of
both resources on stack removal. It does not change the existing build bucket,
runtime stack, empty worker role or Capiro resources.

The future trusted ECS control role can only create-if-absent fixture objects
with the exact KMS key and read current/exact versions under
`qualification-sdk/fixture/*`. Its KMS actions are scoped to S3 and that object
prefix with bucket keys disabled. It has no delete, bypass, list, database,
source or provider actions. Bucket denies also refuse a write without a
conditional header, SSE-KMS and the exact key. The role is not attached to a
running task. The future control task and private S3 endpoint must be scoped
and reviewed separately.

Pinned Node 24.19.0 synthesis and three static resource/policy tests passed
3/3, exit 0. The synthesized template SHA-256 is
`f2b578ea75b3069e11a4eafca41201e52d2afd99edf368a5426fe16c02587485`.
Read-only CloudFormation `ValidateTemplate` returned the expected description,
exit 0. Read-only `DescribeStacks` returned `ValidationError: Stack ... does
not exist`, exit 1, establishing that this is a new stack, not a claimed
deployment. The source was prepared under shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`,
machine map 2026-09-30 00:21:48 UTC, in account `967807252336` with observed
read-only caller `user/hermes-cli`.

No change set, S3 object, KMS key, IAM role, ECS task, image, model call,
provider charge, merge or deployment was created. Seven-day governance
retention is a proposal for synthetic qualification data and needs exact
external-write approval with the full CloudFormation template. Runtime VPC
endpoint, image/scan, actual native evidence inspector, task credentials and
two-task interruption/resume remain open. The 75-request REL-01/REL-06
benchmark remains separate from this greenfield G1 qualification path.

## Deployment readback — 2026-10-11 UTC

The owner answered yes to the exact new-stack deployment request for source
`8c4554d70b0e4552320a9047307260846b199e1c` and template SHA-256
`f2b578ea75b3069e11a4eafca41201e52d2afd99edf368a5426fe16c02587485`.
STS immediately before mutation returned account `967807252336`, region
`us-east-1`, caller `arn:aws:iam::967807252336:user/hermes-cli`; the named
stack did not exist. Change set
`meri-sdk-checkpoint-8c4554d-20261011` listed only the six Add actions in
this template: bucket, bucket policy, KMS key, alias, control role, inline
policy. It was executed and stack
`MeriGreenfield-QualificationSdkCheckpoint` reached `CREATE_COMPLETE` at
`arn:aws:cloudformation:us-east-1:967807252336:stack/MeriGreenfield-QualificationSdkCheckpoint/2ac21470-c594-11f1-85e1-0eab4fe6dfb5`.

Readback confirmed bucket
`meri-greenfield-qual-checkpoint-967807252336-us-east-1` has versioning,
seven-day GOVERNANCE Object Lock, SSE-KMS with bucket keys disabled, four
public-access blocks and TLS-only bucket policy. KMS key
`arn:aws:kms:us-east-1:967807252336:key/3a04f062-40de-4ed8-9a24-dad87c488e0c`
is enabled with annual rotation. The new unused role
`arn:aws:iam::967807252336:role/meri-greenfield-qualification-sdk-control`
has one inline policy, no attached policy; its readback contains conditional
create/read on `qualification-sdk/fixture/*` and prefix-bound KMS via S3,
with no delete, bypass, list or provider action. The initial KMS rotation
readback by alias failed with `InvalidArnException`; readback by exact key ARN
then succeeded. No object was written, no task launched, and no existing
runtime stack was updated. This is infrastructure availability, not S3 I/O,
control-task, two-task, or G1 qualification.

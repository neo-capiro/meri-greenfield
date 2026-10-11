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

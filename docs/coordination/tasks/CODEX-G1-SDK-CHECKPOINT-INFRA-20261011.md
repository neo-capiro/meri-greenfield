# G1 dedicated SDK checkpoint infrastructure candidate

Owner: Codex. Base `8cabeef970cd82a5e863824bb1fc5f24ac80a065`;
branch `task/sdk-checkpoint-infra-20261011`, dedicated worktree. Shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`;
machine map 2026-09-30 00:21:48 UTC.

## Outline before implementation

Prepare a new, standalone qualification CloudFormation stack for the fixed
checkpoint bucket, new KMS key and future trusted control-task role. It must
leave the existing build bucket, worker role, current runtime stack and Capiro
resources untouched. Bucket ownership, versioning, KMS, public block, TLS and
default Object Lock retention protect synthetic checkpoint versions. The
control role gets only create/read object actions under the fixed fixture
prefix and KMS via S3 for that prefix; it gets no delete, retention override,
list, provider, source or database powers. The deployed control task and its
private endpoint will be a later separately reviewed change.

The CDK source must synthesize bootstraplessly for the pinned account/region.
Static checks will assert exact resources and permissions. Read-only AWS
inventory and CloudFormation template comparison may be used; no deploy,
change-set execution, S3 write, role assumption, image build or task launch is
authorized by this source task. Object Lock retention is proposed as seven
days of governance mode for this synthetic qualification bucket; it must be
explicitly reviewed before any cloud creation.

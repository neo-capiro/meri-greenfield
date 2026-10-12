# G1 SDK fixture S3 persistence source review

**Decision: ACCEPT source-only; G1 HOLD.** The candidate adds a concrete
versioned S3 object I/O adapter and composes bundle/sentinel/receipt creation
and readback with the existing service port. It does not alter public 0.1
contracts, registry migration, mTLS ingress, worker identity or the plan.

Base `80071cb7371310f4bb3a25d687d2daf4f5890da4`; shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`;
machine map 2026-09-30 00:21:48 UTC.

The trusted object client fixes account, region, checkpoint bucket name, KMS
key account and generated run/object key shape. Put is `IfNoneMatch:*` with
SHA-256 and KMS, requires a non-null S3 VersionId, and rereads that exact
version with a bounded stream. Receipt loading binds the registry's exact
SHA-256; bundle and sentinel loading use their recorded version IDs. All
receipt flags remain partial/false. A mandatory trusted native evidence
inspector is invoked before any object write. The current transaction/fence
registry can still refuse publication after object preparation; such objects
are untrusted orphans, not a checkpoint.

Node 24.19.0 checks on the candidate: service handler plus new S3 tests 8/8,
exit 0; affected private contract/wire tests 10/10, exit 0. The S3 tests use
a fake `send` client to inspect actual SDK commands and deliberately corrupt
readback; they do not call AWS. Pinned `@aws-sdk/client-s3@3.1149.0` resolves
from the new service lockfile. `git diff --check` passed.

Read-only AWS inventory on 2026-10-11 showed caller
`arn:aws:iam::967807252336:user/hermes-cli`, the existing isolated
qualification cluster, one qualification build bucket and no checkpoint
bucket. No S3 write, CloudFormation change, ECS launch, provider call, image
build, PR, merge or deployment occurred. The exact new bucket, Object Lock
retention, IAM/KMS role, private endpoint, evidence inspector and service
image/task remain to be prepared and admitted before real durability can be
claimed. The 75 real-request REL-01/REL-06 benchmark is not a prerequisite
for this G1 synthetic SDK qualification path.

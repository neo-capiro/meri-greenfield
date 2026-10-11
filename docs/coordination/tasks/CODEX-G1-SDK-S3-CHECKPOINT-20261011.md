# G1 SDK fixture durable object-store path

Owner: Codex. Base `80071cb7371310f4bb3a25d687d2daf4f5890da4` on dedicated
`task/sdk-s3-checkpoint-20261011`. Shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`;
machine map last changed 2026-09-30 00:21:48 UTC.

## Outline before implementation

`service/s3-objects.mjs` owns bounded, create-only S3 writes and exact-VersionId
readbacks with SHA-256, size, KMS and bucket binding. The only bucket, region,
KMS key and prefix come from trusted service configuration; callers provide
canonical run and generated object IDs, never a bucket, URL or object key.
`service/checkpoint-store.mjs` owns partial receipt assembly, evidence-verifier
invocation, workspace sentinel and bundle persistence, and load correlation to
the PostgreSQL publication. The existing registry remains the sole grant/fence
and atomic publication authority. The existing mTLS ingress remains the peer
boundary. A trusted native evidence inspector must be injected and must read
and qualify init, interrupt, exit and drain evidence before any commit write.

This source task uses the pinned AWS SDK and bounded fake S3 response tests. It
does not create or reuse a cloud bucket, deploy a service, issue ECS credentials,
run native SDK recovery or admit an image. A dedicated checkpoint bucket, narrow
control-task IAM/KMS policy, private endpoint, real evidence inspector and live
two-task run remain separate operational gates. Source tests cannot close G1.

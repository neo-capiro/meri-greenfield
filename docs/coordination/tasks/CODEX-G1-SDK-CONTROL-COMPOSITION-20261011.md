# G1 SDK trusted control composition

Owner: Codex. Base `1eac54274223729d69a0d44456a3f090dc1a0b80` on dedicated
`task/sdk-control-composition-20261011`. Shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`;
machine map 2026-09-30 00:21:48 UTC. This is a source-only implementation.

## Outline before implementation

The new service composition owns construction and lifecycle of the existing
PostgreSQL-backed `FixtureRegistry`, `createS3FixtureObjects`,
`createS3CheckpointStore`, fixed service handlers and private mTLS ingress. It
passes certificate fingerprints only to the registry's trusted
`resolveCertificate`; the registry retains current grant/fence authority. The
checkpoint store retains S3 version/readback responsibility. The ingress owns
its listener and sockets. The composition must close its S3 client after ingress
closure, including failed starts. Construction must not connect, listen, or
write. It exposes the registry only to its trusted owner for initial admission
and replacement, never over the HTTP route.

The owner supplies an existing validated `PostgresStore`, exact TLS material,
binding, deployed checkpoint bucket/KMS key, and a **real** native evidence
inspector. A fake S3 client and inspector are allowed only in offline tests.
Missing dependencies fail before allocation. There is no in-memory authority,
worker-selected object location, provider access, migration, or runtime task.

Verify the composition using the existing isolated PostgreSQL/mTLS harness with
fake S3 command handling, plus failure and import-inert checks. Preserve the
existing handler, registry, S3 and ingress tests. This does not prove live S3,
native evidence quiescence, ECS credentials, image admission or G1.

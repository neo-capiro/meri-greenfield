# Temporal issuer source qualification — 2026-10-17

## Source boundary

This successor is stacked on Meri draft PR #122 at `66a251733c13fd659c0f9ff5f1f759b4f99d8192`. The independent central allocation at [`c16d6d5`](https://github.com/neo-capiro/meri-greenfield/blob/c16d6d5cc8c2d1b73c5116f791cb22c20bb9bf60/docs/coordination/tasks/CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md) exclusively reserves `migrations/0001_service_task_registrations.sql` for the `meri_service_identity.service_task_registrations` owner. The migration is source only and has not been applied.

The issuer entrypoint requires a trusted dedicated, verify-full primary-writer `pg` Pool and an exact pinned `registrationRole`; it borrows but never ends the Pool. The entrypoint constructs the canonical PostgreSQL registration adapter, checks the exact primary/schema/privilege grant profile, pins the KMS RSA public key, reads owner-only TLS and client CA material, then mounts the concrete task authority, post-placement certificate owner, token service, and JWKS on private TCP 443. Missing bindings fail before listener readiness. The task-local bootstrap client obtains a claimed task ARN only from ECS metadata v4, proves possession of a fresh CSR key over pinned server TLS, and accepts material only after the issuer proves the observed socket IP against current ECS service/task/ENI facts and commits an exact registration receipt.

The source uses exact `RS256`/asymmetric KMS signing, `permissions:['meri:write']`, separate control and worker identities, task/revision/certificate CAS, irreversible revocation tombstones, and fresh primary and cloud reads. The owner rereads current ECS/ENI facts after the registration commit and primary readback before releasing a certificate. A client leaf is five minutes by default; the product material owner must re-bootstrap and atomically rotate the task-local key/certificate pair before expiry. The token remains valid until its signed expiry even if a task is revoked later; that residual lifetime is bounded to 60 seconds by source and must be included in activation review.

## Focused source check

Run from the repository root with Node 24:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test apps/runtime/temporal-issuer/*.test.mjs
```

The frozen local source passed **95/95** tests on 2026-10-17, including KMS key/signature pins, token/JWKS permissions and lease, task/ENI currentness, one-use CSR proof, certificate shape, registration CAS/revocation/uncertain commit, startup gating, and timeout/cleanup. The tests use fake AWS/KMS/PostgreSQL ports and ephemeral in-memory certificates; they are source checks, not a live qualification. No npm install, native PostgreSQL, AWS write, SQL migration, provisioned CA/KMS key, or image build was run for this successor.

## Exact mount and remaining gates

Server source API: `parseTemporalIssuerEntrypointConfiguration(raw)` and `createTemporalIssuerEntrypoint({configuration,registrationPool}) -> {start,close,available}`. The closed config adds `registrationRole`, `bootstrap:{caKeyFile,caSha256}`, `listen.port:443`, and `service.bootstrapMaxRequestMs` (3,000–14,000 ms) separately from the token request deadline. The root-owned executable must read a pinned owner-only connection file, create the **dedicated** verify-full primary-writer Pool, and close that Pool after entrypoint shutdown. No shared application Pool or arbitrary registration module selector is valid.

Task-local source API: `parseTemporalIssuerBootstrapClientConfiguration(raw)` and `createTemporalIssuerBootstrapClient({configuration,serverCaPem,clientCaPem}) -> {bootstrap,close,available}`. `bootstrap()` returns verified `{keyPem,certPem,registration,...}` buffers and writes no files. The root-owned material init must install the pair atomically at mode 0600 in an initially empty mode 0700 task-local volume, wipe its key buffer, then start the token writer and Temporal connection. It must rotate the pair before expiry and fail readiness closed if renewal fails. The bootstrap client's static server/client CA PEMs are public trust material; its key/cert pair is dynamic and must be excluded from static material inventory.

**Activation is held.** Required later qualification includes native PostgreSQL 16 migration syntax/triggers/ACL and concurrent rotation/revoke with a dedicated least-privilege role, actual ECS task/ENI/source-IP and service deployment state, pinned client/server TLS CA purpose and task SAN, provisioned KMS RSA key/signature/JWKS and IAM, private route/DNS/SG, task-local material lifecycle, package install/image scan, Temporal 1.32.1 authorizer and token renewal, and complete rollback. The separate proposed AWS resource/cost packet is `AWS-ACTIVATION-PROPOSAL.md`; it is not spending or deployment approval.

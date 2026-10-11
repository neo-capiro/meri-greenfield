# G1 SDK mTLS certificate-to-grant resolver

Owner: Codex. Base `8c4554d70b0e4552320a9047307260846b199e1c`;
branch `task/sdk-credential-resolver-20261011`, dedicated worktree. Shared
policy `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`;
machine map 2026-09-30 00:21:48 UTC.

## Outline before implementation

The existing qualification PostgreSQL registry is the canonical current and
historical grant owner. Add a read-only resolver method that maps the SHA-256
fingerprint from the verified mTLS socket to exactly one admitted grant, reads
the run/current and original grant under row locks, reconstructs the existing
closed private contexts, and returns only the matching certificate's audience.
The ingress keeps socket authentication and body binding; the existing registry
authorization/publication transactions remain the sole currentness and fence
authority. A revoked original credential may resolve only to its original A
audience so the exact stale authorization decision can be observed; it cannot
use B's audience. Unknown or duplicate fingerprints, inconsistent database
rows and foreign operations refuse. No new migration or schema is allocated.

Verify the pure row reconstruction and the actual registry query against a
fresh isolated PostgreSQL fixture if available, plus the existing mTLS/service
cases. This does not issue a certificate, prove ECS task possession, deploy a
database, read customer data, run SDK tasks or advance G1. The control issuer
must still bind a unique short-lived certificate fingerprint to an observed
ECS task ARN and admit it with the trusted registry.

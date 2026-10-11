# G1 SDK fixture registry/ingress composition

Owner: Codex. Base `b5d591f4d13114400317d9b26bc0e008fbe35292`;
branch `task/sdk-registry-ingress-compose-20261011`, dedicated worktree
`C:/dev/meri-greenfield-sdk-registry-ingress-compose-20261011`. Shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`;
machine map last changed 2026-09-30 00:21:48 UTC.

## Outline before implementation

Compose the existing private TLS ingress and PostgreSQL fixture registry at one
trusted control-layer boundary. Keep ingress responsible for authenticated
socket identity, canonical wire and deadlines. Keep `FixtureRegistry` responsible
for current grant/fence, stale authorization, atomic receipt publication and
load/verify binding. New `apps/control/qualification-sdk-fixture/service/`
modules translate those results to the four fixed private responses and require
a separately trusted checkpoint storage port for immutable object bytes and
readback. The storage port receives only trusted producer/current contexts and
registry publication identity; no worker request may select a bucket/key/URL.

First prove the current-fence authorization path over actual loopback mTLS and
an isolated PostgreSQL 16 database: A admitted/authorized, A commit published,
B admitted, exact old A credential gets an explicit stale denial, B credential
gets authorization, and a wrong peer/context refuses. Other fixture operations
must remain bound to the registry and storage port, not synthetic success in
production code. Add focused negative tests for substituted current context,
bad stored bytes/reference and uncertain publication as applicable.

No actual S3 adapter, AWS/cloud write, Docker/image build, model call, source
connection, PR, merge or deployment in this task. Synthetic test storage is
only a seam check and cannot prove immutable S3, native SDK recovery, physical
task revocation or G1. Preserve failed attempts and process/database cleanup.

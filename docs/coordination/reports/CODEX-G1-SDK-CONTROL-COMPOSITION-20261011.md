# G1 SDK trusted control composition source review

11 October 2026 UTC. **Decision: ACCEPT source-only; G1 HOLD.** The reviewed
source is `5190c99b37ec5779d3a7afa0b3858de3feb75423` on
`task/sdk-control-composition-20261011`, based on backend draft PR #3 head
`1eac54274223729d69a0d44456a3f090dc1a0b80`. Shared policy was
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`;
machine map last changed 2026-09-30 00:21:48 UTC.

The new `service/control.mjs` assembles the existing PostgreSQL registry,
versioned S3 object adapter/checkpoint store, four fixed service handlers and
TLS 1.3 mTLS ingress. Socket certificate fingerprints resolve through the
registry's durable grant rows; no caller-selected credential resolver or
in-memory currentness authority is passed into this composition. Constructing
it has no database, S3 or listener effect. Its lifecycle closes sockets,
waits for tracked handler operations, then releases its owned S3 client. An
unsettled handler leaves that client available and returns an explicit closure
failure for owner reconciliation. The commit handler now refuses a visibly
aborted request before database publication, so prepared objects after a
disconnect remain untrusted orphans. An already-dispatched database commit can
still be uncertain and requires the existing authoritative readback.

## Verification

- Pinned Node 24.19.0 final affected service suite: **11/11 PASS**, exit 0.
  The integrated case used two distinct synthetic client certificates, real
  loopback mTLS, a fresh isolated local PostgreSQL database and a fake S3
  `send` client. It observed A authorize/commit, three create-only object
  versions and readbacks, B replacement/load/verify, stale A refusal without
  another write, unknown B before admission, corrupted object refusal without
  response bytes, and shutdown waiting for an unsettled object read.
- The existing handler and S3 adapter cases retained their positive and
  negative checks. The new handler negative showed that an abort during
  preparation causes no database publication call.
- The first combined run passed 9/10 and exposed a synthetic B admission
  timestamp earlier than the dynamically stamped receipt commit. The fixture
  was corrected to admit B after the observed commit. A fresh database rerun
  passed 10/10; after the shutdown/abort cases, another fresh database run
  passed 11/11. No failed result was reinterpreted as passing.
- The owned PostgreSQL cluster at ignored
  `.task-inputs/sdk-control-pg-1/data` was stopped with `pg_ctl`, exit 0.
  Subsequent `pg_ctl status` returned its documented no-server exit 3;
  port 55444 and the exact owned process command line were absent. Synthetic
  test certificates and borrowed locked dependencies remain in ignored local
  test paths. `git diff --check` passed on both source commits.

The native evidence inspector used in the integrated test is deliberately
synthetic; **no production inspector exists**. The S3 client was a fake; the
deployed checkpoint bucket received no object in this work. The composition
does not issue ECS certificates, connect to the selected live Capiro Aurora,
build or admit a control image, run an ECS task, access Capiro data, call a
provider, perform actual SDK interruption/recovery, or close G1. The published
worker image remains under its exact-digest security/license HOLD. No push,
PR change, merge or deployment occurred in this workstream.

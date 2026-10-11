# G1 SDK fixture private mTLS ingress — H2 source review

Status: local source-only review candidate. It is not registered, deployed,
connected to the H3 registry or backed by S3. It does not qualify G1.

## Provenance and work boundary

- Shared policy: `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`.
- Allocated source base: `f118ff55dfb96ba4b44099953e6c9724064b723d`;
  bounded H2 branch allocation commit: `179c5233d1c852430a3f5a3ceb873453fd9f085e`.
- Hermes H2 produced uncommitted ingress source and tests, then exited at its
  turn cap. Codex verified the owned launcher and child were absent, independently
  ran the loopback test suite, reviewed the source and completed the defects and
  evidence in this report. H2 did not assert that its work was complete.
- Scope: only `apps/control/qualification-sdk-fixture/ingress/`, the H2 task
  brief and this report. No shared schema, package export, state service,
  worker, infrastructure, AWS or product SessionStore change.

## Review corrections

The initial 21 loopback tests passed, but source review found four missing
checks. Codex bound the presented context to the operation-specific trusted
`producer` or `context` in addition to the audience; validated a handler
response with a fresh trusted clock reading after the handler; bounded
credential resolution and handler dispatch under one post-body deadline with
cooperative cancellation; and serialized concurrent start/close so a late
listen cannot escape shutdown. The combined body and post-body configured
limits now have a 60-second ceiling. Five added tests cover the mismatch,
clock, stalled and cooperatively aborted resolvers, and lifecycle race.

The ingress does not decide currentness or claim durable publication. The
trusted resolver and handlers must be composed with H3's real registry and
immutable object-store readback before any live use. An AbortSignal indicates
cooperative cancellation, not physical termination of downstream work.

## Verification

- Pinned Node `v24.19.0` at
  `C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.
- Real loopback TLS test suite: 26/26 pass, exit 0. Synthetic server, trusted
  client and rogue client certificates were under ignored
  `.task-inputs/sdk-fixture-ingress-1/certs/`. Absent/untrusted certificates,
  header spoofing, route/envelope/body anomalies, context binding, handler and
  resolver deadlines, response validation, close and inert imports were tested.
- A separate ignored `certs-repro-check/` generation using
  `test/generate-certs.ps1 -OutputDirectory` exited 0. OpenSSL `verify` accepted
  the generated server and trusted client against CA1; it refused the rogue
  client against CA1 as intended. The script contains the reproducible OpenSSL
  commands and refuses to overwrite existing synthetic certificates.
- Affected private fixture contract/wire suites: 27/27 pass, exit 0.
- An intermediate 20/21 run failed only because the resolver test expected
  two keys before the explicit cancellation signal was added; the assertion
  was updated to verify the same fingerprint/operation and aborted signal.
  Subsequent 25/25 and 26/26 runs passed.
- `git diff --check` and clean committed status are required before acceptance;
  commit SHA and physical cleanup are recorded in the final checkpoint.

## Remaining integration

Trusted composition must supply registry-backed credential resolution,
operation handlers and immutable object-store/evidence services. Review the
deployment network boundary, certificate issuance and revocation, and actual
runtime supervision before wiring this private ingress into G1. This source
does not grant permission for cloud writes, build, merge or deployment.

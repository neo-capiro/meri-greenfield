# G1 private fixture request decoder — Codex source review

Decision: **ACCEPT as private source only; HOLD G1.** Base `afd66fa60bbd759687892b153b376c700e8de2ec`, dedicated branch `task/remote-sdk-server-wire-20261011`. Shared policy `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`, current and clean when checked; machine-map mtime 2026-09-30 00:21:48 UTC.

The private `qualification-sdk/wire.mjs` now decodes worker request bytes using the same bounded canonical JSON path as its existing response decoder. It copies a nonempty Buffer of at most 50 MiB, rejects a UTF-8 BOM and invalid UTF-8, applies the canonical `assertFixtureRequest` validator with caller-supplied trusted time, then requires exact canonical byte equality. Every failure maps to `FIXTURE_WIRE_INVALID_REQUEST`. The existing response decoder uses the shared internal parser with its unchanged `FIXTURE_WIRE_INVALID_RESPONSE` failure. No schema, product checkpoint, public 0.1 export or worker request format changed.

The result is parsed DATA, not authentication or admission. A future mTLS ingress must independently bind the presented client credential to the real task, canonical actor/run context and operation audience, enforce a streaming byte limit before a complete Buffer is allocated, and call the durable registry for after-lock database-time currentness. This source does not implement TLS, object storage or an endpoint.

Verification on bundled Node 24.19.0:

- Private fixture wire and contract suites: **27/27 PASS, exit 0**. New cases cover all four canonical request operations and malformed/non-Buffer/oversize/invalid-UTF-8/BOM/truncated/noncanonical/invalid-operation/expired-context refusals. Existing response cases remain green.
- Public package suite: initial run **6/7, exit 1** because the first offline dependency install omitted dev dependency `esbuild`; this was setup, not a source failure. After offline full dependency installation, **7/7 PASS, exit 0**. No network install.
- The private wire imported on Node 24 and exported only `MAX_FIXTURE_WIRE_BYTES`, `encodeFixtureRequest`, `decodeFixtureRequest`, and `decodeFixtureResponse`; `packages/contracts/package.json`, public schema and generated distribution were unchanged. Staged `git diff --check` passed; committed path/status readback follows staging.

No AWS, Docker, provider, native SDK, authenticated peer, S3 upload/readback, TLS runtime, two-task experiment, GitHub push, merge or deployment occurred. The exact draft PR #3 approval request for `afd66fa` does not include this later source commit; separate review and approval are needed before any publication. G1 remains OPEN.

# G1 SDK native evidence read seam

11 October 2026 UTC. **ACCEPT source-only read seam; G1 HOLD.** This work is
based on `3ffe8bb0a6be45fd792e05b5e2f398558c86b8ae`; shared policy is
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`.

The existing checkpoint S3 adapter now reads one of four fixed evidence kinds
under the producer's run namespace, using the immutable VersionId and expected
SHA-256/byte count from a single scoped ObjectReference. It enforces the
producer tenant and policy revision, a 64 KiB ceiling, exact KMS key, checksum
and streamed-byte readback. The adapter exposes no evidence write operation;
existing bundle/sentinel/receipt paths retain their behavior. The task outline
is `docs/coordination/tasks/CODEX-G1-SDK-NATIVE-EVIDENCE-READ-20261011.md`.

The Node 24.19.0 affected adapter suite finished **4/4 PASS**, exit 0. It
checks exact key/version and negative foreign scope, unknown kind, oversize,
missing/wrong version, altered bytes and attempted evidence write. An initial
run finished 3/4 because the test expected an asynchronous rejection for a
synchronous input refusal; the assertion was corrected and the final suite
passed. `git diff --check` passed. No AWS client was constructed in the test.

This is a data read seam, **not** a native inspector. No actual trusted
supervisor currently produces the four evidence object payloads, and no
reviewed payload grammar proves genuine SDK init/interrupt, child/process
exit, stdout/stderr drain, subagent/workspace-writer quiescence or task
containment. `createFixtureControl` still requires its separate mandatory
`evidenceInspector.verify`; this work does not supply one or allow a commit
based on references alone. Production object creation and IAM/provenance must
be bound to a trusted owner before using this read path. Published image
security/license HOLD, actual S3 runtime, two-task recovery and G1 remain
OPEN. No cloud write, native SDK run, provider call, push, merge or deployment
occurred.

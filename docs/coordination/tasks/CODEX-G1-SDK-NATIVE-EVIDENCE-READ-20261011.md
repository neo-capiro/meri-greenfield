# G1 SDK native evidence read seam

Owner: Codex. Base `3ffe8bb0a6be45fd792e05b5e2f398558c86b8ae` on
`task/sdk-native-evidence-seam-20261011`. Shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`.
Source-only scope; no AWS call, native execution, branch publication or gate
admission.

## Implementation outline

The existing S3 fixture object adapter owns the only checkpoint-bucket client,
fixed run prefix, exact version/checksum/KMS readback and lifecycle. Extend it
with a read-only operation for the four canonical evidence kinds. It accepts
the validated producer and one ObjectReference, checks the exact producer
tenant/policy scope, and reads only the corresponding run/kind/object key at
the supplied immutable version under a small byte ceiling. Evidence upload is
not exposed by this adapter. Existing bundle/sentinel/receipt writes and reads
retain their paths and behavior.

The trusted control owner must later define and implement the actual native
evidence producer, payload validation and quiescence proof. This read seam
does not turn worker-supplied references or JSON claims into truth and is not
an `evidenceInspector.verify` implementation. The current mandatory inspector
dependency and security/runtime HOLD remain intact.

Verification: affected adapter tests with positive exact-version read and
negative foreign scope, wrong version, corrupted bytes and forbidden evidence
write. No live S3 or task is exercised.

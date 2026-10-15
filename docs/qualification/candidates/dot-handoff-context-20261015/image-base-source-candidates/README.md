# Immutable Node24 base-argument source candidates

UNBUILT, UNADMITTED, source review only. These are alternative one-value patches against the published Meri source; do not apply both. They change only `NODE` in the assembled-image producer, leaving Dockerfile, package locks and every proof-file byte unchanged.

Both immutable official Docker indexes, their linux/amd64 manifests and configs were verified by SHA-256; each config declares Node24.21.0. Existing `--platform linux/amd64` remains unchanged. The patches use the verified official Docker registry rather than assuming an ECR mirror serves identical digests. Any mirror substitution requires its own exact digest readback.

Neither candidate has been built, scanned, ABI-qualified or admitted. A smaller base is not a zero-vulnerability claim. The sealed-source preparation gate remains unchanged and refuses dispatch. Source review does not authorize a paid build or infrastructure work. Registry metadata pins are in `candidate-source-metadata.json`; no private scan findings, receipts, account IDs or runtime bindings are included.

Patch format deliberately omits following context to avoid copying unrelated account bindings. Validate/apply the chosen patch with `git apply --unidiff-zero`; both exact source checks passed. AST review confirms only NODE changes; no producer code was executed.

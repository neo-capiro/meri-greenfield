# Independent storage source review outline

Exact candidate: `d4561d6dff0596998179a98ff439142040b463dc`, tree `0442165b0a893ac696b6d86d930dfa61453cfab2`. Review writes are confined to this directory.

1. Inspect canonical artifact-service reuse, immutable-record/head transaction boundaries, selector integrity versus current server authorization, and UNKNOWN effects.
2. Independently exercise corrupted ownership projections, retained lineage, stale CAS, current authorization before release, S3 exact version/checksum/account/key/SSE correlation, and resource cleanup.
3. Rerun the producer's focused actual AWS SDK and pg-wire tests under an owned Linux subreaper; no live S3, sockets, database, provider, credentials, or private data.
4. Compare the portable 40-entry lock to installed upstream package metadata and native registry integrities; independently attempt offline npm installation with empty owned cache. Retain all failures.
5. Record an exact source verdict and separate installation/native gates, raw outputs, dependency provenance, and cleanup.

No product source edits, migration execution, cloud activation, model calls, or production acceptance claims are authorized by this review. Each captured command is bounded to 180 seconds.

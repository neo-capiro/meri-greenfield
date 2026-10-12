# Client registry source candidate

Author freeze: `56a917f59e849630f50933e31703a2c7c262be1d`.
Base: `e0163fb65a639a28d9423e929058b40b48cc556d`, after PR22.
Independent review and canonical operation registration are still pending.

The new private family defines the selected `lookup_client_registry` read:
trim and truncate the requested name to 300 UTF-16 code units, preserve the
tenant-client versus public LDA exact/candidate projections, and reject
unsupported fields, missing nullable fields, duplicate candidates and an exact
match repeated among candidates. At most five candidates are returned. Storage
integers remain signed 32-bit values; the contract does not invent positive-ID,
count, state-vocabulary, URL-validity or filing-year guarantees absent from the
frozen declarations. Description is at most 200 UTF-16 code units.

The canonical private loader owns schema compilation. The small registry
factory owns only name normalization and candidate identity relations. No
handler, adapter, network, source or authorization is created. The canonical
resolver owns full inert JSON admission once registered; direct flat-input
normalization additionally refuses getters, proxies and hidden/inherited fields.
Public 0.1 exports, original schemas and the catalog are unchanged at this freeze.

The immutable producer projection, local LdaPick type, storage scalars and
four outcome tests establish the boundary even without a named result DTO.
The first discovery pass's missing-DTO blocker was too strict and is corrected.
Reference paths, exact blobs and byte hashes are recorded in
`capability-next-20261012/integration/registry-reference-metadata.json`.
All three inspected files are unchanged between Capiro `fd8765ec` and observed
`4be13b0b`. No private source bodies or queries were copied into Meri.

Compatibility guidance remains untrusted reported text. Legacy guidance can
mention creating a client; this read grants no creation or update authority and
`create_client` remains deferred. Tenant membership alone does not establish
client visibility. The eventual gateway/adapter must authorize each tenant
client read and public registry source separately, preserve upstream failures,
and bind results to trusted request context. Nulls and empty candidates prove
neither authoritative absence nor freshness, completeness, source health or
snapshot stability. No such producer provenance envelope exists in this frozen
wire projection; schema validation must not manufacture one.

Verification: focused checks **8/8 passed**. An earlier expected baseline run
failed because the new validator exports did not yet exist; its raw stdout,
stderr and receipt remain beside the successful run. Both owned process groups
are absent. Initial read-only discovery also contained one command against the
wrong Git repository and one nonexistent guessed registry path; each returned a
missing-path error and supplied no evidence. Subsequent reads used the actual
pinned service/projection path. No native, database, SDK, provider or live source
check ran. G1 remains OPEN; source qualification remains pending.

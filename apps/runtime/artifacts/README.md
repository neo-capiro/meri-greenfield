# Per-request artifact runtime mount

`index.mjs` exports executable composition for the existing document application. Root control dispatch mounts `createRuntimeArtifactApplication({sessions,optionsOwner,now,limits}).handle(request)` at canonical `/api/documents/{create,revise,inspect,download}` POST routes. Without the configured owner it returns503 UNAVAILABLE. This module does not issue sessions, create grants, activate catalog entries, run migrations or open connections during construction.

The trusted in-process `optionsOwner.resolve({credential,intent,body,requestSha256,signal,deadlineMs})` returns `{documentOptions,recheck}` or null when unavailable. The controller captures inert own methods, snapshots body/resource data, freezes the caller deadline, requires the exact configured session owner/clock, and delegates full typed request/format/baseVersionId validation to `createDocumentApplication`. `recheck({phase,intent,requestSha256,resource,signal,deadlineMs})` must invoke actual canonical current allocation, session, output/source and runtime owners before and after effects and before release. Primitive callback results cannot authorize qualification. The request digest correlates the parsed HTTP body and route; it is not source proof or an authorization grant. Current binding/scopes/client/expiry remain enforced by the unchanged canonical session/application/authority owners. DOCX/TXT and create_excel/XLSX replacements retain their existing semantics.

`createRuntimeArtifactStorage({s3:{client,bucket,prefix,expectedBucketOwner,kmsKeyId},versionsPool,now,maxRequestMs?,maxBytes?})` reuses reviewed real S3 and PostgreSQL ports over borrowed clients/pools. `createFixedRuntimeArtifactExecutor(configuration)` reuses the existing fixed generation/structural-inspection owner. Configured executable paths are trusted server configuration; none is admitted from request/model data. Current actual source/renderer sandbox admission is still required from the owner; source fixtures or path strings do not establish it.

`createRuntimeDocumentOptionsComposer({storage,executor,budgetPool,sessions,now,namespace?})` returns a composer accepting `{artifactOptions,selectedClientId,credential,limits,enabled?}` from actual canonical current owners. It preserves context, allocation, authority, sourceEnabled and enabled, and substitutes only the configured real storage/executor/accounting pool. Optional namespace must be exactly `product`; it requires the root-owned canonical option-chain/schema patch. Absence preserves pinned-source characterization behavior. The composer is usable by existing selected-output `approvedOutput.read` independently of this browser mount. Original compiler identity, separate approved output projection and sourceAccess checks remain in the existing selected-output bridge; read-only originals gain no write operation from this module.

Root owns shared control/config/Docker wiring, approved fixed Python/library/image paths and canonical product budget mapping. The pinned base still uses protected qualification budget SQL; tests script SQL in memory and never call that native database. Root separately allocated product mapping and reports implemented native backend identity/context plus native-pair checks. Exact current backend pins and artifact/output/source/renderer field mapping, task admission and host qualification remain native gates; this source lane does not declare the backend globally absent or invent an artifact endpoint.

Six meaningful tests pass through actual loopback HTTP, existing opaque sessions/accounting, original congressional compiler, actual DOCX/XLSX generator/structural inspection and real S3/PG adapter code with explicitly synthetic current/SQL/S3 replies. They cover exact immutable parent/replacement, reconstructed inspect/download, compiler substitution, caller context/session substitution, boolean rejection, missing owner, post-generation revoke before publication and parked resolution deadlines. The first import failure is retained. The initial two DOCX were saved before offline rendering, though API inspect preceded their retention; the final test retains both downloads before API/offline inspection and keeps both bundles. Each original/revision is4 pages. Producer opened all pages; independent artifact review remains separately required. Generation/inspection stay draft/pending/nativeQualified=false.

No native AWS/DB/model call, security setting change, new credential, private artifact transfer or publication retry occurred. Owned links/processes are removed after checks; donor dependencies and all previous files/failures are retained.

## Short-lived revocable download links (additive, not mounted)

`createDownloadLinkApplication({documents,sessions,key,generation,now,ttlMs?,maxRequestMs})` wraps the runtime artifact application:
`POST /api/documents/links/issue {versionId}` and `POST /api/documents/links/redeem {token}` are served here and every other path,
including the existing `/api/documents/download`, is delegated unchanged. Both routes require the caller's Bearer session.
The token (`../../artifacts/storage/signed-download.mjs`) is an HMAC-SHA256 over `{versionId, sha256, scopeDigest, actorId,
expiresAtMs, suppressionGeneration}`, at most five minutes and never beyond the session's current expiry. Issuance runs the canonical
inspect and reads current authority; redemption verifies the MAC and expiry, requires the same current actor and scope digest
(`canonicalSha256` of tenant, conversation, selected client and scopes), re-inspects, requires an unchanged suppression generation,
runs the canonical download, requires the exact bytes hash and rechecks generation and expiry before release. Refusals:
`DOWNLOAD_LINK_INVALID`, `DOWNLOAD_LINK_EXPIRED`, `DOWNLOAD_LINK_ACTOR`, `DOWNLOAD_LINK_REVOKED`, `DOWNLOAD_LINK_BYTES`, plus the
retention gate's own codes; canonical refusals pass through unchanged.

`createSuppressionGeneration({journal,serving})` reads the same retention journal rows and recovery barrier as the canonical read
gate and returns the highest projected ledger sequence of the version's subjects (session conversation, version conversation,
artifact). Any suppression or release of one of them advances it, so links are revoked without a token store.
`readDownloadLinkKey(keyFile)` reads a key of at least 32 bytes through `readSecret`.

Intended mount (a separate root change to `../product-applications.mjs`, `../config.mjs` and `../control.mjs`): when the control
configuration declares retention serving and a link key file, read the key at startup and replace `documents` with
`createDownloadLinkApplication({documents,sessions,key,generation:createSuppressionGeneration(retention),now,maxRequestMs})`.
Redemption reads the version twice (inspect, then download). Tests: `test/download-links.test.mjs` (scripted ports plus one case
through the real canonical owners and generator) and `../../artifacts/storage/test/signed-download.test.mjs`.

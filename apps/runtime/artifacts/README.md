# Per-request artifact runtime mount

`index.mjs` exports executable composition for the existing document application. Root control dispatch mounts `createRuntimeArtifactApplication({sessions,optionsOwner,now,limits}).handle(request)` at canonical `/api/documents/{create,revise,inspect,download}` POST routes. Without the configured owner it returns503 UNAVAILABLE. This module does not issue sessions, create grants, activate catalog entries, run migrations or open connections during construction.

The trusted in-process `optionsOwner.resolve({credential,intent,body,requestSha256,signal,deadlineMs})` returns `{documentOptions,recheck}` or null when unavailable. The controller captures inert own methods, snapshots body/resource data, freezes the caller deadline, requires the exact configured session owner/clock, and delegates full typed request/format/baseVersionId validation to `createDocumentApplication`. `recheck({phase,intent,requestSha256,resource,signal,deadlineMs})` must invoke actual canonical current allocation, session, output/source and runtime owners before and after effects and before release. Primitive callback results cannot authorize qualification. The request digest correlates the parsed HTTP body and route; it is not source proof or an authorization grant. Current binding/scopes/client/expiry remain enforced by the unchanged canonical session/application/authority owners. DOCX/TXT and create_excel/XLSX replacements retain their existing semantics.

`createRuntimeArtifactStorage({s3:{client,bucket,prefix,expectedBucketOwner,kmsKeyId},versionsPool,now,maxRequestMs?,maxBytes?})` reuses reviewed real S3 and PostgreSQL ports over borrowed clients/pools. `createFixedRuntimeArtifactExecutor(configuration)` reuses the existing fixed generation/structural-inspection owner. Configured executable paths are trusted server configuration; none is admitted from request/model data. PDF conversion binds only through `renderer`, a qualified-renderer port from `../../artifacts/renderer.mjs` (`createLibreOfficeRendererPort({admission,executable,tempRoot})`): it is `available` only for a complete renderer admission record (renderer id/version, exact executable, image digest, qualification id) attesting every `RENDERER_SANDBOX_REQUIREMENTS` entry (non-root user, no network, read-only root filesystem, no new privileges, no capabilities, private per-call workspace, bounded resources, no credentials). A raw `officeTransformer` is refused; an absent or unavailable port keeps PDF fail-closed (`ARTIFACT_RENDERER_UNAVAILABLE`). The admission record must come from the renderer qualification owner; source fixtures, callbacks or path strings do not establish it.

`createRuntimeDocumentOptionsComposer({storage,executor,budgetPool,sessions,now,namespace?,renderer?,pdfAdmission?,previews?,maxPreviewBytes?})` returns a composer. `admitPdf` is added for a `create_word` descriptor only when the explicit `pdfAdmission` switch is `true` and `renderer` (the same port bound into `executor`) is available; the switch alone never admits PDF and stays off until renderer qualification. `previews` (a preview record store with `read`/`commit`) composes preview publication and serving with that renderer; the mount rechecks every preview record read and commit like the other artifact ports. The composer accepting `{artifactOptions,selectedClientId,credential,limits,enabled?}` from actual canonical current owners. It preserves context, allocation, authority, sourceEnabled and enabled, and substitutes only the configured real storage/executor/accounting pool. Optional namespace must be exactly `product`; it requires the root-owned canonical option-chain/schema patch. Absence preserves pinned-source characterization behavior. The composer is usable by existing selected-output `approvedOutput.read` independently of this browser mount. Original compiler identity, separate approved output projection and sourceAccess checks remain in the existing selected-output bridge; read-only originals gain no write operation from this module.

Root owns shared control/config/Docker wiring, approved fixed Python/library/image paths and canonical product budget mapping. The pinned base still uses protected qualification budget SQL; tests script SQL in memory and never call that native database. Root separately allocated product mapping and reports implemented native backend identity/context plus native-pair checks. Exact current backend pins and artifact/output/source/renderer field mapping, task admission and host qualification remain native gates; this source lane does not declare the backend globally absent or invent an artifact endpoint.

Six meaningful tests pass through actual loopback HTTP, existing opaque sessions/accounting, original congressional compiler, actual DOCX/XLSX generator/structural inspection and real S3/PG adapter code with explicitly synthetic current/SQL/S3 replies. They cover exact immutable parent/replacement, reconstructed inspect/download, compiler substitution, caller context/session substitution, boolean rejection, missing owner, post-generation revoke before publication and parked resolution deadlines. The first import failure is retained. The initial two DOCX were saved before offline rendering, though API inspect preceded their retention; the final test retains both downloads before API/offline inspection and keeps both bundles. Each original/revision is4 pages. Producer opened all pages; independent artifact review remains separately required. Generation/inspection stay draft/pending/nativeQualified=false.

No native AWS/DB/model call, security setting change, new credential, private artifact transfer or publication retry occurred. Owned links/processes are removed after checks; donor dependencies and all previous files/failures are retained.

## Short-lived revocable download links (mounted behind a readiness gate)

Product owner decision, 15 October 2026: wire signed download links into the live API once the API verifies the current user's access
to that exact artifact before issuing, the bucket stays private and links never reach logs. This section is that wiring.

**Routes.** `POST /api/documents/links/issue {versionId}` returns `{versionId, token, expiresAtMs}`; `POST /api/documents/links/redeem
{token}` returns the canonical attachment. Both require the caller's Bearer action session and `application/json`; every other path,
including `/api/documents/download`, reaches the canonical document application unchanged. A token is accepted only in the redeem
body: a query string is refused, and a token placed in the path is not a route (it is never parsed). Every link-route response,
including canonical refusals passed through and gate refusals, carries `Cache-Control: no-store`, `Referrer-Policy: no-referrer` and
`X-Content-Type-Options: nosniff`. Refusal bodies are `{error:{code}}` with closed codes only.

**Authorization.** Issuance and redemption run one authorized read under the caller's own session (`download-links.mjs`): canonical
inspect (version-scoped `artifact.inspect` authorization, scope/conversation binding, retention gate, current bytes), the suppression
generation, then the canonical download (version-scoped `artifact.download` authorization for that exact `versionId`, retention gate,
exact bytes), the bytes hash against the version record and the generation again, then a fresh current-authority read (same actor,
same scope digest, unexpired session) and a final generation read. Issuance signs only after all of that passes, so a link is never
issued for a version the caller could not download now. Redemption authenticates before parsing the token, verifies the MAC and
expiry, requires the signed actor, scope digest, sha256 and generation, runs the same read, then rechecks link expiry with no further
await before releasing bytes.

**Linearization point.** Each issue or redeem takes effect at its final authority read. The final generation read follows it and must
return the generation read before the bytes were fetched, with the recovery barrier open and every subject RELEASED or absent; since
the generation is a strictly increasing retention ledger sequence, equality proves no suppression or release committed in between.
Nothing is awaited after the final generation read; the actor, scope, session-expiry, link-expiry and request-lifetime checks and the
release or signature are synchronous. A suppression, release or barrier closure committed before the final generation read (including
during the final authority read), or an authority change committed before the final authority read, refuses with nothing released or
signed. One committed later is ordered after the read, as if it had committed just after a completed download. That matches the
retention owner: suppression revokes access from its commit onwards and records issued access it cannot recall, and purge requires the
subject to remain suppressed for the policy's positive cooling period, so released bytes were servable to this caller at the
linearization point. A previously signed link is still revoked by a later suppression, because its redemption is a new read. The token (`../../artifacts/storage/signed-download.mjs`) is an HMAC-SHA256
over `{versionId, sha256, scopeDigest, actorId, expiresAtMs, suppressionGeneration}`. Lifetime: `ttlMs` (default 60 s, at most 5 min),
never beyond the session's current expiry. A token is useless without the same actor's current session. No token is stored anywhere.

Refusals: `DOWNLOAD_LINK_INVALID`, `DOWNLOAD_LINK_EXPIRED`, `DOWNLOAD_LINK_ACTOR`, `DOWNLOAD_LINK_REVOKED`, `DOWNLOAD_LINK_BYTES`,
`DOWNLOAD_LINK_CLAIMS`, `SESSION_REFUSED`, `UNAUTHENTICATED`, `UNSUPPORTED_MEDIA_TYPE`, plus the retention gate's own codes; canonical
refusals pass through unchanged.

**Preview links.** `issue {versionId, target:'preview'}` signs the digest of the published preview PDF instead of the version bytes and adds
the claim `target:'preview'`; redemption reads through the canonical `/api/documents/preview` route and requires that digest. Download
links (no `target`) are byte-identical to the original token format. Both run the same authorized read and linearization.

**Revocation.** `createSuppressionGeneration({journal,serving})` reads the canonical retention journal rows and recovery barrier and
returns the highest projected ledger sequence of the version's subjects (session conversation, version conversation, artifact). Any
suppression or release of one of them advances it, so outstanding links are revoked without a token store.

**Mount and readiness gate (`download-gate.mjs`).** `createRuntimeProductApplications` wraps the canonical document application in
`createDownloadLinkGate`. Until trusted startup opens it, the two link routes answer `503 {error:{code:'DOWNLOADS_UNAVAILABLE'}}` and
nothing else changes. `startControl` calls `open` after assembly and before readiness/listen. The gate opens only when, in order:
`downloadLinks.enabled === true`; retention serving is declared (the suppression generation needs its journal); the
`artifactOptionsOwner` product port is composed (it authorizes each exact version per request); the `artifactStore` product port is
composed and `verifyPrivate()` passes (`createRuntimeArtifactStorage().verifyPrivate`, read-only proof that every S3 Block Public Access
setting is on, the bucket policy is not public, object ownership is `BucketOwnerEnforced` and versioning is Enabled); and the key file
reads through `readSecret` with at least 32 bytes. The key is read last. Any failure leaves the routes closed with a closed reason
(`DOWNLOAD_LINKS_DISABLED`, `DOWNLOAD_LINK_RETENTION_UNAVAILABLE`, `DOWNLOAD_LINK_AUTHORIZATION_UNAVAILABLE`,
`DOWNLOAD_LINK_STORE_UNAVAILABLE`, `DOWNLOAD_LINK_STORE_UNVERIFIED`, `DOWNLOAD_LINK_KEY_UNAVAILABLE`) that `startControl` returns as
`downloads` and the CLI prints in its `runtime.listening` line; control still starts and serves every other route. Only an aborted
startup rejects. The nativeCandidate path composes no `artifactOptionsOwner`/`artifactStore`, so its gate stays closed.

**Signing key (for the shipping owner; no value here).** Secret: the control role's download-link signing key, mounted as an owner-only
file (for example `/run/secrets/meri-download-link-key`, the path named by `downloadLinks.keyFile`), 32–32768 random bytes (generate at
least 32 bytes from a CSPRNG), readable only by the control UID, never baked into the image, never logged. It is a new secret value for
the control role only; workers and runners never receive it. Rotation: replace the file and restart control. Every outstanding link
is then refused as `DOWNLOAD_LINK_INVALID`; because links live at most five minutes and the caller simply issues a new one, rotation
needs no dual-key window. Rotate on any suspected exposure and on the shipping owner's routine schedule. Creating, storing or mounting
the secret, and granting the control task role `s3:GetBucketPublicAccessBlock`, `s3:GetBucketPolicyStatus`,
`s3:GetBucketOwnershipControls` and `s3:GetBucketVersioning` on the artifact bucket, are separately authorized shipping-owner actions;
without them the gate stays closed.

**Logging.** Links never appear in URLs, so they cannot reach request-line access logs or a Referer. The runtime HTTP adapter writes no
access log. Control telemetry records `url.path` through `redactPath` (token-shaped, long or percent-encoded segments become
`{redacted}`) and drops `token`/`credential`/`secret`/`signature`/... attribute keys; bodies, headers and query strings are never
read. Refusal bodies and errors carry closed codes only. Load balancer access logs record the request line only; deployment must keep
that true (no body logging).

Tests: `test/download-links.test.mjs` (scripted ports plus one case through the real canonical owners and generator: happy path,
wrong actor, revoked and suppressed versions, expiry, tampering, changed bytes, download-authority refusal at issue, revocation, scope
change, session expiry and suppression during the final reads, suppression, release or barrier closure during the final authority
read, the documented linearization order, token placement, lifetime bounds), `test/download-links-redaction.test.mjs`
(real loopback listener plus telemetry: no link in process output, spans, metrics or refusal bodies), `../test/download-links-mount.test.mjs`
(startup gate through `startControl`), `../../artifacts/storage/test/signed-download.test.mjs` and
`../../artifacts/storage/test/s3-private-bucket.test.mjs`.

## Core artifact current authority (D31)

Contract: `docs/integration/ARTIFACT-CURRENT-AUTHORITY-CONTRACT.md`; golden vectors: `docs/integration/artifact-current-authority.vector.json`.
`core-authority-wire.mjs` (closed request/receipt shapes, intent operations), `core-authority-client.mjs` (fixed route
`POST /api/clio/application-authority/artifact`, native bearer + `x-internal-service-secret`, correlated `observationId`, Meri-clock
lifetime), `authority-credentials.mjs` (service secret re-read per call; marked candidate credentials and the service secret are never
admitted as a bearer), `core-authority.mjs` (the in-process `authority.resolve` that `../product-ports/documents.mjs` composes: one
observation per resolve/recheck, pinned facts, Core-gated `authorize`) and `authority-composition.mjs` (`composeDocumentsFamily`, used
by startup; composed disabled unless `artifacts.enabled`, `artifacts.authority`, `nativeCandidate`, a readable service secret and the
Meri-local `runOptions`/`executor` owners all exist, otherwise the store-only family with `missing` by key). Core's receipt is a fact,
never the options object: allocation, producer context, descriptor, evidence, assets, run capability and `authority.check` stay with
the Meri-local `runOptions` owner (dot, PR #121 6246642210). Tests: `test/core-authority.test.mjs`.

# Document application source outline

The Fetch boundary admits fixed typed create_word docx/txt requests. It does not interpret prose, create authority, generate approvals, or implement rendering. Existing session issuance remains independently mounted. HTTP bearer credentials are opaque sessions; the configured artifact capability never comes from the body.

`createDocumentApplication({sessions,selectedClientId,artifactOptions,credential,now,limits,enabled=false})` returns `{handle}`. Limits are maxRequestMs/maxRequestBytes/maxResponseBytes. The original canonical artifact context is snapshotted once; its deadline, evidence, assets, scopes and binding are never rewritten to produce a different delivery hash.

Modules: http.mjs owns native Request admission and content-free responses; current.mjs composes createRequestCurrent and captures trusted configuration; index.mjs dispatches to actual artifact owners and validates release. Canonical artifact validators and format helpers own shapes/filenames. PostgresArtifactService owns all write accounting and replay; ArtifactService owns read verification without budget reservation. Every authority boundary and final release rechecks current sessions and exact configured binding/scopes/client. Session and authority expiries synchronously narrow one outer lifetime before another port can run.

Routes: POST /api/documents/create {deliveryId,request}; revise {deliveryId,baseVersionId,request}; inspect/download {versionId}. JSON results are existing artifact results. Download returns exact verified bytes with attachment MIME/filename. Errors contain only a finite code and disposition; write calls with uncertain completion remain UNKNOWN, and acknowledged output denied at release remains RESULT_NOT_RELEASED. There is no automatic retry, reconciliation mutation, resource disposal, or production catalog activation.

Tests use actual canonical artifact services and budget ledger with explicitly scripted ports. Root separately owns actual local docx generation/HTTP flow. Test bounds are 180 seconds. No native database, provider, network service, or customer data is used by this author lane.

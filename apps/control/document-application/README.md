# Typed document application

`createDocumentApplication` in `index.mjs` is an inert Fetch boundary. It returns `{handle(Request)}` and owns no pool, session registry, listener, executor, storage or shutdown operation. The caller retains those resources. `enabled` defaults to `false`; this does not alter the canonical catalog's null handlers or runtime qualification.

```js
const app = createDocumentApplication({
  sessions: {authenticateSession, readCurrentState},
  selectedClientId, artifactOptions, credential, now,
  limits: {maxRequestMs: 15000, maxRequestBytes: 131072, maxResponseBytes: 1048576},
  enabled: true,
});
```

`artifactOptions` is the existing `createPostgresArtifactService` configuration, with the canonical `artifactValidators` object, the **same** `now` function, and the exact `create_word` catalog descriptor projection `{operation,requiredGrants,sourceRequirements}`. Its prebound context, producer identity, immutable allocation and original expiry remain unchanged between deliveries. The caller performs canonical grant binding separately. The configured `credential` is the trusted artifact capability; it is never obtained from the HTTP request. The HTTP Bearer is a separately issued opaque action session. Existing `/api/action-followthrough/session` issuance can be mounted alongside this app on the same trusted host, as shown by the root-owned `local/mount.mjs`. No browser-provided identity, grant, scope, asset or evidence is admitted.

All four routes are POST with JSON and `Authorization: Bearer <opaque session>`:

| Route | Exact body | Success |
| --- | --- | --- |
| `/api/documents/create` | `{deliveryId,request}` | `{version,inspection,execution}` |
| `/api/documents/revise` | `{deliveryId,baseVersionId,request}` | `{version,inspection,execution}` |
| `/api/documents/inspect` | `{versionId}` | `{version,inspection}` |
| `/api/documents/download` | `{versionId}` | Exact verified bytes with attachment filename and MIME |

`request` is the canonical typed `WordRequest` with `operation:'create_word'` and `format:'docx'` or `'txt'`. For DOCX, text uses blocks such as `{kind:'paragraph',runs:[{text:'Draft text'}]}`. TXT uses `{content:{text:'Draft text'}}`. Titles, tables, runs and supported chart/image references follow existing artifact contracts. PDF is intentionally not admitted by this application. No natural-language model loop, approval choice or new renderer is introduced. Revision is a new full typed replacement based on the exact immutable prior version; it is not an in-place patch. Existing service verification preserves the original bytes and parent relationship.

A session fresh check precedes execution, every configured artifact/capability authorization boundary, and release. Current full binding, ordered scopes and selected client must equal the configured context. All session/authority cutoffs shorten one request lifetime; the original artifact context is not rewritten, so repeat delivery identity is stable. Older versions are read under current authority without changing their original version provenance. Reads use the existing artifact service and cannot call the canonical budget reservation/settlement path.

Responses have `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`; no CORS permission is added. Downloads retain the canonical ASCII filename and MIME, and verify length/hash again before release. Borrowed port rejections are converted to inert content-free errors before passing into canonical owners; Proxy and accessor properties are not evaluated. Errors contain only `{error:{code,outcome}}`, never provider messages, credentials or draft content. Malformed route/body/media is refused before effects; session denial is 403, disabled application 503, timeout 408, cancellation 499, and other owner failures 502. Shared body size failures retain 413. A started write with uncertain completion is `UNKNOWN`; a returned result rejected at release is `RESULT_NOT_RELEASED`; unsuccessful reads are `READ_UNAVAILABLE`. These are conservative dispositions, not rollback or physical-cancellation proofs.

The same delivery is not regenerated. This boundary performs no automatic retry, refund, recovery mutation or fresh delivery allocation. Canonical historical reconciliation remains the artifact PostgreSQL owner's responsibility. Local structural inspection and actual DOCX bytes do not establish native Office rendering, visual quality, production identity, physical sandbox isolation or real database qualification.

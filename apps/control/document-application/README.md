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

`artifactOptions` is the existing `createPostgresArtifactService` configuration, with the canonical `artifactValidators` object, the **same** `now` function, and the exact `create_word` or `create_excel` catalog descriptor projection `{operation,requiredGrants,sourceRequirements}`. Its prebound context, producer identity, immutable allocation and original expiry remain unchanged between deliveries. The caller performs canonical grant binding separately. The configured `credential` is the trusted artifact capability; it is never obtained from the HTTP request. The HTTP Bearer is a separately issued opaque action session. Existing `/api/action-followthrough/session` issuance can be mounted alongside this app on the same trusted host, as shown by the root-owned `local/mount.mjs`. No browser-provided identity, grant, scope, asset or evidence is admitted.

All four routes are POST with JSON and `Authorization: Bearer <opaque session>`:

| Route | Exact body | Success |
| --- | --- | --- |
| `/api/documents/create` | `{deliveryId,request}` | `{version,inspection,execution}` |
| `/api/documents/revise` | `{deliveryId,baseVersionId,request}` | `{version,inspection,execution}` |
| `/api/documents/inspect` | `{versionId}` | `{version,inspection}` |
| `/api/documents/download` | `{versionId}` | Exact verified bytes with attachment filename and MIME |

Trusted configuration binds exactly one of those operations; request bodies cannot select another authority. `request` for `create_word` is the canonical typed `WordRequest` with `operation:'create_word'` and `format:'docx'` or `'txt'`. For DOCX, text uses blocks such as `{kind:'paragraph',runs:[{text:'Draft text'}]}`. TXT uses `{content:{text:'Draft text'}}`. Titles, tables, runs and supported chart/image references follow existing artifact contracts. With the exact `create_excel` descriptor, `request` is the canonical typed `ExcelRequest`: `{operation:'create_excel',format:'xlsx',title,content:{sheets:[{name,rows}]}}`. Cells distinguish literal `{value}` from `{formula}`; sheets, typed values, styles and charts follow the existing `Workbook` schema and validators. The application reuses the existing XlsxWriter creation and openpyxl typed-cell revision owners. A Word-bound app refuses Excel requests/results and an Excel-bound app refuses Word requests/results, including inspect/download. PDF, PowerPoint and general analysis are not admitted by this application. No natural-language model loop, approval choice or new renderer is introduced. Revision is a new full typed replacement based on the exact immutable prior version; it is not an in-place patch. Existing service verification preserves the original bytes and parent relationship.

A session fresh check precedes execution, every configured artifact/capability authorization boundary, and release. Current full binding, ordered scopes and selected client must equal the configured context. All session/authority cutoffs shorten one request lifetime; the original artifact context is not rewritten, so repeat delivery identity is stable. Older versions are read under current authority without changing their original version provenance. Reads use the existing artifact service and cannot call the canonical budget reservation/settlement path.

Responses have `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`; no CORS permission is added. Downloads retain the canonical ASCII filename and MIME, and verify length/hash again before release. Borrowed port rejections are converted to inert content-free errors before passing into canonical owners; Proxy and accessor properties are not evaluated. Errors contain only `{error:{code,outcome}}`, never provider messages, credentials or draft content. Malformed route/body/media is refused before effects; session denial is 403, disabled application 503, timeout 408, cancellation 499, and other owner failures 502. Shared body size failures retain 413. A started write with uncertain completion is `UNKNOWN`; a returned result rejected at release is `RESULT_NOT_RELEASED`; unsuccessful reads are `READ_UNAVAILABLE`. These are conservative dispositions, not rollback or physical-cancellation proofs.

The same delivery is not regenerated. This boundary performs no automatic retry, refund, recovery mutation or fresh delivery allocation. Canonical historical reconciliation remains the artifact PostgreSQL owner's responsibility. Local structural inspection and actual DOCX/XLSX bytes do not establish native Office rendering, visual quality, production identity, physical sandbox isolation or real database qualification.

Workbook formulas are editable but generated formula caches remain unverified. Native-opened/rendered/recalculated flags come from the existing canonical inspection; this HTTP layer does not upgrade them. Root-owned local verification may render separate copies; it does not overwrite either retained version or assert production renderer qualification. The fixture operation option defaults to create_word, preserving the existing Word flow.

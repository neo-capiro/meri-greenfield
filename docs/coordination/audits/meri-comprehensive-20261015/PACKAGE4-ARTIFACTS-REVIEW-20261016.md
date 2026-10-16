# Package four: retention, documents and browser source review

16 October 2026. Independent read-only review of `fable/repair-package-4-20261016` at **eca78d458acb46cbfd54a94cf870841d999ef6b1**. Prior audit: `f8d1816eda48347eeca4c0c25308870f2885c1f5`. Live base `48a27c8d0e09f8eb6501e13f0d137458460e163e` is an ancestor, 28 commits ahead and zero behind; comparison lists 184 changed files.

## Verdict

**HOLD the reviewed package-four source scope and candidate-h acceptance.** The new startup owner can lose an acknowledged suppression after a restore followed by a write. Browser approval can allow an interaction after an overlapping navigation changes the page origin. Filing now performs an external registration before the canonical command journal claims execution. Preview publication is not once-only under concurrency and can leave untracked objects.

The conservative inactive defaults are useful and remain intact. These findings are source/activation blockers, not claims of an active deployed disclosure: browser activation is held; product renderer/preview/filing owners are not fully wired; runtime control currently omits the retention suppression owner. The prior accepted DA-1/DA-4 low-level retention safety repairs and PDF page-tree correction are not revoked by this review.

No candidate pin, implementation source, remote branch, migration, cloud resource or deployment was changed.

## R4-RET-1 — P1: a write can hide a restored-away suppression

**Independently reproduced using exact source, the shipped in-memory journal/watermark/ledger adapters, and a synthetic trusted ownership port.**

1. Start at recovered watermark 0 and save the journal plus watermark.
2. Suppress subject A. The authoritative ledger contains sequence 1 and A is refused.
3. Restore journal and watermark to the saved empty state.
4. Before any served read verifies the stale watermark, suppress unrelated subject B.
5. B's ordinary projection advances the restored watermark to 2, and the process high-water mark becomes 2.
6. A's read now succeeds, although its acknowledged suppression remains in the authoritative ledger.

Observed result: `lostSuppressionServable:true`, ledger entries 2, watermark `{sequence:2,entrySha256:null}`, fence enabled, highWater 2.

Cause:
- Only the served read wrapper verifies the persisted watermark: [apps/control/retention/startup.mjs L24-L34](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/retention/startup.mjs#L24-L34).
- The suppression owner checks the in-memory barrier, then appends/projects without that restore check: [apps/control/retention/suppression.mjs L36-L55](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/retention/suppression.mjs#L36-L55).
- Every successful projection blindly advances the watermark and teaches the process the newer sequence: [apps/control/retention/recovery-watermark.mjs L19-L26](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/retention/recovery-watermark.mjs#L19-L26).
- The fence only compares persisted sequence with highWater: [apps/control/retention/serving-fence.mjs L12-L24](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/retention/serving-fence.mjs#L12-L24).

A newer unrelated projection does not prove that all earlier suppression projections survived. The report's optional “atomic watermark advance” is therefore insufficient if implemented merely as the same GREATEST advance inside the write transaction.

Required repair: make normal writes refuse/reconcile a stale recovery generation before they can advance it, and make that guard atomic with the projection/recovery coordination. A write must not certify completeness of unrelated earlier projections. Cover restore→write→read, release as the first post-restore operation, and restores/concurrent changes during guard/read sequences. Preserve the durable ledger and UNKNOWN fences.

The committed startup-restore tests pass, but their restore case performs a read first, which closes the fence before attempting another suppression. That misses this ordering.

## R4-BRW-1 — P1: overlapping navigation invalidates neither the first approval subject nor a pending approval

**Independently reproduced twice with exact page tracker and permission gate, canonical ApprovalDecision validation, and synthetic approval receipts. No browser, SDK query or model process was started.**

Case A:
- Observe `https://records.example`.
- Begin a click.
- Begin a navigation to another permitted origin, `https://notices.example`.
- The first click retains origin `https://records.example`; its permission decision is `allow`.

Case B:
- Begin the click and leave its approval promise pending.
- Start and finish navigation to `https://notices.example`.
- Resolve the valid receipt for the earlier origin.
- The pending click still returns `allow`.

Cause:
- `begin` assigns null only to the newly overlapping call; it does not invalidate earlier calls: [apps/worker/conversation/browser/page-context.mjs L19-L32](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/browser/page-context.mjs#L19-L32).
- The permission gate reads the page once, awaits approval, and then allows without validating a current page generation/origin again: [apps/worker/conversation/browser/permissions.mjs L70-L84](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/browser/permissions.mjs#L70-L84).
- Its PreToolUse hook also ignores a false return from `pages.begin`: [apps/worker/conversation/browser/permissions.mjs L60-L66](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/worker/conversation/browser/permissions.mjs#L60-L66).

The existing overlap regression tests the second interaction, whose captured origin is already null. It does not test the first interaction or a navigation during its approval wait.

Required repair: invalidate every affected pending interaction when page state becomes ambiguous, preserve an unforgeable page-state generation through approval, and recheck immediately before returning allow. Serialize or fence competing browser calls where necessary. Cover both orderings above, cancellation/restoration, duplicate tool-use IDs, and multiple tabs. This is separate from the documented limitation around unsolicited script navigation.

The live activation gate must stay held. A same-tenant, correctly hashed, durably consumed decision cannot authorize an interaction on a different page than the approved subject.

## R4-DOC-1 — P1: filing registration runs before durable command exclusion

Static integration finding independently checked against the canonical executor.

The new resolver is effectful: [apps/artifacts/filing.mjs L34-L50](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/artifacts/filing.mjs#L34-L50) calls `attachments.register` with the selected bytes. A partial or lost registration becomes generic `ARTIFACT_EFFECT_UNKNOWN`.

Existing source composition calls that resolver from `source.prepare`: [apps/control/commands/source-http.mjs L26-L44](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/commands/source-http.mjs#L26-L44). The canonical executor checks initial authority and approval, but then calls `source.prepare` **before** `journal.claim`, budget reservation, and the final effect authority check: [apps/control/commands/executor.mjs L45-L62](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/control/commands/executor.mjs#L45-L62).

Consequences:
- A duplicate invocation registers/uploads again before the journal reveals its existing OUTCOME or UNKNOWN/indeterminate state.
- A failed or ambiguous registration occurs before `claimed=true`, so the executor cannot mark the command unknown.
- `source.prepare` catches the generic artifact error and applies `safe`. [packages/contracts/commands-0.2/execution-boundary.mjs L4-L14](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/packages/contracts/commands-0.2/execution-boundary.mjs#L4-L14) converts non-CommandError errors to `COMMAND_REFUSED`, losing the effect-unknown classification entirely.

Initial approval exists; this is a durable exclusion, fresh effect-authority and UNKNOWN-custody defect, not an absent-initial-approval finding.

Required repair: keep pre-claim preparation pure, or give attachment registration its own durable claim/immutable identity/recovery owner. Registration must participate in current effect authority, resource accounting and durable uncertain-outcome recording. Retrying a command in UNKNOWN must never re-register attachments blindly. The proposed broker contract currently has no explicit idempotency key.

The host broker is not yet supplied or wired into product, so repair this before P6 integration.

## R4-DOC-2 — P2: concurrent preview publication creates orphan objects

**Independently reproduced with the exact preview service, canonical artifact validators, actual new local preview store, a structurally valid source PDF, and synthetic artifact/object ports.** No renderer ran.

Two concurrent publications for the same version both observe no preview, both allocate/write an object, and then compete for the one immutable record. Results: two puts, one committed record, one untracked object; one result `published`, the other `ARTIFACT_EFFECT_UNKNOWN`. A second probe with an in-memory immutable record port gives the same result.

Sources: [apps/artifacts/preview/service.mjs L28-L48](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/artifacts/preview/service.mjs#L28-L48), [apps/artifacts/preview/local-store.mjs L22-L28](https://github.com/neo-capiro/meri-greenfield/blob/eca78d458acb46cbfd54a94cf870841d999ef6b1/apps/artifacts/preview/local-store.mjs#L22-L28).

The immutable store correctly prevents record overwrite, and the error is appropriately effect-unknown. It does not make the claimed “one render/write per version” guarantee true. The current preview suite proves serial republish only. Unknown attempts also lack a durable attempt record that retains the orphan's custody across a process crash.

Required for the durable P2 design: claim before allocation/render/write, reconcile concurrent and lost-ACK attempts by immutable source/version identity, track every created object and unknown effect, and enumerate preview objects/records plus orphans in retention. Until then, treat this as an incomplete source-local mechanism rather than completed live preview publication.

## Retained controls and non-regressions within scope

- Declared retention is initially fenced; missing ledger sink or watermark table prevents readiness. Runtime configuration accepts purge only disabled. This is safer than the former initially open serving gate. Control still does not supply ownership/cancellation or suppression routes.
- The registry now refuses unadmitted row classes instead of claiming complete deletion. Purge remains disabled; schedules are explicitly unsupported as retention subjects and external memory deletion blocks rather than inventing success.
- Renderer availability requires the branded port and all eight admission attestations; the admission record is still a trusted shape, not a runtime sandbox measurement.
- PDF admission requires the explicit switch plus an available renderer and only the Word operation family. No qualification record is supplied by ordinary product composition.
- PDF structure changes from the live base only return the already-verified page-tree leaf count and expose `pdfPageCount`; they do not relax the prior accepted tree/generation checks.
- Preview serving uses canonical artifact reads before and after fetching preview bytes. Runtime composition wraps preview store reads/commits in current-owner rechecks. Signed-preview links remain POST body tokens, actor/scope/generation bound, with the target carried in authenticated claims.
- Browser composition runs last and routes its permission callback separately from other mounts. Egress admission checks the effective policy, all returned addresses, public address classification, ports, expiry and revocation; actual transport enforcement remains unqualified.
- The activation constant is still `held` with null evidence. Approval-owner consume, host proxy/process owner, artifact ingest, browser status publication and exact prompt text remain proposals.

## Migration and contract work remains open

Do not treat report proposals as accepted schema or applied migrations.

1. Retention recovered-watermark table and row-class amendments; precise keys for completion checkpoints, next runs, selected outputs and receipts; surviving subject tombstones and ordered deletion; authoritative write-once sink; prepared-candidate sink binding.
2. Retention inventory is not complete for the merged package: preview objects/records/orphans, `meri_intent_preparations`, local `meri_memory.candidates`, and the new `meri_settings` tables need explicit owner, subject, scope, key and retention mappings. The current registry labels memory proposals external-only. These local tables are proposed/unapplied, but their integration cannot silently inherit that external class.
3. Durable preview store with uncertainty/exclusion semantics above; ArtifactPreview contract and immutable previewStatus relationship; PDF MIME and preview routes in the public DocumentApplication schema. Without the PDF MIME amendment, canonical clients can reject an admitted PDF result.
4. Renderer qualification-owner admission, product switch binding, optional findByObject index, preview-budget decision, governed attachment broker and signed-preview target claim.
5. Browser atomic canonical approval consume with current authenticated approver/authority/revocation; ingest idempotency/provenance; trusted run-bound host runtime and restore binding; exact prompt sentence; status event integration.
6. Real PostgreSQL retention/watermark, preview, intents and memory/settings tests still need an authorized, provisioned validation environment. The package also leaves schedule-occurrence and product-budget schema work open.

## Candidate h

Independently computed exact fetched bytes:
- g: `b74243e64a2a6d031434315cd7e4699ecc151f6ba2ca13959c04c31a75edfcd6`
- h: `79a5f7fc5254c0152c0119264d653cdb5b561f27ded91d379569d00ba73a5c1e`

Both contain 45 file rows. Exactly two rows differ g→h:
- `apps/runtime/control.mjs`: `399698afaa8cac6851f9f40590b1bbf0173e73541125a6b25be65af75ad18ee0` → `ec63730199cbc092042dab6b6694506087530ee85572e1daadfb478bf76c5757`
- `apps/runtime/config.mjs`: `3a1a136ddeccac2983040113c9de16a91110a70178964da601c839db8f169b71` → `9558183a7eab179d3b66d2b1d65707a0f495f882b3aa03e8b04b029942c6685d`

Both exact current source files match h's claimed bytes. The control change composes the new startup owner and calls its ensureServing at readiness; config only adds the closed purge-off declaration. Hash agreement is not acceptance of their dependency closure. The new retention/browser/preview modules and conversation activity/options are outside these 45 rows.

**Recommendation: leave h HOLD and do not change the frozen-candidate pin.** Resolve source defects and integration decisions, produce a successor candidate if reviewed bytes change, then rerun exact-candidate checks. This review did not verify every other unchanged row against source or run the complete image proof.

## Checks actually run

Node v24.19.0, isolated source mirror of exact GitHub reads; reused existing installed test dependencies. No full checkout/install, no edits to implementation source.
- Committed startup-restore, browser permissions and browser egress-control suites: **24/24 pass**, zero skipped.
- Independent retention restore/write counterexample: reproduced.
- Independent browser first-call overlap counterexample: reproduced.
- Independent navigation-during-pending-approval counterexample: reproduced.
- Preview concurrency with synthetic immutable store: reproduced.
- Preview concurrency with the actual source-local store: reproduced.
- g/h row comparison and manifest/two-file SHA-256 calculation: match.

The passing committed tests do not cover the counterexamples. Filing was inspected statically, not independently executed end to end in this review.

UNRUN: full repository tests/typechecks; real PostgreSQL, Temporal, S3/KMS/privacy/deletion; actual renderer/native quality benchmarks; real Playwright/Chromium/SDK hook precedence and page reports; adversarial host proxy/DNS/UDP/coalescing; actual attachment registration/filing; image build/scan/admission; deployment. Fable's local LibreOffice and integrated-suite counts remain author-reported evidence only.

The earlier **P2b stopped review remains stopped**. No denied P2b probe was retried or bypassed. Synthetic browser permission calls here exercise the new source functions without opening the shipped gate or launching a browser/provider.

## Reproducibility

Review-local directory: `/workspace/scratch/cd02fe8d9ebf/package4-artifacts-source/`.
- `probe-independent.mjs` and `independent-probes.log`: retention and browser counterexamples.
- `probe-preview.mjs` and `preview-probe.log`: preview races.
- `focused-tests.log`: 24 committed checks.
- Source maps and base-file snapshots preserve the fetched text used for review.

Temporary preview probe directories were disposed in finally. No remote write, candidate repin, migration execution, live purge, deployment, model/provider call, new credential or paid build occurred.


## Portable reproduction appendix

The following scripts can be saved at the exact pinned repository root and run with Node 24 and the repository’s existing installed dependencies. They import the reviewed production modules and committed synthetic fixtures. They make no network requests, run no real database/browser/model/renderer, and do not modify source. The preview script creates and removes only its own temporary local record directory. These are diagnostic counterexamples, not implementation patches or activation instructions.

### retention-browser-counterexamples.mjs

Run: `node retention-browser-counterexamples.mjs`

```js
import assert from 'node:assert/strict';
import {createRetentionStartup} from './apps/control/retention/startup.mjs';
import {createMemoryRetentionJournal} from './apps/control/retention/memory-journal.mjs';
import {createMemoryLedgerSink} from './apps/control/retention/ledger.mjs';
import {createMemoryWatermarkStore} from './apps/control/retention/recovery-watermark.mjs';
import {createPageContext} from './apps/worker/conversation/browser/page-context.mjs';
import {createPermissionGate} from './apps/worker/conversation/browser/permissions.mjs';
import {validateBrowserPolicy} from './apps/worker/conversation/browser/policy.mjs';
import {canonicalSha256} from './packages/contracts/validate.mjs';
import {binding,enabledPolicy,approvalReceipt,clock,pageResponse} from './apps/worker/conversation/browser/test/fixtures.mjs';
const journal=createMemoryRetentionJournal(), watermark=createMemoryWatermarkStore(), sink=createMemoryLedgerSink();
const startup=createRetentionStartup({journal,watermark,ledgerSink:sink,ownership:{async ownerOf(){return 'owner';}},purge:{enabled:false},now:()=>1800000000000});
const subject=n=>({tenantId:'synthetic',kind:'conversation',subjectId:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`});
const A=subject(1),B=subject(2),suppress=s=>startup.suppression.suppress({principal:{tenantId:'synthetic',actorId:'owner'},subject:s,reason:'synthetic probe'});
await startup.start();const savedJournal=journal.snapshot(),savedWatermark=watermark.snapshot();
await suppress(A);await assert.rejects(startup.gate.assertServable(A),/RETENTION_SUPPRESSED/);
journal.restore(savedJournal);watermark.restore(savedWatermark);
// A write is the first operation after restore, before any served read verifies the stale watermark.
await suppress(B);
let released=false;try{await startup.gate.assertServable(A);released=true;}catch{}
assert.equal(released,true,'counterexample: acknowledged suppression A is lost and now reads as servable');
console.log(JSON.stringify({probe:'restore-write-before-read',lostSuppressionServable:released,ledgerEntries:sink.size(),watermark:await watermark.read(),fence:startup.state()}));
const policy=validateBrowserPolicy(enabledPolicy()),pages=createPageContext();
pages.begin('navigation');pages.end('navigation',pageResponse('https://records.example/initial'));
const gate=createPermissionGate({binding,policy,policySha256:canonicalSha256(policy),server:'meri_browser',pages,now:clock,approvals:{async decide(request){return approvalReceipt(request);}}});
const pre=(tool,id,input={})=>gate.preToolUse({hook_event_name:'PreToolUse',tool_name:'mcp__meri_browser__'+tool,tool_use_id:id,tool_input:input},id,{});
await pre('browser_click','first',{element:'Submit',target:'e1'});
await pre('browser_navigate','second',{url:'https://notices.example/changed'});
assert.equal(pages.originFor('first'),'https://records.example');
const result=await gate.canUseTool('mcp__meri_browser__browser_click',{element:'Submit',target:'e1'},{toolUseID:'first'});
assert.equal(result.behavior,'allow','counterexample: first interaction approved while navigation overlaps');
console.log(JSON.stringify({probe:'first-call-overlap',firstOrigin:pages.originFor('first'),secondOrigin:pages.originFor('second'),decision:result.behavior}));
const pages2=createPageContext();pages2.begin('navigation');pages2.end('navigation',pageResponse('https://records.example/initial'));
let answer,requested;
const gate2=createPermissionGate({binding,policy,policySha256:canonicalSha256(policy),server:'meri_browser',pages:pages2,now:clock,approvals:{decide(request){requested=request;return new Promise(resolve=>{answer=resolve;});}}});
const pre2=(tool,id,input={})=>gate2.preToolUse({hook_event_name:'PreToolUse',tool_name:'mcp__meri_browser__'+tool,tool_use_id:id,tool_input:input},id,{});
await pre2('browser_click','pending',{element:'Submit',target:'e1'});
const pending=gate2.canUseTool('mcp__meri_browser__browser_click',{element:'Submit',target:'e1'},{toolUseID:'pending'});
await new Promise(resolve=>setImmediate(resolve));
await pre2('browser_navigate','later',{url:'https://notices.example/changed'});pages2.end('later',pageResponse('https://notices.example/changed'));
answer(approvalReceipt(requested));
const after=await pending;assert.equal(after.behavior,'allow');
console.log(JSON.stringify({probe:'navigation-during-approval',approvedOrigin:requested.subject.pageOrigin,reportedNewOrigin:'https://notices.example',decision:after.behavior}));


```

Observed output:

```jsonl
{"probe":"restore-write-before-read","lostSuppressionServable":true,"ledgerEntries":2,"watermark":{"sequence":2,"entrySha256":null},"fence":{"enabled":true,"reason":null,"opened":{"sequence":0,"entrySha256":null},"highWater":2,"purgeEnabled":false,"unavailable":null}}
{"probe":"first-call-overlap","firstOrigin":"https://records.example","secondOrigin":null,"decision":"allow"}
{"probe":"navigation-during-approval","approvedOrigin":"https://records.example","reportedNewOrigin":"https://notices.example","decision":"allow"}
```

### preview-concurrency-counterexamples.mjs

Run: `node preview-concurrency-counterexamples.mjs`

```js
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash,randomUUID} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import {canonicalSha256 as hash,validateShape as validatePublicShape} from './packages/contracts/validate.mjs';
import {createArtifactValidators} from './packages/contracts/artifacts-0.2/artifact-validation.mjs';
import {createArtifactPreviewService} from './apps/artifacts/preview/service.mjs';
import {realPdf} from './apps/artifacts/test/pdf-fixtures.mjs';
const ajv=addFormats(new Ajv({strict:true,allErrors:true}));
const pub=JSON.parse(readFileSync(new URL('./packages/contracts/meri.schema.json',import.meta.url)));
const priv=JSON.parse(readFileSync(new URL('./packages/contracts/artifacts-0.2/artifact.schema.json',import.meta.url)));ajv.addSchema(pub);ajv.addSchema(priv);
const v=createArtifactValidators({validatePublicShape,canonicalSha256:hash,validateShape:(n,x)=>{if(!ajv.getSchema(priv.$id+'#/$defs/'+n)(x))throw Error('schema');}});
const sha=b=>createHash('sha256').update(b).digest('hex');
const binding={tenantId:'synthetic',actorId:'owner',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
const scopes=[{tenantId:'synthetic',kind:'tenant',resourceId:'synthetic',policyRevision:'1'}];
const source=realPdf(['synthetic preview concurrency probe']);
const version=v.version({contractVersion:'0.1.0',artifactId:randomUUID(),versionId:randomUUID(),parentVersionId:null,binding,scopes,evidence:[],filename:'synthetic.pdf',mimeType:'application/pdf',generationStatus:'draft',previewStatus:'pending',createdAt:new Date().toISOString(),object:{objectId:randomUUID(),versionId:'source-v1',sha256:sha(source),bytes:source.length,scopes}});
const context=v.context({binding,scopes,evidence:[],assets:[],deadlineMs:Date.now()+60000,maxBytes:8388608});
const bytes=new Map();let puts=0,record=null,commits=0;
const objects={async put({objectId,bytes:b,scopes}){puts++;bytes.set(objectId,Buffer.from(b));return {objectId,versionId:'p'+puts,sha256:sha(b),bytes:b.length,scopes};},async get(object){return bytes.get(object.objectId);}};
const previews={async read(){return record;},async commit(r){commits++;if(record&&hash(record)!==hash(r))throw Object.assign(Error('ARTIFACT_PREVIEW_CONFLICT'),{code:'ARTIFACT_PREVIEW_CONFLICT'});record=r;return {status:'committed',versionId:r.versionId,recordSha256:hash(r)};}};
const svc=createArtifactPreviewService({validators:v,artifacts:{async download(){return {version,bytes:source};},async inspect(){return {version};}},objects,previews,ids:()=>({objectId:randomUUID(),versionId:randomUUID()}),now:Date.now});
const results=await Promise.allSettled([svc.publish(version.versionId,context),svc.publish(version.versionId,context)]);
assert.equal(puts,2);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='ARTIFACT_EFFECT_UNKNOWN').length,1);
console.log(JSON.stringify({probe:'concurrent-preview-publish',puts,commits,committedRecords:record?1:0,untrackedObjects:bytes.size-1,results:results.map(r=>r.status==='fulfilled'?r.value.status:r.reason.code)}));

const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {createLocalPreviewStore}=await import('./apps/artifacts/preview/local-store.mjs');
const root=await mkdtemp(join(tmpdir(),'meri-package4-preview-probe-'));
const local=await createLocalPreviewStore({root:join(root,'records'),canonicalSha256:hash});puts=0;bytes.clear();
try{
 const actual=createArtifactPreviewService({validators:v,artifacts:{async download(){return {version,bytes:source};},async inspect(){return {version};}},objects,previews:local,ids:()=>({objectId:randomUUID(),versionId:randomUUID()}),now:Date.now});
 const checked=await Promise.allSettled([actual.publish(version.versionId,context),actual.publish(version.versionId,context)]);
 const saved=await local.read(version.versionId);assert.equal(puts,2);assert.ok(saved);assert.equal(checked.filter(r=>r.status==='rejected'&&r.reason.code==='ARTIFACT_EFFECT_UNKNOWN').length,1);
 console.log(JSON.stringify({probe:'concurrent-preview-real-local-store',puts,committedRecords:1,untrackedObjects:bytes.size-1,results:checked.map(r=>r.status==='fulfilled'?r.value.status:r.reason.code)}));
}finally{await local.dispose();await rm(root,{recursive:true,force:true});}



```

Observed output:

```jsonl
{"probe":"concurrent-preview-publish","puts":2,"commits":2,"committedRecords":1,"untrackedObjects":1,"results":["published","ARTIFACT_EFFECT_UNKNOWN"]}
{"probe":"concurrent-preview-real-local-store","puts":2,"committedRecords":1,"untrackedObjects":1,"results":["published","ARTIFACT_EFFECT_UNKNOWN"]}
```

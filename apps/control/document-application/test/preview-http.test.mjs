/** Preview publication and serving over HTTP: the document application's preview routes over the artifact preview owner,
 * composed the way the runtime composes them (`createRuntimeDocumentOptionsComposer({previews, renderer})`), the runtime mount's
 * per-port rechecks, and signed preview links over the canonical preview route. SYNTHETIC office converter behind a synthetic
 * renderer admission; real generators and the real local immutable store. Local evidence only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
import {createDocumentApplication} from '../index.mjs';
import {createFixedRuntimeArtifactExecutor,createRuntimeDocumentOptionsComposer} from '../../../runtime/artifacts/composition.mjs';
import {createRuntimeArtifactApplication} from '../../../runtime/artifacts/application.mjs';
import {createDownloadLinkApplication} from '../../../runtime/artifacts/download-links.mjs';
import {createRendererPort} from '../../../artifacts/renderer.mjs';
import {createLocalPreviewStore} from '../../../artifacts/preview/local-store.mjs';
import {structureCheck} from '../../../artifacts/structure/file-structure.mjs';
import {syntheticOfficeConverter,syntheticAdmission} from '../../../artifacts/test/pdf-fixtures.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const specs={docx:{operation:'create_word',format:'docx',title:'Brief',content:{blocks:[{kind:'paragraph',runs:[{text:'Policy brief'}]}]}},
 pdf:{operation:'create_word',format:'pdf',title:'Printable',content:{blocks:[{kind:'paragraph',runs:[{text:'Printable'}]}]}},
 txt:{operation:'create_word',format:'txt',title:'Notes',content:{text:'notes\n'}},
 xlsx:{operation:'create_excel',format:'xlsx',title:'Model',content:{sheets:[{name:'Data',rows:[[{value:'A'},{value:2}],[{value:'Total'},{formula:'=SUM(B1:B1)'}]]}]}}};

async function setup(t,{operation='create_word',previews=true}={}){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation}),root=await mkdtemp(join(tmpdir(),'meri-preview-http-'));
 const store=previews?await createLocalPreviewStore({root:join(root,'previews'),canonicalSha256}):null;
 t.after(async()=>{await f.close();await store?.dispose();await rm(root,{recursive:true,force:true});});
 const office=syntheticOfficeConverter(),renderer=createRendererPort({admission:syntheticAdmission(),transformer:office});
 const executor=createFixedRuntimeArtifactExecutor({pythonExecutable:python,nodeExecutable:process.execPath,pptxModulePath:join(root,'pptx'),tempRoot:root,timeoutMs:30000,renderer});
 const compose=createRuntimeDocumentOptionsComposer({storage:{objects:f.artifactOptions.objects,versions:f.artifactOptions.versions},executor,budgetPool:f.ledger.pool,sessions:f.sessions,now:f.now,renderer,pdfAdmission:true,...(store?{previews:store}:{})});
 const trusted={artifactOptions:f.artifactOptions,selectedClientId:f.selectedClientId,credential:f.credential,limits:f.limits,enabled:true};
 const app=createDocumentApplication(compose(trusted)),session=await f.sessions.issue({identityCredential:f.nativeCredential});
 const request=(route,body)=>new Request(`http://127.0.0.1/api/documents/${route}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.credential}`},body:JSON.stringify(body)});
 const post=(route,body)=>app.handle(request(route,body));
 const create=async format=>{const r=await post('create',{deliveryId:'d-'+format,request:specs[format]});assert.equal(r.status,200,await r.clone().text());return (await r.json()).version;};
 return {f,root,store,office,renderer,compose,trusted,app,session,request,post,create};
}
const error=async(response,status,code,outcome)=>{assert.equal(response.status,status);assert.deepEqual((await response.json()).error,{code,outcome});};
const previewBytes=async response=>{assert.equal(response.status,200,await response.clone().text());
 assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(response.headers.get('content-security-policy'),"sandbox; default-src 'none'");assert.match(response.headers.get('content-disposition'),/^inline; filename="[A-Za-z0-9._ -]+\.preview\.pdf"$/);
 const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(structureCheck(bytes,'pdf'),{valid:true});return bytes;};

test('HTTP preview: pending, publish, serve, idempotent republish; a revision has its own preview and the parent preview stays',async t=>{
 const a=await setup(t),version=await a.create('docx'),generations=a.f.stats().generations,charges=a.f.stats().versionCharges;
 await error(await a.post('preview',{versionId:version.versionId}),409,'ARTIFACT_PREVIEW_PENDING','READ_UNAVAILABLE');
 const published=await (await a.post('preview-publish',{versionId:version.versionId})).json();
 assert.equal(published.status,'published');assert.equal(published.preview.versionId,version.versionId);assert.equal(published.preview.source.sha256,version.object.sha256);assert.equal(published.preview.nativeQualified,false);
 const bytes=await previewBytes(await a.post('preview',{versionId:version.versionId}));assert.equal(sha(bytes),published.preview.preview.object.sha256);
 assert.equal((await (await a.post('preview-publish',{versionId:version.versionId})).json()).status,'existing');assert.equal(a.office.calls.filter(c=>c.format==='docx').length,1);
 // Previews never reserve or settle budget and never regenerate the artifact.
 assert.equal(a.f.stats().generations,generations);assert.equal(a.f.stats().versionCharges,charges);
 const revision=await a.post('revise',{deliveryId:'d-rev',baseVersionId:version.versionId,request:{...specs.docx,content:{blocks:[{kind:'paragraph',runs:[{text:'Revised'}]}]}}});
 const child=(await revision.json()).version;await error(await a.post('preview',{versionId:child.versionId}),409,'ARTIFACT_PREVIEW_PENDING','READ_UNAVAILABLE');
 assert.deepEqual(await previewBytes(await a.post('preview',{versionId:version.versionId})),bytes);
});
test('HTTP preview: a PDF version previews as itself; TXT is unsupported before any write; revoked sessions are refused',async t=>{
 const a=await setup(t),printable=await a.create('pdf'),notes=await a.create('txt');
 const published=await (await a.post('preview-publish',{versionId:printable.versionId})).json();assert.equal(published.preview.conversion.method,'source-pdf');
 assert.equal(sha(await previewBytes(await a.post('preview',{versionId:printable.versionId}))),printable.object.sha256);
 await error(await a.post('preview-publish',{versionId:notes.versionId}),422,'ARTIFACT_PREVIEW_UNSUPPORTED','READ_UNAVAILABLE');
 await error(await a.post('preview',{versionId:notes.versionId}),422,'ARTIFACT_PREVIEW_UNSUPPORTED','READ_UNAVAILABLE');
 a.f.revoke();const denied=await a.post('preview',{versionId:printable.versionId});assert.notEqual(denied.status,200);
});
test('HTTP preview: an Excel-bound application previews workbooks; without a preview store both routes are unavailable',async t=>{
 const a=await setup(t,{operation:'create_excel'}),workbook=await a.create('xlsx');
 assert.equal((await (await a.post('preview-publish',{versionId:workbook.versionId})).json()).preview.conversion.method,'office-pdf');await previewBytes(await a.post('preview',{versionId:workbook.versionId}));
 const b=await setup(t,{previews:false}),version=await b.create('docx');
 for(const route of ['preview','preview-publish'])await error(await b.post(route,{versionId:version.versionId}),503,'PREVIEW_UNAVAILABLE','NOT_DISPATCHED');
 assert.throws(()=>createDocumentApplication({...b.compose(b.trusted),previewOptions:{previews:b.store??{read(){},commit(){}},renderer:syntheticOfficeConverter()}}));
});
test('runtime mount: preview record reads and commits are rechecked; a denial at commit is UNKNOWN and publishes nothing',async t=>{
 const a=await setup(t),version=await a.create('docx'),state={phases:[],denyCommit:false};
 const owner={async resolve(call){return {documentOptions:a.compose(a.trusted),async recheck(check){state.phases.push(check.phase+':'+(check.resource?.previewId?'commit':check.resource?.versionId&&!check.resource.object?'record':'other'));
  if(state.denyCommit&&check.resource?.previewId)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};}};
 const mount=createRuntimeArtifactApplication({sessions:a.f.sessions,optionsOwner:owner,now:a.f.now,limits:a.f.limits});
 state.denyCommit=true;const denied=await mount.handle(a.request('preview-publish',{versionId:version.versionId}));assert.equal(denied.status,502);assert.equal((await denied.json()).error.outcome,'UNKNOWN');
 assert.ok(state.phases.includes('effect:commit'));assert.equal(await a.store.read(version.versionId),null);
 state.denyCommit=false;const published=await mount.handle(a.request('preview-publish',{versionId:version.versionId}));assert.equal(published.status,200);
 await previewBytes(await mount.handle(a.request('preview',{versionId:version.versionId})));assert.ok(state.phases.includes('release:other'));
});
test('signed preview links: issue binds the preview digest; redeem serves it inline; a suppression generation change revokes it; download links are unchanged',async t=>{
 const a=await setup(t),version=await a.create('docx');await a.post('preview-publish',{versionId:version.versionId});
 const clock={generation:0},links=createDownloadLinkApplication({documents:a.app,sessions:a.f.sessions,key:Buffer.alloc(32,7),generation:async()=>clock.generation,now:a.f.now,ttlMs:60000,maxRequestMs:15000});
 const link=(route,body)=>links.handle(new Request(`http://127.0.0.1/api/documents/links/${route}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${a.session.credential}`},body:JSON.stringify(body)}));
 const issued=await (await link('issue',{versionId:version.versionId,target:'preview'})).json();assert.deepEqual(Object.keys(issued).sort(),['expiresAtMs','target','token','versionId']);
 const claims=JSON.parse(Buffer.from(issued.token.split('.')[0],'base64url'));assert.equal(claims.target,'preview');
 const redeemed=await link('redeem',{token:issued.token});const bytes=await previewBytes(redeemed);assert.equal(sha(bytes),claims.sha256);assert.equal(redeemed.headers.get('referrer-policy'),'no-referrer');
 const download=await (await link('issue',{versionId:version.versionId})).json();assert.deepEqual(Object.keys(download).sort(),['expiresAtMs','token','versionId']);
 assert.equal(JSON.parse(Buffer.from(download.token.split('.')[0],'base64url')).sha256,version.object.sha256);
 const file=await link('redeem',{token:download.token});assert.equal(file.status,200);assert.equal(sha(Buffer.from(await file.arrayBuffer())),version.object.sha256);
 assert.equal((await link('issue',{versionId:version.versionId,target:'other'})).status,400);
 clock.generation=1;const revoked=await link('redeem',{token:issued.token});assert.equal(revoked.status,410);assert.deepEqual(await revoked.json(),{error:{code:'DOWNLOAD_LINK_REVOKED'}});
 const child=await a.create('pdf');const pending=await link('issue',{versionId:child.versionId,target:'preview'});assert.equal(pending.status,409);
});

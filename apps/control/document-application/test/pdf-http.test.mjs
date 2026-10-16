/** PDF through the HTTP document application with the renderer bound the way the runtime binds it: the fixed executor from
 * `createFixedRuntimeArtifactExecutor({renderer})` and admission decided by `createRuntimeDocumentOptionsComposer` (explicit
 * `pdfAdmission` switch AND an available qualified-renderer port). Default converter: the SYNTHETIC port in
 * apps/artifacts/test/pdf-fixtures.mjs behind a synthetic admission record. Opt-in: real LibreOffice (MERI_ARTIFACT_SOFFICE)
 * behind the same synthetic admission record. Both are local evidence only: no renderer qualification, image or sandbox. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
import {createDocumentApplication} from '../index.mjs';
import {createFixedRuntimeArtifactExecutor,createRuntimeDocumentOptionsComposer} from '../../../runtime/artifacts/composition.mjs';
import {createRendererPort,createLibreOfficeRendererPort} from '../../../artifacts/renderer.mjs';
import {structureCheck} from '../../../artifacts/structure/file-structure.mjs';
import {pdfLines,sha,syntheticConverter,syntheticAdmission} from '../../../artifacts/test/pdf-fixtures.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const soffice=process.env.MERI_ARTIFACT_SOFFICE;
const word={operation:'create_word',format:'pdf',title:'Brief',content:{blocks:[{kind:'paragraph',style:'Title',runs:[{text:'Policy',bold:true}]},{kind:'table',rows:[['Name','Value'],['A','2']]}]}};
const revised={...word,content:{blocks:[{kind:'paragraph',style:'Title',runs:[{text:'Revised policy',bold:true}]},{kind:'table',rows:[['Name','Value'],['A','3']]}]}};
const syntheticPort=()=>{const converter=syntheticConverter();return {converter,port:()=>createRendererPort({admission:syntheticAdmission(),transformer:converter})};};
const realPort=root=>createLibreOfficeRendererPort({admission:syntheticAdmission({executable:soffice}),executable:soffice,tempRoot:root});

async function setup(t,{renderer,pdfAdmission=true,operation='create_word'}){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation}),root=await mkdtemp(join(tmpdir(),'meri-pdf-http-'));
 t.after(async()=>{await f.close();assert.deepEqual(f.stats().cleanup,{executorDirectoriesAbsent:true,storeRemoved:true});await rm(root,{recursive:true,force:true});});
 const port=renderer?.(root),counts={generations:0};
 const inner=createFixedRuntimeArtifactExecutor({pythonExecutable:python,nodeExecutable:process.execPath,pptxModulePath:join(root,'pptx-not-configured'),tempRoot:root,timeoutMs:30000,...(port?{renderer:port}:{})});
 const executor={execute(call){counts.generations++;return inner.execute(call);}};
 const compose=createRuntimeDocumentOptionsComposer({storage:{objects:f.artifactOptions.objects,versions:f.artifactOptions.versions},executor,budgetPool:f.ledger.pool,sessions:f.sessions,now:f.now,...(port?{renderer:port}:{}),pdfAdmission});
 const options=compose({artifactOptions:f.artifactOptions,selectedClientId:f.selectedClientId,credential:f.credential,limits:f.limits,enabled:true});
 const app=createDocumentApplication(options),session=await f.sessions.issue({identityCredential:f.nativeCredential});
 const post=(route,body)=>app.handle(new Request(`http://127.0.0.1/api/documents/${route}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.credential}`},body:JSON.stringify(body)}));
 return {f,root,counts,options,post};
}
const ok=async response=>{assert.equal(response.status,200,await response.clone().text());return response;};
const pdf=bytes=>{assert.equal(bytes.subarray(0,5).toString('latin1'),'%PDF-');assert.deepEqual(structureCheck(bytes,'pdf'),{valid:true});return bytes;};

async function httpLineage(t,renderer,synthetic){
 const a=await setup(t,{renderer});assert.equal(a.options.admitPdf,true);
 const first=await (await ok(await a.post('create',{deliveryId:'pdf-original',request:word}))).json();
 assert.equal(first.version.mimeType,'application/pdf');assert.equal(first.version.filename,'Brief.pdf');assert.equal(first.version.parentVersionId,null);assert.equal(first.version.previewStatus,'pending');
 assert.deepEqual(Object.keys(first.inspection.details).sort(),['conversionCompleted','renderInspection','sourceDocxSha256']);assert.equal(first.execution.nativeQualified,false);
 const inspected=await (await ok(await a.post('inspect',{versionId:first.version.versionId}))).json();assert.equal(inspected.inspection.currentBytesVerified,true);assert.equal(inspected.inspection.format,'pdf');
 const downloaded=await ok(await a.post('download',{versionId:first.version.versionId}));
 assert.equal(downloaded.headers.get('content-type'),'application/pdf');assert.equal(downloaded.headers.get('content-disposition'),'attachment; filename="Brief.pdf"');assert.equal(downloaded.headers.get('cache-control'),'no-store');
 const parent=pdf(Buffer.from(await downloaded.arrayBuffer()));assert.equal(sha(parent),first.version.object.sha256);if(synthetic)assert.deepEqual(pdfLines(parent),['Policy','Name','Value','A','2']);
 const second=await (await ok(await a.post('revise',{deliveryId:'pdf-revision',baseVersionId:first.version.versionId,request:revised}))).json();
 assert.equal(second.version.parentVersionId,first.version.versionId);assert.equal(second.version.artifactId,first.version.artifactId);assert.notEqual(second.version.versionId,first.version.versionId);
 const child=pdf(Buffer.from(await (await ok(await a.post('download',{versionId:second.version.versionId}))).arrayBuffer()));assert.equal(sha(child),second.version.object.sha256);
 if(synthetic)assert.deepEqual(pdfLines(child),['Revised policy','Name','Value','A','3']);assert.notDeepEqual(child,parent);
 assert.deepEqual(Buffer.from(await (await ok(await a.post('download',{versionId:first.version.versionId}))).arrayBuffer()),parent,'parent bytes untouched');
 assert.equal(a.counts.generations,2);assert.equal(a.f.stats().versionCharges,2);assert.equal(a.f.stats().settled,2);assert.equal(a.f.stats().consumedMicroUsd,'20');
 // Replay of the same revision delivery over HTTP: the same committed version, no generation and no charge.
 const replay=await (await ok(await a.post('revise',{deliveryId:'pdf-revision',baseVersionId:first.version.versionId,request:revised}))).json();
 assert.deepEqual(replay.version,second.version);assert.deepEqual(replay.inspection,second.inspection);assert.equal(a.counts.generations,2);assert.equal(a.f.stats().versionCharges,2);
 // The same delivery with a different request is not a replay.
 assert.notEqual((await a.post('revise',{deliveryId:'pdf-revision',baseVersionId:first.version.versionId,request:{...revised,title:'Other'}})).status,200);assert.equal(a.counts.generations,2);
 // A stale parent is refused at commit: effect UNKNOWN, no new version, both versions unchanged.
 const stale=await a.post('revise',{deliveryId:'pdf-stale',baseVersionId:first.version.versionId,request:{...revised,title:'Stale'}});
 assert.equal(stale.status,502);assert.deepEqual((await stale.json()).error,{code:'ARTIFACT_EFFECT_UNKNOWN',outcome:'UNKNOWN'});
 assert.deepEqual(Buffer.from(await (await ok(await a.post('download',{versionId:second.version.versionId}))).arrayBuffer()),child);
 // Revoked authority: refused before any generation.
 const generations=a.counts.generations;a.f.revoke();
 assert.notEqual((await a.post('revise',{deliveryId:'pdf-revoked',baseVersionId:second.version.versionId,request:revised})).status,200);assert.equal(a.counts.generations,generations);
 assert.deepEqual(await readdir(a.root),[]);
}
test('HTTP PDF create/inspect/download/revise/replay through the bound renderer port (synthetic converter)',t=>{const s=syntheticPort();return httpLineage(t,s.port,true);});
test('HTTP PDF create/inspect/download/revise/replay through real LibreOffice (opt-in MERI_ARTIFACT_SOFFICE)',{skip:!soffice&&'MERI_ARTIFACT_SOFFICE not set'},t=>httpLineage(t,realPort,false));

const refusedPdf=async(a)=>{const res=await a.post('create',{deliveryId:'pdf',request:word});
 assert.equal(res.status,400);assert.deepEqual((await res.json()).error,{code:'INVALID_REQUEST',outcome:'NOT_DISPATCHED'});assert.equal(a.counts.generations,0);assert.equal(a.f.stats().versionCharges,0);};
test('the PDF admission switch stays off by default even with an available renderer',async t=>{
 const a=await setup(t,{renderer:syntheticPort().port,pdfAdmission:false});assert.equal(a.options.admitPdf,undefined);await refusedPdf(a);
});
test('the switch alone never admits PDF: no renderer, an unadmitted renderer or an unqualified sandbox keeps PDF refused',async t=>{
 const sandbox={...syntheticAdmission().sandbox,noNetwork:false};
 for(const renderer of [undefined,()=>createRendererPort({admission:undefined,transformer:syntheticConverter()}),()=>createRendererPort({admission:syntheticAdmission({sandbox}),transformer:syntheticConverter()})]){
  const a=await setup(t,{renderer,pdfAdmission:true});assert.equal(a.options.admitPdf,undefined);await refusedPdf(a);
 }
});
test('an Excel-bound application is never asked to admit PDF',async t=>{
 const a=await setup(t,{renderer:syntheticPort().port,operation:'create_excel'});assert.equal(a.options.admitPdf,undefined);
 const res=await a.post('create',{deliveryId:'pdf',request:word});assert.equal(res.status,400);assert.equal(a.counts.generations,0);
});
test('runtime executor binding accepts only a qualified-renderer port and fails closed without one',async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-pdf-binding-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const base={pythonExecutable:python,nodeExecutable:process.execPath,pptxModulePath:join(root,'pptx'),tempRoot:root};
 assert.throws(()=>createFixedRuntimeArtifactExecutor({...base,officeTransformer:syntheticConverter()}));
 assert.throws(()=>createFixedRuntimeArtifactExecutor({...base,renderer:syntheticConverter()}));
 for(const renderer of [undefined,createRendererPort({admission:undefined,transformer:syntheticConverter()})]){
  const executor=createFixedRuntimeArtifactExecutor({...base,...(renderer?{renderer}:{})});
  await assert.rejects(executor.execute({request:word,assets:[],base:null,deadlineMs:Date.now()+10000,maxBytes:1048576}),{code:'ARTIFACT_RENDERER_UNAVAILABLE'});
  assert.deepEqual(await readdir(root),[]);
 }
 assert.throws(()=>createRuntimeDocumentOptionsComposer({storage:{objects:{},versions:{}},executor:{},budgetPool:{},sessions:{},now:Date.now,renderer:syntheticConverter()}));
 assert.throws(()=>createRuntimeDocumentOptionsComposer({storage:{objects:{},versions:{}},executor:{},budgetPool:{},sessions:{},now:Date.now,pdfAdmission:'yes'}));
});

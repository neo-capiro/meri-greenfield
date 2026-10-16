/** PDF create/revise/replay through the canonical owners the document application dispatches to: the durable
 * PostgresArtifactService (scripted canonical ledger, real local immutable store, real DOCX generator) for writes and
 * the ArtifactService for inspect/download. The DOCX -> PDF converter is the SYNTHETIC port from
 * apps/artifacts/test/pdf-fixtures.mjs; an opt-in variant uses real LibreOffice (MERI_ARTIFACT_SOFFICE, local evidence only). Without the
 * explicit admission switch PDF stays unadmitted (asserted last); this proves the owners beneath that admission. The admitted HTTP route
 * through the bound renderer port is pdf-http.test.mjs. Neither is native rendering or a qualified renderer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
import {createDocumentApplication} from '../index.mjs';
import {createPostgresArtifactService} from '../../../artifacts/postgres-service.mjs';
import {createArtifactService} from '../../../artifacts/service.mjs';
import {createLocalArtifactExecutor} from '../../../artifacts/local-executor.mjs';
import {createLibreOfficeTransformer} from '../../../artifacts/office-transform.mjs';
import {structureCheck} from '../../../artifacts/structure/file-structure.mjs';
import {pdfLines,sha,syntheticConverter} from '../../../artifacts/test/pdf-fixtures.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const word={operation:'create_word',format:'pdf',title:'Brief',content:{blocks:[{kind:'paragraph',style:'Title',runs:[{text:'Policy',bold:true}]},{kind:'table',rows:[['Name','Value'],['A','2']]}]}};
const revised={...word,content:{blocks:[{kind:'paragraph',style:'Title',runs:[{text:'Revised policy',bold:true}]},{kind:'table',rows:[['Name','Value'],['A','3']]}]}};

async function setup(t,transformer){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python}),root=await mkdtemp(join(tmpdir(),'meri-pdf-lineage-'));
 t.after(async()=>{await f.close();assert.deepEqual(f.stats().cleanup,{executorDirectoriesAbsent:true,storeRemoved:true});await rm(root,{recursive:true,force:true});});
 const converter=transformer?.(root)??syntheticConverter(),counts={generations:0,puts:0};
 const inner=createLocalArtifactExecutor({pythonExecutable:python,nodeExecutable:process.execPath,pptxModulePath:join(root,'pptx-not-configured'),tempRoot:root,timeoutMs:15000,officeTransformer:converter});
 const options={...f.artifactOptions,executor:{execute(call){counts.generations++;return inner.execute(call);}},
  objects:{get:f.artifactOptions.objects.get,put(...args){counts.puts++;return f.artifactOptions.objects.put(...args);}}};
 const write=body=>createPostgresArtifactService(options).execute(body,f.credential);
 const forbidden=()=>{throw Error('READ_BUDGET_FORBIDDEN');};
 const reads=createArtifactService({...options,budget:{reserve:forbidden,settle:forbidden}}),context=f.artifactOptions.context;
 return {f,root,converter,counts,write,inspect:id=>reads.inspect(id,context),download:async id=>Buffer.from((await reads.download(id,context)).bytes)};
}
const pdf=bytes=>{assert.equal(bytes.subarray(0,5).toString('latin1'),'%PDF-');assert.deepEqual(structureCheck(bytes,'pdf'),{valid:true});return bytes;};

async function durableLineage(t,transformer){
 const synthetic=!transformer,a=await setup(t,transformer);
 const first=await a.write({deliveryId:'pdf-original',baseVersionId:null,request:word});
 const parent=pdf(await a.download(first.version.versionId));if(synthetic)assert.deepEqual(pdfLines(parent),['Policy','Name','Value','A','2']);
 assert.equal((await a.inspect(first.version.versionId)).inspection.currentBytesVerified,true);
 const second=await a.write({deliveryId:'pdf-revision',baseVersionId:first.version.versionId,request:revised});
 assert.equal(second.version.parentVersionId,first.version.versionId);assert.equal(second.version.artifactId,first.version.artifactId);assert.notEqual(second.version.versionId,first.version.versionId);
 assert.equal(second.version.mimeType,'application/pdf');assert.equal(second.inspection.format,'pdf');if(synthetic)assert.equal(second.inspection.details.sourceDocxSha256,a.converter.calls[1].inputSha256);
 const child=pdf(await a.download(second.version.versionId));assert.equal(sha(child),second.version.object.sha256);if(synthetic)assert.deepEqual(pdfLines(child),['Revised policy','Name','Value','A','3']);assert.notDeepEqual(child,parent);
 assert.equal((await a.inspect(second.version.versionId)).inspection.currentBytesVerified,true);
 assert.deepEqual(await a.download(first.version.versionId),parent,'parent bytes untouched');
 const settled={generations:2,puts:2};assert.deepEqual(a.counts,settled);
 const stats=a.f.stats();assert.equal(stats.versionCharges,2);assert.equal(stats.settled,2);assert.equal(stats.consumedMicroUsd,'20');
 // Replay of the same revision delivery: the same committed version, no generator launch, object write or new charge.
 const replay=await a.write({deliveryId:'pdf-revision',baseVersionId:first.version.versionId,request:revised});
 assert.deepEqual(replay.version,second.version);assert.deepEqual(replay.inspection,second.inspection);assert.deepEqual(a.counts,settled);if(synthetic)assert.equal(a.converter.calls.length,2);
 for(const key of ['versionCharges','settled','consumedMicroUsd'])assert.equal(a.f.stats()[key],stats[key],key);
 // The same delivery with a different request is not a replay and starts nothing.
 await assert.rejects(a.write({deliveryId:'pdf-revision',baseVersionId:first.version.versionId,request:{...revised,title:'Other'}}));assert.deepEqual(a.counts,settled);
 // CAS: a new revision from the superseded parent is refused at commit; nothing is committed and the lineage is unchanged.
 const stale=await a.write({deliveryId:'pdf-stale',baseVersionId:first.version.versionId,request:{...revised,title:'Stale'}}).then(()=>assert.fail('stale parent committed'),e=>e);
 assert.equal(stale.code,'ARTIFACT_EFFECT_UNKNOWN');assert.equal(stale.versionCommitted,false);let cause=stale;while(cause.cause)cause=cause.cause;assert.equal(cause.code,'ARTIFACT_STALE_PARENT');
 await assert.rejects(a.inspect(stale.versionId));
 assert.deepEqual(await a.download(first.version.versionId),parent);assert.deepEqual(await a.download(second.version.versionId),child);
 const generations=a.counts.generations,puts=a.counts.puts;
 // No current authority: a revision is refused before any generator launch or object write.
 a.f.revoke();await assert.rejects(a.write({deliveryId:'pdf-revoked',baseVersionId:second.version.versionId,request:revised}));
 assert.equal(a.counts.generations,generations);assert.equal(a.counts.puts,puts);assert.deepEqual(await readdir(a.root),[]);
}
test('PDF revision is a durable full re-render with exact parent; replay returns the same version without a second launch or write',t=>durableLineage(t));
test('real LibreOffice durable PDF create/revise/replay (opt-in MERI_ARTIFACT_SOFFICE)',{skip:!process.env.MERI_ARTIFACT_SOFFICE&&'MERI_ARTIFACT_SOFFICE not set'},
 t=>durableLineage(t,root=>createLibreOfficeTransformer({executable:process.env.MERI_ARTIFACT_SOFFICE,tempRoot:root})));

test('without the admission switch the document application still refuses PDF before generation',async t=>{
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python});t.after(()=>f.close());
 const app=createDocumentApplication({sessions:f.sessions,selectedClientId:f.selectedClientId,artifactOptions:f.artifactOptions,credential:f.credential,now:f.now,limits:f.limits,enabled:true});
 const session=await f.sessions.issue({identityCredential:f.nativeCredential});
 const res=await app.handle(new Request('http://127.0.0.1/api/documents/create',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.credential}`},body:JSON.stringify({deliveryId:'pdf',request:word})}));
 // input() maps the admission refusal (UNSUPPORTED_DOCUMENT_FORMAT) to the content-free INVALID_REQUEST.
 assert.equal(res.status,400);assert.deepEqual((await res.json()).error,{code:'INVALID_REQUEST',outcome:'NOT_DISPATCHED'});assert.equal(f.stats().generations,0);assert.equal(f.stats().versionCharges,0);
});

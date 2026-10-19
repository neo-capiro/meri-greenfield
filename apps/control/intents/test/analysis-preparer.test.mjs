/** Real typed ZIP generator and canonical durable analysis owner over scripted SQL;
 * sandbox admission/execution are explicitly synthetic ports, never host code. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import JSZip from 'jszip';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createAnalysisIntentPreparer} from '../analysis-preparer.mjs';
import {createLocalDocumentFixture} from '../../document-application/local/fixture.mjs';
import {createDocumentApplication} from '../../document-application/index.mjs';
import {createPostgresArtifactService} from '../../../artifacts/postgres-service.mjs';
import {createPostgresAnalysisExecutor} from '../../../artifacts/postgres-analysis.mjs';
import {delivery} from './fixture.mjs';

const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const typed={operation:'run_analysis',format:'zip',title:'Client analysis',content:{
 tables:[{name:'data',columns:['program','amount'],rows:[['A',2],['B',5]]}],source:'data',
 steps:[{kind:'derive',name:'projected',left:'amount',operator:'multiply',right:3}]}};
const code=expected=>error=>error.code===expected;
async function setup(t){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation:'run_analysis'});
 t.after(async()=>{await f.close();assert.deepEqual(f.stats().cleanup,{executorDirectoriesAbsent:true,storeRemoved:true});});
 const options=f.artifactOptions,binding=options.context.binding,descriptor=options.descriptor;
 const owner=createPostgresArtifactService(options),writes={execute:(call,signal)=>owner.execute(call,f.credential,signal)};
 const context=v.context({...options.context,deadlineMs:f.now()+5000,analysisAdmission:{receiptSha256:'2'.repeat(64),manifestSha256:'3'.repeat(64),imageDigest:'sha256:'+'4'.repeat(64)}});
 const object=(digit='1',scopes=context.scopes)=>({objectId:randomUUID(),versionId:'immutable-'+digit,sha256:digit.repeat(64),bytes:16,scopes});
 const request={operation:'run_analysis',format:'sandbox',title:'Admitted analysis',content:{program:object(),inputs:[object('2')],outputs:['facts.json']}};
 const state={admissions:0,dispatches:0,allowed:true,proofHook:null,portHook:null};
 const analysis=createPostgresAnalysisExecutor({pool:options.pool,allocationJson:options.allocationJson,
  producerContext:options.producerContext,descriptor,context,validators:v,authority:options.authority,
  verifyAdmission:async value=>{state.admissions++;const proof={allowed:state.allowed,intentSha256:value.intentSha256,...value.admission,expiresAtMs:context.deadlineMs};await state.proofHook?.(proof);return proof;},
  port:{async execute(value){state.dispatches++;const result={intentSha256:value.intentSha256,admissionReceiptSha256:value.admission.receiptSha256,
   manifestSha256:value.admission.manifestSha256,imageDigest:value.admission.imageDigest,outputs:[{name:'facts.json',object:object('3')}]};
   await state.portHook?.(result,value);return result;}},now:f.now,newReservationId:randomUUID,limits:options.limits,sourceEnabled:true});
 const sandbox={context,executor:{execute:(call,signal)=>analysis.execute(call,f.credential,signal)}};
 const factory=changes=>createAnalysisIntentPreparer({binding,descriptor,artifact:{context:options.context,writes},sandbox,...changes});
 const post=async(route,body)=>{const session=await f.sessions.issue({identityCredential:f.nativeCredential});
  const app=createDocumentApplication({sessions:f.sessions,selectedClientId:f.selectedClientId,artifactOptions:options,credential:f.credential,now:f.now,limits:f.limits,enabled:true});
  return app.handle(new Request(`https://synthetic.invalid/api/documents/${route}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.credential}`},body:JSON.stringify(body)}));};
 return {f,options,binding,descriptor,context,request,state,factory,sandbox,object,writes,post};
}

test('typed analysis prepares an actual ZIP draft with computed JSON/CSV and canonical replay',async t=>{
 const x=await setup(t),p=x.factory(),call={arguments:typed,deliveryId:delivery(1)},out=await p.prepare(call);
 assert.equal(p.owner,'artifact');assert.deepEqual(p.formats,['zip','sandbox']);assert.equal(out.status,'draft');
 assert.equal(out.version.mimeType,'application/zip');assert.equal(out.version.previewStatus,'pending');
 const bytes=await x.options.objects.get(out.version.object),zip=await JSZip.loadAsync(bytes);
 const result=JSON.parse(await zip.file('result.json').async('string'));
 assert.deepEqual(result.columns,['program','amount','projected']);assert.deepEqual(result.data,[['A',2,6],['B',5,15]]);
 assert.equal(result.semantics.codeExecution,false);assert.match(await zip.file('result.csv').async('string'),/B,5,15\.0/);
 const replay=await p.prepare(call);assert.deepEqual(replay,out);assert.equal(x.f.stats().generations,1);assert.equal(x.f.stats().versionCharges,1);
 const record=await x.options.versions.read(out.version.versionId);assert.equal(record.inspection.nativeOpened,false);assert.equal(record.inspection.rendered,false);
 await assert.rejects(p.prepare({...call,arguments:{...typed,title:'Changed'}}),code('UNKNOWN'));
 assert.equal(x.f.stats().generations,1);
});

test('typed ZIP HTTP admission creates/reads exact immutable bytes and never admits a sandbox request',async t=>{
 const x=await setup(t),first=await x.post('create',{deliveryId:'zip-http',request:typed});assert.equal(first.status,200);const out=await first.json();
 const repeated=await x.post('create',{deliveryId:'zip-http',request:typed});assert.equal(repeated.status,200);assert.deepEqual((await repeated.json()).version,out.version);
 const bytes=await x.post('download',{versionId:out.version.versionId});assert.equal(bytes.status,200);assert.equal(bytes.headers.get('content-type'),'application/zip');
 assert.equal((await x.post('create',{deliveryId:'sandbox-not-http',request:x.request})).status,400);
 assert.equal(x.state.dispatches,0);assert.equal(x.f.stats().generations,1);assert.equal(x.f.stats().versionCharges,1);
});

test('HTTP-bound ZIP port needs no guessed context and still rejects wrong-run or mismatched file receipts',async t=>{
 const x=await setup(t),p=x.factory({artifact:{writes:x.writes},sandbox:undefined});
 assert.deepEqual(p.formats,['zip']);const result=await p.prepare({arguments:typed,deliveryId:delivery(2)});assert.equal(result.status,'draft');
 const full=await x.writes.execute({deliveryId:delivery(2),request:typed,baseVersionId:null});
 for(const mutate of [r=>{r.version.binding.writerFence++;},r=>{r.version.mimeType='text/plain; charset=utf-8';},r=>{r.inspection.sha256='0'.repeat(64);},r=>{r.version.object.scopes=[];}]){
  const invalid=structuredClone(full);mutate(invalid);
  const bad=x.factory({artifact:{writes:{async execute(){return invalid;}}},sandbox:undefined});
  await assert.rejects(bad.prepare({arguments:typed,deliveryId:delivery(3)}),error=>error.code==='INVALID_RESULT'&&error.effect==='unknown');
 }
});

test('admitted sandbox preparation returns exact pending references without fabricating an ArtifactVersion',async t=>{
 const x=await setup(t),p=x.factory(),call={arguments:x.request,deliveryId:delivery(10)},out=await p.prepare(call);
 assert.equal(out.status,'analysis_pending');assert.deepEqual(out.binding,x.binding);assert.deepEqual(out.scopes,x.context.scopes);
 assert.equal(out.result.inspectionStatus,'pending');assert.equal(out.result.publicationStatus,'pending');assert.equal(Object.hasOwn(out,'version'),false);
 assert.equal(out.result.imageDigest,x.context.analysisAdmission.imageDigest);assert.equal(out.result.outputs[0].name,'facts.json');
 assert.equal(x.state.dispatches,1);assert.equal(x.state.admissions,1);assert.equal(x.f.stats().settled,1);assert.equal(x.f.stats().generations,0);
 await assert.rejects(p.prepare(call),code('UNKNOWN'));assert.equal(x.state.dispatches,1);
});

test('model authority/code, foreign program scopes and missing native binding refuse before effects',async t=>{
 const x=await setup(t),p=x.factory();
 for(const [n,request] of [{...typed,analysisAdmission:x.context.analysisAdmission},{...x.request,content:{...x.request.content,code:'print(1)'}},
  {...x.request,content:{...x.request.content,program:x.object('4',[{...x.context.scopes[0],resourceId:randomUUID()}])}}].entries())
  await assert.rejects(p.prepare({arguments:request,deliveryId:delivery(20+n)}),error=>error.code==='INVALID_ARGUMENTS'&&error.effect==='none');
 const zipOnly=x.factory({sandbox:undefined});
 await assert.rejects(zipOnly.prepare({arguments:x.request,deliveryId:delivery(25)}),error=>error.code==='UNAVAILABLE'&&error.effect==='none');
 assert.throws(()=>x.factory({artifact:undefined,sandbox:undefined}),code('INTENT_CONFIGURATION'));
 assert.throws(()=>x.factory({sandbox:{executor:x.sandbox.executor,context:x.options.context}}),code('INTENT_CONFIGURATION'));
 const abort=new AbortController();abort.abort();await assert.rejects(p.prepare({arguments:typed,deliveryId:delivery(26),signal:abort.signal}),code('CANCELLED'));
 assert.equal(x.f.stats().versionCharges,0);assert.equal(x.state.admissions,0);assert.equal(x.state.dispatches,0);assert.equal(x.f.stats().generations,0);
});

test('sandbox denied admission, wrong outputs and revocation retain uncertainty without retry or fake publication',async t=>{
 for(const mode of ['admission','output','revocation']){
  const x=await setup(t),p=x.factory();
  if(mode==='admission')x.state.allowed=false;
  if(mode==='output')x.state.portHook=result=>{result.outputs[0].object.scopes=[{...x.context.scopes[0],resourceId:randomUUID()}];};
  if(mode==='revocation')x.f.revoke();
  const call={arguments:x.request,deliveryId:delivery(30)};
  await assert.rejects(p.prepare(call),code('UNKNOWN'));await assert.rejects(p.prepare(call),code('UNKNOWN'));
  assert.equal(x.state.dispatches,mode==='output'?1:0);assert.equal(x.f.stats().settled,0);
  assert.equal(x.f.stats().unknown,mode==='revocation'?0:1);
 }
});

test('cancellation during sandbox dispatch cannot publish or dispatch that delivery a second time',async t=>{
 const x=await setup(t),p=x.factory(),entered=Promise.withResolvers(),release=Promise.withResolvers(),abort=new AbortController();
 x.state.portHook=async()=>{entered.resolve();await release.promise;};
 const call={arguments:x.request,deliveryId:delivery(40)},running=p.prepare({...call,signal:abort.signal});
 await Promise.race([entered.promise,running.then(()=>assert.fail('Sandbox completed before cancellation'))]);abort.abort();
 try{await assert.rejects(running,error=>error.code==='UNKNOWN'&&error.effect==='unknown');}
 finally{release.resolve();await new Promise(resolve=>setImmediate(resolve));}
 await assert.rejects(p.prepare(call),code('UNKNOWN'));assert.equal(x.state.dispatches,1);assert.equal(x.f.stats().settled,0);assert.equal(x.f.stats().unknown,1);
});

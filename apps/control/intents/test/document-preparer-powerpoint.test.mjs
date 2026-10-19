/** Real fixed PPTX generation/immutable storage and canonical accounting; synthetic
 * local authority and SQL protocol only. No Office render or deployment proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLocalDocumentFixture} from '../../document-application/local/fixture.mjs';
import {createDocumentApplication} from '../../document-application/index.mjs';
import {createPostgresArtifactService} from '../../../artifacts/postgres-service.mjs';
import {createDocumentIntentPreparer} from '../document-preparer.mjs';
import {mount,delivery,id} from './fixture.mjs';

const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const pptxModulePath=process.env.MERI_PPTXGENJS??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs';
const operation={id:'create_powerpoint',version:'0.2.0'};
const spec={operation:operation.id,format:'pptx',title:'Client strategy',content:{slides:[
 {title:'Priorities',bullets:['Review the current evidence','Confirm client timing'],notes:'Draft for review'},
 {title:'Funding comparison',table:[['Program','Amount'],['Synthetic A','12']]}]}};
const code=expected=>error=>error.code===expected;
async function setup(t){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation:operation.id,pptxModulePath});
 t.after(async()=>{await f.close();assert.deepEqual(f.stats().cleanup,{executorDirectoriesAbsent:true,storeRemoved:true});});
 const owner=createPostgresArtifactService(f.artifactOptions),writes={execute:(call,signal)=>owner.execute(call,f.credential,signal)};
 const binding=f.artifactOptions.context.binding,preparer=createDocumentIntentPreparer({descriptor:f.artifactOptions.descriptor,binding,writes});
 const m=mount({binding,preparers:[preparer],now:f.now,scopes:f.artifactOptions.context.scopes});
 const app=createDocumentApplication({sessions:f.sessions,selectedClientId:f.selectedClientId,artifactOptions:f.artifactOptions,
  credential:f.credential,now:f.now,limits:f.limits,enabled:true});
 const session=await f.sessions.issue({identityCredential:f.nativeCredential});
 const post=(route,body)=>app.handle(new Request(`https://synthetic.invalid/api/documents/${route}`,{method:'POST',
  headers:{'content-type':'application/json',authorization:`Bearer ${session.credential}`},body:JSON.stringify(body)}));
 return {f,writes,preparer,...m,post,binding};
}

test('PowerPoint conversational preparation creates one immutable draft and recovery never regenerates',async t=>{
 const x=await setup(t),call={operation,arguments:spec,deliveryId:delivery(1)};
 const result=await x.mount.prepare(call);
 assert.equal(result.status,'draft');assert.equal(result.version.filename,'Client strategy.pptx');
 assert.equal(result.version.generationStatus,'draft');assert.equal(result.version.previewStatus,'pending');
 assert.deepEqual(await x.mount.prepare(call),result);
 // This bypasses only the intent replay cache, exercising the artifact owner's
 // existing exact-version recovery with the newly admitted PPTX operation.
 const recovered=await x.writes.execute({deliveryId:call.deliveryId,request:spec,baseVersionId:null});
 assert.deepEqual(recovered.version,result.version);assert.equal(recovered.execution.nativeQualified,false);
 assert.equal(recovered.inspection.nativeOpened,false);assert.equal(recovered.inspection.rendered,false);
 assert.equal(recovered.inspection.recalculated,false);assert.equal(recovered.inspection.details.slides,2);
 assert.equal(x.f.stats().generations,1);assert.equal(x.f.stats().versionCharges,1);
 await assert.rejects(x.mount.prepare({...call,arguments:{...spec,title:'Changed'}}),code('CONFLICT'));
 for(const route of ['inspect','download']){
  const response=await x.post(route,{versionId:result.version.versionId});assert.equal(response.status,200);
  if(route==='inspect')assert.equal((await response.json()).inspection.currentBytesVerified,true);
  else{
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');
   assert.equal(createHash('sha256').update(bytes).digest('hex'),result.version.object.sha256);
   assert.equal(response.headers.get('content-type'),'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  }
 }
 assert.equal(x.f.stats().versionCharges,1);
});

test('PowerPoint typed revisions preserve the original immutable version and exact parent',async t=>{
 const x=await setup(t),firstResponse=await x.post('create',{deliveryId:'pptx-first',request:spec});
 assert.equal(firstResponse.status,200);const first=await firstResponse.json();
 const changed=structuredClone(spec);changed.content.slides[0].bullets.push('Revised item');
 const response=await x.post('revise',{deliveryId:'pptx-revision',baseVersionId:first.version.versionId,request:changed});
 assert.equal(response.status,200);const second=await response.json();
 assert.equal(second.version.parentVersionId,first.version.versionId);
 assert.equal(second.version.artifactId,first.version.artifactId);
 assert.notEqual(second.version.object.sha256,first.version.object.sha256);
 assert.equal(x.f.stats().generations,2);assert.equal(x.f.stats().versionCharges,2);
 const original=await x.post('download',{versionId:first.version.versionId});
 assert.equal(createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex'),first.version.object.sha256);
 x.f.revoke();assert.equal((await x.post('download',{versionId:second.version.versionId})).status,403);
 assert.equal(x.f.stats().generations,2);
});

test('PowerPoint authority injection, wrong operation and pre-cancelled preparation have no owner effect',async t=>{
 const x=await setup(t);
 for(const [n,args] of [{...spec,context:{binding:x.binding}},{...spec,operation:'create_word'},{...spec,format:'zip'},
  {...spec,content:{slides:[{title:'URL injection',image:{url:'https://source.invalid/image.png'}}]}}].entries())
  await assert.rejects(x.mount.prepare({operation,arguments:args,deliveryId:delivery(10+n)}),code('INVALID_ARGUMENTS'));
 const controller=new AbortController();controller.abort();
 await assert.rejects(x.preparer.prepare({arguments:spec,deliveryId:delivery(20),signal:controller.signal}),code('CANCELLED'));
 assert.equal(x.f.stats().generations,0);assert.equal(x.f.stats().versionCharges,0);
});

test('document port getters/proxies and cross-run returned drafts cannot create preparation authority',async t=>{
 const x=await setup(t),created=await x.writes.execute({deliveryId:delivery(30),request:spec,baseVersionId:null});let touched=0;
 const writes={};Object.defineProperty(writes,'execute',{enumerable:true,get(){touched++;return ()=>created;}});
 assert.throws(()=>createDocumentIntentPreparer({descriptor:x.f.artifactOptions.descriptor,binding:x.binding,writes}),code('INTENT_CONFIGURATION'));
 assert.throws(()=>createDocumentIntentPreparer({descriptor:x.f.artifactOptions.descriptor,binding:x.binding,writes:new Proxy({execute(){}},{ownKeys(){touched++;return [];}})}),code('INTENT_CONFIGURATION'));
 assert.equal(touched,0);
 const foreign=structuredClone(created);foreign.version.binding.workerId=id(99);
 const p=createDocumentIntentPreparer({descriptor:x.f.artifactOptions.descriptor,binding:x.binding,writes:{async execute(){return foreign;}}});
 await assert.rejects(p.prepare({arguments:spec,deliveryId:delivery(31)}),error=>error.code==='INVALID_RESULT'&&error.effect==='unknown');
});

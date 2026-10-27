/** Actual public/runtime/document routes over synthetic source storage. No renderer/native/DB qualification. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';import {realPdf} from '../../../artifacts/test/pdf-fixtures.mjs';
import {id} from '../../../artifacts/storage/test/sql-fixture.mjs';import {createLocalDocumentPorts} from '../local/ports.mjs';
import {createRuntimeArtifactApplication} from '../../../runtime/artifacts/application.mjs';import {createRuntimeDocumentOptionsComposer} from '../../../runtime/artifacts/composition.mjs';
import {createControlRouteApplications} from '../../../runtime/control-route-boundary.mjs';import * as access from '../../../../packages/contracts/dist/document-access-application.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const utf8=x=>new TextEncoder().encode(JSON.stringify(x));
async function fixture(t){
 const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1},clientId=id(106),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'policy1'}];
 const f=nativeDocumentFixture({binding,scopes}),bytes=realPdf(['Synthetic retained PDF']),request={operation:'create_word',format:'pdf',title:'Retained',content:{blocks:[{kind:'paragraph',runs:[{text:'Retained'}]}]}};
 const executor={async execute(call){f.state.executions.push(call);return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'pdf',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{conversionCompleted:true,renderInspection:'pending',sourceDocxSha256:'a'.repeat(64)}}};}};
 const source=await f.owner({executor}).execute({...f.call,request}),state={closed:false,revoked:false,artifactChecks:0},now=Date.now,deadlineMs=now()+25000;
 const ports=createLocalDocumentPorts({binding,scopes,clientId,deadlineMs,now,state});t.after(()=>ports.sessions.close());
 let claim=null,record=null,writes=0,denyRelease=false;const physical=new Map();
 const objects={async put(value){writes++;const object={objectId:value.objectId,versionId:'synthetic-preview-object',sha256:sha(value.bytes),bytes:value.bytes.length,scopes:value.scopes};physical.set(object.objectId,Buffer.from(value.bytes));return object;},async get(object,signal){return physical.has(object.objectId)?physical.get(object.objectId):f.options.objects.get(object,signal);}};
 const previews={async read(){return record;},async claim(value){if(claim)return {claimed:false,claim};claim=structuredClone(value);return {claimed:true,claim};},async recordObject(){},async assertCurrent(){},async commit(value){record=structuredClone(value);return {status:'committed',versionId:value.versionId,recordSha256:v.hash(value)};}};
 const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},compose=createRuntimeDocumentOptionsComposer({storage:{objects,versions:f.options.versions},executor,pool:{},store:{lifecycle:{readArtifactFile:async()=>null}},sessions:ports.sessions,now,previews});
 const owner={async resolve(){return {documentOptions:compose({artifactOptions:{...f.options,context:{...f.options.context,deadlineMs},objects,now,authorize:ports.authorize,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},selectedClientId:clientId,limits,enabled:true}),async recheck(check){if(denyRelease&&check.phase==='release')throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};}};
 const runtime=createRuntimeArtifactApplication({sessions:ports.sessions,optionsOwner:owner,now,limits}),listeners=createControlRouteApplications({assembly:runtime,candidate:{async handle(){return null;}}}),session=await ports.sessions.issue({identityCredential:ports.nativeCredential});
 const make=(route,body={versionId:source.version.versionId})=>new Request('https://meri.synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body)});
 return {source,state,post:(route,body)=>listeners.public.handle(make(route,body)),privatePost:route=>listeners.private.handle(make(route)),deny:()=>{denyRelease=true;},writes:()=>writes,f};
}
test('public PDF preview is explicit, reads without PDF-generation admission, and its real headers enter the public receiver',async t=>{
 const x=await fixture(t),versionId=x.source.version.versionId,request=access.receiveDocumentRequest('inspect',utf8({versionId}));
 const inspected=await x.post('inspect');assert.equal(inspected.status,200,await inspected.clone().text());const {version}=await access.receiveDocumentResponse('inspect',200,new Uint8Array(await inspected.arrayBuffer()),request);
 const pending=await x.post('preview');assert.equal(pending.status,409);assert.equal(x.writes(),0);
 const publishRequest=access.receiveDocumentPreviewRequest('publish',utf8({versionId})),published=await x.post('preview-publish');assert.equal(published.status,200,await published.clone().text());
 const receipt=access.receiveDocumentPreviewPublication(200,new Uint8Array(await published.arrayBuffer()),publishRequest,version);assert.equal(receipt.preview.conversion.method,'source-pdf');assert.equal(x.writes(),1);
 const result=await access.receiveDocumentPreview(await x.post('preview'),version);assert.equal(sha(result.bytes),version.object.sha256);assert.equal(result.preview.recordSha256,v.hash(receipt.preview));
 assert.equal((await x.post('preview-publish')).status,200);assert.equal(x.writes(),1);assert.equal(x.f.state.executions.length,1);assert.equal(version.previewStatus,'pending');
 assert.equal((await x.privatePost('preview')).status,404);
});
test('public preview rejects caller-supplied stores and withholds after release revocation',async t=>{
 const x=await fixture(t);assert.equal((await x.post('preview',{versionId:x.source.version.versionId,renderer:{}})).status,400);
 assert.equal((await x.post('preview-publish')).status,200);x.deny();const result=await x.post('preview');assert.equal(result.status,403);assert.equal((await result.json()).error.outcome,'RESULT_NOT_RELEASED');assert.equal(x.writes(),1);
});

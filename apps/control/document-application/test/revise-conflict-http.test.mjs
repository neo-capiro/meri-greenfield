/** Real route/session/service/publication owners over scripted storage: definite revision and admission refusals over HTTP. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createDocumentApplication} from '../index.mjs';import {createLocalDocumentPorts} from '../local/ports.mjs';
import {nativeDocumentFixture} from '../../../artifacts/test/native-document-fixture.mjs';
import {NOW,id} from '../../../artifacts/storage/test/sql-fixture.mjs';
const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1},clientId=id(106),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'policy1'}];
async function fixture(t){
 const f=nativeDocumentFixture({binding,scopes}),first=await f.run(),second=await f.run({...f.call,deliveryId:'second',baseVersionId:first.version.versionId,request:{...f.call.request,content:{text:'Second\n'}}});
 const state={closed:false,revoked:false,artifactChecks:0},now=()=>NOW,ports=createLocalDocumentPorts({binding,scopes,clientId,deadlineMs:NOW+25000,now,state});t.after(()=>ports.sessions.close());
 const artifactOptions={...f.options,authorize:ports.authorize,now,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})};
 const app=createDocumentApplication({sessions:ports.sessions,selectedClientId:clientId,artifactOptions,now,limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},enabled:true});
 const session=await ports.sessions.issue({identityCredential:ports.nativeCredential});
 const post=(route,body)=>app.handle(new Request('https://meri.synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {f,first,second,post};
}
test('a revision of a superseded parent is a definite 409 over HTTP: nothing generated, FAILED delivery, same answer on replay, head still revisable',async t=>{
 const x=await fixture(t),request={...x.f.call.request,content:{text:'Stale\n'}},executions=x.f.state.executions.length,puts=x.f.state.puts;
 const stale=await x.post('revise',{deliveryId:'stale',baseVersionId:x.first.version.versionId,request});
 assert.equal(stale.status,409,await stale.clone().text());assert.deepEqual((await stale.json()).error,{code:'ARTIFACT_STALE_PARENT',outcome:'NOT_DISPATCHED'});
 assert.equal(x.f.state.executions.length,executions);assert.equal(x.f.state.puts,puts);assert.equal(x.f.sql.state.versions.size,2);
 const replay=await x.post('revise',{deliveryId:'stale',baseVersionId:x.first.version.versionId,request});
 assert.equal(replay.status,409);assert.deepEqual((await replay.json()).error,{code:'CONFLICT',outcome:'NOT_DISPATCHED'});assert.equal(x.f.state.executions.length,executions);
 const current=await x.post('revise',{deliveryId:'current',baseVersionId:x.second.version.versionId,request});
 assert.equal(current.status,200,await current.clone().text());assert.equal((await current.json()).version.parentVersionId,x.second.version.versionId);
});
test('PDF without a qualified renderer is refused as an unsupported format before any effect',async t=>{
 const x=await fixture(t),executions=x.f.state.executions.length;
 const refused=await x.post('create',{deliveryId:'pdf',request:{operation:'create_word',format:'pdf',title:'Unadmitted',content:{blocks:[{kind:'paragraph',runs:[{text:'Draft'}]}]}}});
 assert.equal(refused.status,422);assert.deepEqual((await refused.json()).error,{code:'UNSUPPORTED_DOCUMENT_FORMAT',outcome:'NOT_DISPATCHED'});
 assert.equal(x.f.state.executions.length,executions);assert.equal(x.f.state.rows.size,2,'no delivery is claimed for an unadmitted format');
});

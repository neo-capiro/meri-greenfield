import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {productControlFixture} from './test/control-fixture.mjs';
import {NOW} from '../../gateway/budget/product-scripted-fixture.mjs';
import {compileNativeTaskRequest} from '../../runtime/native-authority/task-request.mjs';
import {compilePreparedRunConfigurationSha256} from '../../runtime/prepared-run-configuration.mjs';
import {storeFixture,id} from '../../control/conversations/test/store-fixture.mjs';
import {applicationAuthorityRoutes} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {createProductOwnerNativeCurrentness} from './owner-native-currentness.mjs';

const bytes=Buffer.from('synthetic-existing-native-session\n'),fileSha=createHash('sha256').update(bytes).digest('hex');
const refused=/PRODUCT_OWNER_NATIVE_UNAVAILABLE/;
function fixture({dynamic=false}={}){
 const source=productControlFixture(),db=storeFixture(),c=source.configuration,n=c.nativeCandidate;
 const binding=dynamic?{...source.binding,writerFence:1}:n.runtime.binding,
  scope={kind:'client',tenantId:binding.tenantId,resourceId:source.clientId,policyRevision:n.qualification.policyRevision},at=NOW,
  f={configuration:c,binding,scopes:[scope],now:at},createdAt=new Date(at).toISOString(),principal={tenantId:binding.tenantId,actorId:binding.actorId};
 const run={binding,state:'running',scopes:[scope],policyRevision:scope.policyRevision,versions:c.versions,createdAt};
 const request={requestId:id(900),prompt:'synthetic initial prompt',skill:null,window:null};
 const row={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,projection:run,projection_sha256:hash(run),request_id:request.requestId,request,request_sha256:hash(request),last_sequence:1,sequence_base:0,sequence_end:null};
 db.state.runs.set([binding.tenantId,binding.conversationId,binding.runId].join(':'),row);
 const event={contractVersion:'0.1.0',eventId:id(901),binding,sequence:1,createdAt,scopes:run.scopes,type:'run.status',data:{state:'running',reasonCode:null}};
 db.state.events.set([binding.tenantId,binding.conversationId,binding.runId].join(':'),[{sequence:1,event_id:event.eventId,event,event_sha256:hash(event)}]);
 const original={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'d'.repeat(64),expiresAtMs:at+5000,versions:c.versions},
  grantIntents=n.grantIntents.map(g=>({...g,expiresAtMs:original.expiresAtMs})),
  resource={taskArn:source.qualification.workerArn,createdAtMs:at,clusterArn:n.taskRequest.cluster,taskDefinitionArn:n.taskRequest.taskDefinition,containerName:n.containerName},
  allocationSha256=hash(JSON.parse(n.allocationJson));
 resource.grantFactsJsons=grantIntents.map(g=>JSON.stringify({grantId:g.grantId,binding,qualificationBinding:{runId:binding.runId,attempt:n.qualification.attempt,workerArn:resource.taskArn,fence:binding.writerFence,policyRevision:scope.policyRevision},capabilitySha256:g.capabilitySha256,allocationSha256}));
 const record={binding,allocationKey:hash(binding),original,allocationSha256,qualification:n.qualification,grantIntents,
  taskRequestSha256:compileNativeTaskRequest({original,taskRequest:n.taskRequest,containerName:n.containerName}).taskRequestSha256,expiresAtMs:original.expiresAtMs,state:'ADMITTED',resource};
 db.state.allocations.set([binding.tenantId,binding.conversationId,binding.runId].join(':'),{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,intent_key:record.allocationKey,record,record_sha256:hash(record)});
 let admission={schemaVersion:1,state:'ADMITTED',binding,selectedClientId:source.clientId,policyRevision:scope.policyRevision,versions:c.versions,
  configurationSha256:compilePreparedRunConfigurationSha256(c),expiresAtMs:original.expiresAtMs,createdAtMs:at-1};
 const pool={async connect(){const client=await db.pool.connect();return {async query(sql,p){
  if(sql.startsWith('BEGIN ISOLATION'))return client.query('BEGIN');
  if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings'))return {rows:admission?[{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:admission.binding.runId,record:admission,record_sha256:hash(admission)}]:[]};
  return client.query(sql,p);
 },release:e=>client.release(e)};}};
 const state={reads:0,fetches:[],change:r=>r,material:()=>Buffer.from(bytes),pending:null};
 const options={configuration:c,pool,credentialFileSha256:fileSha,now:()=>at,limits:{maxRequestMs:1000,maxFactBytes:131072},enabled:true,
  fetchImpl:async(url,init)=>{state.fetches.push({url,init});const body=JSON.parse(init.body),identity={principal,identityRevision:'native-revision',checkedAtMs:at,expiresAtMs:at+5000};
   return state.response?.()??Response.json(state.change(url.endsWith(applicationAuthorityRoutes.identity)?identity:{identitySha256:body.identitySha256,principal,identityRevision:identity.identityRevision,conversationId:body.conversationId,selectedClientId:body.clientId,contextRevision:'native-context',checkedAtMs:at,expiresAtMs:at+5000}));}};
 const make=(extra={})=>createProductOwnerNativeCurrentness({...options,...extra},{readMaterial:async path=>{state.reads++;assert.equal(path,n.identity.credentialFile);return state.material();}});
 return {f,db,row,state,options,make,admission,record,setAdmission:value=>{admission=value;},call:()=>({binding,deadlineMs:at+900})};
}

test('source construction is inert and disabled default releases no native material',async()=>{
 const f=fixture(),owner=f.make({enabled:false});assert.equal(owner.available,false);
 await assert.rejects(owner.checkCurrentConversation(f.call()),refused);assert.equal(f.state.reads,0);assert.equal(f.db.state.calls.length,0);
});

test('real conversation owners plus private pinned file feed fresh Core identity/context without releasing credential',async()=>{
 const f=fixture(),owner=f.make(),first=await owner.checkCurrentConversation(f.call()),count=f.db.state.calls.length;
 assert.equal(first.binding.runId,f.f.binding.runId);assert.equal(first.selectedClientId,f.f.scopes[0].resourceId);
 assert.equal(f.state.reads,2);assert.deepEqual(f.state.fetches.map(x=>new URL(x.url).pathname),Object.values(applicationAuthorityRoutes));
 assert.ok(f.db.state.calls.some(x=>x.includes('FROM meri_conversations.next_runs')));
 assert.ok(f.state.fetches.every(x=>x.init.headers.authorization==='Bearer synthetic-existing-native-session'&&x.init.cache==='no-store'));
 assert.equal(JSON.stringify(first).includes('synthetic-existing-native-session'),false);
 await owner.checkCurrentConversation(f.call());assert.equal(f.state.reads,4);assert.ok(f.db.state.calls.length>count);
 owner.close();assert.equal(owner.available,false);await assert.rejects(owner.checkCurrentConversation(f.call()),refused);
});

test('credential rotation, foreign native actor/client, terminal run and latest-writer drift deny',async()=>{
 for(const change of [
  f=>{f.state.material=()=>Buffer.from('changed-native-session');},
  f=>{f.state.change=r=>({...r,principal:{...r.principal,actorId:'foreign'}});},
  f=>{f.state.change=r=>r.selectedClientId?{...r,selectedClientId:id(999)}:r;},
  f=>{f.row.projection.state='completed';f.row.projection_sha256=hash(f.row.projection);},
  f=>{const row=structuredClone(f.row);row.run_id=id(990);row.projection.binding={...row.projection.binding,runId:row.run_id,writerFence:2,attemptId:id(991),workerId:id(992)};row.projection_sha256=hash(row.projection);row.sequence_base=1;f.row.sequence_end=1;f.db.state.runs.set([row.tenant_id,row.conversation_id,row.run_id].join(':'),row);},
 ]){const f=fixture();change(f);await assert.rejects(f.make().checkCurrentConversation(f.call()),refused);}
});

test('foreign requested binding is denied before material or SQL; pending delivery quarantines the whole owner',async()=>{
 const f=fixture(),owner=f.make();await assert.rejects(owner.checkCurrentConversation({...f.call(),binding:{...f.f.binding,actorId:'foreign'}}),refused);assert.equal(f.state.reads,0);
 f.state.material=()=>new Promise(()=>{});
 await assert.rejects(owner.checkCurrentConversation(f.call()),refused);assert.equal(owner.available,false);
 const reads=f.state.reads;await assert.rejects(owner.checkCurrentConversation(f.call()),refused);assert.equal(f.state.reads,reads);
});

test('dynamic original uses canonical journal and exact config custody; config rollover and replaced original binding deny',async()=>{
 const f=fixture({dynamic:true});await f.make().checkCurrentConversation(f.call());
 for(const change of [x=>{x.admission.configurationSha256='f'.repeat(64);},x=>{x.admission.binding={...x.admission.binding,runId:id(998)};},x=>{x.options.configuration.nativeCandidate.taskRequest.networkConfiguration.awsvpcConfiguration.subnets=['subnet-ffffffff'];}]){
  const x=fixture({dynamic:true});change(x);await assert.rejects(x.make().checkCurrentConversation(x.call()),refused);
 }
});

test('a settled child denial with unretired native body quarantines every binding on the shared authority',async()=>{
 const f=fixture(),owner=f.make();f.state.response=()=>new Response(new ReadableStream({cancel(){throw Error('synthetic unresolved stop');}},{highWaterMark:0}),{status:503});
 await assert.rejects(owner.checkCurrentConversation(f.call()),refused);assert.equal(owner.available,false);
 const count=f.state.reads;await assert.rejects(owner.checkCurrentConversation({...f.call(),binding:{...f.f.binding,runId:id(997)}}),refused);
 assert.equal(f.state.reads,count,'another binding cannot reset the child quarantine');
 const replacement=f.make();assert.equal(replacement.available,false);
 await assert.rejects(replacement.checkCurrentConversation(f.call()),refused);assert.equal(f.state.reads,count,'new helpers cannot reset an uncertain pool authority');
});

/** C12: latest-generation admission fences both the kickoff and model-currentness boundaries.
 * Real journals/owners, scripted SQL only; no cloud, provider, credential file or native database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {initialInputFixture} from '../../control/conversations/test/initial-input-fixture.mjs';
import {id} from '../../control/conversations/test/store-fixture.mjs';
import {createPreparedRunRegistry} from '../prepared-run-registry.mjs';
import {createProductOwnerNativeCurrentness} from '../../proxy/product/owner-native-currentness.mjs';
import {productControlFixture} from '../../proxy/product/test/control-fixture.mjs';
import {compilePreparedRunConfigurationSha256} from '../prepared-run-configuration.mjs';
import {compileNativeTaskRequest} from '../native-authority/task-request.mjs';
import {applicationAuthorityRoutes} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {NOW} from '../../gateway/budget/product-scripted-fixture.mjs';

const check=()=>{},copy=value=>structuredClone(value),tuple=b=>[b.tenantId,b.conversationId,b.runId].join(':');
async function superseded(){
 const source=productControlFixture(),db=initialInputFixture(),configuration=source.configuration,n=configuration.nativeCandidate;
 // Honor the journal's ORDER BY and LIMIT, rather than hard-coding the expected generation in the SQL protocol fixture.
 const pool={async connect(){const c=await db.pool.connect();return {async query(sql,p=[]){
  const answer=await c.query(sql,p);
  if(!sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings'))return answer;
  let rows=db.bindings.filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]);
  if(sql.includes('ORDER BY generation'))rows=rows.toSorted((a,b)=>sql.includes('generation DESC')?b.generation-a.generation:a.generation-b.generation);
  if(sql.includes('LIMIT 1'))rows=rows.slice(0,1);return {rows:copy(rows),rowCount:rows.length};
 },release:reason=>c.release(reason)};}};
 const now=()=>NOW,journal=createInitialRunBindingJournal({pool,now});
 const proposal={principal:{tenantId:source.binding.tenantId,actorId:source.binding.actorId},conversationId:source.binding.conversationId,
  selectedClientId:source.clientId,policyRevision:n.qualification.policyRevision,versions:configuration.versions,
  configurationSha256:compilePreparedRunConfigurationSha256(configuration),proposedExpiresAtMs:NOW+60000};
 const old=(await journal.claim(proposal,check)).record;
 const current=(await journal.rebind({...proposal,configurationSha256:'e'.repeat(64)},check)).record;
 assert.notEqual(old.binding.runId,current.binding.runId,'a new original generation was admitted');
 assert.deepEqual(db.bindings.map(r=>r.generation),[1,2]);
 return {source,db,pool,configuration,n,now,journal,old,current};
}

test('superseded original kickoff is refused by the prepared registry before any run read or authority effect',async()=>{
 const f=await superseded(),effects=[];
 const blocked=async()=>{effects.push('authority');throw Error('unexpected authority effect');};
 const store=createPostgresConversationStore({pool:f.pool,now:f.now});
 const owner=createPreparedRunRegistry({initialBindings:f.journal,configurationSha256:f.old.configurationSha256,
  prepareInitial:blocked,retireInitial:blocked,issuance:{prepare:blocked,resolveFacts:blocked,resolveCapability:blocked},issuanceIntent:blocked,
  store,pool:f.pool,client:{send:blocked},identity:{origin:f.n.identity.origin,credential:'synthetic-native',commandContext:f.n.identity.commandContext,fetchImpl:blocked},
  controlCapability:'synthetic-control',objects:{},limits:{maxRequestMs:1000,maxFactBytes:131072},now:f.now,allocate:blocked});
 f.db.state.calls.length=0;
 try{
  const response=await owner.handle(new Request('https://control.synthetic.invalid/v1/execution/kickoff',{method:'POST',
   headers:{authorization:'Bearer synthetic-control','content-type':'application/json'},body:JSON.stringify({binding:f.old.binding,executionKey:hash(f.old.binding)})}));
  assert.equal(response?.status,403);assert.deepEqual(await response.json(),{error:{code:'PREPARED_RUN_REGISTRY_REFUSED'}});
  assert.ok(f.db.state.calls.some(sql=>sql.includes('initial_run_bindings')),'the real journal checked the durable admission');
  assert.equal(f.db.state.calls.some(sql=>sql.startsWith('SELECT * FROM meri_conversations.runs')),false,'stale admission is refused before run lookup');
  assert.deepEqual(effects,[]);assert.deepEqual(owner.entries(),[]);
 }finally{await owner.close();}
});

/** A stale owner's run/allocation snapshot must not overrule the current binding journal. These synthetic rows are deliberately
 * injected AFTER supersession: the normal accept path refuses this state; the independent model boundary must reject it too. */
function staleSnapshot(f){
 const b=f.old.binding,scopes=[{kind:'client',tenantId:b.tenantId,resourceId:f.source.clientId,policyRevision:f.old.policyRevision}],createdAt=new Date(NOW).toISOString();
 const run={binding:b,state:'running',scopes,policyRevision:f.old.policyRevision,versions:f.configuration.versions,createdAt};
 const request={requestId:id(900),prompt:'synthetic stale snapshot',skill:null,window:null};
 f.db.state.runs.set(tuple(b),{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,projection:run,projection_sha256:hash(run),
  request_id:request.requestId,request,request_sha256:hash(request),last_sequence:1,sequence_base:0,sequence_end:null});
 const event={contractVersion:'0.1.0',eventId:id(901),binding:b,sequence:1,createdAt,scopes,type:'run.status',data:{state:'running',reasonCode:null}};
 f.db.state.events.set(tuple(b),[{sequence:1,event_id:event.eventId,event,event_sha256:hash(event)}]);
 const original={binding:b,executionKey:hash(b),executionId:hash(b),planSha256:'d'.repeat(64),expiresAtMs:f.old.expiresAtMs,versions:f.old.versions};
 const grantIntents=f.n.grantIntents.map(g=>({...g,expiresAtMs:original.expiresAtMs})),allocationSha256=hash(JSON.parse(f.n.allocationJson));
 const resource={taskArn:f.source.qualification.workerArn,createdAtMs:NOW,clusterArn:f.n.taskRequest.cluster,taskDefinitionArn:f.n.taskRequest.taskDefinition,containerName:f.n.containerName};
 resource.grantFactsJsons=grantIntents.map(g=>JSON.stringify({grantId:g.grantId,binding:b,qualificationBinding:{runId:b.runId,attempt:f.n.qualification.attempt,
  workerArn:resource.taskArn,fence:b.writerFence,policyRevision:f.old.policyRevision},capabilitySha256:g.capabilitySha256,allocationSha256}));
 const record={binding:b,allocationKey:hash(b),original,allocationSha256,qualification:f.n.qualification,grantIntents,
  taskRequestSha256:compileNativeTaskRequest({original,taskRequest:f.n.taskRequest,containerName:f.n.containerName}).taskRequestSha256,
  expiresAtMs:original.expiresAtMs,state:'ADMITTED',resource};
 f.db.state.allocations.set(tuple(b),{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,intent_key:record.allocationKey,record,record_sha256:hash(record)});
}

test('proxy native-currentness refuses a superseded original even with a stale valid run and allocation snapshot',async()=>{
 const f=await superseded();staleSnapshot(f);const bytes=Buffer.from('synthetic-existing-native-session\n'),refusals=[],fetches=[];
 const principal={tenantId:f.old.binding.tenantId,actorId:f.old.binding.actorId};
 const owner=createProductOwnerNativeCurrentness({configuration:f.configuration,pool:f.pool,credentialFileSha256:createHash('sha256').update(bytes).digest('hex'),
  now:f.now,limits:{maxRequestMs:1000,maxFactBytes:131072},enabled:true,report:(_scope,step)=>refusals.push(step),
  fetchImpl:async(url,init)=>{fetches.push(url);const body=JSON.parse(init.body),identity={principal,identityRevision:'native-revision',checkedAtMs:NOW,expiresAtMs:NOW+5000};
   return Response.json(url.endsWith(applicationAuthorityRoutes.identity)?identity:{...identity,identitySha256:body.identitySha256,conversationId:body.conversationId,
    selectedClientId:body.clientId,contextRevision:'native-context'});}},
  {readMaterial:async()=>Buffer.from(bytes)});
 try{
  await assert.rejects(owner.checkCurrentConversation({binding:f.old.binding,deadlineMs:NOW+900}),/PRODUCT_OWNER_NATIVE_UNAVAILABLE/);
  assert.deepEqual(refusals,['initial-binding'],'the latest admission, not missing or corrupt run evidence, refused the request');
  assert.deepEqual(fetches.map(url=>new URL(url).pathname),[applicationAuthorityRoutes.identity],
   'identity is re-proven, but the superseded run never reaches the Core conversation-context call');
 }finally{owner.close();}
});

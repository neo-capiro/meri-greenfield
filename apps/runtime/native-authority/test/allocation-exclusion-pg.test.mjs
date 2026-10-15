/** Gap 5 invariant over real task-owned PostgreSQL: within one tenant and conversation no replacement allocation is claimed while the
 * predecessor is live or unresolved; retirement needs the physical-stop proof; grant revocation is verified by the next-run owner through
 * the real budget admission; exact replay never redispatches; a fork into its own conversation coexists. Synthetic: task ARNs, grant
 * digests, checkpoint bytes. No native process, image, provider or cloud resource. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {fixture} from './broker-pg-fixture.mjs';import {seedContinuation,pauseSource,continueFrom} from './lifecycle-seed.mjs';
import {createNextRunOwner} from '../../../control/conversations/next-run.mjs';
import {createNativeAllocationAdmission} from '../../../gateway/budget/native-allocation-admission.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
const check=()=>{};
const arn=()=>'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+randomUUID().replaceAll('-','');
function allocationIntent(binding,expiresAtMs,policyRevision,grantId=randomUUID()){const key=hash(binding);return {binding,allocationKey:key,original:{binding,executionKey:key,executionId:key,planSha256:'a'.repeat(64),expiresAtMs,versions},allocationSha256:'d'.repeat(64),qualification:{attempt:1,policyRevision},grantIntents:[{grantId,capabilitySha256:hash({grantId}),expiresAtMs}],taskRequestSha256:'c'.repeat(64),expiresAtMs};}
const resource=at=>({taskArn:arn(),clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker',createdAtMs:at});
async function conversation(t,f){
 const store=f.stack.store,saved=await f.stack.store.read(f.binding,{},check),scopes=saved.run.scopes,policyRevision=saved.run.policyRevision,createdAt=saved.run.createdAt;
 const source={...f.binding,conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 await store.accept({conversation:{conversationId:source.conversationId,owner:{tenantId:source.tenantId,actorId:source.actorId},scopes,createdAt,policyRevision},run:{...saved.run,binding:source,state:'queued'},request:{requestId:randomUUID(),prompt:'/status',skill:null,window:null,windowRequest:null},event:{contractVersion:'0.1.0',eventId:randomUUID(),binding:source,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}},check);
 const sourceSaved=await store.read(source,{},check);
 const checkpointFor=binding=>{const object={objectId:randomUUID(),versionId:'immutable-local-fixture-v1',sha256:'1'.repeat(64),bytes:10,scopes},workspace={contractVersion:'0.1.0',manifestId:randomUUID(),binding,logicalCwd:'/workspace/conversation',entries:[],scopes,createdAt};return {contractVersion:'0.1.0',checkpointId:randomUUID(),parentCheckpointId:null,binding,sessionId:randomUUID(),opaqueSession:object,workspace,workspaceSha256:hash(workspace),versions,lastEventSequence:1,scopes,createdAt,durableReceiptId:randomUUID()};};
 return {store,source,sourceSaved,scopes,policyRevision,createdAt,checkpointFor};
}
test('a replacement allocation in the same conversation is refused while the predecessor is live or unresolved, admitted only after a proven physical stop, replay never redispatches, and a fork elsewhere coexists',async t=>{
 const f=await fixture(t,{leaseMs:120000}),c=await conversation(t,f),{store,source,policyRevision}=c,at=Date.now(),expiresAtMs=f.expiry;
 // Canonical targets: a resume target in the same conversation (fence 2) and a fork target in its own conversation (fence 1).
 const target={...source,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2},forkTarget={...source,conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const first=allocationIntent(source,expiresAtMs,policyRevision),second=allocationIntent(target,expiresAtMs,policyRevision),forked=allocationIntent(forkTarget,expiresAtMs,policyRevision),key={binding:source,allocationKey:first.allocationKey};
 assert.equal((await store.allocations.claim(first,check)).dispatch,true,'the predecessor claims its allocation while queued');
 // One pause and checkpoint of the source run; the fork control runs first (the source stays paused), then the resume control retires it
 // and creates the same-conversation replacement target. The predecessor allocation is still CLAIMED: no physical stop has been proven.
 const paused=await pauseSource(store,source,c.sourceSaved,c.checkpointFor(source));
 await continueFrom(store,source,c.sourceSaved,paused,{mode:'fork',target:forkTarget,expiresAtMs});
 await continueFrom(store,source,c.sourceSaved,paused,{mode:'resume',target,expiresAtMs});
 const busy=async label=>{await assert.rejects(store.allocations.claim(second,check),/NATIVE_PREPARATION_CONVERSATION_BUSY/,label);assert.equal((await store.allocations.read({binding:target,allocationKey:second.allocationKey},check)).record,null,label+': no replacement row was written');};
 await busy('predecessor CLAIMED');
 const res=resource(at);await store.allocations.record({...key,state:'ALLOCATED',resource:res},check);await busy('predecessor ALLOCATED');
 const admitted={...res,grantFactsJsons:[JSON.stringify({grantId:first.grantIntents[0].grantId,binding:source,qualificationBinding:{runId:source.runId,attempt:1,workerArn:res.taskArn,fence:1,policyRevision},capabilitySha256:first.grantIntents[0].capabilitySha256,allocationSha256:first.allocationSha256})]};
 await store.allocations.record({...key,state:'ADMITTED',resource:admitted},check);await busy('predecessor ADMITTED');
 // A fork into its own conversation is not excluded by the live predecessor.
 assert.equal((await store.allocations.claim(forked,check)).dispatch,true,'fork target in another conversation claims while the predecessor is live');
 await store.allocations.record({...key,state:'UNKNOWN',resource:null},check);await busy('predecessor UNKNOWN');
 // Retirement acknowledgement without the physical-stop proof is refused by the record validator and keeps the exclusion.
 await assert.rejects(store.allocations.record({...key,state:'RETIRED',resource:{...admitted}},check),/NATIVE_PREPARATION_REFUSED/,'RETIRED without physicalStopProven is refused');await busy('retirement acknowledged without physical proof');
 // Exact replay of the predecessor's own claim never redispatches, whatever its state.
 assert.equal((await store.allocations.claim(first,check)).dispatch,false,'exact original replay');
 await store.allocations.record({...key,state:'RETIRED',resource:{...admitted,physicalStopProven:true}},check);
 assert.equal((await store.allocations.claim(second,check)).dispatch,true,'the replacement claims once the predecessor is RETIRED with its physical stop proven');
 assert.equal((await store.allocations.claim(first,check)).dispatch,false,'the retired predecessor still replays without redispatch');
 // A further same-conversation replacement cannot be created over the retired source (its sequence range is closed); if the lifecycle
 // journal ever admitted one, it would be excluded by the now-live replacement under the conversation lock.
 const third={...source,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:3};
 await continueFrom(store,source,c.sourceSaved,paused,{mode:'resume',target:third,expiresAtMs}).catch(error=>{assert.match(String(error?.code??error?.message),/RUN_RANGE_CLOSED|LIFECYCLE|STORE_CORRUPT|CHECKPOINT/,'a second resume continuation over the retired source is refused by the lifecycle journal or inserts a third target');});
 const thirdSaved=await store.read(third,{},check).catch(()=>null);
 if(thirdSaved){const results=await Promise.allSettled([store.allocations.claim(allocationIntent(third,expiresAtMs,policyRevision),check),store.allocations.claim(allocationIntent(third,expiresAtMs,policyRevision,randomUUID()),check)]);assert.ok(results.every(r=>r.status==='rejected'&&/CONVERSATION_BUSY|REPLAY_REFUSED/.test(String(r.reason?.code??r.reason?.message))),'no third allocation while the replacement is live: '+results.map(r=>r.status+':'+String(r.reason?.code??r.reason?.message??'')).join(','));}
 const rows=await f.pool.query('SELECT run_id,record->>\'state\' AS state FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY run_id',[source.tenantId,source.conversationId]);
 assert.deepEqual(new Map(rows.rows.map(r=>[r.run_id,r.state])),new Map([[source.runId,'RETIRED'],[target.runId,'CLAIMED']]));
});
test('a launched predecessor (launch claimed, STARTED, then resource UNKNOWN) excludes the same-conversation replacement until its physical stop is proven',async t=>{
 const f=await fixture(t,{leaseMs:120000}),c=await conversation(t,f),{store,source,policyRevision}=c,at=Date.now(),expiresAtMs=f.expiry;
 const target={...source,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2};
 const first=allocationIntent(source,expiresAtMs,policyRevision),second=allocationIntent(target,expiresAtMs,policyRevision),key={binding:source,allocationKey:first.allocationKey};
 // Launch preparation and consumption need the source run queued, starting or running; they precede the pause that creates the target.
 assert.equal((await store.allocations.claim(first,check)).dispatch,true);const res=resource(at);await store.allocations.record({...key,state:'ALLOCATED',resource:res},check);
 const admitted={...res,grantFactsJsons:[JSON.stringify({grantId:first.grantIntents[0].grantId,binding:source,qualificationBinding:{runId:source.runId,attempt:1,workerArn:res.taskArn,fence:1,policyRevision},capabilitySha256:first.grantIntents[0].capabilitySha256,allocationSha256:first.allocationSha256})]};
 await store.allocations.record({...key,state:'ADMITTED',resource:admitted},check);
 const pins={...key,preparationId:randomUUID(),descriptorSha256:'f'.repeat(64),configTreeSha256:'0'.repeat(64)};await store.allocations.prepareLaunch(pins,check);assert.equal((await store.allocations.consumeLaunch(pins,check)).dispatch,true,'the predecessor consumes its launch');
 const paused=await pauseSource(store,source,c.sourceSaved,c.checkpointFor(source));await continueFrom(store,source,c.sourceSaved,paused,{mode:'resume',target,expiresAtMs});
 const busy=async label=>{await assert.rejects(store.allocations.claim(second,check),/NATIVE_PREPARATION_CONVERSATION_BUSY/,label);assert.equal((await store.allocations.read({binding:target,allocationKey:second.allocationKey},check)).record,null,label+': no replacement row was written');};
 await busy('predecessor ADMITTED with its launch claimed');
 await store.allocations.recordLaunch({...pins,state:'STARTED'},check);await busy('predecessor launched (STARTED)');
 // The launch binding stays STARTED (its only transition); the resource-level UNKNOWN is the unresolved predecessor fact.
 await store.allocations.record({...key,state:'UNKNOWN',resource:null},check);await busy('predecessor resource UNKNOWN');
 const live=(await store.allocations.read(key,check)).record;
 await assert.rejects(store.allocations.record({...key,state:'RETIRED',resource:{...live.resource}},check),/NATIVE_PREPARATION_REFUSED/,'RETIRED without physicalStopProven is refused');await busy('retirement acknowledged without physical proof');
 await store.allocations.record({...key,state:'RETIRED',resource:{...live.resource,physicalStopProven:true}},check);
 assert.equal((await store.allocations.claim(second,check)).dispatch,true,'the replacement claims once the launched predecessor is RETIRED with its physical stop proven');
 assert.equal((await store.allocations.claim(first,check)).dispatch,false,'the retired predecessor replays without redispatch');
});
test('concurrent replacement claims after retirement admit exactly one under the conversation lock',async t=>{
 const f=await fixture(t,{leaseMs:120000}),c=await conversation(t,f),{store,source,policyRevision}=c,expiresAtMs=f.expiry,at=Date.now();
 const first=allocationIntent(source,expiresAtMs,policyRevision),key={binding:source,allocationKey:first.allocationKey};await store.allocations.claim(first,check);
 const res=resource(at);await store.allocations.record({...key,state:'ALLOCATED',resource:res},check);await store.allocations.record({...key,state:'RETIRED',resource:{...res,physicalStopProven:true}},check);
 const a={...source,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2},b={...source,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:3};
 const paused=await pauseSource(store,source,c.sourceSaved,c.checkpointFor(source));await continueFrom(store,source,c.sourceSaved,paused,{mode:'resume',target:a,expiresAtMs});
 const second=await continueFrom(store,source,c.sourceSaved,paused,{mode:'resume',target:b,expiresAtMs}).then(()=>true,()=>false);
 if(!second){t.diagnostic('the lifecycle journal admits one resume continuation per paused source; concurrency is exercised with the single target against its own replay');}
 const intents=[allocationIntent(a,expiresAtMs,policyRevision),second?allocationIntent(b,expiresAtMs,policyRevision):allocationIntent(a,expiresAtMs,policyRevision)];
 const results=await Promise.allSettled(intents.map(i=>store.allocations.claim(i,check)));
 const dispatched=results.filter(r=>r.status==='fulfilled'&&r.value.dispatch===true).length;
 assert.equal(dispatched,1,'exactly one replacement dispatches: '+results.map(r=>r.status==='fulfilled'?'dispatch='+r.value.dispatch:String(r.reason?.code??r.reason?.message)).join(','));
 if(second)assert.ok(results.some(r=>r.status==='rejected'&&/CONVERSATION_BUSY/.test(String(r.reason?.code??r.reason?.message))),'the loser is excluded by the winner');
});
test('physical stop without grant revocation is refused by the next-run owner; revocation through the real budget admission admits the reservation',async t=>{
 const f=await fixture(t,{leaseMs:120000}),store=f.stack.store,binding=f.binding,saved=await store.read(binding,{},check),scopes=saved.run.scopes,policyRevision=saved.run.policyRevision,clientId=scopes[0].resourceId,expiresAtMs=f.expiry,at=Date.now();
 const intent={binding,allocationKey:hash(binding),original:{binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs,versions},allocationSha256:f.facts.allocationSha256,qualification:{attempt:1,policyRevision},grantIntents:[{grantId:f.facts.grantId,capabilitySha256:f.facts.capabilitySha256,expiresAtMs}],taskRequestSha256:'c'.repeat(64),expiresAtMs},key={binding,allocationKey:intent.allocationKey};
 await store.allocations.claim(intent,check);const res={...resource(at),taskArn:f.facts.qualificationBinding.workerArn};await store.allocations.record({...key,state:'ALLOCATED',resource:res},check);
 const status=state=>({eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}});await store.append(binding,status('starting'),check);await store.append(binding,status('running'),check);
 // Completion through the canonical completion journal (synthetic bytes), then retirement with the physical-stop proof.
 const p=await store.completions.begin({binding,scopes,selectedClientId:clientId,completionId:randomUUID(),checkpointId:randomUUID()},check);
 const object={objectId:randomUUID(),versionId:'synthetic-immutable-v1',sha256:'1'.repeat(64),bytes:10,scopes},workspace={contractVersion:'0.1.0',manifestId:randomUUID(),binding,logicalCwd:'/workspace/conversation',entries:[],scopes,createdAt:new Date().toISOString()},checkpoint={contractVersion:'0.1.0',checkpointId:p.checkpointId,parentCheckpointId:null,binding,sessionId:randomUUID(),opaqueSession:object,workspace,workspaceSha256:hash(workspace),versions,lastEventSequence:p.captureSequence,scopes,createdAt:new Date().toISOString(),durableReceiptId:randomUUID()},proof={checkpoint,checkpointSha256:hash(checkpoint),sourceRequestSha256:p.sourceRequestSha256,contextSha256:p.contextSha256,resumeSessionAt:null,readReceiptId:randomUUID()};
 await store.completions.publish({binding,scopes,selectedClientId:clientId,completionId:p.completionId,proof,events:[{contractVersion:'0.1.0',eventId:p.verifiedEventId,createdAt:new Date().toISOString(),type:'checkpoint.verified',data:{checkpointId:p.checkpointId}},{contractVersion:'0.1.0',eventId:p.completedEventId,createdAt:new Date().toISOString(),type:'run.status',data:{state:'completed',reasonCode:null}}]},check);
 await store.allocations.record({...key,state:'RETIRED',resource:{...res,physicalStopProven:true}},check);
 const admission=createNativeAllocationAdmission({pool:f.pool,allocationJson:JSON.stringify(f.allocation),qualification:{attempt:1,policyRevision},grantIntents:intent.grantIntents,binding,now:Date.now,limits:{maxRequestMs:3000,maxFactBytes:131072}});
 const retirement={async verifyRetired({binding:b}){const r=(await store.allocations.read({binding:b,allocationKey:hash(b)},check)).record;return {physicalStopProven:r?.state==='RETIRED'&&r.resource?.physicalStopProven===true};}};
 // The revocation port reads the real budget grants of that run; it never revokes by itself.
 const revocation={async verifyRevoked({binding:b}){const grants=(await f.pool.query('SELECT grant_id,state FROM meri_product_budget.grants WHERE run_id=$1 ORDER BY grant_id',[b.runId])).rows;if(!grants.length||grants.some(g=>g.state!=='REVOKED'))throw Object.assign(Error('NEXT_RUN_REVOCATION_REQUIRED'),{code:'NEXT_RUN_REVOCATION_REQUIRED'});return {receiptSha256:hash({binding:b,grants}),grantIds:grants.map(g=>g.grant_id)};}};
 const owner=createNextRunOwner({store,retirement,revocation,versions}),principal={tenantId:binding.tenantId,actorId:binding.actorId};
 await assert.rejects(owner.selectRun({principal,conversationId:binding.conversationId}),/NEXT_RUN_REVOCATION_REQUIRED/,'physical stop alone does not admit a replacement');
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_conversations.next_runs WHERE tenant_id=$1',[binding.tenantId])).rows[0].n,0);
 const revoked=await admission.revoke({taskArn:res.taskArn});assert.equal(revoked.state,'REVOKED');assert.equal(revoked.revocationProven,true);
 const selected=await owner.selectRun({principal,conversationId:binding.conversationId});assert.equal(selected.reserved,true);assert.equal(selected.binding.writerFence,2);
 assert.deepEqual((await f.pool.query('SELECT state FROM meri_product_budget.grants WHERE run_id=$1',[binding.runId])).rows.map(r=>r.state),['REVOKED']);
});
test('two distinct target runs racing for the same conversation allocation in separate transactions behind a start barrier: exactly one claims, the other receives the busy outcome',async t=>{
 const f=await fixture(t,{leaseMs:120000}),c=await conversation(t,f),{store,source,policyRevision}=c,expiresAtMs=f.expiry,at=Date.now();
 // Predecessor: claimed, allocated, then retired with its physical stop proven, so the conversation is free for exactly one successor.
 const first=allocationIntent(source,expiresAtMs,policyRevision),key={binding:source,allocationKey:first.allocationKey};assert.equal((await store.allocations.claim(first,check)).dispatch,true);
 const res=resource(at);await store.allocations.record({...key,state:'ALLOCATED',resource:res},check);await store.allocations.record({...key,state:'RETIRED',resource:{...res,physicalStopProven:true}},check);
 // Target A is the canonical resume continuation (fence 2). The lifecycle and next-run journals admit one successor per source, so a
 // second queued run in the same conversation cannot be produced canonically; target B (fence 3) is inserted directly with a
 // hash-correct projection and request so that the allocation journal's own exclusion is what the race exercises.
 const a={...source,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2},b={...source,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:3};
 const paused=await pauseSource(store,source,c.sourceSaved,c.checkpointFor(source));await continueFrom(store,source,c.sourceSaved,paused,{mode:'resume',target:a,expiresAtMs});
 const savedA=await store.read(a,{},check),runB={...savedA.run,binding:b,state:'queued'},requestB={...savedA.request,requestId:randomUUID()},eventB={contractVersion:'0.1.0',eventId:randomUUID(),binding:b,sequence:1,createdAt:savedA.run.createdAt,scopes:savedA.run.scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
 const baseA=(await f.pool.query('SELECT sequence_base FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[a.tenantId,a.conversationId,a.runId])).rows[0].sequence_base;
 await f.pool.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sequence_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9)',[b.tenantId,b.conversationId,b.runId,runB,hash(runB),requestB.requestId,requestB,hash(requestB),baseA]);
 await f.pool.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,1,$4,$5,$6)',[b.tenantId,b.conversationId,b.runId,eventB.eventId,eventB,hash(eventB)]);
 assert.equal((await store.read(b,{},check)).run.state,'queued','target B is readable through the store as a queued run');
 // Start barrier at the pool: each claim obtains its own connection, and neither transaction begins until both hold one.
 const intentA=allocationIntent(a,expiresAtMs,policyRevision),intentB=allocationIntent(b,expiresAtMs,policyRevision),connect=f.pool.connect.bind(f.pool);
 let arrived=0,open;const barrier=new Promise(resolve=>{open=resolve;});const connections=[];
 f.pool.connect=async()=>{const client=await connect();connections.push(client.processID);if(++arrived===2)open();await barrier;return client;};
 let results;try{results=await Promise.allSettled([store.allocations.claim(intentA,check),store.allocations.claim(intentB,check)]);}finally{f.pool.connect=connect;}
 assert.equal(connections.length,2);assert.notEqual(connections[0],connections[1],'two distinct backend connections, so two separate transactions');
 const outcome=r=>r.status==='fulfilled'?'dispatch='+r.value.dispatch:String(r.reason?.code??r.reason?.message);
 const winners=results.filter(r=>r.status==='fulfilled'&&r.value.dispatch===true),losers=results.filter(r=>r.status==='rejected'&&/NATIVE_PREPARATION_CONVERSATION_BUSY/.test(String(r.reason?.code)));
 assert.equal(winners.length,1,'exactly one distinct target acquires a new claim: '+results.map(outcome).join(','));assert.equal(losers.length,1,'the other distinct target receives the documented busy outcome: '+results.map(outcome).join(','));
 const winner=results[0].status==='fulfilled'?a:b,loser=winner===a?b:a,loserIntent=winner===a?intentB:intentA,winnerIntent=winner===a?intentA:intentB;
 const rows=await f.pool.query('SELECT run_id,record->>\'state\' AS state FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2',[source.tenantId,source.conversationId]);
 assert.deepEqual(new Map(rows.rows.map(r=>[r.run_id,r.state])),new Map([[source.runId,'RETIRED'],[winner.runId,'CLAIMED']]),'no row was written for the loser');
 await assert.rejects(store.allocations.claim(loserIntent,check),/NATIVE_PREPARATION_CONVERSATION_BUSY/,'the loser stays excluded by the live winner after the race');
 assert.equal((await store.allocations.claim(winnerIntent,check)).dispatch,false,'the winner replays without redispatch');
 assert.equal((await store.allocations.read({binding:loser,allocationKey:loserIntent.allocationKey},check)).record,null);
});

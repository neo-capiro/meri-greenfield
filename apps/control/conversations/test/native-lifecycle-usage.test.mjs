/** Actual pause/resume journal lineage and usage row; SQL protocol is scripted, no model call. */
import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleFixture,binding,scopes,id} from './lifecycle-fixture.mjs';
import {sdkUsageSnapshot} from '../usage.mjs';
const payload=cost=>({usage:sdkUsageSnapshot({type:'result',session_id:id(223),total_cost_usd:cost/1e6,modelUsage:{'us.anthropic.claude-sonnet-4-6':{inputTokens:cost,outputTokens:2,cacheReadInputTokens:0,cacheCreationInputTokens:0,webSearchRequests:0,costUSD:cost/1e6,provider:'bedrock',costBasis:'list'}}}),toolsUsed:{tools:[],omitted:0}});
for(const intent of ['pause','approval.wait','takeover.begin'])test(`${intent} native resume accounts only additional usage and reads exact cumulative custody`,async t=>{
 const f=await lifecycleFixture({browserSessions:intent==='takeover.begin'});t.after(f.close);await f.running();
 const held=id(700),input={controlId:held,intent,...(intent==='approval.wait'?{proposalId:f.proposal.proposalId}:{})};
 await f.control(input);await f.claim(held);
 await f.service.recordUsage({credential:f.credential,binding,input:payload(300)});const browserCustody=intent==='takeover.begin'?{schema:'meri-browser-custody/1',binding,controlId:held,ownerInstanceId:id(702),hostId:id(703),generation:1,leaseEpoch:1,policySha256:'a'.repeat(64),expiresAtMs:Date.now()+60000}:undefined;
 await f.checkpoint(held,browserCustody);
 if(browserCustody)await f.service.returnTakeover({credential:f.credential,returned:{ownerInstanceId:browserCustody.ownerInstanceId,leaseEpoch:2,snapshotSha256:'b'.repeat(64)}});
 const proof=f.proofs.get(binding.runId),resumed=await f.control({controlId:id(701),intent:intent==='takeover.begin'?'takeover.end':'resume',checkpointId:proof.checkpointId,checkpointSha256:proof.checkpointSha256}),target=resumed.targetBinding;
 f.state.context.binding=target;const session=await f.sessions.issue({identityCredential:'synthetic-current-resumed'});
 for(const [n,state] of [[710,'starting'],[711,'running']])await f.store.append(target,{eventId:id(n),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},()=>{});
 assert.deepEqual(await f.service.recordUsage({credential:session.credential,binding:target,input:payload(500)}),{status:'recorded',reason:null,replayed:false});
 const usage=await f.store.readUsage(target,()=>{});assert.equal(usage.chargeMicroUsd,200);assert.equal(usage.cumulative.sdkEstimateUsd,0.0005);assert.equal(usage.parentRunId,binding.runId);
 assert.equal((await f.service.recordUsage({credential:session.credential,binding:target,input:payload(500)})).replayed,true);
 await assert.rejects(f.store.readUsage({...target,actorId:'foreign'},()=>{}));
 const lineage=structuredClone((await f.store.lifecycle.execution({binding:target,scopes,selectedClientId:id(5)},()=>{})).continuation);lineage.sdkSession.key.sessionId=id(999);
 const row=[...f.state.runs.values()].find(r=>r.run_id===target.runId);row.sdk_usage=null;
 await assert.rejects(f.store.recordUsage({binding:target,scopes,input:payload(600),lineage},()=>{}),/SDK_USAGE_PARENT_REFUSED/);
});

/** Actual worker lifecycle and canonical journal; scripted SDK/host ports only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {createActivityLifecycle} from '../activity-lifecycle.mjs';
import {createLifecycleRunOwner} from '../../../../control/conversations/lifecycle/worker-owner.mjs';
import {lifecycleFixture,binding,id} from '../../../../control/conversations/test/lifecycle-fixture.mjs';
import {sdkUsageSnapshot} from '../../../../control/conversations/usage.mjs';
for(const failAbsence of [false,true])test(`takeover ${failAbsence?'refuses uncertain SDK absence':'drains terminal usage before native custody and APPLIED lease'}`,async t=>{
 const f=await lifecycleFixture({browserSessions:true});t.after(f.close);await f.running();
 const controlId=id(920),calls=[],custody={schema:'meri-browser-custody/1',binding,controlId,ownerInstanceId:id(921),hostId:id(922),
  generation:1,leaseEpoch:1,policySha256:'a'.repeat(64),expiresAtMs:Date.now()+60000};
 await f.control({controlId,intent:'takeover.begin'});
 const owner=createLifecycleRunOwner({service:f.service,credentialForBinding:async()=>f.credential});
 const saved=await f.store.read(binding,{},()=>{}),life=createOperationLifetime({now:Date.now,deadlineMs:Date.now()+10000,errorFactory:code=>Object.assign(Error(code),{code})});
 const lifecycle=createActivityLifecycle({binding,saved,runtime:{deadlineMs:Date.now()+10000},now:Date.now,life,
  runOwner:{...owner,async recordCheckpoint(value){calls.push('APPLIED');return owner.recordCheckpoint(value);}},
  config:{captureCheckpoint:async()=>{calls.push('native-capture');await f.capture();}},input:{enqueue(){assert.fail('no hold prompt');},close(){calls.push('input-close');}},
  query:{async interrupt(){calls.push('interrupt');return {still_queued:[]};},async close(){calls.push('query-close');},async drain(){
   calls.push('terminal-usage');await f.service.recordUsage({credential:f.credential,binding,input:{usage:sdkUsageSnapshot({type:'result',session_id:id(223),total_cost_usd:0.0003,
    modelUsage:{'us.anthropic.claude-sonnet-4-6':{inputTokens:10,outputTokens:2,cacheReadInputTokens:0,cacheCreationInputTokens:0,webSearchRequests:0,costUSD:0.0003,provider:'bedrock',costBasis:'list'}}}),toolsUsed:{tools:[],omitted:0}}});}},
  browserRun:{async prepareTakeover(){calls.push('browser-fence');},async captureTakeover(){calls.push('sdk-absence');if(failAbsence)throw Error('native absence unknown');return custody;},
   async retainTakeover({receipt}){const read=await f.service.readTakeover({credential:f.credential});assert.equal(read.state,'held');assert.equal(receipt.state,'APPLIED');calls.push('user-lease');}},
 });t.after(()=>{lifecycle.close();life.close();});
 await lifecycle.observe({type:'system',subtype:'init',session_id:id(223)});
 if(failAbsence){await assert.rejects(lifecycle.heldResult(),/LIFECYCLE_EXECUTION_UNKNOWN/);assert.equal(calls.includes('APPLIED'),false);assert.equal(calls.includes('user-lease'),false);}
 else{assert.deepEqual(await lifecycle.heldResult(),{state:'paused'});assert.deepEqual(calls,['browser-fence','interrupt','input-close','terminal-usage','query-close','sdk-absence','native-capture','APPLIED','user-lease']);}
 assert.equal((await f.store.readUsage(binding,()=>{})).chargeMicroUsd,300);
 await lifecycle.finish();
});

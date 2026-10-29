/** The actual reads client's lost-response observation, fed through the actual worker terminal usage
 * payload into the real conversation store over fake SQL: SDK facts stored, answer preserved, unknown
 * external fact durable, exact replay still bounded. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {applicationFixture,binding,versions,id} from '../../../../control/conversations/test/application-fixture.mjs';
import {fixture as readsFixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {SDK_USAGE_BASIS} from '../../../../control/conversations/usage.mjs';

const ENDPOINT='https://meri-preview-web-search-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp';
const ENV={MERI_WEB_SEARCH_GATEWAY_ENDPOINT:ENDPOINT,MERI_WEB_SEARCH_TOOL:'WebSearch-tool-abc123',MERI_WEB_SEARCH_REGION:'us-east-1'};
const CREDS=async()=>({accessKeyId:'AKIAFIXTURE',secretAccessKey:'fixture-secret'});
const result=()=>({type:'result',subtype:'success',is_error:false,session_id:id(900),total_cost_usd:0.001,
 modelUsage:{'us.anthropic.claude-sonnet-4-6':{inputTokens:10,outputTokens:10,cacheReadInputTokens:0,
  cacheCreationInputTokens:0,webSearchRequests:0,costUSD:0.001,provider:'bedrock',costBasis:'list'}}});
const runtime=()=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,
 model:'us.anthropic.claude-sonnet-4-6',region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},
 usageBasis:SDK_USAGE_BASIS,sessionStore:{async load(){return null;},async append(){}},
 deadlineMs:Date.now()+5000,maxTurns:2,maxCostMicroUSD:1000000,maxOutputBytes:1024});

test('a lost provider response is durably unknown without losing the completed answer or the SDK facts',async t=>{
 const saved={};
 for(const key of Object.keys(ENV)){saved[key]=process.env[key];Object.assign(process.env,{[key]:ENV[key]});}
 t.after(()=>{for(const key of Object.keys(ENV)){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];} });
 try{
  // 1. The real reads client submits a managed search and never receives the response.
  const gatewayCalls=[];
  const reads=await readsFixture('public-web','search_public_web',{primaryCredentials:CREDS,gatewayCalls,dropExecuteResponseOnce:true});
  await assert.rejects(()=>reads.port.execute({operation:reads.operation,arguments:{query:'lost look',limit:3},deliveryId:'synthetic-lost'}));
  assert.equal(gatewayCalls.length,1,'the provider call happened');
  const snapshot=reads.port.externalUsage();
  assert.equal(snapshot.provider,null,'nothing was observed, so nothing is attributed');
  assert.equal(snapshot.incomplete,true);
  assert.equal(snapshot.attempts,0,'no attempt is invented');

  // 2. The actual worker activity records its terminal usage through the real store.
  const f=await applicationFixture({initialInput:true});t.after(()=>f.close());
  await f.service.allocateInput({credential:f.credential,input:f.input});
  await f.service.submit({credential:f.credential,input:f.input});
  const deliveries=[];
  const runOwner={...f.runOwner,async recordUsage(args){deliveries.push(args);return f.service.recordUsage({credential:f.credential,...args});}};
  let n=800;
  const execute=createConversationActivity({runOwner,newId:()=>id(n++),terminalAttemptMs:50,
   generalReads:{readAvailability(){},execute(){},externalUsage:()=>snapshot},
   prepareRuntime:async()=>runtime(),
   query(){return {async *[Symbol.asyncIterator](){
    yield {type:'assistant',parent_tool_use_id:null,message:{id:'msg_synthetic',content:[{type:'text',text:'Synthetic answer'}]}};
    yield result();},close(){}};}});
  assert.deepEqual(await execute({binding}),{state:'completed'},'accounting never fails a completed answer');
  assert.equal(deliveries.length,1,'one terminal delivery');
  assert.deepEqual(deliveries[0].input.externalSearch,snapshot,'the client snapshot is the stored fact');

  // 3. The stored run keeps both SDK facts and the distinct external unknown fact, exactly replays.
  const run=[...f.state.runs.values()][0];
  assert.equal(run.sdk_usage.externalSearch.provider,null);
  assert.equal(run.sdk_usage.externalSearch.incomplete,true);
  assert.equal(run.sdk_usage.externalSearch.billedMicroUsd,null);
  assert.equal(run.sdk_usage.externalSearch.estimateMicroUsd,0);
  assert.equal(run.sdk_usage.sdkEstimateUsd,0.001,'the SDK snapshot is preserved');
  assert.equal(run.sdk_charge_micro_usd,1000);
  const history=await f.service.history({credential:f.credential});
  assert.equal(history.run.state,'completed');
  const replay=await f.service.recordUsage({credential:f.credential,binding,input:deliveries[0].input});
  assert.equal(replay.replayed,true,'exact replay stays bounded to the one record');
 } finally {}
});

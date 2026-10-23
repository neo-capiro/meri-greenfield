import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {applicationFixture,binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
import {SDK_USAGE_BASIS} from '../../../control/conversations/usage.mjs';

const result=()=>({type:'result',subtype:'success',is_error:false,session_id:id(900),total_cost_usd:0.001,
 modelUsage:{'us.anthropic.claude-sonnet-4-6':{inputTokens:10,outputTokens:10,cacheReadInputTokens:0,
  cacheCreationInputTokens:0,webSearchRequests:0,costUSD:0.001,provider:'bedrock',costBasis:'list'}}});
const runtime=()=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,
 model:'us.anthropic.claude-sonnet-4-6',region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},
 usageBasis:SDK_USAGE_BASIS,sessionStore:{async load(){return null;},async append(){}},
 deadlineMs:Date.now()+5000,maxTurns:2,maxCostMicroUSD:1000000,maxOutputBytes:1024});
const audit={tools:[{tool:'Read',toolUseId:'toolu_synthetic',outcome:'completed',durationMs:null}],omitted:0};

async function fixture(t,{ending='result',accounting,claimUnknown=false,prepareFails=false,abort}={}){
 const f=await applicationFixture({initialInput:true});t.after(()=>f.close());
 await f.service.allocateInput({credential:f.credential,input:f.input});
 await f.service.submit({credential:f.credential,input:f.input});
 let n=800,queries=0,closes=0;const deliveries=[];
 const runOwner={...f.runOwner,async append(args){const receipt=await f.runOwner.append(args);
   if(claimUnknown&&args.event.data.state==='starting')throw Error('claim acknowledgement unknown');return receipt;},
  async recordUsage(args){deliveries.push(args);return accounting?accounting(args):f.service.recordUsage({credential:f.credential,...args});}};
 const execute=createConversationActivity({runOwner,newId:()=>id(n++),terminalAttemptMs:50,
  prepareRuntime:async()=>{if(prepareFails)throw Error('runtime unavailable');return runtime();},
  query({options}){queries++;return {async *[Symbol.asyncIterator](){
   await options.hooks.PostToolUse.at(-1).hooks[0]({tool_name:'Read',tool_use_id:'toolu_synthetic',
    tool_input:{path:'PRIVATE_INPUT'},tool_response:'PRIVATE_OUTPUT'},undefined,{});
   abort?.();
   yield {type:'assistant',parent_tool_use_id:null,message:{id:'msg_synthetic',content:[{type:'text',text:'Synthetic answer'}]}};
   if(ending==='throw')throw Error('PRIVATE_STREAM_FAILURE');
   if(ending!=='end')yield result();
   if(ending==='duplicate')yield result();
   if(ending==='throw-after-result')throw Error('PRIVATE_LATE_FAILURE');
  },close(){closes++;}};}});
 return {...f,execute,deliveries,counts:()=>({queries,closes}),saved:()=>[...f.state.runs.values()][0]};
}

for(const ending of ['result','end','throw','duplicate','throw-after-result'])test(`one terminal usage/audit delivery for SDK ${ending}`,async t=>{
 const f=await fixture(t,{ending});
 if(ending==='result')assert.deepEqual(await f.execute({binding}),{state:'completed'});
 else await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);
 const hasResult=!['end','throw'].includes(ending),history=await f.service.history({credential:f.credential});
 assert.equal(history.run.state,ending==='result'?'completed':'failed');
 assert.equal(f.deliveries.length,1);
 assert.equal(f.saved().sdk_usage.status,hasResult?'recorded':'unavailable');
 assert.equal(f.saved().sdk_charge_micro_usd===null,!hasResult,'missing usage must not imply zero spend');
 assert.deepEqual(f.saved().sdk_usage.toolsUsed,audit);
 assert.deepEqual(f.deliveries[0].input.toolsUsed,audit);
 assert.equal(f.deliveries[0].input.usage===null,!hasResult);
 assert(!JSON.stringify(f.deliveries[0].input).includes('PRIVATE'));
 assert.deepEqual(f.counts(),{queries:1,closes:1});
 await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);
 assert.equal(f.deliveries.length,1,'another activity cannot redeliver for a terminal run');
 assert.equal(f.counts().queries,1,'accounting never replays the model');
});

for(const mode of ['throw','timeout'])test(`accounting ${mode} preserves completed answer and is attempted once`,async t=>{
 let finish;const late=new Promise(resolve=>{finish=resolve;});t.after(()=>finish({status:'recorded'}));
 const f=await fixture(t,{accounting:async()=>{if(mode==='throw')throw Error('transport unknown');return late;}});
 assert.deepEqual(await f.execute({binding}),{state:'completed'});
 assert.equal((await f.service.history({credential:f.credential})).run.state,'completed');
 assert.equal(f.deliveries.length,1);assert.equal(f.deliveries[0].signal.aborted,true);
 finish({status:'recorded'});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.counts(),{queries:1,closes:1});assert.equal(f.deliveries.length,1);
});

test('accounting refusal preserves the failed run and original content-free execution error',async t=>{
 const f=await fixture(t,{ending:'throw',accounting:async()=>{throw Error('PRIVATE_ACCOUNTING_ERROR');}});
 await assert.rejects(f.execute({binding}),error=>error.message==='EXECUTION_FAILED');
 assert.equal((await f.service.history({credential:f.credential})).run.state,'failed');
 assert.equal(f.deliveries.length,1);assert.equal(f.deliveries[0].input.usage,null);
 assert.deepEqual(f.deliveries[0].input.toolsUsed,audit);assert.equal(f.counts().queries,1);
});

test('a claimed runtime preparation failure records unavailable usage after terminalization',async t=>{
 const f=await fixture(t,{prepareFails:true});await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);
 assert.equal((await f.service.history({credential:f.credential})).run.state,'failed');
 assert.equal(f.deliveries.length,1);assert.equal(f.deliveries[0].input.usage,null);
 assert.equal(f.saved().sdk_usage.status,'unavailable');assert.deepEqual(f.saved().sdk_usage.toolsUsed,{tools:[],omitted:0});
 assert.deepEqual(f.counts(),{queries:0,closes:0});
});

test('an unacknowledged starting claim cannot write usage or terminalize another claimant',async t=>{
 const f=await fixture(t,{claimUnknown:true});await assert.rejects(f.execute({binding}),/EXECUTION_FAILED/);
 assert.equal((await f.service.history({credential:f.credential})).run.state,'starting');
 assert.equal(f.deliveries.length,0);assert.equal(f.saved().sdk_usage??null,null);
 assert.deepEqual(f.counts(),{queries:0,closes:0});
});

test('cancelled iterator preserves native audit with unavailable usage under its independent delivery bound',async t=>{
 const controller=new AbortController(),f=await fixture(t,{ending:'end',abort:()=>controller.abort()});
 await assert.rejects(f.execute({binding,signal:controller.signal}),/EXECUTION_STOPPED/);
 assert.equal((await f.service.history({credential:f.credential})).run.state,'cancelled');
 assert.equal(f.deliveries.length,1);assert.equal(f.saved().sdk_usage.status,'unavailable');
 assert.deepEqual(f.saved().sdk_usage.toolsUsed,audit);assert.deepEqual(f.counts(),{queries:1,closes:1});
});

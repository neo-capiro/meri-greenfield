import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
import {settlementFor} from '../agentcore-contract.mjs';
let workspaces=0;
// Linux directory ownership is exercised by the native gate; this closed suite isolates the query/HTTP settlement ordering.
mock.module('../conversation-runner.mjs',{namedExports:{assembleConversationRunner(){throw Error('explicit test assembly required');},assertRunnerEnvironment(){},async assertRunnerWorkspace(){workspaces++;}}});
const {createAgentCoreQuery}=await import('../agentcore-query.mjs');
const make=()=>{const {versions:_,...execution}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:Date.now()+60000,runtimeSessionId:'synthetic-session-11111111111111111111'});return {execution,versions,credential:'synthetic-run-only'};};
function fixture(options={}){
 const input=make(),calls=[],cleanup={pendingInitializations:0,closed:true,failures:[],...options.cleanup};let queryCalls=0,admissions=0;
 const execute=createAgentCoreQuery({origin:'https://control.synthetic.invalid',environment:{},workspace:{async prepare(execution){assert.deepEqual(execution,input.execution);calls.push('workspace');return {workspace:'/workspace/'+binding.conversationId,sdk:{configParentDirectory:'/run/meri/private',secureStorageDirectory:'/run/meri/private/secure'}};}},sessionFactory:()=>()=>{},
 fetchImpl:async(url,init)=>{const path=new URL(url).pathname;calls.push(path);assert.equal(init.headers.authorization,'Bearer '+input.credential);const request=JSON.parse(init.body);assert.deepEqual(request.execution,input.execution);
 if(path.endsWith('/settle'))return Response.json(options.badSettlement?{...settlementFor(input.execution,request.state),settled:false}:settlementFor(input.execution,request.state));
 admissions++;const response={execution:input.execution,versions,state:admissions===1?(options.initialState??'queued'):(options.readback??'failed'),scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:'11111111-1111-4111-8111-111111111111',policyRevision:'p'}],selectedClientId:'11111111-1111-4111-8111-111111111111',policyRevision:'p'};
 return Response.json(options.badAdmission?{...response,execution:{...input.execution,expiresAtMs:input.execution.expiresAtMs-1}}:response);},
 assemble:configuration=>{assert.deepEqual(configuration.configuration.execution,input.execution);const run=async()=>{queryCalls++;calls.push('query');await options.wait?.();if(options.failure)throw Error('private query failure');return {state:'completed'};};run.cleanupStatus=()=>{calls.push('closed');return cleanup;};return run;}});
 return {input,calls,run:signal=>execute(input,{signal}),queryCalls:()=>queryCalls};
}
test('query acknowledges settlement only after actual activity and mirror cleanup, with the exact immutable identity',async()=>{
 const f=fixture();assert.deepEqual(await f.run(),settlementFor(f.input.execution,'completed'));
 assert.deepEqual(f.calls,['/v1/runner/execution','workspace','query','closed','/v1/runner/execution/settle']);assert.equal(f.queryCalls(),1);
});
test('failed activity requires canonical terminal readback; running or unknown never becomes settled',async()=>{
 for(const state of ['failed','running']){const f=fixture({failure:true,readback:state});if(state==='failed')assert.deepEqual(await f.run(),settlementFor(f.input.execution,'failed'));else await assert.rejects(f.run());assert.equal(f.queryCalls(),1);assert.equal(f.calls.filter(x=>x.endsWith('/settle')).length,state==='failed'?1:0);}
});
test('uncertain close, pending initialization or failed settlement cannot acknowledge completed SDK execution',async()=>{
 for(const cleanup of [{closed:false},{pendingInitializations:1},{failures:['RUNNER_CLEANUP_UNKNOWN']}]){const f=fixture({cleanup});await assert.rejects(f.run(),{code:'RUNNER_CLEANUP_UNKNOWN'});assert.equal(f.calls.some(x=>x.endsWith('/settle')),false);assert.equal(f.queryCalls(),1);}
 const f=fixture({badSettlement:true});await assert.rejects(f.run());assert.equal(f.queryCalls(),1);
});
test('foreign admission, replayed terminal state, pre-cancellation and near expiry never start a query',async()=>{
 for(const options of [{badAdmission:true},{initialState:'completed'}]){const f=fixture(options);await assert.rejects(f.run());assert.equal(f.queryCalls(),0);}
 const f=fixture(),controller=new AbortController();controller.abort();await assert.rejects(f.run(controller.signal));assert.equal(f.queryCalls(),0);
 const short=fixture();short.input.execution={...short.input.execution,expiresAtMs:Date.now()+20000};await assert.rejects(short.run(),{code:'RUNNER_DEADLINE'});assert.equal(short.calls.length,0);
});

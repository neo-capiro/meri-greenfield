import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
import {settlementFor} from '../agentcore-contract.mjs';
import {withRunnerDiagnostics} from '../runner-runtime-diagnostics.mjs';
let workspaces=0;
// Linux directory ownership is exercised by the native gate; this closed suite isolates the query/HTTP settlement ordering.
mock.module('../conversation-runner.mjs',{namedExports:{assembleConversationRunner(){throw Error('explicit test assembly required');},assertRunnerEnvironment(){},async assertRunnerWorkspace(){workspaces++;}}});
const {createAgentCoreQuery}=await import('../agentcore-query.mjs');
const make=()=>{const {versions:_,...execution}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:Date.now()+60000,runtimeSessionId:'synthetic-session-11111111111111111111'});return {execution,versions,credential:'synthetic-run-only'};};
function fixture(options={}){
 const input=make(),calls=[],cleanup={pendingInitializations:0,closed:true,failures:[],...options.cleanup};let queryCalls=0,admissions=0;
 const execute=createAgentCoreQuery({origin:'https://control.synthetic.invalid',environment:{},workspace:{async prepare(execution){assert.deepEqual(execution,input.execution);calls.push('workspace');if(options.workspaceError)throw options.workspaceError;return {workspace:'/workspace/'+binding.conversationId,sdk:{configParentDirectory:'/run/meri/private',secureStorageDirectory:'/run/meri/private/secure'}};}},sessionFactory:()=>{if(options.sessionError)throw options.sessionError;return ()=>{};},
 fetchImpl:async(url,init)=>{const path=new URL(url).pathname;calls.push(path);assert.equal(init.headers.authorization,'Bearer '+input.credential);const request=JSON.parse(init.body);assert.deepEqual(request.execution,input.execution);
 if(path.endsWith('/settle'))return Response.json(options.badSettlement?{...settlementFor(input.execution,request.state),settled:false}:settlementFor(input.execution,request.state));
 admissions++;const response={execution:input.execution,versions,state:admissions===1?(options.initialState??'queued'):(options.readback??'failed'),scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:'11111111-1111-4111-8111-111111111111',policyRevision:'p'}],selectedClientId:'11111111-1111-4111-8111-111111111111',policyRevision:'p'};
 return Response.json(options.badAdmission?{...response,execution:{...input.execution,expiresAtMs:input.execution.expiresAtMs-1}}:response);},
 assemble:configuration=>{if(options.assemblyError)throw options.assemblyError;assert.deepEqual(configuration.configuration.execution,input.execution);const run=async()=>withRunnerDiagnostics(async()=>{queryCalls++;calls.push('query');await options.wait?.();if(options.failure)throw options.failure instanceof Error?options.failure:Error('private query failure');return {state:'completed'};},{binding});run.cleanupStatus=()=>{calls.push('closed');return cleanup;};return run;}});
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

function capturedDiagnostics(t){
 const lines=[],records=[],stdout=process.stdout.write.bind(process.stdout);
 t.mock.method(process.stderr,'write',line=>{lines.push(String(line));return true;});
 t.mock.method(process.stdout,'write',(line,...args)=>{if(typeof line==='string'&&line.startsWith('{')){records.push(JSON.parse(line));return true;}return stdout(line,...args);});
 return {lines,records,stdout};
}
test('visibility: pre-assembly failures retain their actual stage and fixed code without raw content',async t=>{
 const {lines,records}=capturedDiagnostics(t),secret='PRIVATE_SETUP_CONTENT_CANARY';
 const cases=[
  [{badAdmission:true},'agentcore-admission','RUNNER_BINDING_REFUSED'],
  [{workspaceError:Object.assign(Error(secret),{code:'EACCES'})},'agentcore-workspace','EACCES'],
  [{sessionError:Object.assign(Error(secret),{code:'NATIVE_CONFIGURATION'})},'agentcore-clients','NATIVE_CONFIGURATION'],
  [{assemblyError:Object.assign(Error(secret),{errorClass:'executable_launch_failed'})},'agentcore-assemble','SDK_EXECUTABLE_LAUNCH_FAILED'],
 ];
 for(const [options,stage,code] of cases){
  const f=fixture(options);await assert.rejects(f.run());assert.equal(f.queryCalls(),0);
  const failure=records.filter(r=>r.event==='meri.turn.failure').at(-1);
  assert.equal(failure?.stage,stage);assert.equal(failure.code,code);assert.equal(failure.runId,binding.runId);
 }
 assert.equal(lines.filter(l=>l.startsWith('RUNNER_FIRST_FAILURE ')).length,cases.length);
 assert.equal(JSON.stringify({lines,records}).includes(secret),false);
 const invalid=fixture();invalid.input.credential='';await assert.rejects(invalid.run(),{code:'AGENTCORE_REQUEST_REFUSED'});
 const rejected=records.filter(r=>r.event==='meri.turn.failure').at(-1);
 assert.equal(rejected.stage,'agentcore-input');assert.equal(Object.hasOwn(rejected,'runId'),false);assert.equal(invalid.queryCalls(),0);
});
test('visibility: only a validated settlement after cleanup emits one correlated settlement receipt',async t=>{
 const {records}=capturedDiagnostics(t),f=fixture();
 assert.deepEqual(await f.run(),settlementFor(f.input.execution,'completed'));
 const settled=records.filter(r=>r.event==='meri.turn.settlement');assert.equal(settled.length,1);
 assert.equal(settled[0].runId,binding.runId);assert.equal(settled[0].attemptId,binding.attemptId);
 assert.equal(settled[0].state,'completed');assert.equal(settled[0].sdkCleanup,'closed');
 assert.equal(Object.hasOwn(settled[0],'Turns'),false,'settlement must not count a second control terminal');
 assert.equal(records.filter(r=>r.event==='meri.turn.stage'&&r.stage==='runner.process.start').length,1);
 for(const options of [{badSettlement:true},{cleanup:{closed:false}}]){
  const invalid=fixture(options);await assert.rejects(invalid.run());
  assert.equal(records.filter(r=>r.event==='meri.turn.settlement').length,1,'uncertain settlement must not emit a receipt');
 }
 const failures=records.filter(r=>r.event==='meri.turn.failure');
 assert.deepEqual(failures.map(r=>[r.stage,r.code]),[['agentcore-settle','AGENTCORE_RESULT_REFUSED'],['agentcore-cleanup','RUNNER_CLEANUP_UNKNOWN']]);
});
test('visibility: activity failure remains first when cleanup cannot settle and logging cannot alter success',async t=>{
 const {lines,records,stdout}=capturedDiagnostics(t),failure=Object.assign(Error('PRIVATE_ACTIVITY_CANARY'),{code:'SDK_EXECUTION_FAILED'});
 const f=fixture({failure,cleanup:{closed:false}});await assert.rejects(f.run(),{code:'RUNNER_CLEANUP_UNKNOWN'});
 const first=records.find(r=>r.event==='meri.turn.failure');assert.equal(first?.stage,'activity');assert.equal(first.code,'SDK_EXECUTION_FAILED');
 assert.equal(lines.filter(l=>l.startsWith('RUNNER_FIRST_FAILURE ')).length,1);assert.equal(lines.join('').includes('PRIVATE_ACTIVITY_CANARY'),false);
 assert.equal(records.some(r=>r.event==='meri.turn.settlement'),false);
 t.mock.method(process.stdout,'write',(line,...args)=>{if(typeof line==='string'&&line.startsWith('{'))throw Error('writer unavailable');return stdout(line,...args);});
 t.mock.method(process.stderr,'write',()=>{throw Error('writer unavailable');});
 const success=fixture();assert.deepEqual(await success.run(),settlementFor(success.input.execution,'completed'));
});

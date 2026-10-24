import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleAgentCoreCandidate} from '../agentcore-candidate.mjs';
import {compileAgentCoreConfiguration} from '../agentcore-configuration.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {agentcoreConfig} from './agentcore-fixture.mjs';
import {binding,versions,id} from '../../control/conversations/test/application-fixture.mjs';

const at=1800000000000,clientId=id(5),policyRevision='policy-v1',controlCredential='synthetic-control-secret-not-a-user-bearer';
function fixture(options={}){
 const b=options.binding??binding,configuration={agentcore:agentcoreConfig(),versions,sourceEnabled:false,limits:{requestMs:3000,requestBytes:131072,shutdownMs:30000}};
 if(options.readBudget){configuration.limits.requestMs=10;configuration.agentcore.approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,
  operations:[{id:'read_bill_text',version:'0.2.0'}],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:8192};}
 const run={binding:b,versions,scopes:[{kind:'client',tenantId:b.tenantId,resourceId:clientId,policyRevision}],policyRevision,state:'queued'};
 let record=null,invocations=0,coreCalls=0,stops=0,claimCalls=0,relayCalls=0,coreInput,invocation,schemaQueries=0,schemaRelations=[];
 const pending=Promise.withResolvers();
 const check=f=>f?.();
 const store={async read(request,_cursor,c){check(c);assert.deepEqual(request,b);return {run,events:[{type:'run.status',data:{state:run.state},createdAt:new Date(at-1).toISOString()}],lastSequence:1};},async readOptional(){return {run};},
  async append(_binding,event){run.state=event.data.state;},async readModelPolicy(){assert.fail('Ordinary absent Objective selection never reads model policy');},
  async readModelSelection(){assert.fail('Ordinary absent Objective selection never reads model selection');},
  lifecycle:{async execution(){return null;},async get(){throw Error('No lifecycle use in this control');},async readSessionCapture(){throw Error('No lifecycle use in this control');}},
  nextRuns:{...Object.fromEntries(['reserve','readTarget','listRuns','latestCheckpoint','settlement','current'].map(k=>[k,async()=>k==='readTarget'?null:{runs:[run],reservations:[]} ])),async execution(){return null;},async sessionSnapshot(){throw Error('No snapshot without lineage');}},
  executions:{async read(request,c){check(c);assert.deepEqual(request,b);return {run,record};},async claim(value,c){check(c);claimCalls++;record={...value,phase:'launching',native:null};return {run,record,dispatch:true};},
   async record(value,c){check(c);record={...record,phase:value.phase,native:value.native};return {run,record};},
   async withCurrentRun(){throw Error('No synthetic SQL effect in this composition control');},
   async requestStop(){return {run,record,dispatch:Boolean(record&&record.phase!=='settled')};},async settleStopped(value){record={...record,phase:'settled',native:{state:value.state,stopped:true}};}}};
 const initialBindings={async readContext(){return options.context===undefined?{selectedClientId:clientId,policyRevision}:options.context;},async claim(){},async rebind(){},async readConversation(){}};
 const pool={async query(_sql,args){schemaQueries++;schemaRelations=[...args[0]];assert.ok(args[0].every(name=>!name.includes('allocation')&&!name.includes('grant')&&!name.includes('issuance')));return {rows:args[0].map(name=>({name,relation:name===options.missingRelation?null:name}))};},
  async connect(){return {async query({text,values}){
   if(text.includes('FROM meri_objective_source.run_starts')){assert.match(text,/WHERE tenant_id=\$1 AND conversation_id=\$2 AND run_id=\$3$/);assert.deepEqual(values,[b.tenantId,b.conversationId,b.runId]);return {rows:[]};}
   assert.ok(['BEGIN ISOLATION LEVEL READ COMMITTED',"SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)",'SELECT pg_advisory_xact_lock(hashtextextended($1,0))','COMMIT'].includes(text),text);
   return {rows:[],command:text==='COMMIT'?'COMMIT':undefined};
  },release(){}};}};
 const nativeCredentials={nativeCredentialFor(){relayCalls++;if(options.revokeAfterCore&&coreCalls)throw Error('SESSION_UNAVAILABLE');return {credential:'actual-user-bearer',expiresAtMs:at+120000};}};
 const fetchImpl=async(_url,request)=>{coreCalls++;coreInput={headers:request.headers,body:JSON.parse(request.body)};
  if(options.status)return Response.json({error:'refused'},{status:options.status});
  return Response.json({principal:{tenantId:b.tenantId,actorId:b.actorId},role:'standard_user',permissions:[],clientIds:[clientId],identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:b.conversationId,selectedClientId:clientId,checkedAtMs:at,expiresAtMs:at+120000,...options.receipt});};
 const provider={async invoke(input){invocations++;invocation=input;return pending.promise;},async stop(input){stops++;if(options.stopUnknown)throw Error('transport lost');return {...input,signal:undefined,stopped:true};}};
 // Keep the exact transport receipt closed (AbortSignal is request-only).
 provider.stop=async({signal,...input})=>{signal?.throwIfAborted();stops++;if(options.stopUnknown)throw Error('transport lost');return {...input,stopped:true};};
 const candidate=assembleAgentCoreCandidate({configuration,pool,store,initialBindings,provider,controlCredential,nativeCredentials,fetchImpl,now:()=>at,...(options.createReadsRuntime?{createReadsRuntime:options.createReadsRuntime}:{})});
 return {candidate,configuration,run,store,pending,counts:()=>({invocations,coreCalls,stops,claimCalls,relayCalls}),schema:()=>({queries:schemaQueries,relations:schemaRelations}),coreInput:()=>coreInput,invocation:()=>invocation,record:()=>record,
  async kickoff(){return candidate.native.call('execution/kickoff',{binding:b,executionKey:hash(b)});},
  async finish(state='completed'){run.state=state;const v=invocation;pending.resolve(await candidate.execution.settle({credential:v.credential,execution:v.execution,state}));await candidate.close();}};
}

test('one real Core current admission and durable execution; private callbacks do not multiply Core observations',async()=>{
 const f=fixture();await f.kickoff();assert.equal(f.counts().coreCalls,1);assert.equal(f.coreInput().headers.authorization,'Bearer actual-user-bearer');
 assert.deepEqual(f.coreInput().body,{conversationId:binding.conversationId,clientId});
 assert.equal(f.record().expiresAtMs,at+900000,'execution lifetime is the reviewed run window, not action-session TTL');
 const v=f.invocation();await f.candidate.execution.admitted({credential:v.credential,execution:v.execution,versions});
 await f.kickoff();assert.equal(f.counts().invocations,1);assert.equal(f.counts().coreCalls,1);
 await f.finish();
});
for(const [name,options] of [
 ['revoked Core membership',{status:403}],['Core unavailable',{status:503}],['foreign actor',{receipt:{principal:{tenantId:binding.tenantId,actorId:'foreign'}}}],
 ['foreign tenant',{receipt:{principal:{tenantId:'foreign',actorId:binding.actorId}}}],['foreign conversation',{receipt:{conversationId:id(900)}}],
 ['unavailable client wall',{receipt:{clientIds:[]}}],['expired Core receipt',{receipt:{checkedAtMs:at-1000,expiresAtMs:at-1}}],
 ['stale current observation',{receipt:{checkedAtMs:at-1}}],['local session revoked during Core call',{revokeAfterCore:true}],
 ['durable selected client mismatch',{context:{selectedClientId:id(901),policyRevision}}],['durable policy mismatch',{context:{selectedClientId:clientId,policyRevision:'foreign'}}],
 ['missing dynamic original',{binding:{...binding,conversationId:id(902)},context:null}],
])test(name+' refuses before invocation or claim',async()=>{
 const f=fixture(options);await assert.rejects(f.kickoff());assert.equal(f.counts().invocations,0);assert.equal(f.counts().claimCalls,0);await f.candidate.close();
});
test('no configured original can replace the required durable binding',async()=>{const f=fixture({context:null});try{await assert.rejects(f.kickoff(),/AGENTCORE_ADMISSION_REFUSED/);assert.equal(f.counts().invocations,0);assert.equal(f.counts().claimCalls,0);}finally{await f.candidate.close();}});
test('Stop uses canonical fencing and exact provider session; unknown is not acknowledged',async()=>{
 for(const stopUnknown of [false,true]){const f=fixture({stopUnknown});await f.kickoff();
  const call=f.candidate.native.call('execution/kickoff/stop',{binding,executionId:hash(binding)});
  if(stopUnknown)await assert.rejects(call,/EXECUTION_STOP_UNKNOWN/u);else assert.deepEqual(await call,{binding,executionId:hash(binding),expiresAtMs:at+900000});
  assert.equal(f.run.state,'failed');assert.equal(f.counts().stops,1);
  f.pending.reject(Error('stopped transport'));await f.candidate.close();
 }
});
test('no invocation Stop uses the actual committed failed event and never calls provider',async()=>{
 const f=fixture();const result=await f.candidate.native.call('execution/kickoff/stop',{binding,executionId:hash(binding)});
 assert.equal(result.expiresAtMs,at-1);assert.equal(f.run.state,'failed');assert.equal(f.counts().stops,0);await f.candidate.close();
});
test('candidate routes admitted/settle and existing worker body without task/bootstrap fallback',async()=>{
 const f=fixture();let forwarded;
 f.candidate.bindApplication({async handle(request){forwarded={path:new URL(request.url).pathname,body:await request.json(),auth:request.headers.get('authorization')};return Response.json({ok:true});}});
 const request=new Request('https://control.synthetic.invalid/v1/runner/load',{method:'POST',headers:{authorization:'Bearer execution-only','content-type':'application/json'},body:JSON.stringify({binding})});
 assert.equal((await f.candidate.application.handle(request)).status,200);assert.deepEqual(forwarded,{path:'/internal/conversations/load',body:{binding},auth:'Bearer execution-only'});
 assert.equal(await f.candidate.application.handle(new Request('https://control.synthetic.invalid/v1/runner/native/bootstrap')),null);
 await assert.rejects(f.candidate.native.call('checkpoint/read',{}),/NATIVE_OPERATION_UNAVAILABLE/u);
 await f.candidate.native.readiness();await f.candidate.close();
});
test('read factory receives only execution, binding and declared reads; unopened business owners stay absent',async()=>{
 let passed;const f=fixture({createReadsRuntime(input){passed=input;return {async handle(request){assert.equal(request.headers.get('authorization'),'Bearer synthetic-execution');return Response.json({ok:true});}};}});
 const request=new Request('https://control.synthetic.invalid/v1/runner/reads/availability',{method:'POST',headers:{authorization:'Bearer synthetic-execution','content-type':'application/json'},body:JSON.stringify({binding})});
 assert.equal((await f.candidate.application.handle(request)).status,200);assert.equal(passed.execution,f.candidate.execution);assert.deepEqual(Object.keys(passed).sort(),['binding','execution']);
 assert.equal(typeof f.candidate.productPorts.sdkSessionSnapshot.readSnapshot,'function');assert.equal(f.candidate.productPorts.selectedController,undefined);await f.candidate.close();
});
test('candidate mounts real runtime preparation and refuses unclaimed credentials before any worker fallback',async()=>{
 const f=fixture();let forwarded=0;f.candidate.bindApplication({async handle(){forwarded++;return Response.json({unexpected:true});}});
 const request=credential=>new Request('https://control.synthetic.invalid/v1/runner/runtime',{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify({binding,versions})});
 try{
  assert.equal((await f.candidate.application.handle(request('unclaimed'))).status,503);assert.equal(forwarded,0);
  await f.kickoff();const response=await f.candidate.application.handle(request(f.invocation().credential));assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{binding,versions,deadlineMs:at+900000,maxOutputBytes:262144,sdkSessionKey:null,objective:null});assert.equal(forwarded,0);
  await f.finish();
 }finally{await f.candidate.close();}
});
test('the actual Temporal native client readiness reaches the control-only schema owner',async()=>{
 const f=fixture();
 const client=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:131072},credential:controlCredential,
  fetch:(url,options)=>f.candidate.application.handle(new Request(url,options)),maxRequestMs:3000});
 await client.readiness();
 assert.deepEqual(f.counts(),{invocations:0,coreCalls:0,stops:0,claimCalls:0,relayCalls:0});
 await f.candidate.close();await assert.rejects(client.readiness());
});

const canonicalRelations=[...['conversations','runs','events','controls','native_executions','initial_run_bindings','next_runs','sdk_sessions','sdk_session_streams','sdk_session_entries','sdk_session_batches'].map(name=>'meri_conversations.'+name),'meri_objective_source.run_starts'];
test('readiness checks the canonical conversation and native execution schema without identity or provider work',async()=>{
 const f=fixture();try{
  await f.candidate.native.readiness();assert.deepEqual(f.schema(),{queries:1,relations:canonicalRelations});
  assert.equal(new Set(f.schema().relations).size,canonicalRelations.length);
  assert.deepEqual(f.counts(),{invocations:0,coreCalls:0,stops:0,claimCalls:0,relayCalls:0});
 }finally{await f.candidate.close();}
});
for(const missingRelation of canonicalRelations)test(`readiness refuses missing ${missingRelation} before any admission or invocation`,async()=>{
 const f=fixture({missingRelation});try{
  await assert.rejects(f.candidate.native.readiness(),/DATABASE_SCHEMA_UNAVAILABLE/);
  assert.equal(f.schema().queries,1);assert.deepEqual(f.counts(),{invocations:0,coreCalls:0,stops:0,claimCalls:0,relayCalls:0});
 }finally{await f.candidate.close();}
});
test('pre-aborted readiness performs no schema, identity or provider work',async()=>{
 const f=fixture(),controller=new AbortController();controller.abort();try{
  await assert.rejects(f.candidate.native.readiness({signal:controller.signal}));assert.equal(f.schema().queries,0);
  assert.deepEqual(f.counts(),{invocations:0,coreCalls:0,stops:0,claimCalls:0,relayCalls:0});
 }finally{await f.candidate.close();}
});
test('read execution retains its explicit tool deadline instead of the short ordinary control deadline',async()=>{
 const f=fixture({readBudget:true,createReadsRuntime(){return {async handle(request){await new Promise(resolve=>setTimeout(resolve,30));request.signal.throwIfAborted();return Response.json({ok:true});}};}});
 const response=await f.candidate.application.handle(new Request('https://control.synthetic.invalid/v1/runner/reads/execute',{
  method:'POST',headers:{authorization:'Bearer synthetic-execution','content-type':'application/json'},body:JSON.stringify({binding})}));
 assert.equal(response.status,200);await f.candidate.close();
});
test('closed AgentCore configuration refuses task material, foreign endpoint and unpinned versions',()=>{
 for(const change of [c=>c.runtimeVersion='LATEST',c=>c.qualifier='other',c=>c.runtimeArn=c.runtimeArn.replace(':us-east-1:',':us-west-2:'),c=>c.taskRequest={},c=>c.identity.credentialFile='/synthetic/credential',c=>c.runWindowMs=0,c=>delete c.maxOutputBytes,c=>c.maxOutputBytes=0,c=>c.maxOutputBytes=1048577]){
  const c=agentcoreConfig();change(c);assert.throws(()=>compileAgentCoreConfiguration(c));
 }
 assert.deepEqual(compileAgentCoreConfiguration(agentcoreConfig()),agentcoreConfig());
});

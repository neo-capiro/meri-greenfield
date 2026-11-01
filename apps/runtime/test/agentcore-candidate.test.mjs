import {automaticContextFixture} from '../../worker/conversation/test/automatic-context-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleAgentCoreCandidate} from '../agentcore-candidate.mjs';
import {compileAgentCoreConfiguration} from '../agentcore-configuration.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createControlRouteApplications} from '../control-route-boundary.mjs';
import {createNativeFileApplication,NATIVE_FILE_PATHS} from '../artifacts/native-files-http.mjs';
import {nativeFileBindingHeader} from '../../../packages/contracts/runtime-0.2/files.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {agentcoreConfig} from './agentcore-fixture.mjs';
import {binding,versions,id} from '../../control/conversations/test/application-fixture.mjs';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../product-ports/capability-policy.mjs';
import {EGRESS_REQUIREMENTS_SHA256} from '../../worker/conversation/browser/activation.mjs';
import {billTextCase} from '../../gateway/sources/bill-text/test/fixture.mjs';
import {createTurnTelemetry} from '../telemetry/turn-context.mjs';
import {countingFetch} from '../telemetry/counting.mjs';

const at=1800000000000,clientId=id(5),policyRevision='policy-v1',controlCredential='synthetic-control-secret-not-a-user-bearer';
const readOperation={id:'read_bill_text',version:'0.2.0'},searchOperation={id:'search_congress_bills',version:'0.2.0'};
function readPlatform(operations=[readOperation]){
 const platform=structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM);
 for(const policy of [platform.maximum,platform.defaults,...Object.values(platform.roleCeilings)])policy.activeReadOperations=structuredClone(operations);
 return platform;
}
function fixture(options={}){
 const b=options.binding??binding,configuration={agentcore:agentcoreConfig(),versions,sourceEnabled:false,limits:{requestMs:3000,requestBytes:131072,shutdownMs:30000}};
 if(options.reads)configuration.capabilityPlatform=options.platform??readPlatform();
 if(options.browserActivation)configuration.browserActivation=options.browserActivation;
 if(options.readBudget||options.reads){if(options.readBudget)configuration.limits.requestMs=10;configuration.agentcore.approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,
  operations:options.approvedOperations??[readOperation],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:8192};}
 const run={binding:b,versions,scopes:[{kind:'client',tenantId:b.tenantId,resourceId:clientId,policyRevision}],policyRevision,state:'queued'};
 let record=null,invocations=0,coreCalls=0,stops=0,claimCalls=0,relayCalls=0,coreInput,invocation,schemaQueries=0,schemaRelations=[];
 const pending=Promise.withResolvers(),invoked=Promise.withResolvers();
 const check=f=>f?.();
 const store={async read(request,_cursor,c){check(c);assert.deepEqual(request,b);return {run,request:{requestId:id(999),prompt:'Synthetic ordinary request'},events:[{type:'run.status',data:{state:run.state},createdAt:new Date(at-1).toISOString()}],lastSequence:1};},async readOptional(){return {run};},
  async append(_binding,event){run.state=event.data.state;},async appendSource(request,event,c,expectedScopes){check(c);assert.deepEqual(request,b);assert.deepEqual(expectedScopes,run.scopes);assert.equal(event.type,'source.native-bill-text');options.sourcePublications??=[];options.sourcePublications.push(structuredClone(event));},async readModelPolicy(){assert.fail('Ordinary absent Objective selection never reads model policy');},
  async readModelSelection(){assert.fail('Ordinary absent Objective selection never reads model selection');},
  lifecycle:{async execution(){return null;},async get(){throw Error('No lifecycle use in this control');},async readSessionCapture(){throw Error('No lifecycle use in this control');}},
  nextRuns:{...Object.fromEntries(['reserve','readTarget','listRuns','latestCheckpoint','settlement','current'].map(k=>[k,async()=>k==='readTarget'?null:{runs:[run],reservations:[]} ])),async execution(){return null;},async sessionSnapshot(){throw Error('No snapshot without lineage');}},
  executions:{async read(request,c){check(c);assert.deepEqual(request,b);return {run,record};},async claim(value,c){check(c);claimCalls++;record={...value,phase:'launching',native:null};return {run,record,dispatch:true};},
   async record(value,c){check(c);record={...record,phase:value.phase,native:value.native};return {run,record};},
   async withCurrentRun(){throw Error('No synthetic SQL effect in this composition control');},
   async requestStop(){return {run,record,dispatch:Boolean(record&&record.phase!=='settled')};},async settleStopped(value){record={...record,phase:'settled',native:{state:value.state,stopped:true}};}}};
 const initialBindings={async readContext(){return options.context===undefined?{selectedClientId:clientId,policyRevision}:options.context;},async claim(){},async rebind(){},async readConversation(){}};
 const pool={async query(_sql,args){schemaQueries++;schemaRelations=[...args[0]];assert.ok(args[0].every(name=>!name.includes('allocation')&&!name.includes('grant')&&!name.includes('issuance')));return {rows:args[0].map(name=>({name,relation:name===options.missingRelation?null:name}))};},
  async connect(){return {async query(query,params=[]){const {text,values}=typeof query==='string'?{text:query,values:params}:query;
   if(text==='SELECT * FROM meri_settings.tenant_settings WHERE tenant_id=$1'){
    assert.deepEqual(values,[b.tenantId]);if(options.settingsUnavailable)throw Error('settings unavailable');
    const document={defaultTimezone:'UTC',capabilityPolicy:options.tenantPolicy??{}};
    return {rows:[{revision:1,document,document_sha256:options.badSettingsHash?'f'.repeat(64):hash(document)}]};
   }
   if(['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',"SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '2s'",'ROLLBACK'].includes(text))return {rows:[]};
   if(text.includes('FROM meri_objective_source.run_starts')){assert.match(text,/WHERE tenant_id=\$1 AND conversation_id=\$2 AND run_id=\$3$/);assert.deepEqual(values,[b.tenantId,b.conversationId,b.runId]);return {rows:[]};}
   assert.ok(['BEGIN ISOLATION LEVEL READ COMMITTED',"SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)",'SELECT pg_advisory_xact_lock(hashtextextended($1,0))','COMMIT'].includes(text),text);
   return {rows:[],command:text==='COMMIT'?'COMMIT':undefined};
  },release(){}};}};
 const nativeCredentials={nativeCredentialFor(){relayCalls++;if(options.revokeAfterCore&&coreCalls)throw Error('SESSION_UNAVAILABLE');return {credential:'actual-user-bearer',expiresAtMs:at+120000};}};
 const fetchImpl=async(_url,request)=>{coreCalls++;coreInput={headers:request.headers,body:JSON.parse(request.body)};
  await options.onCoreFetch?.();
  if(new URL(_url).pathname==='/api/clio/client-context/automatic'){assert.equal(request.headers['x-internal-service-secret'],'synthetic-service');assert.deepEqual(JSON.parse(request.body),{schemaVersion:1,clientId});return Response.json(automaticContextFixture(b,clientId,at));}
  if(options.status)return Response.json({error:'refused'},{status:options.status});
  return Response.json({principal:{tenantId:b.tenantId,actorId:b.actorId},role:'standard_user',permissions:[],clientIds:[clientId],identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:b.conversationId,selectedClientId:clientId,checkedAtMs:at,expiresAtMs:at+120000,...options.receipt});};
 const provider={async invoke(input){invocations++;invocation=input;invoked.resolve(input);return pending.promise;},async stop(input){stops++;if(options.stopUnknown)throw Error('transport lost');return {...input,signal:undefined,stopped:true};}};
 // Keep the exact transport receipt closed (AbortSignal is request-only).
 provider.stop=async({signal,...input})=>{signal?.throwIfAborted();stops++;if(options.stopUnknown)throw Error('transport lost');return {...input,stopped:true};};
 const candidate=assembleAgentCoreCandidate({configuration,pool,store,initialBindings,provider,controlCredential,nativeCredentials,fetchImpl,turnTelemetry:options.turnTelemetry,...(options.automaticContext?{getCoreServiceSecret:async()=> 'synthetic-service'}:{}),now:()=>at,...(options.createReadsRuntime?{createReadsRuntime:options.createReadsRuntime}:{})});
 return {candidate,configuration,run,store,pending,counts:()=>({invocations,coreCalls,stops,claimCalls,relayCalls}),schema:()=>({queries:schemaQueries,relations:schemaRelations}),coreInput:()=>coreInput,invocation:()=>invocation,record:()=>record,
  async kickoff(){return candidate.native.call('execution/kickoff',{binding:b,executionKey:hash(b)});},
  async waitForInvocation(){let timer;try{return await Promise.race([invoked.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Provider invocation did not arrive')),1000);})]);}finally{clearTimeout(timer);}},
  async finish(state='completed'){run.state=state;const v=invocation;pending.resolve(await candidate.execution.settle({credential:v.credential,execution:v.execution,state}));await candidate.close();}};
}

test('admission settings carry the configured browser activation verdict to the runner; absent or held is false',async t=>{
 const held=fixture();await held.kickoff();await held.waitForInvocation();t.after(()=>held.finish());
 assert.deepEqual(held.invocation().browser,{enabled:false});
 const explicit=fixture({browserActivation:{state:'held'}});await explicit.kickoff();await explicit.waitForInvocation();t.after(()=>explicit.finish());
 assert.deepEqual(explicit.invocation().browser,{enabled:false});
 const open=fixture({browserActivation:{state:'open',evidence:'docs/qualification/browser-egress/record.md',evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256}});
 await open.kickoff();await open.waitForInvocation();t.after(()=>open.finish());
 assert.deepEqual(open.invocation().browser,{enabled:true});
});
test('the private expiry sweep reaches only the bound control retention owner',async()=>{
 const f=fixture();let calls=0;
 const post=credential=>f.candidate.application.handle(new Request('https://control.invalid/v1/retention/sweep',{
  method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({after:null})}));
 assert.equal((await post(controlCredential)).status,503);
 f.candidate.bindApplication({handle:async()=>{throw Error('not a runner route');},async sweepRetention(input){calls++;assert.equal(input.after,null);assert.equal(input.signal.aborted,false);return {after:null,more:false,outcome:'empty'};}});
 assert.equal((await post('synthetic-run-credential')).status,403);assert.equal(calls,0);
 assert.deepEqual(await (await post(controlCredential)).json(),{after:null,more:false,outcome:'empty'});assert.equal(calls,1);
 assert.equal(f.counts().invocations,0);await f.candidate.close();
});

test('one real Core current admission and durable execution; private callbacks do not multiply Core observations',async()=>{
 const f=fixture();await f.kickoff();assert.equal(f.counts().coreCalls,1);assert.equal(f.coreInput().headers.authorization,'Bearer actual-user-bearer');
 assert.deepEqual(f.coreInput().body,{conversationId:binding.conversationId,clientId});
 assert.equal(f.record().expiresAtMs,at+900000,'execution lifetime is the reviewed run window, not action-session TTL');
 const v=await f.waitForInvocation();await f.candidate.execution.admitted({credential:v.credential,execution:v.execution,versions});
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
test('no configured original can replace the required durable binding',async()=>{const f=fixture({context:null});try{await assert.rejects(f.kickoff(),/AGENTCORE_ADMISSION_REFUSED/);assert.equal(f.counts().invocations,0);assert.equal(f.counts().claimCalls,0);}finally{f.pending.resolve(null);await f.candidate.close();}});
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
 const routes=createControlRouteApplications({assembly:{handle(){assert.fail('No private fallback');}},candidate:f.candidate.application});
 for(const operation of ['load','publish','record-usage','upload-source','next-controls','claim-control','ack-control','record-checkpoint','selected/prepare','selected/read','selected/finish','selected/publish','session/register','session/load','session/append','session/list-subkeys','session/snapshot']){
  const path='/v1/runner/'+operation,request=new Request('https://control.synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer execution-only','content-type':'application/json'},body:JSON.stringify({binding})});
  assert.equal((await routes.private.handle(request)).status,200);
  assert.deepEqual(forwarded,{path:operation.startsWith('session/')?path:'/internal/conversations/'+operation,body:{binding},auth:'Bearer execution-only'});
 }
 assert.equal(await f.candidate.application.handle(new Request('https://control.synthetic.invalid/v1/runner/native/bootstrap')),null);
 await assert.rejects(f.candidate.native.call('checkpoint/read',{}),/NATIVE_OPERATION_UNAVAILABLE/u);
 await f.candidate.native.readiness();await f.candidate.close();
});
test('read factory receives canonical policy and private current-role owner; unopened business owners stay absent',async()=>{
 let passed;const f=fixture({createReadsRuntime(input){passed=input;return {async handle(request){assert.equal(request.headers.get('authorization'),'Bearer synthetic-execution');return Response.json({ok:true});}};}});
 const request=new Request('https://control.synthetic.invalid/v1/runner/reads/availability',{method:'POST',headers:{authorization:'Bearer synthetic-execution','content-type':'application/json'},body:JSON.stringify({binding})});
 assert.equal((await f.candidate.application.handle(request)).status,200);assert.equal(passed.execution,f.candidate.execution);assert.deepEqual(Object.keys(passed).sort(),['binding','capabilityPolicy','conversationStore','execution','readCapabilityRole']);
 assert.equal(typeof passed.conversationStore.appendSource,'function');assert.equal(passed.readCapabilityRole,f.candidate.readCapabilityRole);assert.equal(typeof passed.capabilityPolicy.forRun,'function');
 assert.equal(typeof f.candidate.productPorts.sdkSessionSnapshot.readSnapshot,'function');assert.equal(f.candidate.productPorts.selectedController,undefined);await f.candidate.close();
});

test('private candidate mounts every declared native file operation with the original execution credential and binding',async t=>{
 const f=fixture();await f.kickoff();await f.waitForInvocation();t.after(()=>f.finish());const called=[];
 const fileApplication=createNativeFileApplication({now:()=>at,owner:{authenticate:f.candidate.execution.authenticate,
  ...Object.fromEntries(Object.values(NATIVE_FILE_PATHS).map(method=>[method,async({credential,request})=>{
   assert.equal(credential,f.invocation().credential);assert.deepEqual(request.binding,binding);called.push(method);
   return method==='restore'?{binding,files:null,upload:null}:{binding,operation:method};
  }]))}});
 f.candidate.bindApplication(fileApplication);
 const routes=createControlRouteApplications({assembly:fileApplication,candidate:f.candidate.application}),statuses=[];
 const client=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:131072},credential:f.invocation().credential,now:()=>at,
  fetch:async(url,options)=>{const response=await routes.private.handle(new Request(url,options));statuses.push(response.status);return response;}});
 for(const [path,method] of Object.entries(NATIVE_FILE_PATHS)){
  const input=method==='restore'?{binding}:{binding,sessionId:id(991),files:[],taskFiles:[],...(method==='capture'?{controlId:id(992)}:{})};
  const result=await client.call(path.slice('/v1/'.length),input);assert.deepEqual(result,method==='restore'?{binding,files:null,upload:null}:{binding,operation:method});
 }
 assert.deepEqual(statuses,[200,200,200]);assert.deepEqual(called,Object.values(NATIVE_FILE_PATHS));assert.equal(f.counts().coreCalls,1);
 const post=(path,{credential=f.invocation().credential,headerBinding=binding,bodyBinding=binding}={})=>new Request('https://control.synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json','x-meri-run-binding':nativeFileBindingHeader(headerBinding)},body:JSON.stringify({binding:bodyBinding})});
 for(const path of Object.keys(NATIVE_FILE_PATHS)){
  assert.equal((await routes.public.handle(post(path))).status,404,'native files never become public');
  assert.equal((await routes.private.handle(post(path,{credential:'unclaimed'}))).status,401);
  assert.equal((await routes.private.handle(post(path,{headerBinding:{...binding,tenantId:id(993)}}))).status,401);
  assert.equal((await routes.private.handle(post(path,{bodyBinding:{...binding,runId:id(994)}}))).status,403);
 }
 for(const path of ['/v1/runner/files/capture','/v1/runner/files/complete','/v1/runner/files/restore/extra','/v1/runner/checkpoint/read','/v1/runner/checkpoint/complete/extra']){
  assert.equal((await routes.private.handle(post(path))).status,404,'only canonical file operations are mounted');
 }
 assert.equal(called.length,3,'denied and unmatched requests never reach file effects');assert.equal(f.counts().coreCalls,1);
});

test('declared native file routes without product composition are unavailable, never a successful fallback',async t=>{
 const f=fixture();t.after(()=>f.candidate.close());const assembly={async handle(){assert.fail('No unbound fallback');}};
 const routes=createControlRouteApplications({assembly,candidate:f.candidate.application});
 for(const path of Object.keys(NATIVE_FILE_PATHS)){
  const response=await routes.private.handle(new Request('https://control.synthetic.invalid'+path,{method:'POST'}));
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'NATIVE_FILES_UNAVAILABLE'}});
 }
});
test('candidate mounts real runtime preparation and refuses unclaimed credentials before any worker fallback',async()=>{
 const f=fixture({automaticContext:true});let forwarded=0;f.candidate.bindApplication({async handle(){forwarded++;return Response.json({unexpected:true});}});
 const request=credential=>new Request('https://control.synthetic.invalid/v1/runner/runtime',{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify({binding,versions})});
 try{
  assert.equal((await f.candidate.application.handle(request('unclaimed'))).status,503);assert.equal(forwarded,0);
  await f.kickoff();await f.waitForInvocation();const response=await f.candidate.application.handle(request(f.invocation().credential));assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{binding,versions,deadlineMs:at+900000,maxOutputBytes:262144,sdkSessionKey:null,objective:null,outreach:null,automaticClientContext:automaticContextFixture(binding,clientId,at)});assert.equal(forwarded,0);assert.equal(f.counts().coreCalls,2);
  await f.finish();
 }finally{f.pending.resolve(null);await f.candidate.close();}
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
 }finally{f.pending.resolve(null);await f.candidate.close();}
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

/** Actual candidate -> composer -> canonical settings store/resolver -> discovery/dispatch. Synthetic Core/source and SQL only. */
async function policyFixture(options={}){
 const b={...binding,tenantId:id(70),actorId:id(71),...options.binding},source=billTextCase();let sourceCalls=0,readCoreCalls=0,afterSource;
 const fetchImpl=async(url,request)=>{readCoreCalls++;await options.onCoreFetch?.();
   if(url.endsWith('/application-authority/current'))return Response.json({principal:{tenantId:b.tenantId,actorId:b.actorId},role:'standard_user',permissions:[],clientIds:[clientId],identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:b.conversationId,selectedClientId:clientId,checkedAtMs:at,expiresAtMs:at+120000});
   assert.equal(new URL(url).pathname,'/api/clio/tools/read_bill_text');sourceCalls++;const result=source.native(JSON.parse(request.body));afterSource?.();return Response.json(result);
  };
 const composer=await createControlReadsComposer({coreOrigin:'https://core.synthetic.invalid',familyIds:['bill-text'],defaultCongress:119,
  nativeCredentials:{nativeCredentialFor:()=>({credential:'SYNTHETIC_USER',expiresAtMs:at+120000})},readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:()=>at,newId:()=>id(90),
  fetchImpl:countingFetch(fetchImpl,options.turnTelemetry,{origin:'https://core.synthetic.invalid'})});
 const f=fixture(Object.assign(options,{binding:b,reads:true,createReadsRuntime:composer.createReadsRuntime}));await f.kickoff();f.run.state='running';
 const schemaVersion='meri-native-general-reads/1',operation={id:'read_bill_text',version:'0.2.0'};
 const request=(kind,extra={})=>f.candidate.application.handle(new Request('https://control.synthetic.invalid/v1/runner/reads/'+kind,{method:'POST',
  headers:{authorization:'Bearer '+f.invocation().credential,'content-type':'application/json'},body:JSON.stringify({schemaVersion,binding:b,...extra})}));
 return {...f,options,sourceCalls:()=>sourceCalls,readCoreCalls:()=>readCoreCalls,after:fn=>{afterSource=fn;},availability:()=>request('availability'),
  execute:available=>request('execute',{operation,arguments:{billId:'H.R. 1'},deliveryId:'synthetic',installationId:available.installation.installationId,executionCatalogSha256:available.installation.executionCatalogSha256})};
}
test('production composition honors persisted generalReads narrowing for discovery and dispatch with one role observation per snapshot',async t=>{
 const f=await policyFixture();t.after(()=>f.finish());
 const first=await f.availability();assert.equal(first.status,200,await first.clone().text());const available=await first.json();
 assert.equal(available.discovery.operations.length,1);assert.equal(available.expiresAtMs,at+120000);
 assert.equal(f.counts().coreCalls,3,'one kickoff plus two availability decisions, regardless of local polls');
 const result=await f.execute(available);assert.equal(result.status,200,await result.clone().text());assert.equal(f.sourceCalls(),1);assert.equal(f.options.sourcePublications.length,1);assert.equal(f.options.sourcePublications[0].data.operation.id,'read_bill_text');
 assert.equal(f.counts().coreCalls,5,'execute adds only its before/after decisions');
 f.options.tenantPolicy={capabilities:{generalReads:false}};
 const narrowed=await f.availability();assert.equal(narrowed.status,200);assert.deepEqual((await narrowed.json()).discovery.operations,[]);
 const denied=await f.execute(available);assert.equal(denied.status,503);assert.equal(f.sourceCalls(),1,'old discovery cannot dispatch after tenant narrowing');
});
test('role ceiling uses actual admin vs standard role and later downgrade withholds the source result',async t=>{
 const platform=readPlatform();platform.roleCeilings.standard_user.generalReads=false;
 const options={platform,receipt:{role:'user_admin'}},f=await policyFixture(options);t.after(()=>f.finish());
 const r=await f.availability();assert.equal(r.status,200);const available=await r.json();assert.equal(available.discovery.operations.length,1,'all-role intersection would incorrectly hide admin reads');
 f.after(()=>{options.receipt={role:'standard_user'};});const response=await f.execute(available);
 assert.equal(response.status,503);assert.equal(f.sourceCalls(),1);assert.doesNotMatch(await response.text(),/resultJson/);
 const downgraded=await f.availability();assert.equal(downgraded.status,200);assert.deepEqual((await downgraded.json()).discovery.operations,[]);
});
test('canonical empty default active operations exposes no reads and never falls back to approved operations',async t=>{
 const platform=readPlatform();platform.defaults.activeReadOperations=[];
 const f=await policyFixture({platform});t.after(()=>f.finish());
 const response=await f.availability();assert.equal(response.status,200);const available=await response.json();assert.deepEqual(available.discovery.operations,[]);
 const denied=await f.execute(available);assert.equal(denied.status,503);assert.equal(f.sourceCalls(),0);assert.doesNotMatch(await denied.text(),/resultJson/);
});
for(const source of ['tenant','role'])for(const remaining of [[],[searchOperation]])for(const boundary of ['discovery','stale dispatch','after source']){
 test(`${source} operation narrowing to ${remaining.length} reads fences ${boundary}`,async t=>{
  const operations=[readOperation,searchOperation],platform=readPlatform(operations);
  if(source==='role')platform.roleCeilings.standard_user.activeReadOperations=remaining;
  const options={platform,approvedOperations:operations,receipt:{role:'user_admin'}},f=await policyFixture(options);t.after(()=>f.finish());
  const narrow=()=>{if(source==='tenant')options.tenantPolicy={capabilities:{activeReadOperations:remaining}};else options.receipt={role:'standard_user'};};
  const initial=await f.availability();assert.equal(initial.status,200);const available=await initial.json();assert.deepEqual(available.discovery.operations,operations);
  if(boundary==='after source')f.after(narrow);else narrow();
  if(boundary==='discovery'){
   const response=await f.availability();assert.equal(response.status,200);assert.deepEqual((await response.json()).discovery.operations,remaining);assert.equal(f.sourceCalls(),0);
  }else{
   const response=await f.execute(available);assert.equal(response.status,503);assert.equal(f.sourceCalls(),boundary==='after source'?1:0);assert.doesNotMatch(await response.text(),/resultJson/);
  }
  assert.equal(f.counts().coreCalls,boundary==='stale dispatch'?4:5,'existing snapshots keep one role observation each');
 });
}
for(const [name,change] of [
 ['saved tenant narrowing',o=>{o.tenantPolicy={capabilities:{generalReads:false}};}],
 ['revoked membership',o=>{o.status=403;}],['unavailable settings',o=>{o.settingsUnavailable=true;}],
 ['corrupt settings',o=>{o.badSettingsHash=true;}],['missing role',o=>{o.receipt={role:undefined};}],
 ['expired role',o=>{o.receipt={expiresAtMs:at};}],['foreign tenant',o=>{o.receipt={principal:{tenantId:id(99),actorId:id(71)}};}],
 ['foreign selected client',o=>{o.receipt={selectedClientId:id(99)};}],
])test(name+' after a source call releases no earlier privileged bytes',async t=>{
 const options={},f=await policyFixture(options);t.after(()=>f.finish());
 const r=await f.availability();assert.equal(r.status,200);const available=await r.json();
 f.after(()=>change(options));const response=await f.execute(available);assert.notEqual(response.status,200);assert.equal(f.sourceCalls(),1);assert.doesNotMatch(await response.text(),/resultJson/);
});
test('private role reads use the current canonical observation, preserve original expiry and do not alter local polling',async t=>{
 const options={},f=fixture(options);await f.kickoff();await f.waitForInvocation();t.after(()=>f.finish());
 for(let n=0;n<4;n++)await f.candidate.execution.authenticate({credential:f.invocation().credential,binding});
 assert.equal(f.counts().coreCalls,1);
 const role=await f.candidate.readCapabilityRole({binding});assert.deepEqual(role,{actorRole:'standard_user',checkedAtMs:at,expiresAtMs:at+120000});assert.equal(f.counts().coreCalls,2);
 options.receipt={role:'user_admin'};assert.equal((await f.candidate.readCapabilityRole({binding})).actorRole,'user_admin');assert.equal(f.counts().coreCalls,3);
 options.status=403;await assert.rejects(f.candidate.readCapabilityRole({binding}));
});


test('native telemetry covers admission, runtime preparation, repeated discovery and the real tool transport once',async t=>{
 const lines=[];let clock=1000;
 const telemetry=createTurnTelemetry({service:'control',now:()=>clock,write:line=>lines.push(JSON.parse(line))});
 const f=await policyFixture({turnTelemetry:telemetry,automaticContext:true,onCoreFetch:()=>{clock+=5;}});t.after(async()=>{await f.finish();telemetry.close();});
 const runtime=await f.candidate.application.handle(new Request('https://control.synthetic.invalid/v1/runner/runtime',{method:'POST',headers:{authorization:'Bearer '+f.invocation().credential,'content-type':'application/json'},body:JSON.stringify({binding:f.run.binding,versions})}));
 assert.equal(runtime.status,200);
 for(let i=0;i<2;i++){const response=await f.availability();assert.equal(response.status,200);}
 const available=await (await f.availability()).json(),result=await f.execute(available);
 assert.equal(result.status,200);assert.equal(f.sourceCalls(),1);
 const expected=f.counts().coreCalls+f.readCoreCalls();assert.ok(f.readCoreCalls()>0);
 const counts=telemetry.counters(f.run.binding);
 assert.equal(Object.values(counts.core).reduce((n,row)=>n+Object.values(row).reduce((a,b)=>a+b,0),0),expected,'every actual Core port invocation, including pre-binding admission and tool transport, is counted once');
 assert.equal(counts.coreMs,expected*5);
 telemetry.rollup();assert.equal(lines.find(x=>x.event==='meri.process.rollup').CoreCalls,0,'no attributed request leaks into background');
 assert.equal(lines.find(x=>x.event==='meri.turn.counters').runId,f.run.binding.runId);
});

test('native telemetry keeps interleaved authenticated owners separate',async t=>{
 const lines=[],telemetry=createTurnTelemetry({service:'control',write:line=>lines.push(JSON.parse(line))});
 const a=await policyFixture({turnTelemetry:telemetry}),b=await policyFixture({turnTelemetry:telemetry,binding:{conversationId:id(700),runId:id(701),attemptId:id(702),workerId:id(703)}});
 t.after(async()=>{await a.finish();await b.finish();telemetry.close();});
 const enteredA=Promise.withResolvers(),enteredB=Promise.withResolvers(),releaseA=Promise.withResolvers(),releaseB=Promise.withResolvers();
 a.options.onCoreFetch=async()=>{enteredA.resolve();await releaseA.promise;};b.options.onCoreFetch=async()=>{enteredB.resolve();await releaseB.promise;};
 const first=a.availability(),second=b.availability();await Promise.all([enteredA.promise,enteredB.promise]);
 releaseB.resolve();assert.equal((await second).status,200);releaseA.resolve();assert.equal((await first).status,200);
 for(const f of [a,b]){const counts=telemetry.counters(f.run.binding);assert.equal(Object.values(counts.core).flatMap(Object.values).reduce((n,v)=>n+v,0),f.counts().coreCalls+f.readCoreCalls());}
 telemetry.rollup();assert.equal(lines.find(x=>x.event==='meri.process.rollup').CoreCalls,0);
 assert.deepEqual(new Set(lines.filter(x=>x.event==='meri.turn.counters').map(x=>x.runId)),new Set([a.run.binding.runId,b.run.binding.runId]));
});

test('native telemetry refuses a foreign credential or binding without assigning another owner, and retains current-access refusal',async t=>{
 const lines=[],telemetry=createTurnTelemetry({service:'control',write:line=>lines.push(JSON.parse(line))});
 const f=await policyFixture({turnTelemetry:telemetry});t.after(async()=>{await f.finish();telemetry.close();});
 const post=(credential,b)=>f.candidate.application.handle(new Request('https://control.synthetic.invalid/v1/runner/reads/availability',{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({schemaVersion:'meri-native-general-reads/1',binding:b})}));
 const before=f.counts().coreCalls;
 assert.equal((await post('foreign-credential',f.run.binding)).status,403);
 assert.equal((await post(f.invocation().credential,{...f.run.binding,runId:id(799)})).status,403);
 assert.equal(f.counts().coreCalls,before,'refused ownership never reaches Core');
 f.options.status=403;assert.equal((await f.availability()).status,503);
 const counts=telemetry.counters(f.run.binding);assert.equal(counts.core.current['403'],1);assert.equal(counts.core.current['2xx'],1);
 telemetry.rollup();assert.equal(lines.find(x=>x.event==='meri.process.rollup').CoreCalls,0);
 assert.equal(lines.some(x=>x.runId===id(799)),false);assert.equal(lines.some(x=>x.event==='meri.turn.summary'),false,'refusal never invents completion');
});

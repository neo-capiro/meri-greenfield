import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleAgentCoreCandidate} from '../agentcore-candidate.mjs';
import {agentcoreConfig} from './agentcore-fixture.mjs';
import {binding,versions,id} from '../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

const at=1800000000000,controlId=id(810),policyRevision='policy-v1',controlCredential='synthetic-control-secret-not-a-user-bearer';
function fixture({mode='fork',general=false,...options}={}){
 const selectedClientId=general?null:id(5),sourceBinding=structuredClone(binding);
 const targetBinding={...binding,conversationId:mode==='resume'?binding.conversationId:id(811),runId:id(812),attemptId:id(813),workerId:id(814),writerFence:mode==='resume'?2:1};
 const scopes=[{kind:general?'private-user':'client',tenantId:binding.tenantId,resourceId:general?binding.actorId:selectedClientId,policyRevision}];
 const source={binding:sourceBinding,scopes,versions,policyRevision,state:mode==='resume'?'paused':'completed'};
 const target={binding:targetBinding,scopes,versions,policyRevision,state:'queued'};
 const bootstrap={schemaVersion:general?2:1,requestId:controlId,tenantId:binding.tenantId,actorId:binding.actorId,conversationId:targetBinding.conversationId,clientId:selectedClientId,...(general?{scopeKind:'general'}:{})};
 const origin={controlId,mode,sourceBinding,bootstrap:mode==='resume'?null:bootstrap};
 const state={core:[],relay:[],originReads:0,claims:0,invocations:0,initialClaims:0,bootstrapCalls:0,record:null,origin,source,target,...options};
 const configuration={agentcore:agentcoreConfig(),versions,sourceEnabled:false,limits:{requestMs:3000,requestBytes:131072,shutdownMs:30000}};
 const runs=new Map([[hash(sourceBinding),source],[hash(targetBinding),target]]),check=f=>f?.();
 const saved=b=>{const run=runs.get(hash(b));assert.ok(run);return {run,events:[],lastSequence:1};};
 const pending=Promise.withResolvers();pending.promise.catch(()=>{});
 const store={async append(){throw Error('No append in admission control');},async read(b,_cursor,c){check(c);return saved(b);},async readOptional(b){return runs.has(hash(b))?saved(b):null;},
  lifecycle:{async continuationOrigin(value,c){check(c);assert.deepEqual(value,{binding:targetBinding,scopes,selectedClientId});state.originReads++;if(state.mappingUnknown)throw Error('LIFECYCLE_TRANSITION_REFUSED');return structuredClone(state.originReads>1&&state.changedOrigin?state.changedOrigin:state.origin);},
   async get(){return state.control??{state:'DISPATCHING',input:{intent:mode},target:{binding:targetBinding,scopes,selectedClientId}};},async execution(){return null;},async readSessionCapture(){throw Error('Not used in this boundary control');}},
  nextRuns:{async execution(){return null;},async sessionSnapshot(){throw Error('No snapshot in this admission fixture');},async current(b,c){check(c);return {binding:b,scopes,policyRevision,reserved:false,...state.latest};},async readTarget(){return null;},async reserve(){},async listRuns(){},async latestCheckpoint(){},async settlement(){}},
  executions:{async read(b,c){check(c);return {run:saved(b).run,record:state.record};},async claim(value,c){check(c);state.claims++;state.record={...value,phase:'launching',native:null};return {run:target,record:state.record,dispatch:true};},
   async record(value){state.record={...state.record,phase:value.phase,native:value.native};return {run:target,record:state.record};},async requestStop(){throw Error('Not used');},async settleStopped(){throw Error('Not used');},async withCurrentRun(){throw Error('Not used');}}};
 const nativeCredentials={nativeCredentialFor({binding:b,selectedClientId:client,signal}){
  signal?.throwIfAborted();state.relay.push(structuredClone(b));assert.equal(client,selectedClientId);
  if(hash(b)!==hash(sourceBinding))throw Object.assign(Error('SESSION_UNAVAILABLE'),{code:state.targetError??'SESSION_UNAVAILABLE'});
  if(state.sourceRevoked||state.revokeAfterCore&&state.core.length)throw Object.assign(Error('SESSION_UNAVAILABLE'),{code:'SESSION_UNAVAILABLE'});
  return {credential:'source-user-bearer',expiresAtMs:state.sourceExpired?at-1:at+120000};
 }};
 const initialBindings={async readContext(){return {selectedClientId,policyRevision};},async readConversation(){},async rebind(){},async claim(input,c){check(c);state.initialClaims++;state.claimInput=input;
  if(state.commitUnknown)throw Object.assign(Error('INITIAL_RUN_BINDING_COMMIT_UNKNOWN'),{code:'INITIAL_RUN_BINDING_COMMIT_UNKNOWN'});
  return {record:{schemaVersion:1,state:'ADMITTED',binding:targetBinding,selectedClientId,policyRevision,versions,configurationSha256:hash(configuration.agentcore),expiresAtMs:at+900000,createdAtMs:at},created:state.initialClaims===1};}};
 const fetchImpl=async(url,request)=>{
  assert.equal(request.headers.authorization,'Bearer source-user-bearer');assert.equal(request.redirect,'error');
  const body=JSON.parse(request.body),path=new URL(url).pathname;
  if(path==='/api/clio/conversations/bootstrap'){
   state.bootstrapCalls++;assert.deepEqual(body,general?{schemaVersion:2,requestId:controlId,scopeKind:'general',clientId:null}:{schemaVersion:1,requestId:controlId,clientId:selectedClientId});
   if(state.bootstrapUnknown)throw Error('Lost bootstrap acknowledgement');
   return Response.json(state.bootstrapReceipt??bootstrap,{status:201});
  }
  assert.equal(path,'/api/clio/application-authority/current');state.core.push(body);
  state.onCore?.(body);
  if(state.coreStatus)return Response.json({error:'denied'},{status:state.coreStatus});
  return Response.json({principal:{tenantId:binding.tenantId,actorId:binding.actorId},role:'standard_user',permissions:[],clientIds:general?[]:[selectedClientId],identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:body.conversationId,selectedClientId,checkedAtMs:at,expiresAtMs:at+120000,...state.currentReceipt});
 };
 const provider={async invoke(value){state.invocations++;state.invocation=value;return pending.promise;},async stop(){throw Error('No Stop effect in admission control');}};
 const candidate=assembleAgentCoreCandidate({configuration,pool:{query(){throw Error('No readiness DB');}},provider,controlCredential,nativeCredentials,store,initialBindings,fetchImpl,now:()=>at});
 return {candidate,state,sourceBinding,targetBinding,scopes,selectedClientId,bootstrap,
  kickoff:signal=>candidate.native.call('execution/kickoff',{binding:targetBinding,executionKey:hash(targetBinding)},{signal}),
  fork:signal=>candidate.admitFork({controlId,sourceBinding,scopes,selectedClientId,versions,signal}),
  transition:(b=targetBinding,extra={})=>candidate.productPorts.transitionAuthority.readCurrent({binding:b,scopes,selectedClientId,policyRevision,deadlineMs:at+3000,...extra}),
  async close(){pending.reject(Error('closed synthetic transport'));await candidate.close();pending.promise.catch(()=>{});}};
}

for(const mode of ['resume','fork'])for(const general of [false,true])test(`${mode} ${general?'General':'client'} target borrows only its canonical source bearer and rechecks exact target Core`,async()=>{
 const f=fixture({mode,general});try{
  await f.kickoff();assert.equal(f.state.claims,1);assert.equal(f.state.invocations,1);assert.equal(f.state.originReads,2);
  assert.deepEqual(f.state.core,[{conversationId:f.targetBinding.conversationId,clientId:f.selectedClientId}]);
  assert.deepEqual(f.state.relay,[f.targetBinding,f.sourceBinding,f.sourceBinding]);
 }finally{await f.close();}
});

for(const [name,change] of [
 ['unknown mapping',f=>f.state.mappingUnknown=true],['foreign origin actor',f=>f.state.origin.sourceBinding.actorId='foreign'],
 ['resume wrong conversation',f=>f.state.origin.sourceBinding.conversationId=id(899)],['resume stale fence',f=>f.state.origin.sourceBinding.writerFence=3],
 ['resume fabricated bootstrap',f=>f.state.origin.bootstrap=f.bootstrap],['source expired',f=>f.state.sourceExpired=true],['source revoked',f=>f.state.sourceRevoked=true],
 ['revoked while Core awaited',f=>f.state.revokeAfterCore=true],['foreign target receipt',f=>f.state.currentReceipt={conversationId:id(899)}],
 ['Core access refusal',f=>f.state.coreStatus=403],['target credential error is not absence',f=>f.state.targetError='SESSION_REFUSED'],
 ['mapping changed during Core call',f=>f.state.changedOrigin={...f.state.origin,controlId:id(899)}],
])test(`${name} refuses before execution claim/invoke`,async()=>{
 const f=fixture({mode:'resume'});change(f);try{await assert.rejects(f.kickoff());assert.equal(f.state.claims,0);assert.equal(f.state.invocations,0);}finally{await f.close();}
});

test('request cancellation during target authorization cannot leave a new execution',async()=>{
 const controller=new AbortController(),f=fixture({onCore:()=>controller.abort()});
 try{await assert.rejects(f.kickoff(controller.signal));assert.equal(f.state.claims,0);assert.equal(f.state.invocations,0);}finally{await f.close();}
});

for(const general of [false,true])test(`actual ${general?'v2 General':'v1 client'} bootstrap receipt and fresh target check precede initial claim; same request replays`,async()=>{
 const f=fixture({general});try{
  const first=await f.fork(),second=await f.fork();assert.deepEqual(first,second);assert.deepEqual(first.bootstrap,f.bootstrap);
  assert.equal(f.state.bootstrapCalls,2);assert.equal(f.state.initialClaims,2);assert.equal(f.state.invocations,0);
  assert.deepEqual(f.state.core.map(v=>v.conversationId),[f.sourceBinding.conversationId,f.targetBinding.conversationId,f.sourceBinding.conversationId,f.targetBinding.conversationId]);
  assert.equal(f.state.claimInput.selectedClientId,f.selectedClientId);assert.equal(f.state.claimInput.conversationId,f.targetBinding.conversationId);
 }finally{await f.close();}
});

for(const [name,change] of [
 ['foreign bootstrap tenant',f=>f.state.bootstrapReceipt={...f.bootstrap,tenantId:'foreign'}],
 ['wrong bootstrap request',f=>f.state.bootstrapReceipt={...f.bootstrap,requestId:id(899)}],
 ['v1 null is forbidden',f=>{const {scopeKind,...raw}=f.bootstrap;f.state.bootstrapReceipt={...raw,schemaVersion:1};}],
 ['unknown bootstrap response',f=>f.state.bootstrapUnknown=true],['target current denies after bootstrap',f=>f.state.onCore=b=>{if(b.conversationId===f.targetBinding.conversationId)f.state.coreStatus=403;}],
])test(`${name} never claims an initial run`,async()=>{
 const f=fixture({general:true});change(f);try{await assert.rejects(f.fork());assert.equal(f.state.initialClaims,0);assert.equal(f.state.invocations,0);}finally{await f.close();}
});

test('unknown initial COMMIT remains unknown with no replacement bootstrap or model attempt',async()=>{
 const f=fixture({commitUnknown:true});try{await assert.rejects(f.fork(),{code:'INITIAL_RUN_BINDING_COMMIT_UNKNOWN'});assert.equal(f.state.bootstrapCalls,1);assert.equal(f.state.initialClaims,1);assert.equal(f.state.invocations,0);}finally{await f.close();}
});

test('completed source remains eligible for fresh Core authorization before canonical fork admission',async()=>{
 const f=fixture();try{const result=await f.transition(f.sourceBinding);assert.deepEqual(result.binding,f.sourceBinding);assert.equal(f.state.core.length,1);assert.equal(f.state.claims,0);}finally{await f.close();}
});
for(const state of ['completed','failed'])test(`committed ${state} target acknowledgement rechecks its exact origin without reopening execution`,async()=>{
 const f=fixture({mode:'resume'});f.state.target.state=state;try{
  const result=await f.transition(f.targetBinding,{committedContinuation:{sourceBinding:f.sourceBinding,controlId}});
  assert.deepEqual(result.binding,f.targetBinding);assert.equal(f.state.originReads,2);assert.equal(f.state.core.length,1);assert.equal(f.state.claims,0);assert.equal(f.state.invocations,0);
 }finally{await f.close();}
});
for(const [name,change] of [
 ['cancelled target',f=>f.state.target.state='cancelled'],
 ['unknown control',f=>f.state.control={state:'UNKNOWN',input:{intent:'resume'},target:{binding:f.targetBinding,scopes:f.scopes,selectedClientId:f.selectedClientId}}],
 ['foreign mapped target',f=>f.state.control={state:'APPLIED',input:{intent:'resume'},target:{binding:{...f.targetBinding,conversationId:id(899)},scopes:f.scopes,selectedClientId:f.selectedClientId}}],
 ['newer reserved writer',f=>f.state.latest={reserved:true}],
 ['current Core revocation',f=>f.state.coreStatus=403],
])test(`committed acknowledgement refuses ${name}`,async()=>{
 const f=fixture({mode:'resume'});f.state.target.state='completed';change(f);try{
  await assert.rejects(f.transition(f.targetBinding,{committedContinuation:{sourceBinding:f.sourceBinding,controlId}}));assert.equal(f.state.claims,0);assert.equal(f.state.invocations,0);
 }finally{await f.close();}
});

/** Pre-deploy rehearsal of one first turn against the real control run-owner path under measured Core latencies.
 *
 * Composed for real: the product runner (assembleConversationRunner with the remote task's lease-derived budget), the
 * conversation activity and its lifecycle pump, the native capability client, control's worker-http, the action session owner,
 * the native identity context, the Core membership gate, and the conversation and lifecycle services.
 * In process: Core (identity, membership, context) with per-route latency, plus Clerk's 2 s timeout answered as 401;
 * the task verifier's identity+context join (its grant/SQL/ECS checks are not modelled, so live is slower); an in-memory store;
 * the SDK (the real message sequence: system/init, stream events, assistant, result); runner/runtime and
 * runner/checkpoint/complete, whose owners are outside worker-http (they answer at once and are not counted).
 *
 * Each turn reports time to first published text, time to result, and Core calls per operation. Quiet and the live median
 * must complete (the gate); the live tail and a Clerk timeout are reported. POSIX only (the remote task's SDK directories).
 * Run: node --test --test-concurrency=1 apps/runtime/test/first-turn-rehearsal.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createNativeIdentityContext} from '../native-authority/identity-context.mjs';
import {createCoreMembershipGate} from '../../control/product-access/core-membership.mjs';
import {createActionSessionOwner} from '../../control/action-host/session/owner.mjs';
import {createConversationService} from '../../control/conversations/service.mjs';
import {createConversationLifecycleService} from '../../control/conversations/lifecycle/service.mjs';
import {createWorkerRunApplication} from '../worker-http.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {continuationFixture,id} from '../../worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {runnerStartupBudget} from '../../../packages/runtime/runner-load-budget.mjs';

/** Per-route Core latency in ms (identity / membership / context), from the 10:26Z live Core log. */
export const CORE_PROFILES=Object.freeze({
 quiet:{identity:85,membership:220,context:250},
 'live-median':{identity:100,membership:300,context:500},
 'live-tail':{identity:150,membership:450,context:750},
});
const CLERK_TIMEOUT_MS=2000;
const delay=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted)return reject(Error('aborted'));const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 const abort=()=>{clearTimeout(timer);reject(Error('aborted'));};signal?.addEventListener('abort',abort,{once:true});});

/** One composed first turn. `clerkTimeoutAt` makes that (1-based) Core call wait Core's Clerk timeout and answer 401, as Core does. */
export async function rehearseFirstTurn({profile,clerkTimeoutAt}){
 const latency=CORE_PROFILES[profile];if(!latency)throw Error('unknown profile');
 const f=continuationFixture('resume'),{target}=f;target.sourceRequest.skill=null;target.request.skill=null;
 const binding=f.binding,versions=target.versions,scopes=target.scopes,clientId=id(5),principal={tenantId:binding.tenantId,actorId:binding.actorId};
 const sessionId=f.continuation.checkpoint.sessionId,request=target.sourceRequest,expiry=()=>Date.now()+600000;
 const operation=new AsyncLocalStorage(),calls={},started=performance.now(),at=()=>Math.round(performance.now()-started),marks={};let coreCalls=0;
 const count=route=>{const op=operation.getStore()??'other';calls[op]??={requests:0,core:0};calls[op].core++;calls[op][route]=(calls[op][route]??0)+1;};
 async function coreFetch(url,init){
  const path=new URL(url).pathname,route=path.endsWith('/identity')?'identity':path.endsWith('/context')?'context':path.endsWith('/membership')?'membership':null;
  if(!route)throw Error('unknown local Core route');count(route);
  if(++coreCalls===clerkTimeoutAt){await delay(CLERK_TIMEOUT_MS,init.signal);return Response.json({message:'Application authority unavailable'},{status:401});}
  await delay(latency[route],init.signal);const now=Date.now(),body=JSON.parse(init.body);
  if(route==='identity')return Response.json({principal,identityRevision:'identity-revision',checkedAtMs:now,expiresAtMs:expiry()});
  if(route==='membership')return Response.json({...principal,status:'active',role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:'membership-revision',checkedAtMs:now,expiresAtMs:expiry()});
  return Response.json({principal,identityRevision:'identity-revision',identitySha256:body.identitySha256,conversationId:body.conversationId,selectedClientId:clientId,contextRevision:'context-revision',checkedAtMs:now,expiresAtMs:expiry()});
 }
 // Control: the dynamic first conversation selects this run; the task verifier keeps its own run-bound context.
 const runFact=()=>JSON.stringify({binding,policyRevision:scopes[0].policyRevision,deadlineMs:expiry(),checkedAtMs:Date.now()});
 const currentOwner={async currentRun(){return runFact();},async withCurrentAllocation(){throw Error('unused');}},limits={maxRequestMs:25000,maxFactBytes:65536};
 const identityContext=createNativeIdentityContext({origin:'https://core.synthetic.invalid',commandContext:{binding:{...binding,conversationId:id(901),runId:id(902)},clientResolution:{reference:clientId,clientId}},
  currentOwner,fetchImpl:coreFetch,enabled:true,now:Date.now,limits,admitInitialConversation:async()=>runFact()});
 const verifierContext=createNativeIdentityContext({origin:'https://core.synthetic.invalid',commandContext:{binding,clientResolution:{reference:clientId,clientId}},currentOwner,fetchImpl:coreFetch,enabled:true,now:Date.now,limits});
 const membership=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext,fetchImpl:coreFetch,now:Date.now,limits});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identityContext.verifyIdentity,resolveContext:identityContext.resolveContext,
  membership:{admit:membership.admit,recheck:membership.recheck},now:Date.now,limits:{maxSessions:16,maxRequestMs:25000,maxTtlMs:300000,maxFactBytes:65536}});
 const saved={run:{binding,state:'queued',scopes,versions,createdAt:new Date().toISOString(),policyRevision:scopes[0].policyRevision},request,lastSequence:1},events=[];
 const unused=async()=>{throw Error('unused');};
 const store={accept:unused,async append(_binding,event){events.push(event);if(event.type==='run.status')saved.run.state=event.data.state;
   if(event.type==='message.delta')marks.firstText??=at();return {scopes};},async read(){return structuredClone(saved);},
  lifecycle:{begin:unused,change:unused,get:unused,async controls(){return [];},claim:unused,checkpoint:unused,readCheckpoint:unused,async execution(){return null;},continuation:unused,cancel:unused,readStopFence:unused}};
 const service=createConversationLifecycleService({service:createConversationService({sessions,store,dispatcher:{start:unused,cancel:unused,signal:unused},versions,maxRequestMs:25000}),
  store,dispatcher:{start:unused,cancel:unused,signal:unused},sessions,maxRequestMs:25000,reconcileOriginal:unused,checkpoints:{read:unused}});
 const native={async call(name,input,{signal}={}){if(name!=='worker/authorize')throw Error('unexpected native operation');
  const verified=await verifierContext.verifyIdentity({credential:'synthetic-native',deadlineMs:Date.now()+25000,signal});
  await verifierContext.resolveContext({identityCredential:'synthetic-native',identity:verified,identitySha256:hash(verified),hints:{conversationId:binding.conversationId,runId:binding.runId},deadlineMs:Date.now()+25000,signal});
  const now=Date.now();return {binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-native',scopes,selectedClientId:clientId,
   policyRevision:scopes[0].policyRevision,authorizationDecisionId:'synthetic-decision',checkedAtMs:now,expiresAtMs:expiry()};}};
 const control=createWorkerRunApplication({service,sessions,native,configuration:{limits:{requestMs:25000,requestBytes:131072}},now:Date.now});
 // Runner → control: run-owner operations go to worker-http exactly as prepared-candidate.mjs rewrites them.
 const outside=async(name)=>{
  if(name==='runner/runtime')return {binding,versions,proxyUrl:'https://proxy.example.invalid',proxyCredential:'synthetic-proxy',model:'synthetic-model',deadlineMs:Date.now()+600000,maxTurns:2,maxCostMicroUSD:1,maxOutputBytes:65536};
  if(name==='runner/checkpoint/complete'){const cp=structuredClone(f.continuation.checkpoint);cp.binding=binding;cp.workspace.binding=binding;cp.workspaceSha256=hash(cp.workspace);cp.sessionId=sessionId;
   return {checkpoint:cp,checkpointSha256:hash(cp),sourceRequestSha256:hash(request),contextSha256:hash({window:null,skill:null,scopes}),sessionId,resumeSessionAt:null,verificationId:id(103),
    workspaceReadbackSha256:cp.workspaceSha256,opaqueSessionReadbackSha256:cp.opaqueSession.sha256,checkedAtMs:Date.now(),expiresAtMs:Date.now()+60000};}
  throw Error('unexpected '+name);};
 const root=mkdtempSync(join(tmpdir(),'meri-first-turn-rehearsal-'));mkdirSync(join(root,'config'),{mode:0o700});
 const remoteTask={original:{binding,versions,executionKey:hash(binding),executionId:hash(binding),planSha256:'b'.repeat(64),expiresAtMs:Date.now()+900000},
  preparationIntent:{workspace:join(root,binding.conversationId),configParentDirectory:join(root,'config'),secureStorageDirectory:join(root,'secure'),
   launchTemplate:{command:'/opt/claude',args:[],env:{CLAUDE_SECURESTORAGE_CONFIG_DIR:join(root,'secure')}},executableSha256:'a'.repeat(64),imageSha256:'b'.repeat(64),
   runnerSha256:'c'.repeat(64),sdkOptionsSha256:'d'.repeat(64),authoritySha256:'f'.repeat(64)}};
 // remote-conversation-runner.mjs gives runner/load the startup budget's load stage; every other call passes its own allowance.
 const startup=runnerStartupBudget({requestMs:25000,shutdownMs:1000,originalExpiresAtMs:remoteTask.original.expiresAtMs}).stages;
 const client=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:2097152},credential:'synthetic-task',loadMaxRequestMs:startup.load.maxMs,
  fetch:async(url,init)=>{const name=new URL(url).pathname.slice('/v1/'.length),op=name.slice('runner/'.length);calls[name]??={requests:0,core:0};calls[name].requests++;
   if(!Object.hasOwn(runOwnerOperations,op))return Response.json(await outside(name));
   return operation.run(name,()=>control.handle(new Request(url.replace('/v1/runner/','/internal/conversations/'),init)));}});
 const text=t=>({type:'stream_event',session_id:sessionId,parent_tool_use_id:null,event:{type:'content_block_delta',index:0,delta:{type:'text_delta',text:t}}});
 const execute=assembleConversationRunner({configuration:{binding,versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.example.invalid',limits:{requestMs:25000,shutdownMs:1000},remoteTask},
  native:client,credentialForBinding:async()=>'synthetic-current-task-capability',
  query(args){return {async *[Symbol.asyncIterator](){
   yield {type:'system',subtype:'init',session_id:sessionId};marks.init=at();await args.prompt[Symbol.asyncIterator]().next();
   yield {type:'stream_event',session_id:sessionId,parent_tool_use_id:null,event:{type:'message_start',message:{id:'msg_rehearsal',role:'assistant',content:[]}}};
   yield {type:'stream_event',session_id:sessionId,parent_tool_use_id:null,event:{type:'content_block_start',index:0,content_block:{type:'text',text:''}}};
   yield text('Hello');yield text(' from the rehearsal.');
   yield {type:'stream_event',session_id:sessionId,parent_tool_use_id:null,event:{type:'content_block_stop',index:0}};
   yield {type:'assistant',session_id:sessionId,parent_tool_use_id:null,message:{id:'msg_rehearsal',role:'assistant',content:[{type:'text',text:'Hello from the rehearsal.'}]}};
   yield {type:'result',subtype:'success',is_error:false,session_id:sessionId,result:'Hello from the rehearsal.'};},async interrupt(){return {still_queued:[]};},close(){}};}});
 let outcome;
 try{outcome=await execute({binding}).then(value=>({value}),error=>({error:error?.code??String(error)}));}
 finally{sessions.close();rmSync(root,{recursive:true,force:true});}
 const perOperation=Object.fromEntries(Object.entries(calls).sort());
 return {profile,clerkTimeoutAt:clerkTimeoutAt??null,outcome:outcome.value?.state??outcome.error,initMs:marks.init??null,firstTextMs:marks.firstText??null,resultMs:at(),
  coreCalls:coreCalls,perOperation,published:events.map(e=>e.type==='run.status'?e.data.state:e.type)};
}

const posix={skip:process.platform==='win32'&&'POSIX ownership of the remote task SDK directories',timeout:600000};
for(const profile of ['quiet','live-median'])test(`first turn completes under the ${profile} Core profile`,posix,async t=>{
 const r=await rehearseFirstTurn({profile});t.diagnostic(JSON.stringify(r));
 assert.equal(r.outcome,'completed',JSON.stringify(r));assert.ok(r.firstTextMs!==null,'text was published');
});
for(const [profile,clerkTimeoutAt] of [['live-tail'],['live-median',40]])test(`first turn under the ${profile} Core profile${clerkTimeoutAt?' with a Clerk timeout':''} (reported)`,posix,async t=>{
 t.diagnostic(JSON.stringify(await rehearseFirstTurn({profile,clerkTimeoutAt})));
});

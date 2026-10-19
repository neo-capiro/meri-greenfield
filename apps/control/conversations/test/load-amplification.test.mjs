/** The worker HTTP, native client, session, service and lifecycle load composition
 * against bounded, in-process Core responses. Task-verifier grant/SQL checks are
 * replaced with an instrumented fixed-run identity/context join; those checks
 * need their own tests and this fixture does not prove live DB/pool behavior.
 * Local import-only stubs are opt-in for a checkout without installed dependencies.
 * No external network, database, AWS, model, or credentials are used. */
import {registerHooks} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import test from 'node:test';

const repo=fileURLToPath(new URL('../../../../',import.meta.url));
const packageParent=process.env.MERI_DIAGNOSTIC_DEPS_ROOT?pathToFileURL(resolve(process.env.MERI_DIAGNOSTIC_DEPS_ROOT,'package.json')).href:null;
const localStubs=process.env.MERI_DIAGNOSTIC_IMPORT_STUBS==='1';
registerHooks({resolve(specifier,context,nextResolve){
  if(localStubs&&specifier==='@js-temporal/polyfill')return {url:new URL('./load-only-temporal-stub.mjs',import.meta.url).href,shortCircuit:true};
  if(localStubs&&specifier==='./config.mjs'&&context.parentURL?.includes('/apps/runtime/'))return {url:new URL('./load-only-runtime-config-stub.mjs',import.meta.url).href,shortCircuit:true};
  try{return nextResolve(specifier,context);}catch(error){
    if(packageParent&&!specifier.startsWith('.')&&!specifier.startsWith('/')&&!specifier.startsWith('node:'))return nextResolve(specifier,{...context,parentURL:packageParent});
    throw error;
  }
}});
const imported=async path=>import(pathToFileURL(resolve(repo,path)).href);
const [{createNativeIdentityContext},{createCoreMembershipGate},{createActionSessionOwner},
  {createConversationService,loadWithLifecycle},{createConversationLifecycleService},{createWorkerRunApplication},
  {createNativeCapabilityClient},{binding,scopes,versions,id},{canonicalSha256:hash}]=await Promise.all([
  'apps/runtime/native-authority/identity-context.mjs',
  'apps/control/product-access/core-membership.mjs',
  'apps/control/action-host/session/owner.mjs',
  'apps/control/conversations/service.mjs',
  'apps/control/conversations/lifecycle/service.mjs',
  'apps/runtime/worker-http.mjs',
  'apps/runtime/native-client.mjs',
  'apps/control/conversations/test/store-fixture.mjs',
  'packages/contracts/validate.mjs',
].map(imported));

const delay=(ms,signal)=>new Promise((done,fail)=>{
  if(signal?.aborted)return fail(Error('aborted'));
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',aborted);done();},ms);
  const aborted=()=>{clearTimeout(timer);fail(Error('aborted'));};
  signal?.addEventListener('abort',aborted,{once:true});
});
async function one({mode,latencyMs=0,serverMs=3000,nativeMs=3000,duringJournal,nextTurn=false,journalExtra=true,foreignStoredBinding=false}={}){
  const started=performance.now(),counts={identity:0,context:0,membership:0,taskAuthorization:0,currentRun:0,read:0,journalExecution:0,retention:0};
  const principal={tenantId:binding.tenantId,actorId:binding.actorId};
  const commandBinding=mode==='dynamic'?{...binding,conversationId:id(901),runId:id(902)}:binding;
  const clientId=id(5),expiry=()=>Date.now()+60000;
  const state={membershipStatus:'active',membershipRevision:'membership-revision',policyRevision:scopes[0].policyRevision,selectedClientId:clientId,retention:'servable'};
  async function coreFetch(url,init){
    const path=new URL(url).pathname;
    const route=path.endsWith('/identity')?'identity':path.endsWith('/context')?'context':path.endsWith('/membership')?'membership':null;
    if(!route)throw Error('unknown local Core route');
    counts[route]++;
    await delay(latencyMs,init.signal);
    const at=Date.now(),body=JSON.parse(init.body);
    if(route==='identity')return Response.json({principal,identityRevision:'identity-revision',checkedAtMs:at,expiresAtMs:expiry()});
    if(route==='membership')return Response.json({...principal,status:state.membershipStatus,role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:state.membershipRevision,checkedAtMs:at,expiresAtMs:expiry()});
    return Response.json({principal,identityRevision:'identity-revision',identitySha256:body.identitySha256,conversationId:body.conversationId,selectedClientId:state.selectedClientId,contextRevision:'context-revision',checkedAtMs:at,expiresAtMs:expiry()});
  }
  const runFact=()=>({binding,policyRevision:state.policyRevision,deadlineMs:expiry(),checkedAtMs:Date.now()});
  const identityContext=createNativeIdentityContext({origin:'https://core.synthetic.invalid',commandContext:{binding:commandBinding,clientResolution:{reference:clientId,clientId}},
    currentOwner:{async currentRun(){counts.currentRun++;return JSON.stringify(runFact());},async withCurrentAllocation(){throw Error('unused');}},
    fetchImpl:coreFetch,enabled:true,now:Date.now,limits:{maxRequestMs:serverMs,maxFactBytes:65536},
    ...(mode==='dynamic'?{admitInitialConversation:async()=>JSON.stringify(runFact())}:{})});
  // The admitted task verifier has a separate, run-bound fixed context even
  // when control selects a dynamic initial conversation.
  const verifierContext=createNativeIdentityContext({origin:'https://core.synthetic.invalid',commandContext:{binding,clientResolution:{reference:clientId,clientId}},
    currentOwner:{async currentRun(){counts.currentRun++;return JSON.stringify(runFact());},async withCurrentAllocation(){throw Error('unused');}},
    fetchImpl:coreFetch,enabled:true,now:Date.now,limits:{maxRequestMs:serverMs,maxFactBytes:65536}});
  const membership=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext,fetchImpl:coreFetch,now:Date.now,limits:{maxRequestMs:serverMs,maxFactBytes:65536}});
  const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identityContext.verifyIdentity,resolveContext:identityContext.resolveContext,membership:{admit:membership.admit,recheck:membership.recheck},now:Date.now,
    limits:{maxSessions:4,maxRequestMs:serverMs,maxTtlMs:60000,maxFactBytes:65536}});
  const saved={run:{binding,state:'queued',scopes,versions,createdAt:new Date().toISOString(),policyRevision:scopes[0].policyRevision},request:{requestId:id(6),prompt:'Synthetic only',skill:null,window:null,windowRequest:null},lastSequence:1};
  if(foreignStoredBinding)saved.run.binding={...binding,tenantId:'other-tenant'};
  const stub=async()=>{throw Error('unused');};
  const store={accept:stub,append:stub,async read(){counts.read++;return structuredClone(saved);},
    ...(nextTurn?{nextRuns:{async execution(){return {nextTurn:{fixtureMarker:'new-turn'}};}}}:{}),
    lifecycle:{begin:stub,change:stub,get:stub,controls:stub,claim:stub,checkpoint:stub,readCheckpoint:stub,async execution(){counts.journalExecution++;duringJournal?.({state,saved});return journalExtra?{fixtureMarker:'journal-read'}:null;},continuation:stub,cancel:stub,readStopFence:stub}};
  const dispatcher={start:stub,cancel:stub,signal:stub};
  const retention={async assertServable(){counts.retention++;if(state.retention!=='servable')throw Error('RETENTION_SUPPRESSED');}};
  const basic=createConversationService({sessions,store,dispatcher,versions,maxRequestMs:serverMs,retention});
  const service=createConversationLifecycleService({service:basic,store,dispatcher,sessions,maxRequestMs:serverMs,reconcileOriginal:stub,checkpoints:{read:stub}});
  const native={async call(operation,input,{signal}={}){if(operation!=='worker/authorize')throw Error('unexpected native operation');counts.taskAuthorization++;
    const verified=await verifierContext.verifyIdentity({credential:'synthetic-native',deadlineMs:Date.now()+serverMs,signal});
    await verifierContext.resolveContext({identityCredential:'synthetic-native',identity:verified,identitySha256:hash(verified),hints:{conversationId:binding.conversationId,runId:binding.runId},deadlineMs:Date.now()+serverMs,signal});
    const at=Date.now();return {binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-native',scopes,selectedClientId:clientId,
      policyRevision:scopes[0].policyRevision,authorizationDecisionId:'synthetic-decision',checkedAtMs:at,expiresAtMs:expiry()};}};
  const app=createWorkerRunApplication({service,sessions,native,configuration:{limits:{requestMs:serverMs,requestBytes:131072}},now:Date.now});
  let responseStatus;
  const client=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:2097152},credential:'synthetic-task',now:Date.now,maxRequestMs:nativeMs,
    fetch:async(url,init)=>{const response=await app.handle(new Request(url.replace('/v1/runner/load','/internal/conversations/load'),init));responseStatus=response.status;return response;}});
  let outcome,value;
  const transport=client.call('runner/load',{binding},{deadlineMs:Date.now()+6000});
  try{value=await transport;outcome='200';}
  catch(error){outcome=error?.code??error?.message??'error';}
  finally{sessions.close();}
  return {mode,latencyMs,serverMs,nativeMs,outcome,value,responseStatus,durationMs:Math.round(performance.now()-started),coreCalls:counts.identity+counts.context+counts.membership,counts};
}

test('fused runner/load keeps the original authority gates with bounded Core fanout',async()=>{
  const fixed=await one({mode:'fixed'}),dynamic=await one({mode:'dynamic'});
  assert.equal(fixed.outcome,'200',JSON.stringify(fixed));
  assert.equal(dynamic.outcome,'200',JSON.stringify(dynamic));
  assert.equal(fixed.value.fixtureMarker,'journal-read');
  assert.equal(dynamic.value.fixtureMarker,'journal-read');
  assert.equal(fixed.coreCalls,51,JSON.stringify(fixed));
  assert.equal(dynamic.coreCalls,62,JSON.stringify(dynamic));
  for(const result of [fixed,dynamic]){
    assert.equal(result.counts.taskAuthorization,3);
    assert.equal(result.counts.journalExecution,1);
    assert.equal(result.counts.read,2,'initial and post-journal run/request reads');
    assert.equal(result.counts.retention,4,'before, across and after journal plus outer release');
  }
});

test('35 ms serial Core responses fit the fused load deadline',async()=>{
  const result=await one({mode:'dynamic',latencyMs:35});
  assert.equal(result.outcome,'200',JSON.stringify(result));
  assert.equal(result.coreCalls,62);
  assert.ok(result.durationMs<3000,JSON.stringify(result));
});

test('native client retains its independent three-second cap',async()=>{
  const result=await one({mode:'dynamic',latencyMs:85,serverMs:5000,nativeMs:3000});
  assert.equal(result.outcome,'DEADLINE',JSON.stringify(result));
  assert.ok(result.durationMs>=2900&&result.durationMs<4000,JSON.stringify(result));
});

test('load accepts a next turn alone and refuses ambiguous continuation lineage',async()=>{
  const next=await one({mode:'dynamic',nextTurn:true,journalExtra:false});
  assert.equal(next.outcome,'200',JSON.stringify(next));
  assert.equal(next.value.nextTurn.fixtureMarker,'new-turn');
  const ambiguous=await one({mode:'dynamic',nextTurn:true});
  assert.equal(ambiguous.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(ambiguous));
  assert.equal(ambiguous.responseStatus,403);
  assert.equal(ambiguous.value,undefined);
});

test('a consistently foreign stored run cannot pass the fused load',async()=>{
  const result=await one({mode:'dynamic',foreignStoredBinding:true});
  assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));
  assert.equal(result.responseStatus,403);
  assert.equal(result.value,undefined);
});

test('the fused load independently refuses an out-of-scope selected client',async()=>{
  const principal={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId};
  const sessions={async authenticateSession(){const at=Date.now();return {principal,checkedAtMs:at,expiresAtMs:at+30000};},
    async readCurrentState({authentication}){const at=Date.now();return {authenticationSha256:hash(authentication),binding,scopes,selectedClientId:id(777),checkedAtMs:at,expiresAtMs:at+30000};}};
  const unused=async()=>{throw Error('must not read');};
  const service=createConversationService({sessions,store:{accept:unused,append:unused,read:unused},dispatcher:{start:unused,cancel:unused},versions});
  await assert.rejects(service[loadWithLifecycle]({credential:'synthetic',binding},unused),/SCOPE_REFUSED/u);
});

for(const [name,mutate] of [
  ['membership revocation',({state})=>{state.membershipStatus='removed';}],
  ['selected client drift',({state})=>{state.selectedClientId=id(777);}],
  ['current policy drift',({state})=>{state.policyRevision='changed';}],
  ['retention suppression',({state})=>{state.retention='suppressed';}],
  ['saved tenant drift',({saved})=>{saved.run.binding={...saved.run.binding,tenantId:'other-tenant'};}],
  ['saved request drift',({saved})=>{saved.request.prompt='Changed during journal';}],
])test(`mid-journal ${name} cannot release a load receipt`,async()=>{
  const result=await one({mode:'dynamic',duringJournal:mutate});
  assert.equal(result.counts.journalExecution,1,JSON.stringify(result));
  assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));
  assert.equal(result.responseStatus,403,JSON.stringify(result));
  assert.equal(result.value,undefined);
});

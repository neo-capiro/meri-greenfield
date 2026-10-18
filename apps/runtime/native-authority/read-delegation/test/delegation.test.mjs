/** Option B, Meri side, in isolation: Neo's bounds (attended 30 min total from issuance, unattended 15 min per occurrence under a
 * <=30-day consent, pause/revoke ends authority, no write ever), per-slot ceilings derived from the admitted call, lost-response
 * retries, Stop ordering, and the adapter's result/body bindings. Stub Core only; no credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {composeGeneralReadAllocation} from '../../../../gateway/budget/general-read-allocation.mjs';
import {GENERAL_READ_DEFAULT_RUN_BUDGETS} from '../../../../gateway/budget/general-read-manifest.mjs';
import {READ_TOKEN_CEILINGS,READ_DELEGATION_LIMITS,OBSERVATION_CALLS,tokenRequest,assertCurrentReceipt,operationsDigest,toolRoute,READ_DELEGATION_ROUTES} from '../contract.mjs';
import {createRunReadDelegation} from '../delegation.mjs';
import {composeDelegatedNativeCredentials} from '../native-credentials.mjs';
import {nativeReadFault} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';
import {lostResponseFault} from '../core-client.mjs';

const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const MIN=60000,T0=1800000000000;
const binding={tenantId:uuid('b'),actorId:uuid('c'),conversationId:uuid('1'),runId:uuid('2'),attemptId:uuid('3'),workerId:uuid('4'),writerFence:1};
const clientId=uuid('a'),policyRevision='9'.repeat(64),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision}];
const read={id:'search_tracked_bills',version:'0.2.0'},mode={id:'search_federal_grants',version:'0.2.0'};
const code=expected=>error=>error.message===expected;
function allocationJson({maxToolCalls=GENERAL_READ_DEFAULT_RUN_BUDGETS.maxToolCalls}={}){
 return JSON.stringify(composeGeneralReadAllocation({run:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},operations:[read,mode],
  runBudgets:{...GENERAL_READ_DEFAULT_RUN_BUDGETS,maxToolCalls},catalogSha256:'c'.repeat(64),scheduleRevision:'d'.repeat(64),expiresAt:new Date(T0+24*60*MIN).toISOString()}).allocation);
}
/** Stub Core: records requests; `expiry(bound)` picks the receipt expiry; `lose` drops that many token responses. */
function stub({clock,expiry=bound=>bound,lose=0,failRevokes=0}={}){
 const s={creates:[],tokens:[],revokes:0,lose,failRevokes,hang:null,n:0};
 const client={available:true,origin:'https://core.example.invalid',
  async create({request,liveCredential}){s.creates.push({request,liveCredential});const issued=clock.t;
   const bound=request.mode==='attended'?issued+30*MIN:issued+15*MIN;return {schemaVersion:1,delegationId:uuid(String(s.creates.length%10)),expiresAtMs:expiry(bound),checkedAtMs:issued};},
  async issueToken({request,signal}){s.tokens.push(request);
   if(s.hang){await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(nativeReadFault('CANCELLED')),{once:true}));}
   if(s.lose>0){s.lose--;throw lostResponseFault('UNAVAILABLE');}
   return {schemaVersion:1,token:`tok-${++s.n}`,expiresAtMs:clock.t+MIN};},
  async revoke(){s.revokes++;if(s.failRevokes>0){s.failRevokes--;throw nativeReadFault('UNAVAILABLE');}return {schemaVersion:1};}};
 return {s,client};
}
function delegation({clock,client,live=true,occurrence=null,runDeadlineMs=T0+60*MIN,maxToolCalls}){
 const calls={live:0,occurrence:0};
 const d=createRunReadDelegation({binding,scopes,allocationJson:allocationJson({maxToolCalls}),runDeadlineMs,client,now:()=>clock.t,
  liveCredentialFor:async()=>{calls.live++;const v=typeof live==='function'?live():live;if(!v)throw Error('no session');return {credential:'SYNTHETIC_LIVE',expiresAtMs:clock.t+5*MIN};},
  readOccurrence:async()=>{calls.occurrence++;return typeof occurrence==='function'?occurrence():occurrence;}});
 return {d,calls};
}
const tokenCall=(over={})=>({kind:'current',callKey:'owned_11111111-1111-4111-8111-111111111111',body:{schemaVersion:1,conversation:false},deadlineMs:T0+120*MIN,...over});

test('the per-slot ceilings are the admitted call\'s own arithmetic, never the allocation schedule length',()=>{
 assert.deepEqual({...READ_TOKEN_CEILINGS},{tool:1,current:35,mode:7,reference:7});
 assert.equal(READ_TOKEN_CEILINGS.current,7*OBSERVATION_CALLS.mode.current);assert.equal(READ_TOKEN_CEILINGS.mode,7*OBSERVATION_CALLS.mode.mode);
});

test('attended: created from a live session, at most 30 minutes from issuance and never past the run deadline',async()=>{
 const clock={t:T0};
 {const {s,client}=stub({clock}),{d}=delegation({clock,client});const r=await d.ensure();
  assert.equal(s.creates[0].liveCredential,'SYNTHETIC_LIVE');assert.equal(s.creates[0].request.mode,'attended');assert.equal(s.creates[0].request.supersedes,null);
  assert.equal(r.expiresAtMs,T0+30*MIN);assert.equal(d.hardExpiry(),T0+30*MIN);assert.equal(d.mode,'attended');}
 for(const [label,expiry,deadline] of [['beyond 30 minutes',b=>b+READ_DELEGATION_LIMITS.clockSkewMs+1,T0+60*MIN],['beyond the run deadline',b=>b,T0+10*MIN]]){
  const {client}=stub({clock,expiry}),{d}=delegation({clock,client,runDeadlineMs:deadline});
  if(label==='beyond the run deadline')await assert.rejects(d.ensure(),code('ACCESS_DENIED'),label);else await assert.rejects(d.ensure(),code('ACCESS_DENIED'),label);
 }
});

test('attended: it outlives the creating session; renewal is a new superseding delegation from a live login only',async()=>{
 const clock={t:T0};let live=true;const {s,client}=stub({clock}),{d}=delegation({clock,client,live:()=>live});
 const first=await d.ensure();live=false;clock.t+=29*MIN;assert.equal((await d.ensure()).delegationId,first.delegationId,'no session needed while current');
 clock.t+=MIN;await assert.rejects(d.ensure(),code('UNAVAILABLE'),'30 minutes TOTAL: no extension and no session');assert.equal(s.creates.length,1);
 live=true;const second=await d.ensure();assert.equal(s.creates[1].request.supersedes,first.delegationId);assert.notEqual(second.delegationId,first.delegationId);
 assert.equal(second.expiresAtMs,clock.t+30*MIN);
});

function occurrence(clock,over={}){
 const a=JSON.parse(allocationJson());
 return {consentId:uuid('5'),consentState:'active',consentExpiresAtMs:clock.t+20*86400000,consentCreatedAtMs:clock.t-10*86400000,scheduleId:uuid('6'),occurrenceKey:'e'.repeat(64),
  startedAtMs:clock.t,clientId,operationsDigest:operationsDigest(a.manifest.allowedOperations),policyRevision,runBinding:binding,...over};
}
test('unattended: one delegation per occurrence under an active consent, at most 15 minutes, never renewed, no user bearer',async()=>{
 const clock={t:T0};const {s,client}=stub({clock}),{d,calls}=delegation({clock,client,occurrence:()=>occurrence({t:T0})});
 const r=await d.ensure();assert.equal(d.mode,'unattended');assert.equal(calls.live,0,'never asks for a session');assert.equal(s.creates[0].liveCredential,undefined);
 assert.equal(s.creates[0].request.consentId,uuid('5'));assert.equal(s.creates[0].request.occurrenceKey,'e'.repeat(64));assert.equal(r.expiresAtMs,T0+15*MIN);
 clock.t+=15*MIN;await assert.rejects(d.ensure(),code('UNAVAILABLE'));assert.equal(s.creates.length,1,'never renewed');
 // A pause mid-occurrence ends authority at the next token, before Core is asked.
 {const c0={t:T0};let state='active';const {s:s0,client:k0}=stub({clock:c0}),{d:d0}=delegation({clock:c0,client:k0,occurrence:()=>occurrence({t:T0},{consentState:state})});
  await d0.token(tokenCall());state='paused';await assert.rejects(d0.token(tokenCall()),code('UNAVAILABLE'));assert.equal(s0.tokens.length,1);}
 // The consent's own expiry bounds the occurrence too.
 const short={t:T0},{client:c2}=stub({clock:short}),{d:d2}=delegation({clock:short,client:c2,occurrence:()=>occurrence(short,{consentExpiresAtMs:T0+5*MIN})});
 await assert.rejects(d2.ensure(),code('ACCESS_DENIED'),'Core answering past the consent is refused');
 const {client:c3}=stub({clock:short,expiry:()=>T0+5*MIN}),{d:d3}=delegation({clock:short,client:c3,occurrence:()=>occurrence(short,{consentExpiresAtMs:T0+5*MIN})});
 assert.equal((await d3.ensure()).expiresAtMs,T0+5*MIN);
});

test('unattended: paused, revoked or expired consent, or any change of scope, ends authority before Core is asked',async()=>{
 const clock={t:T0};
 for(const [over,expected] of [[{consentState:'paused'},'UNAVAILABLE'],[{consentState:'revoked'},'UNAVAILABLE'],[{consentExpiresAtMs:T0},'UNAVAILABLE'],
  [{consentCreatedAtMs:T0-31*86400000,consentExpiresAtMs:T0+MIN},'UNAVAILABLE'],[{clientId:uuid('7')},'ACCESS_DENIED'],[{operationsDigest:'0'.repeat(64)},'ACCESS_DENIED'],
  [{policyRevision:'8'.repeat(64)},'ACCESS_DENIED'],[{runBinding:{...binding,writerFence:2}},'ACCESS_DENIED']]){
  const {s,client}=stub({clock}),{d}=delegation({clock,client,occurrence:()=>occurrence(clock,over)});
  await assert.rejects(d.ensure(),code(expected),JSON.stringify(over));assert.equal(s.creates.length,0);
 }
});

test('tokens: per-slot ceilings and the run call allowance refuse locally before Core',async()=>{
 const clock={t:T0};const {s,client}=stub({clock}),{d}=delegation({clock,client,maxToolCalls:2});
 const tool=over=>tokenCall({kind:'tool',path:toolRoute(read),bodySha256:'1'.repeat(64),body:undefined,operation:read,argumentsSha256:'2'.repeat(64),...over});
 await d.token(tool());await assert.rejects(d.token(tool()),code('RESOURCE_LIMIT'),'one tool token per slot');
 for(let i=0;i<READ_TOKEN_CEILINGS.current;i++)await d.token(tokenCall());await assert.rejects(d.token(tokenCall()),code('RESOURCE_LIMIT'));
 await d.token(tokenCall({callKey:'owned_22222222-2222-4222-8222-222222222222'}));
 await assert.rejects(d.token(tokenCall({callKey:'owned_33333333-3333-4333-8333-333333333333'})),code('RESOURCE_LIMIT'),'a third slot exceeds maxToolCalls 2');
 assert.equal(s.tokens.length,1+READ_TOKEN_CEILINGS.current+1);
});

test('tokens: a lost response is re-requested as a retry of the same request, at most twice; refusals are never retried',async()=>{
 const clock={t:T0};
 {const {s,client}=stub({clock,lose:2}),{d}=delegation({clock,client});
  const t=await d.token(tokenCall());assert.match(t.token,/^tok-/u);
  assert.equal(s.tokens.length,3);assert.equal(s.tokens[0].retryOf,null);
  for(const retry of s.tokens.slice(1))assert.equal(retry.retryOf,hash(s.tokens[0]));}
 {const {s,client}=stub({clock,lose:3}),{d}=delegation({clock,client});
  await assert.rejects(d.token(tokenCall()),code('UNAVAILABLE'));assert.equal(s.tokens.length,3,'first + two retries');}
 {const {s,client}=stub({clock}),{d}=delegation({clock,client});client.issueToken=async input=>{s.tokens.push(input.request);throw nativeReadFault('ACCESS_DENIED');};
  await assert.rejects(d.token(tokenCall()),code('ACCESS_DENIED'));assert.equal(s.tokens.length,1);}
});

test('tokens: receipts longer than 60 s, or past the hard expiry, are capped or refused',async()=>{
 const clock={t:T0};const {client}=stub({clock}),{d}=delegation({clock,client});
 client.issueToken=async()=>({schemaVersion:1,token:'tok-long',expiresAtMs:clock.t+MIN+READ_DELEGATION_LIMITS.clockSkewMs+1});
 await assert.rejects(d.token(tokenCall()),code('ACCESS_DENIED'));
 const late={t:T0},{client:c2}=stub({clock:late}),{d:d2}=delegation({clock:late,client:c2,runDeadlineMs:T0+30000});
 c2.create=async()=>({schemaVersion:1,delegationId:uuid('1'),expiresAtMs:T0+30000,checkedAtMs:T0});
 assert.equal((await d2.token(tokenCall())).expiresAtMs,T0+30000,'capped by the run deadline');
});

test('Stop: refused locally at once, in-flight requests aborted, revoke best-effort with bounded retries',async()=>{
 const clock={t:T0};const {s,client}=stub({clock,failRevokes:5}),{d}=delegation({clock,client});
 await d.token(tokenCall());s.hang=true;const pending=d.token(tokenCall({callKey:'owned_22222222-2222-4222-8222-222222222222'}));
 const stopped=await d.stop('cancelled');assert.deepEqual(stopped,{stopped:true,revoked:false});assert.equal(s.revokes,READ_DELEGATION_LIMITS.revokeAttempts);
 await assert.rejects(pending);const before=s.tokens.length;s.hang=null;
 await assert.rejects(d.token(tokenCall()),code('UNAVAILABLE'));await assert.rejects(d.ensure(),code('UNAVAILABLE'));assert.equal(s.tokens.length,before);assert.equal(s.creates.length,1);
 assert.throws(()=>d.assertReleasable(),code('UNAVAILABLE'));assert.deepEqual(await d.stop('cancelled'),{stopped:true,revoked:false},'idempotent');
});

test('no write is ever delegated: token requests are read-only, exact-route and body-bound',()=>{
 const base={callKey:'owned_1',bodySha256:'1'.repeat(64)};
 assert.throws(()=>tokenRequest({...base,kind:'tool',path:'/api/clio/tools/create_word',operation:{id:'create_word',version:'0.2.0'},argumentsSha256:'2'.repeat(64)}),code('ACCESS_DENIED'));
 assert.throws(()=>tokenRequest({...base,kind:'tool',path:'/api/clio/tools/search_state_bills',operation:read,argumentsSha256:'2'.repeat(64)}),code('INVALID_ARGUMENTS'),'path must be the operation\'s own');
 assert.throws(()=>tokenRequest({...base,kind:'tool',path:toolRoute(read),operation:read}),code('INVALID_ARGUMENTS'),'tool needs the reservation arguments hash');
 assert.throws(()=>tokenRequest({...base,kind:'mode',path:READ_DELEGATION_ROUTES.mode,operation:read,toolRequestSha256:'3'.repeat(64)}),code('INVALID_ARGUMENTS'),'mode only for mode reads');
 assert.throws(()=>tokenRequest({...base,kind:'current',path:'/api/clio/application-authority/membership'}),code('INVALID_ARGUMENTS'));
 assert.equal(tokenRequest({...base,kind:'mode',path:READ_DELEGATION_ROUTES.mode,operation:mode,toolRequestSha256:'3'.repeat(64)}).toolRequestSha256,'3'.repeat(64));
});

test('current receipts: exactly the delegated client, delegation and run conversation; never a roster',()=>{
 const started=T0,now=()=>T0+10,ok={schemaVersion:1,delegationId:uuid('1'),principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'a'.repeat(64),actorRole:'standard_user',
  membershipRevision:'b'.repeat(64),clientIds:[clientId],checkedAtMs:T0+5,expiresAtMs:T0+1000};
 const check=(raw,conversation=false)=>assertCurrentReceipt(raw,{delegationId:uuid('1'),binding,clientId,conversation,started,now});
 assert.doesNotThrow(()=>check(ok));
 for(const bad of [{...ok,clientIds:[clientId,uuid('7')]},{...ok,clientIds:[uuid('7')]},{...ok,delegationId:uuid('2')},{...ok,principal:{...ok.principal,actorId:uuid('7')}},{...ok,conversation:{conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:'r'}}])
  assert.throws(()=>check(bad),code('ACCESS_DENIED'));
 assert.doesNotThrow(()=>check({...ok,conversation:{conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:'r'}},true));
 assert.throws(()=>check({...ok,conversation:{conversationId:uuid('7'),selectedClientId:clientId,contextRevision:'r'}},true),code('ACCESS_DENIED'));
});

test('adapter: a reference resolving to another client is refused; mode tokens carry the operation and request hash; unknown handles refuse',async()=>{
 const clock={t:T0},requests=[];const {client}=stub({clock}),{d}=delegation({clock,client});
 client.issueToken=async({request})=>{requests.push(request);return {schemaVersion:1,token:`tok-${requests.length}`,expiresAtMs:clock.t+MIN};};
 let checkRef=clientId;
 client.target=async({path,body})=>{
  if(path.endsWith('/current'))return {schemaVersion:1,delegationId:d.delegationId,principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'a'.repeat(64),actorRole:'standard_user',membershipRevision:'b'.repeat(64),clientIds:[clientId],checkedAtMs:clock.t,expiresAtMs:clock.t+30000};
  if(path===READ_DELEGATION_ROUTES.reference)return {ok:true,clientId:checkRef};
  const parsed=JSON.parse(body);return {operation:parsed.operation,requestSha256:parsed.requestSha256,principal:{tenantId:binding.tenantId,actorId:binding.actorId},surface:'chat',evidenceAccuracyMode:'off'};};
 const x=composeDelegatedNativeCredentials({delegation:d,client,now:()=>clock.t});
 const {credential}=await x.getNativeCredential({binding,callKey:'owned_1',deadlineMs:T0+MIN});
 assert.match(credential,/^mrd\./u);assert.equal(x.isDelegated(credential),true);
 assert.equal((await x.coreAuthority.readClientReference({credential,reference:'Acme',deadlineMs:T0+MIN})).clientId,clientId);
 checkRef=uuid('7');await assert.rejects(x.coreAuthority.readClientReference({credential,reference:'Other',deadlineMs:T0+MIN}),code('ACCESS_DENIED'));
 await x.coreAuthority.readModeObservation({credential,serviceSecret:'SYNTHETIC_SERVICE',operation:mode,requestSha256:'4'.repeat(64),deadlineMs:T0+MIN});
 const m=requests.find(r=>r.kind==='mode');assert.deepEqual(m.operation,mode);assert.equal(m.toolRequestSha256,'4'.repeat(64));
 await assert.rejects(x.coreAuthority.readCurrent({credential:'mrd.forged',deadlineMs:T0+MIN}),code('UNAVAILABLE'),'no fallback: unknown handles refuse');
 await assert.rejects(x.toolCredential({credential,operation:{id:'create_word',version:'0.2.0'},argumentsSha256:'2'.repeat(64),target:{method:'POST',path:'/api/clio/tools/create_word',bodySha256:'1'.repeat(64)},deadlineMs:T0+MIN}),code('ACCESS_DENIED'));
 await assert.rejects(x.toolCredential({credential,operation:read,argumentsSha256:'2'.repeat(64),target:{method:'POST',path:'/api/clio/tools/other',bodySha256:'1'.repeat(64)},deadlineMs:T0+MIN}),code('ACCESS_DENIED'));
 assert.equal(await x.toolCredential({credential:'SYNTHETIC_OPTION_A_BEARER',operation:read,argumentsSha256:'2'.repeat(64),target:{method:'POST',path:toolRoute(read),bodySha256:'1'.repeat(64)},deadlineMs:T0+MIN}),null,'option A credentials are left to option A');
});

test('adapter: every delegated target call carries the Stop signal of the run and is aborted by Stop',async()=>{
 const clock={t:T0};const {client}=stub({clock}),{d}=delegation({clock,client});
 client.issueToken=async()=>({schemaVersion:1,token:'tok-1',expiresAtMs:clock.t+MIN});
 let aborted=false;client.target=({signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(nativeReadFault('CANCELLED'));},{once:true}));
 const x=composeDelegatedNativeCredentials({delegation:d,client,now:()=>clock.t});
 const {credential}=await x.getNativeCredential({binding,callKey:'owned_1',deadlineMs:T0+MIN});
 const pending=x.coreAuthority.readCurrent({credential,deadlineMs:T0+MIN});pending.catch(()=>{});
 await new Promise(resolve=>setTimeout(resolve,5));await d.stop('cancelled');
 await assert.rejects(pending);assert.equal(aborted,true);
});

test('adapter relays the signed retained source correlation into the one-use Core tool token',async()=>{
 const clock={t:T0},{s,client}=stub({clock}),{d}=delegation({clock,client});
 const x=composeDelegatedNativeCredentials({delegation:d,client,now:()=>clock.t});
 const {credential}=await x.getNativeCredential({binding,callKey:'owned_signed_1',deadlineMs:T0+MIN});
 const operation={id:'read_client_documents',version:'0.2.0'},correlationSha256='e'.repeat(64),bodySha256='f'.repeat(64);
 const receipt=await x.toolCredential({credential,operation,argumentsSha256:'a'.repeat(64),
  target:{method:'POST',path:toolRoute(operation),bodySha256},correlationSha256,deadlineMs:T0+MIN});
 assert.equal(receipt.authorizationScheme,'CapiroMeriRead');
 const issued=s.tokens.find(request=>request.kind==='tool');
 assert.equal(issued.callKey,'owned_signed_1');assert.deepEqual(issued.operation,operation);
 assert.equal(issued.correlationSha256,correlationSha256);assert.equal(issued.bodySha256,bodySha256);
});

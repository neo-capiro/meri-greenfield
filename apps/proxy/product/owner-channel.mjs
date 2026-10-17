/** One request of the unmounted HTTPS :8444 product owner protocol.
 *
 * The future listener must supply TLS-derived peer evidence and a separately
 * verified proxy task lease independently on every POST, then route each
 * owner-issued session ID to this one object. Neither header nor body claims
 * may populate this peer object. This
 * module opens no listener, creates no certificate and has no budget store.
 * The existing product persisted-facts owner selects by the SHA-256 of the
 * actual observed bearer. The caller's request ID is only a one-send slot.
 */
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {BudgetCommitUncertain} from '../../gateway/budget/postgres-budget-store.mjs';
import {createProductProxyOwnerComposition} from './product-owner-composition.mjs';
import {captureCallRequest,captureCompleteRequest,decodeCompleteCaptureFrame,
 decodeReservationFrame,decodeSettlementFrame,parseOwnerWire} from './owner-wire-codec.mjs';

export const OWNER_PATHS=Object.freeze({
 open:'/v1/internal/product-model/owner/session/open',
 operation:'/v1/internal/product-model/owner/operation',
 poll:'/v1/internal/product-model/owner/capture/poll',
 reply:'/v1/internal/product-model/owner/capture/reply',
});
const MAX_WIRE=12*1024*1024;
const SLOT=/^[A-Za-z0-9_-]{1,128}$/u;
const SHA=/^[0-9a-f]{64}$/u;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const deny=()=>{throw Error('PRODUCT_OWNER_CHANNEL_DENIED');};
const slot=value=>typeof value==='string'&&SLOT.test(value)?value:deny();
const digest=value=>typeof value==='string'&&SHA.test(value)?value:deny();
const tuple=(value,n)=>Array.isArray(value)&&value.length===n?value:deny();
const raw=value=>Buffer.isBuffer(value)&&value.length>0&&value.length<=MAX_WIRE?value:deny();
const bytes=value=>{const result=Buffer.from(JSON.stringify(value));return raw(result);};
const equalDigest=(a,b)=>timingSafeEqual(Buffer.from(digest(a),'hex'),Buffer.from(digest(b),'hex'));
const serviceGates=new WeakSet();
const poolGates=new WeakMap(),factsGates=new WeakMap();
const admissionReads=new WeakMap();
const channelPeers=new WeakMap();

function bindServiceGate(serviceGate,persistedFacts,pool){
 if(!serviceGates.has(serviceGate)||!serviceGate.available||
    (poolGates.has(pool)&&poolGates.get(pool)!==serviceGate)||
    (factsGates.has(persistedFacts)&&factsGates.get(persistedFacts)!==serviceGate))deny();
 poolGates.set(pool,serviceGate);factsGates.set(persistedFacts,serviceGate);
}

/** Share ONE gate across all sessions of a service revision. A timed out
 * database/capture promise may still finish; only process retirement or an
 * independently reviewed reconciliation may replace a poisoned gate.
 */
export function createProductOwnerServiceGate(){
 let available=true,pending=0;
 const gate=Object.freeze({
  get available(){return available;},
  get pending(){return pending;},
  begin(){
   if(!available)deny();
   pending++;
   let finished=false;
   return ()=>{if(!finished){finished=true;pending--;}};
  },
  poison(){available=false;},
 });
 serviceGates.add(gate);
 return gate;
}

function principal(policy,peer){
 if(!peer||typeof peer!=='object'||Array.isArray(peer)||
    Object.keys(peer).sort().join()!==[
     'clientCertSha256','clientSubject','connectionId','deploymentRevision',
     'issuerSha256','proxyTaskArn','tlsVersion'].sort().join())deny();
 if(peer.tlsVersion!=='TLSv1.3'||peer.clientSubject!==policy.clientSubject||
    peer.proxyTaskArn!==policy.proxyTaskArn||peer.deploymentRevision!==policy.deploymentRevision||
    !equalDigest(peer.clientCertSha256,policy.clientCertSha256)||
    !equalDigest(peer.issuerSha256,policy.issuerSha256))deny();
 return slot(peer.connectionId);
}

function channelPeer(serviceGate,policy,peer,carrier){
 if(!['operation','capture'].includes(carrier))deny();
 const id=principal(policy,peer),key=JSON.stringify([policy.ownerTaskArn,policy.proxyTaskArn]);
 if(!channelPeers.has(serviceGate))channelPeers.set(serviceGate,new Map());
 const policies=channelPeers.get(serviceGate),pin=canonicalSha256(policy);
 if(!policies.has(key))policies.set(key,{pin,roles:new Map()});
 const state=policies.get(key);
 if(state.pin!==pin||state.roles.has(id)&&state.roles.get(id)!==carrier)deny();
 if(!state.roles.has(id)&&state.roles.size>=4096){serviceGate.poison();deny();}
 state.roles.set(id,carrier);return id;
}

function policyCheck(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).sort().join()!==[
     'clientCertSha256','clientSubject','deploymentRevision','issuerSha256',
     'ownerTaskArn','proxyTaskArn','selectedClientId'].sort().join())deny();
 digest(value.clientCertSha256);digest(value.issuerSha256);
 for(const field of ['clientSubject','deploymentRevision'])slot(value[field]);
 if(typeof value.selectedClientId!=='string'||!UUID.test(value.selectedClientId))deny();
 for(const field of ['ownerTaskArn','proxyTaskArn']){
  if(typeof value[field]!=='string'||value[field].length<1||value[field].length>512)deny();
 }
 if(value.ownerTaskArn===value.proxyTaskArn)deny();
 return Object.freeze({...value});
}

/** Return inert handlers for four fixed routes; the caller enforces HTTP POST,
 * empty query, body cap, pinned mTLS listener and exact path before dispatch.
 * `persistedFacts` is createProductProxyPersistedFacts. Its resolve call is
 * bounded, read-only and locates the current canonical grant by the observed
 * bearer digest. `ownerPorts` are trusted bootstrap ports, never HTTP input.
 * `serviceGate` MUST be one process-lifetime gate shared by every session.
 * This module binds it to the borrowed canonical pool and persisted resolver:
 * another gate for either same resource is refused. It poisons on unresolved
 * external work. Mount startup must retain those same resource objects.
 * The session ACK reveals no persisted binding, grant or task facts.
 */
export function createProductOwnerChannel({clientPolicy,persistedFacts,ownerPorts,
 serviceGate,now,
 maxExchangeMs=3000}){
 const policy=policyCheck(clientPolicy);
 if(!serviceGates.has(serviceGate)||!serviceGate.available||
    typeof persistedFacts?.resolve!=='function'||persistedFacts.available!==true||
    !ownerPorts||typeof ownerPorts!=='object'||Array.isArray(ownerPorts)||
    Object.keys(ownerPorts).sort().join()!==[
     'checkCurrentConversation','limits','pool','pricing'].sort().join()||
    typeof ownerPorts.pool?.connect!=='function'||
    typeof ownerPorts.checkCurrentConversation!=='function'||
    typeof now!=='function'||
    !Number.isSafeInteger(maxExchangeMs)||maxExchangeMs<1||maxExchangeMs>30000)deny();
 bindServiceGate(serviceGate,persistedFacts,ownerPorts.pool);
 let state='NEW',id=null,requestId=null,binding=null,deadlineMs=null,grantId=null;
 let operationConnection=null,captureConnection=null,owner=null;
 let challenge=null,challengeDelivered=false,pollWaiter=null,replyWaiter=null,requestKind=null;
 let localPending=0;

 function checkTime(){
  if(!serviceGate.available)deny();
  const at=now();
  if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(deadlineMs)||at>=deadlineMs)deny();
  return Math.min(maxExchangeMs,deadlineMs-at);
 }
 function checkPeer(peer,channel){
  const connection=channelPeer(serviceGate,policy,peer,channel);
  if(channel==='operation'){
   if(operationConnection===null)operationConnection=connection;
   if(connection!==operationConnection||connection===captureConnection)deny();
  }else if(channel==='capture'){
   if(captureConnection===null)captureConnection=connection;
   if(connection!==captureConnection||connection===operationConnection)deny();
  }else deny();
 }
 function exact(frame,expected){if(!isDeepStrictEqual(frame,expected))deny();}
 function poisoned(error){
  state='FAILED';
  if(localPending>0)serviceGate.poison();
  if(pollWaiter){pollWaiter.reject(error);pollWaiter=null;}
  if(replyWaiter){replyWaiter.reject(error);replyWaiter=null;}
  challenge=null;challengeDelivered=false;
 }
 async function bounded(work,duration=checkTime()){
  if(!serviceGate.available||!Number.isSafeInteger(duration)||duration<1)deny();
  const abort=new AbortController(),finish=serviceGate.begin();
  localPending++;
  let timer,settled=false;
  const pending=Promise.resolve().then(()=>work(abort.signal));
  pending.then(()=>done(),()=>done());
  function done(){settled=true;localPending--;finish();}
  try{
   return await Promise.race([pending,new Promise((_,reject)=>{
    timer=setTimeout(()=>{
     if(!settled){serviceGate.poison();abort.abort();}
     reject(Error('PRODUCT_OWNER_CHANNEL_DEADLINE'));
    },duration);
   })]);
  }finally{clearTimeout(timer);}
 }
 async function captured(kind,request){
  if(challenge!==null||replyWaiter!==null||
     kind==='call'&&state!=='RESERVING'||
     kind==='complete'&&state!=='SETTLING')deny();
  const expected=kind==='call'
   ?captureCallRequest(request):captureCompleteRequest(request);
  if(request.requestId!==requestId||!isDeepStrictEqual(request.binding,binding)||
     kind==='call'&&request.deadlineMs!==deadlineMs||
     kind==='complete'&&request.grantId!==grantId)deny();
  requestKind=kind;challenge=expected;
  if(pollWaiter){
   const waiter=pollWaiter;pollWaiter=null;challengeDelivered=true;
   waiter.resolve(bytes(expected));
  }
  const answer=new Promise((resolve,reject)=>{replyWaiter={resolve,reject};});
  return bounded(()=>answer);
 }
 const hostChannel=Object.freeze({
  captureAuthenticatedCall:request=>captured('call',request),
  captureAuthenticatedComplete:request=>captured('complete',request),
 });

 return Object.freeze({
  get available(){return state!=='FAILED'&&serviceGate.available;},
  async open(body,peer){
   try{
    if(state!=='NEW')deny();state='OPENING';
    if(!serviceGate.available)deny();
    checkPeer(peer,'operation');
    const frame=tuple(parseOwnerWire(raw(body)),5);
    if(frame[0]!=='meri.proxy.session-open/1')deny();
    const claimedId=slot(frame[1]),capabilitySha256=digest(frame[2]);
    const claimedDeadline=frame[4],at=now();
    if(!Number.isSafeInteger(at)||!Number.isSafeInteger(claimedDeadline)||
       claimedDeadline<=at||claimedDeadline-at>900000)deny();
    const facts=await bounded(signal=>persistedFacts.resolve({
     capabilitySha256,deadlineMs:Math.min(claimedDeadline,at+maxExchangeMs),signal}),
     maxExchangeMs);
    if(!facts||typeof facts!=='object'||Array.isArray(facts)||
       Object.keys(facts).sort().join()!==[
       'allocationJson','binding','expiresAtMs','grantFactsJsons','modelGrantId',
       'original','requestSha256','resource','selectedClientId'].sort().join())deny();
    if(facts.selectedClientId!==policy.selectedClientId||
       typeof facts.resource?.taskArn!=='string'||
       !Number.isSafeInteger(facts.expiresAtMs)||
       claimedDeadline>facts.expiresAtMs||!Array.isArray(facts.grantFactsJsons)||
       facts.grantFactsJsons.length<1||facts.grantFactsJsons.length>16)deny();
    let selected;
    try{
     const grants=facts.grantFactsJsons.map(value=>JSON.parse(value));
     const matches=grants.filter(fact=>fact.grantId===facts.modelGrantId);
     if(matches.length!==1)deny();
     [selected]=matches;
    }catch{deny();}
    if(!selected||!equalDigest(selected.capabilitySha256,capabilitySha256)||
       !isDeepStrictEqual(selected.binding,facts.binding)||
       selected.qualificationBinding?.workerArn!==facts.resource.taskArn)deny();
    requestId=claimedId;grantId=slot(facts.modelGrantId);
    binding=facts.binding;deadlineMs=claimedDeadline;
    checkTime();
    exact(frame,["meri.proxy.session-open/1",requestId,
     capabilitySha256,captureCallRequest({requestId,binding,deadlineMs})[2],deadlineMs]);
    owner=createProductProxyOwnerComposition({pool:ownerPorts.pool,
     allocationJson:facts.allocationJson,grantFactsJsons:facts.grantFactsJsons,
     modelGrantId:grantId,selectedClientId:policy.selectedClientId,
     pricing:ownerPorts.pricing,requestId,now,limits:ownerPorts.limits,
     checkCurrentConversation:ownerPorts.checkCurrentConversation,
     hostChannel:{requestId,...hostChannel}});
    id=randomBytes(24).toString('hex');state='OPEN';
    return bytes(['meri.proxy.session/1',id,requestId,capabilitySha256]);
   }catch(error){poisoned(error);deny();}
  },
  async poll(body,peer){
   try{
    if(!['OPEN','RESERVING','HELD','SETTLING'].includes(state)||pollWaiter||challengeDelivered)deny();
    checkPeer(peer,'capture');checkTime();
    exact(parseOwnerWire(raw(body)),['meri.proxy.capture-poll/1',id,requestId,
     state==='HELD'||state==='SETTLING'?'complete':'call']);
    if(challenge!==null){challengeDelivered=true;return bytes(challenge);}
    const next=new Promise((resolve,reject)=>{pollWaiter={resolve,reject};});
    return await bounded(()=>next);
   }catch(error){poisoned(error);deny();}
  },
  async reply(body,peer){
   try{
    if(!replyWaiter||challenge===null||!challengeDelivered)deny();
    checkPeer(peer,'capture');checkTime();
    const frame=tuple(parseOwnerWire(raw(body)),3);
    if(frame[0]!=='meri.proxy.capture-reply/1'||frame[1]!==id)deny();
    const result=requestKind==='call'
     ?decodeReservationFrame(frame[2]):decodeCompleteCaptureFrame(frame[2]);
    if(requestKind==='call'){
     if(result.request.requestId!==requestId||
        !isDeepStrictEqual(result.request.binding,binding)||
        result.request.deadlineMs!==deadlineMs)deny();
    }else if(result.completion.requestId!==requestId||
             !isDeepStrictEqual(result.completion.binding,binding))deny();
    const waiter=replyWaiter,kind=requestKind;
    replyWaiter=null;challenge=null;challengeDelivered=false;requestKind=null;
    waiter.resolve(kind==='call'?result.observation:
     {reservation:result.reservation,rawRequestBody:result.rawRequestBody,
      nativeRequestBody:result.nativeRequestBody,completion:result.completion,
      usageResult:result.usageResult});
    return bytes(['meri.proxy.capture-ack/1',id,requestId,kind]);
   }catch(error){poisoned(error);deny();}
  },
  async operation(body,peer){
   try{
    if(!['OPEN','HELD','UNCERTAIN'].includes(state))deny();
    checkPeer(peer,'operation');checkTime();
    const frame=tuple(parseOwnerWire(raw(body)),3);
    if(frame[0]!=='meri.proxy.operation/1'||frame[1]!==id)deny();
    const claim=frame[2];
    if(state==='OPEN'){
     const submitted=decodeReservationFrame(claim);
     if(submitted.request.requestId!==requestId||
        !isDeepStrictEqual(submitted.request.binding,binding)||
        submitted.request.deadlineMs!==deadlineMs)deny();
     state='RESERVING';
     const receipt=await bounded(signal=>owner.reserve(
      {...submitted.request,signal},submitted.observation));
     if(!receipt||receipt.requestId!==requestId||receipt.state!=='UNKNOWN'||
        !SHA.test(receipt.nativeBodySha256))deny();
     state='HELD';
     return bytes(['meri.proxy.reservation-receipt/1',id,
      [requestId,receipt.nativeBodySha256,'UNKNOWN']]);
    }
    if(state==='HELD'){
     const submitted=decodeSettlementFrame(claim);
     if(submitted.requestId!==requestId)deny();
     state='SETTLING';
     try{
      const result=await bounded(()=>owner.settleComplete(requestId,submitted.usageResult));
      if(!result||result.requestId!==requestId||result.state!=='SETTLED')deny();
      state='SETTLED';
      return bytes(['meri.proxy.settlement-receipt/1',id,[requestId,'SETTLED']]);
     }catch(error){
      if(error instanceof BudgetCommitUncertain){
       state='UNCERTAIN';
       return bytes(['meri.proxy.commit-uncertain/1',id,requestId]);
      }
      throw error;
     }
    }
    exact(claim,['meri.proxy.outcome/1',requestId]);
    state='OUTCOME';
    const result=await bounded(()=>owner.readOutcome(requestId));
    if(!result||result.requestId!==requestId||result.state!=='SETTLED'||
       typeof result.actualMicroUSD!=='string'||
       !/^(?:0|[1-9][0-9]{0,18})$/u.test(result.actualMicroUSD))deny();
    state='SETTLED';
    return bytes(['meri.proxy.outcome-receipt/1',id,
     [requestId,'SETTLED',result.actualMicroUSD]]);
   }catch(error){poisoned(error);deny();}
  },
 });

}

/** Read-only frame on OWNER_PATHS.operation, before or between one-send exchanges.
 * The future mount supplies freshly authenticated TLS/task evidence, exactly as
 * for createProductOwnerChannel. No listener or transport is supplied here.
 */
export function createProductOwnerAdmissionChannel({clientPolicy,persistedFacts,ownerPorts,
 serviceGate,now,maxExchangeMs=3000}){
 const policy=policyCheck(clientPolicy);
 if(typeof persistedFacts?.resolve!=='function'||persistedFacts.available!==true||
    typeof ownerPorts?.pool?.connect!=='function'||typeof ownerPorts.checkCurrentConversation!=='function'||
    typeof now!=='function'||!Number.isSafeInteger(maxExchangeMs)||maxExchangeMs<1||maxExchangeMs>30000)deny();
 bindServiceGate(serviceGate,persistedFacts,ownerPorts.pool);
 if(!admissionReads.has(serviceGate))admissionReads.set(serviceGate,new Set());
 const consumed=admissionReads.get(serviceGate);
 const connections={operation:null,capture:null};
 const bindingTuple=b=>['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'].map(k=>b[k]);
 function source(value,capabilitySha256){
  const f=data(own(value,['binding','allocationJson','grantFactsJsons','modelGrantId','selectedClientId','original','resource','requestSha256','expiresAtMs']));
  validateShape('RunBinding',f.binding);digest(f.requestSha256);
  if(f.selectedClientId!==policy.selectedClientId||!UUID.test(f.modelGrantId)||
     !Array.isArray(f.grantFactsJsons)||f.grantFactsJsons.length<1||f.grantFactsJsons.length>16)deny();
  const selected=parseAdmittedGrantSet(f).facts
   .filter(v=>v.grantId===f.modelGrantId);
  if(selected.length!==1)deny();
  const grant=own(selected[0],['grantId','binding','qualificationBinding','capabilitySha256','allocationSha256']);
  const q=own(grant.qualificationBinding,['runId','attempt','workerArn','fence','policyRevision']);
  digest(grant.allocationSha256);digest(q.policyRevision);
  if(!equalDigest(grant.capabilitySha256,capabilitySha256)||!isDeepStrictEqual(grant.binding,f.binding)||
     q.runId!==f.binding.runId||q.fence!==f.binding.writerFence||!Number.isSafeInteger(q.attempt)||q.attempt<1)deny();
  const o=own(f.original,['binding','executionKey','executionId','planSha256','expiresAtMs','versions']);
  validateShape('RuntimeVersions',o.versions);digest(o.planSha256);
  const r=own(f.resource,['taskArn','createdAtMs','clusterArn','taskDefinitionArn','containerName']);
  if(!isDeepStrictEqual(o.binding,f.binding)||o.executionKey!==canonicalSha256(f.binding)||o.executionId!==o.executionKey||
     !Number.isSafeInteger(o.expiresAtMs)||!Number.isSafeInteger(f.expiresAtMs)||f.expiresAtMs>o.expiresAtMs||
     r.taskArn!==q.workerArn||typeof r.clusterArn!=='string'||typeof r.taskDefinitionArn!=='string'||
     typeof r.containerName!=='string'||!SLOT.test(r.containerName)||!Number.isSafeInteger(r.createdAtMs)||r.createdAtMs<1||r.createdAtMs>=o.expiresAtMs)deny();
  return {facts:f,tuple:[bindingTuple(f.binding),f.modelGrantId,capabilitySha256,
   [q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision],
   [o.executionKey,o.executionId,o.planSha256,o.expiresAtMs,o.versions.imageDigest],
   [r.taskArn,r.createdAtMs,r.clusterArn,r.taskDefinitionArn,r.containerName],f.requestSha256,f.selectedClientId]};
 }
 function current(value,facts,started,at){
  const c=data(own(value,['identitySha256','binding','scopes','selectedClientId','contextRevision','checkedAtMs','expiresAtMs']));
  digest(c.identitySha256);digest(c.contextRevision);
  const grant=facts.grantFactsJsons.map(v=>JSON.parse(v)).find(v=>v.grantId===facts.modelGrantId);
  const scopes=[{kind:'client',tenantId:facts.binding.tenantId,resourceId:policy.selectedClientId,policyRevision:grant.qualificationBinding.policyRevision}];
  if(!isDeepStrictEqual(c.binding,facts.binding)||!isDeepStrictEqual(c.scopes,scopes)||c.selectedClientId!==policy.selectedClientId||
     !Number.isSafeInteger(c.checkedAtMs)||c.checkedAtMs<started||c.checkedAtMs>at||
     !Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=at)deny();
  return {value:c,tuple:[c.identitySha256,bindingTuple(c.binding),
   c.scopes.map(s=>[s.kind,s.tenantId,s.resourceId,s.policyRevision]),c.selectedClientId,c.contextRevision,c.checkedAtMs,c.expiresAtMs]};
 }
 return Object.freeze({get available(){return serviceGate.available&&persistedFacts.available===true;},async read(body,peer,carrier='operation'){
  if(!serviceGate.available||persistedFacts.available!==true)deny();
  if(!Buffer.isBuffer(body)||body.length>16384)deny();
  // Carrier is supplied only by the future mount's known physical TLS
  // connection/session role, never a body, header or query selector.
  const connection=channelPeer(serviceGate,policy,peer,carrier),other=carrier==='operation'?'capture':'operation';
  if(connections[carrier]!==null&&connections[carrier]!==connection||connections[other]===connection)deny();
  connections[carrier]=connection;
  const frame=tuple(parseOwnerWire(raw(body)),5);
  if(frame[0]!=='meri.proxy.admission-read/1')deny();
  const readId=slot(frame[1]),capabilitySha256=digest(frame[2]),expected=frame[3],deadline=frame[4],started=now();
  if(expected!==null)digest(expected);
  if(!Number.isSafeInteger(started)||started<0||!Number.isSafeInteger(deadline)||deadline<=started||deadline-started>900000||consumed.has(readId))deny();
  if(consumed.size>=4096){serviceGate.poison();deny();}consumed.add(readId);
  const cutoff=Math.min(deadline,started+maxExchangeMs),abort=new AbortController(),finish=serviceGate.begin();
  let settled=false,timer;
  const check=()=>{const at=now();if(!serviceGate.available||persistedFacts.available!==true||!Number.isSafeInteger(at)||at<started||at>=cutoff)deny();return at;};
  const work=Promise.resolve().then(async()=>{
   check();const first=source(await persistedFacts.resolve({capabilitySha256,deadlineMs:cutoff,signal:abort.signal}),capabilitySha256);check();
   const sourceSha256=canonicalSha256(first.tuple);if(expected!==null&&expected!==sourceSha256)deny();
   const firstCurrent=current(await ownerPorts.checkCurrentConversation({binding:first.facts.binding,deadlineMs:cutoff,signal:abort.signal}),first.facts,started,check());
   const last=source(await persistedFacts.resolve({capabilitySha256,deadlineMs:cutoff,signal:abort.signal}),capabilitySha256);check();
   if(canonicalSha256(last.tuple)!==sourceSha256)deny();
   const lastCurrent=current(await ownerPorts.checkCurrentConversation({binding:last.facts.binding,deadlineMs:cutoff,signal:abort.signal}),last.facts,started,check());
   const expiresAtMs=Math.min(deadline,first.facts.expiresAtMs,last.facts.expiresAtMs,firstCurrent.value.expiresAtMs,lastCurrent.value.expiresAtMs);
   const at=check();if(expiresAtMs<=at)deny();
   return bytes(['meri.proxy.admission/1',readId,capabilitySha256,sourceSha256,last.tuple,lastCurrent.tuple,at,expiresAtMs]);
  });
  work.then(()=>{settled=true;finish();},()=>{settled=true;finish();});
  try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{
   if(!settled){serviceGate.poison();abort.abort();}reject(Error('PRODUCT_OWNER_ADMISSION_DEADLINE'));
  },Math.max(1,cutoff-now()));})]);}finally{clearTimeout(timer);}
 }});
}

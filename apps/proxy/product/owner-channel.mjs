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
 if((poolGates.has(ownerPorts.pool)&&poolGates.get(ownerPorts.pool)!==serviceGate)||
    (factsGates.has(persistedFacts)&&factsGates.get(persistedFacts)!==serviceGate))deny();
 poolGates.set(ownerPorts.pool,serviceGate);
 factsGates.set(persistedFacts,serviceGate);
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
  const connection=principal(policy,peer);
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

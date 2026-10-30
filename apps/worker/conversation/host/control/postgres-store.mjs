/** PostgreSQL-backed currentness, facts, workflow and held-custody reads. The caller supplies an
 * acknowledged write transaction and canonical run readers operating on that SAME transaction. No
 * migration, pool, fallback authority or second journal is created here. */
import {assertBrowserCustody,assertBrowserHandoff} from '../../../../../packages/runtime/browser-custody.mjs';
import {assertBrowserHostFacts} from '../../../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity,MAX_HOST_CURRENTNESS_MS} from '../binding.mjs';
import {hostControlRequest,hostClientDnsName,HOST_CONTROL_RESPONSE_SCHEMA,
 hostFactsRequest,hostFactsResponse,HOST_FACTS_RESPONSE_SCHEMA,
 hostWorkflowRequest,hostWorkflowResponse,HOST_WORKFLOW_RESPONSE_SCHEMA,
 hostHoldRequest,hostHoldResponse,HOST_HOLD_RESPONSE_SCHEMA} from './protocol.mjs';

const HEX=/^[0-9a-f]{64}$/u;
const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_UNAVAILABLE'),{code:'HOST_CONTROL_UNAVAILABLE'});};
/** Keep the stable public code while retaining the underlying refusal for diagnosis. Never serialized. */
const refused=error=>Object.assign(new Error('HOST_CONTROL_UNAVAILABLE'),{code:'HOST_CONTROL_UNAVAILABLE',cause:error});
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const ms=value=>{
 const n=typeof value==='string'&&/^(?:0|[1-9][0-9]*)$/u.test(value)?Number(value):value;
 if(!Number.isSafeInteger(n)||n<0)fail();return n;
};

// The control/migration owner must allocate this proposed schema and exact columns before composition.
export const HOST_CONTROL_SQL=Object.freeze({
 lockHost:`SELECT allocation_json, allocation_sha256, host_identity_json, host_identity_sha256,
  client_cert_sha256, client_dns_name, client_cert_not_after_ms, lease_deadline_ms, state
  FROM meri_host_control.lock_allocation($1,$2)`,
 consumeNonce:`INSERT INTO meri_host_control.request_nonces(host_id,generation,nonce_sha256)
  VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING nonce_sha256`,
 clock:`SELECT floor(extract(epoch from clock_timestamp()) * 1000)::bigint AS now_ms`,
 runs:`SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE`,
});

/** `readCanonicalRun(client,{allocation,binding})` MUST lock/read the canonical current run in this
 * transaction and return its exact full binding, the independently derived effective browser/capability digests,
 * per-purpose admission booleans, active phase and durable cutoff. `sdkAdmitted` covers each isolated-host run;
 * `browserAdmitted` stays false while activation is held; `bashAdmitted` requires real Bash eligibility.
 * `readCanonicalFacts(client,input)` is the protected facts producer and consumes this same client.
 * `resolveWorkflow({binding,signal})` is the borrowed Core domain read and runs with NO transaction held.
 * `holdCustody({client,binding,allocation,check})` is the lifecycle owner's same-client APPLIED/no-return read.
 * Every optional dependency refuses its own operation when absent; nothing degrades to a success stub. */
export function createPostgresHostCurrentnessStore({transact,readCanonicalRun,readCanonicalFacts,resolveWorkflow,holdCustody,maxLeaseMs,maxFactsBytes}={}){
 if(typeof transact!=='function'||typeof readCanonicalRun!=='function'||
  !Number.isSafeInteger(maxLeaseMs)||maxLeaseMs<1||maxLeaseMs>MAX_HOST_CURRENTNESS_MS||
  readCanonicalFacts!==undefined&&typeof readCanonicalFacts!=='function'||
  resolveWorkflow!==undefined&&typeof resolveWorkflow!=='function'||
  holdCustody!==undefined&&typeof holdCustody!=='function'||
  maxFactsBytes!==undefined&&(!Number.isSafeInteger(maxFactsBytes)||maxFactsBytes<1))fail();
 const factsBound=maxFactsBytes??262144;

 /** Shared authenticated admission: pinned allocation, exact identity, live certificate and lease. */
 async function admit(client,{request,fingerprintSha256,peerDnsName,signal}){
  if(signal?.aborted||typeof client?.query!=='function')fail();
  const hostRows=(await client.query(HOST_CONTROL_SQL.lockHost,[request.allocation.hostId,request.allocation.generation])).rows;
  if(!Array.isArray(hostRows)||hostRows.length!==1)fail();
  const h=own(data(hostRows[0]),['allocation_json','allocation_sha256','host_identity_json','host_identity_sha256',
   'client_cert_sha256','client_dns_name','client_cert_not_after_ms','lease_deadline_ms','state']);
  const a=assertHostAllocation(h.allocation_json),b=assertHostRunBinding(a,request.binding),i=assertD005HostIdentity(h.host_identity_json,b,a);
  if(!same(a,request.allocation)||!same(i,request.hostIdentity)||h.allocation_sha256!==canonicalSha256(a)||
   h.host_identity_sha256!==canonicalSha256(i)||h.client_cert_sha256!==fingerprintSha256||
   h.client_dns_name!==peerDnsName||h.state!=='active'||ms(h.lease_deadline_ms)!==a.leaseDeadlineMs)fail();
  return {a,b,h};
 }
 /** Single-use nonce: the INSERT is the acknowledgement. A replay returns no row and refuses here. */
 async function consume(client,a,nonce){
  const inserted=(await client.query(HOST_CONTROL_SQL.consumeNonce,[a.hostId,a.generation,canonicalSha256(nonce)])).rows;
  if(!Array.isArray(inserted)||inserted.length!==1||inserted[0]?.nonce_sha256!==canonicalSha256(nonce))fail();
 }
 async function clock(client){
  const times=(await client.query(HOST_CONTROL_SQL.clock)).rows;
  if(!Array.isArray(times)||times.length!==1)fail();
  return ms(times[0].now_ms);
 }
 const cutoff=(nowMs,a,h,stateUntilMs)=>Math.min(nowMs+maxLeaseMs,ms(stateUntilMs),ms(h.client_cert_not_after_ms),a.leaseDeadlineMs);

 return Object.freeze({
  async readCurrent({request,fingerprintSha256,peerDnsName,signal}={}){
   const q=hostControlRequest(request);try{nativeSignal(signal);}catch{fail();}
   if(typeof fingerprintSha256!=='string'||!HEX.test(fingerprintSha256)||peerDnsName!==hostClientDnsName(q.allocation)||
    signal?.aborted)fail();
   // `transact` owns BEGIN/COMMIT, bounded lock/statement waits and connection eviction on uncertain ACK.
   // A returned receipt is released only after the transaction's COMMIT is acknowledged.
   try{return await transact(async client=>{
    const {a,b,h}=await admit(client,{request:q,fingerprintSha256,peerDnsName,signal});
    // This port is supplied by the canonical admitted-run owner, not by the request or a local cache.
    const state=own(data(await readCanonicalRun(client,{allocation:a,binding:b,signal})),
     ['binding','browserPolicySha256','capabilityPolicySha256','sdkAdmitted','browserAdmitted','bashAdmitted','phase','currentUntilMs'],['browserCustody','browserSuccessor']);
    const selected=q.purpose==='browser'
     ?{digest:state.browserPolicySha256,admitted:state.browserAdmitted}
     :{digest:state.capabilityPolicySha256,admitted:q.purpose==='sdk'?state.sdkAdmitted:state.bashAdmitted};
    const held=q.purpose==='browser'&&['browser-held','browser-successor'].includes(state.phase);
    if(held){const custody=assertBrowserCustody(state.browserCustody,{binding:b});
     if(custody.hostId!==a.hostId||custody.generation!==a.generation||custody.policySha256!==q.policySha256||
      ms(state.currentUntilMs)>custody.expiresAtMs||state.sdkAdmitted!==false||state.bashAdmitted!==false)fail();
    }
    if(state.phase==='browser-successor'){
     const successor=own(state.browserSuccessor,['binding'],['handoff']),target=assertHostRunBinding(a,successor.binding);
     if(q.purpose!=='browser'||target.actorId!==b.actorId||target.writerFence<=b.writerFence||target.runId===b.runId||
      target.attemptId===b.attemptId||target.workerId===b.workerId)fail();
     if(successor.handoff!==undefined){const handoff=assertBrowserHandoff(successor.handoff,{targetBinding:target}),custody=handoff.custody;
      if(custody.ownerInstanceId!==state.browserCustody.ownerInstanceId||custody.hostId!==a.hostId||custody.generation!==a.generation||
       custody.policySha256!==q.policySha256||custody.expiresAtMs>state.browserCustody.expiresAtMs||custody.expiresAtMs<ms(state.currentUntilMs)||
       custody.binding.writerFence<b.writerFence)fail();
     }
    }else if(state.browserSuccessor!==undefined)fail();
    if(!same(state.binding,b)||selected.digest!==q.policySha256||selected.admitted!==true||
     (!held&&(state.sdkAdmitted!==true||state.phase!=='active')))fail();
    if(signal?.aborted)fail();
    await consume(client,a,q.nonce);
    const nowMs=await clock(client),untilMs=cutoff(nowMs,a,h,state.currentUntilMs);
    if(signal?.aborted||nowMs>=untilMs||nowMs>=a.leaseDeadlineMs)fail();
    return Object.freeze({schema:HOST_CONTROL_RESPONSE_SCHEMA,nonce:q.nonce,purpose:q.purpose,
     receipt:Object.freeze({allocation:a,binding:b,policySha256:q.policySha256,phase:'active',
      checkedAtMs:nowMs,currentUntilMs:untilMs,...(q.purpose==='browser'&&state.browserSuccessor?.handoff?{browserHandoff:state.browserSuccessor.handoff}:{})})});
   },{signal,readOnly:false});}catch(error){throw refused(error);}
  },

  /** Canonical facts3 for the SAME authenticated transaction: the producer reads on the caller's client,
   * so the nonce, the peer certificate and the run facts share one acknowledged boundary. */
  async readFacts({request,fingerprintSha256,peerDnsName,signal}={}){
   try{const q=hostFactsRequest(request);nativeSignal(signal);
    if(!readCanonicalFacts||typeof fingerprintSha256!=='string'||!HEX.test(fingerprintSha256)||
     peerDnsName!==hostClientDnsName(q.allocation)||signal?.aborted)fail();
    return await transact(async client=>{
     const {a,b,h}=await admit(client,{request:q,fingerprintSha256,peerDnsName,signal});
     const facts=assertBrowserHostFacts(await readCanonicalFacts(client,{allocation:a,binding:b,signal}),{binding:b});
     if(Buffer.byteLength(JSON.stringify(data(facts)),'utf8')>factsBound)fail();
     await consume(client,a,q.nonce);
     const nowMs=await clock(client),untilMs=cutoff(nowMs,a,h,facts.currentUntilMs);
     if(signal?.aborted||nowMs>=untilMs||nowMs>=a.leaseDeadlineMs)fail();
     return Object.freeze(hostFactsResponse({schema:HOST_FACTS_RESPONSE_SCHEMA,nonce:q.nonce,facts,
      checkedAtMs:nowMs,currentUntilMs:untilMs},q));
    },{signal,readOnly:false});
   }catch(error){throw refused(error);}
  },

  /** Acknowledged admission, then the borrowed Core resolver with NO lock held, then a fresh canonical
   * check before release. The nonce is consumed once, in the admission transaction, and never again. */
  async resolveBrowserWorkflow({request,fingerprintSha256,peerDnsName,signal}={}){
   let admitted,workflow;
   try{const q=hostWorkflowRequest(request);nativeSignal(signal);
    if(!resolveWorkflow||typeof fingerprintSha256!=='string'||!HEX.test(fingerprintSha256)||
     peerDnsName!==hostClientDnsName(q.allocation)||signal?.aborted)fail();
    admitted=await transact(async client=>{
     const {a,b,h}=await admit(client,{request:q,fingerprintSha256,peerDnsName,signal});
     const state=own(data(await readCanonicalRun(client,{allocation:a,binding:b,signal})),
      ['binding','browserPolicySha256','capabilityPolicySha256','sdkAdmitted','browserAdmitted','bashAdmitted','phase','currentUntilMs'],['browserCustody','browserSuccessor']);
     if(!same(state.binding,b)||state.phase!=='active'||state.browserAdmitted!==true)fail();
     await consume(client,a,q.nonce);
     return {q,a,b,h,stateSha256:canonicalSha256(data(state))};
    },{signal,readOnly:false});
    // No transaction, lock or connection is held while the Core domain read runs.
    workflow=await resolveWorkflow({binding:admitted.b,signal});
   }catch(error){throw refused(error);}
   try{
    return await transact(async client=>{
     const {a,b,h}=await admit(client,{request:admitted.q,fingerprintSha256,peerDnsName,signal});
     if(!same(a,admitted.a)||!same(b,admitted.b))fail();
     const fresh=own(data(await readCanonicalRun(client,{allocation:a,binding:b,signal})),
      ['binding','browserPolicySha256','capabilityPolicySha256','sdkAdmitted','browserAdmitted','bashAdmitted','phase','currentUntilMs'],['browserCustody','browserSuccessor']);
     // A post-read authority change (phase, scopes, custody or cutoffs) refuses the answer.
     if(canonicalSha256(data(fresh))!==admitted.stateSha256||fresh.phase!=='active'||fresh.browserAdmitted!==true)fail();
     const nowMs=await clock(client),untilMs=cutoff(nowMs,a,h,fresh.currentUntilMs);
     if(signal?.aborted||nowMs>=untilMs||nowMs>=a.leaseDeadlineMs)fail();
     return Object.freeze(hostWorkflowResponse({schema:HOST_WORKFLOW_RESPONSE_SCHEMA,nonce:admitted.q.nonce,workflow,
      checkedAtMs:nowMs,currentUntilMs:untilMs},admitted.q));
    },{signal,readOnly:false});
   }catch(error){throw refused(error);}
  },

  /** Read-only verification of an ALREADY applied takeover. It never dispatches service.control, never
   * claims or checkpoints, and it refuses returned, expired, foreign or successor custody. */
  async holdBrowser({request,fingerprintSha256,peerDnsName,signal}={}){
   try{const q=hostHoldRequest(request);nativeSignal(signal);
    if(!holdCustody||typeof fingerprintSha256!=='string'||!HEX.test(fingerprintSha256)||
     peerDnsName!==hostClientDnsName(q.allocation)||signal?.aborted)fail();
    return await transact(async client=>{
     const {a,b,h}=await admit(client,{request:q,fingerprintSha256,peerDnsName,signal});
     const state=own(data(await readCanonicalRun(client,{allocation:a,binding:b,signal})),
      ['binding','browserPolicySha256','capabilityPolicySha256','sdkAdmitted','browserAdmitted','bashAdmitted','phase','currentUntilMs'],['browserCustody','browserSuccessor']);
     if(!same(state.binding,b)||state.phase!=='browser-held'||state.browserAdmitted!==true||
      state.sdkAdmitted!==false||state.bashAdmitted!==false||state.browserSuccessor!==undefined)fail();
     const check=()=>{if(signal?.aborted)fail();};
     // The lifecycle owner's same-client read proves APPLIED, exact custody and NO browserReturn.
     const held=data(await holdCustody({client,binding:b,allocation:a,check}));
     const custody=assertBrowserCustody(held.custody,{binding:b});
     if(custody.hostId!==a.hostId||custody.generation!==a.generation||
      custody.policySha256!==state.browserPolicySha256)fail();
     await consume(client,a,q.nonce);
     const nowMs=await clock(client);
     if(custody.expiresAtMs<=nowMs)fail();
     const untilMs=cutoff(nowMs,a,h,Math.min(state.currentUntilMs,custody.expiresAtMs));
     if(signal?.aborted||nowMs>=untilMs||nowMs>=a.leaseDeadlineMs)fail();
     return Object.freeze(hostHoldResponse({schema:HOST_HOLD_RESPONSE_SCHEMA,nonce:q.nonce,outcome:'APPLIED',
      custody,checkedAtMs:nowMs,currentUntilMs:untilMs},q));
    },{signal,readOnly:false});
   }catch(error){throw refused(error);}
  },
 });
}

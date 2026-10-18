/** PostgreSQL-backed currentness read. The caller supplies an acknowledged write transaction and a canonical
 * run reader operating on that SAME transaction. No migration, pool, or fallback authority is created here. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity,MAX_HOST_CURRENTNESS_MS} from '../binding.mjs';
import {hostControlRequest,hostClientDnsName,HOST_CONTROL_RESPONSE_SCHEMA} from './protocol.mjs';

const HEX=/^[0-9a-f]{64}$/u;
const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_UNAVAILABLE'),{code:'HOST_CONTROL_UNAVAILABLE'});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const ms=value=>{
 const n=typeof value==='string'&&/^(?:0|[1-9][0-9]*)$/u.test(value)?Number(value):value;
 if(!Number.isSafeInteger(n)||n<0)fail();return n;
};

// The control/migration owner must allocate this proposed schema and exact columns before composition.
export const HOST_CONTROL_SQL=Object.freeze({
 lockHost:`SELECT allocation_json, allocation_sha256, host_identity_json, host_identity_sha256,
  client_cert_sha256, client_dns_name, client_cert_not_after_ms, lease_deadline_ms, state
  FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2 FOR SHARE`,
 consumeNonce:`INSERT INTO meri_host_control.request_nonces(host_id,generation,nonce_sha256)
  VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING nonce_sha256`,
 clock:`SELECT floor(extract(epoch from clock_timestamp()) * 1000)::bigint AS now_ms`,
});

/** `readCanonicalRun(client,{allocation,binding})` MUST lock/read the canonical current run in this
 * transaction and return its exact full binding, the independently derived effective browser/capability digests,
 * per-purpose admission booleans, active phase and durable cutoff. `sdkAdmitted` covers each isolated-host run;
 * `browserAdmitted` stays false while activation is held; `bashAdmitted` requires real Bash eligibility.
 * Its lifecycle owner must atomically revoke/replace that row with run state. A cached callback is invalid. */
export function createPostgresHostCurrentnessStore({transact,readCanonicalRun,maxLeaseMs}={}){
 if(typeof transact!=='function'||typeof readCanonicalRun!=='function'||
  !Number.isSafeInteger(maxLeaseMs)||maxLeaseMs<1||maxLeaseMs>MAX_HOST_CURRENTNESS_MS)fail();
 return Object.freeze({async readCurrent({request,fingerprintSha256,peerDnsName,signal}={}){
  const q=hostControlRequest(request);try{nativeSignal(signal);}catch{fail();}
  if(typeof fingerprintSha256!=='string'||!HEX.test(fingerprintSha256)||peerDnsName!==hostClientDnsName(q.allocation)||
   signal?.aborted)fail();
  // `transact` owns BEGIN/COMMIT, bounded lock/statement waits and connection eviction on uncertain ACK.
  // A returned receipt is released only after the transaction's COMMIT is acknowledged.
  try{return await transact(async client=>{
   if(signal?.aborted||typeof client?.query!=='function')fail();
   const hostRows=(await client.query(HOST_CONTROL_SQL.lockHost,[q.allocation.hostId,q.allocation.generation])).rows;
   if(!Array.isArray(hostRows)||hostRows.length!==1)fail();
   const h=own(data(hostRows[0]),['allocation_json','allocation_sha256','host_identity_json','host_identity_sha256',
    'client_cert_sha256','client_dns_name','client_cert_not_after_ms','lease_deadline_ms','state']);
   const a=assertHostAllocation(h.allocation_json),b=assertHostRunBinding(a,q.binding),i=assertD005HostIdentity(h.host_identity_json,b,a);
   if(!same(a,q.allocation)||!same(i,q.hostIdentity)||h.allocation_sha256!==canonicalSha256(a)||
    h.host_identity_sha256!==canonicalSha256(i)||h.client_cert_sha256!==fingerprintSha256||
    h.client_dns_name!==peerDnsName||h.state!=='active'||ms(h.lease_deadline_ms)!==a.leaseDeadlineMs)fail();
   // This port is supplied by the canonical admitted-run owner, not by the request or a local cache.
   const state=own(data(await readCanonicalRun(client,{allocation:a,binding:b,signal})),
    ['binding','browserPolicySha256','capabilityPolicySha256','sdkAdmitted','browserAdmitted','bashAdmitted','phase','currentUntilMs']);
   const selected=q.purpose==='browser'
    ?{digest:state.browserPolicySha256,admitted:state.browserAdmitted}
    :{digest:state.capabilityPolicySha256,admitted:q.purpose==='sdk'?state.sdkAdmitted:state.bashAdmitted};
   if(!same(state.binding,b)||selected.digest!==q.policySha256||state.sdkAdmitted!==true||
    selected.admitted!==true||state.phase!=='active')fail();
   if(signal?.aborted)fail();
   const inserted=(await client.query(HOST_CONTROL_SQL.consumeNonce,[a.hostId,a.generation,canonicalSha256(q.nonce)])).rows;
   if(!Array.isArray(inserted)||inserted.length!==1||inserted[0]?.nonce_sha256!==canonicalSha256(q.nonce))fail();
   const times=(await client.query(HOST_CONTROL_SQL.clock)).rows;
   if(!Array.isArray(times)||times.length!==1)fail();
   const nowMs=ms(times[0].now_ms),untilMs=Math.min(nowMs+maxLeaseMs,ms(state.currentUntilMs),
    ms(h.client_cert_not_after_ms),a.leaseDeadlineMs);
   if(signal?.aborted||nowMs>=untilMs||nowMs>=a.leaseDeadlineMs)fail();
   return Object.freeze({schema:HOST_CONTROL_RESPONSE_SCHEMA,nonce:q.nonce,purpose:q.purpose,
    receipt:Object.freeze({allocation:a,binding:b,policySha256:q.policySha256,phase:'active',
     checkedAtMs:nowMs,currentUntilMs:untilMs})});
  },{signal,readOnly:false});}catch{fail();}
 }});
}

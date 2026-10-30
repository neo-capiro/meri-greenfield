/** One physical allocation table; canonical conversation journals own all run/custody authority. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertBrowserCustody} from '../../../packages/runtime/browser-custody.mjs';
import {transact,assertPool} from '../product-persistence/transaction.mjs';
import {prepareHostAllocation,allocationRow,hostKey,assertRequestedBinding,fail,same} from './allocation.mjs';
export const HOST_ALLOCATION_SQL=Object.freeze({
 lock:`SELECT * FROM meri_host_control.lock_allocation($1,$2)`,
 conversation:`SELECT * FROM meri_host_control.lock_conversation($1,$2)`,
 insert:`INSERT INTO meri_host_control.host_allocations(host_id,generation,tenant_id,conversation_id,allocation_json,allocation_sha256,
  original_binding_json,host_identity_json,host_identity_sha256,owner_instance_id,endpoint_json,record_sha256,
  client_cert_sha256,client_dns_name,client_cert_not_after_ms,server_cert_not_after_ms,credential_revision,lease_deadline_ms,state)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,$17,'active') ON CONFLICT(host_id,generation) DO NOTHING`,
 revoke:`UPDATE meri_host_control.host_allocations SET state='revoked' WHERE host_id=$1 AND generation=$2 AND state='active'`,
});
const rows=value=>{if(!Array.isArray(value?.rows)||value.rows.length>1)fail();return value.rows;};
const until=r=>Math.min(r.allocation.leaseDeadlineMs,r.hostCertificate.notAfterMs,r.serverCertificateNotAfterMs);

/** Private allocator API. The issuing control owner supplies public certificates
 * from its existing issuer and verified native allocation, never browser input. */
export function createPostgresHostAllocationWriter({pool,now=Date.now}){
 assertPool(pool);
 return Object.freeze({
  async admit({record:raw,signal}){
   nativeSignal(signal);const record=prepareHostAllocation(raw,now()),a=record.allocation;
   const check=()=>{signal?.throwIfAborted();if(until(record)<=now())fail();};
   return transact(pool,async client=>{
    check();await client.query(HOST_ALLOCATION_SQL.insert,[a.hostId,a.generation,a.tenantId,a.conversationId,a,hash(a),record.originalBinding,
     record.hostIdentity,hash(record.hostIdentity),record.ownerInstanceId,record.endpoint,hash(record),record.hostCertificate.fingerprintSha256,
     record.hostCertificate.dnsName,record.hostCertificate.notAfterMs,record.serverCertificateNotAfterMs,a.leaseDeadlineMs]);check();
    const found=rows(await client.query(HOST_ALLOCATION_SQL.lock,[a.hostId,a.generation]));if(found.length!==1)fail();
    const saved=allocationRow(found[0]);if(saved.state!=='active'||!same(saved.record,record))fail();return saved.record;
   },{check,unavailable:'BROWSER_HOST_ALLOCATION_REFUSED',uncertain:'BROWSER_HOST_ALLOCATION_UNKNOWN'});
  },
  async revoke({hostId,generation,signal}){
   nativeSignal(signal);const key=hostKey({hostId,generation}),check=()=>signal?.throwIfAborted();
   return transact(pool,async client=>{
    check();await client.query(HOST_ALLOCATION_SQL.revoke,[key.hostId,key.generation]);check();
    const found=rows(await client.query(HOST_ALLOCATION_SQL.lock,[key.hostId,key.generation]));if(found.length!==1)fail();
    const value=allocationRow(found[0]);if(value.state==='active')fail();return {revoked:true};
   },{check,unavailable:'BROWSER_HOST_ALLOCATION_REFUSED',uncertain:'BROWSER_HOST_ALLOCATION_UNKNOWN'});
  },
 });
}

/** The same-transaction callback belongs to the canonical run/custody owner. It
 * must recheck fresh Core authority and the full selected logical binding; a
 * physical allocation alone never grants browser access. No fallback or cache. */
export function createPostgresHostAllocationReader({pool,readCanonicalRun,now=Date.now}){
 assertPool(pool);if(typeof readCanonicalRun!=='function')fail();
 return Object.freeze({async resolve(raw){
  const {binding:input,custody=null,signal}=own(raw,['binding'],['custody','signal']);nativeSignal(signal);
  const binding=assertRequestedBinding(input);if(custody!==null)assertBrowserCustody(custody);
  const check=()=>signal?.throwIfAborted();
  return transact(pool,async client=>{
   check();const found=rows(await client.query(custody?HOST_ALLOCATION_SQL.lock:HOST_ALLOCATION_SQL.conversation,
    custody?[custody.hostId,custody.generation]:[binding.tenantId,binding.conversationId]));check();if(found.length!==1)fail();
   const saved=allocationRow(found[0]),r=saved.record,a=r.allocation;
   if(saved.state!=='active'||until(r)<=now()||a.tenantId!==binding.tenantId||a.conversationId!==binding.conversationId||
     custody&&(custody.ownerInstanceId!==r.ownerInstanceId||custody.hostId!==a.hostId||custody.generation!==a.generation))fail();
   const current=await readCanonicalRun(client,{allocation:a,originalBinding:r.originalBinding,binding,custody,signal});check();
   if(!same(current.binding,binding)||current.browserAdmitted!==true||!Number.isSafeInteger(current.currentUntilMs)||current.currentUntilMs<=now())fail();
   return Object.freeze({binding,allocation:a,ownerInstanceId:r.ownerInstanceId,endpoint:r.endpoint,
    expiresAtMs:Math.min(until(r),current.currentUntilMs),recordSha256:hash(r)});
  },{check,unavailable:'BROWSER_HOST_ALLOCATION_REFUSED',uncertain:'BROWSER_HOST_ALLOCATION_UNKNOWN'});
 }});
}

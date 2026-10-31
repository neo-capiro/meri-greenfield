/** One physical allocation table; canonical conversation journals own all run/custody authority. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertBrowserCustody} from '../../../packages/runtime/browser-custody.mjs';
import {transact,assertPool} from '../product-persistence/transaction.mjs';
import {prepareHostAllocation,allocationRow,hostKey,assertRequestedBinding,fail,same} from './allocation.mjs';
import {verifiedTeardownReceipt} from './teardown-receipt.mjs';
import {assertBrowserHostAllocation,assertHostAllocation} from '../../worker/conversation/host/binding.mjs';
import {assertNativeHostAllocation,assertHostRunBindingPin,assertD005HostIdentityShape} from '../../../packages/contracts/native-lifecycle.mjs';
import {assertNativeUploadCustody} from '../../runtime/uploads/native-host-contract.mjs';
import {createNativeReservationOwner,NATIVE_RESERVATION_SQL,requireCurrentNativeAuthority,assertNativeDeclaration,assertNativeBootstrapAdmission} from './native-reservations.mjs';
import {createNativePhysicalOwner,finishPhysicalFullTeardown} from './native-physical-owner.mjs';
import {NATIVE_DECLARATION_V2} from '../../../packages/contracts/native-observer.mjs';
import {readNativePhysicalRow} from './native-physical-state.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export const HOST_ALLOCATION_SQL=Object.freeze({
 lock:`SELECT * FROM meri_host_control.lock_allocation($1,$2)`,
 lockWriter:`SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2 FOR UPDATE`,
 lockServing:`SELECT a.* FROM meri_host_control.lock_allocation($1,$2) a WHERE a.state='active'`,
 conversation:`SELECT * FROM meri_host_control.lock_conversation($1,$2)` ,
 // Purpose is filtered in SQL BEFORE any JavaScript cardinality: the browser reader never sees a native row.
 // Purpose selection wraps the EXISTING SECURITY DEFINER lock function (0001 grants; no direct FOR UPDATE for a
 // read-only role) and filters purpose in SQL before any JavaScript cardinality.
 nativeConversation:`SELECT a.* FROM meri_host_control.lock_conversation($1,$2) a
  WHERE a.state='active' AND a.allocation_json->>'hostMode'='native-processing'`,
 nativeRows:`SELECT a.* FROM meri_host_control.lock_conversation($1,$2) a
  WHERE a.allocation_json->>'hostMode'='native-processing'`,
 browserConversation:`SELECT a.* FROM meri_host_control.lock_conversation($1,$2) a
  WHERE a.state='active' AND COALESCE(a.allocation_json->>'hostMode','legacy') IN ('legacy','browser-only')`,
 // Canonical admission lock: taken BEFORE any insert, including for a conversation with zero allocation rows.
 admission:`SELECT 1 FROM meri_host_control.lock_conversation_admission($1,$2)`,
 // Fresh VOLATILE read AFTER the lock (never a same-statement prelock snapshot).
 purposeRows:`SELECT host_id,generation,state,allocation_sha256,record_sha256,
  allocation_json->>'hostMode' AS host_mode
  FROM meri_host_control.host_allocations
  WHERE tenant_id=$1 AND conversation_id=$2 AND state<>'terminated' FOR UPDATE`,
 insert:`INSERT INTO meri_host_control.host_allocations(host_id,generation,tenant_id,conversation_id,allocation_json,allocation_sha256,
  original_binding_json,host_identity_json,host_identity_sha256,owner_instance_id,endpoint_json,record_sha256,
  client_cert_sha256,client_dns_name,client_cert_not_after_ms,server_cert_not_after_ms,credential_revision,lease_deadline_ms,state)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,$17,'active') ON CONFLICT(host_id,generation) DO NOTHING`,
 revoke:`UPDATE meri_host_control.host_allocations SET state='revoked' WHERE host_id=$1 AND generation=$2 AND state='active'`,
 terminate:`UPDATE meri_host_control.host_allocations SET state='terminated',teardown_json=$3,teardown_sha256=$4 WHERE host_id=$1 AND generation=$2 AND state<>'terminated'`,
});
const rows=value=>{if(!Array.isArray(value?.rows)||value.rows.length>1)fail();return value.rows;};
/** Admission scans may return MANY conflicting rows; only the validated shape is enforced here. */
const list=value=>{if(!Array.isArray(value?.rows))fail();for(const row of value.rows)
 if(row===null||typeof row!=='object')fail();return value.rows;};
const until=r=>Math.min(r.allocation.leaseDeadlineMs,r.hostCertificate.notAfterMs,r.serverCertificateNotAfterMs);

/** Private allocator API. The issuing control owner supplies public certificates
 * from its existing issuer and verified native allocation, never browser input. */
export function createPostgresHostAllocationWriter({pool,now=Date.now,readCurrentNativeAuthority,physicalRequestDeadlineMs,physicalOwnerProcessId}={}){
 assertPool(pool);
 const nativeReservations=createNativeReservationOwner({pool,now,readCurrentAuthority:readCurrentNativeAuthority});
 const nativePhysical=createNativePhysicalOwner({pool,now,requestDeadlineMs:physicalRequestDeadlineMs,ownerProcessId:physicalOwnerProcessId});
 return Object.freeze({
  async admit({record:raw,signal}){
   nativeSignal(signal);const a=assertHostAllocation(raw?.allocation);let record=null;
   let grantUntil=null;
   const check=()=>{signal?.throwIfAborted();
    const allocationUntil=record===null?a.leaseDeadlineMs:until(record);
    const bound=grantUntil===null?allocationUntil:Math.min(allocationUntil,grantUntil);
    if(bound<=now())fail();};
   return transact(pool,async client=>{
    check();
    // READ COMMITTED then the canonical tenant:conversation admission lock BEFORE the insert.
    // Isolation is VERIFIED, never claimed: only READ COMMITTED may use the post-lock fresh read.
    const iso=(await client.query('SHOW transaction_isolation')).rows?.[0]?.transaction_isolation;
    if(iso!=='read committed')fail();
    await client.query(HOST_ALLOCATION_SQL.admission,[a.tenantId,a.conversationId]);
    const existing=list(await client.query(HOST_ALLOCATION_SQL.purposeRows,[a.tenantId,a.conversationId]));
    const purpose=a.hostMode===undefined?'legacy':a.hostMode;
    const nativeCandidate=existing.find(row=>row.host_id===a.hostId&&Number(row.generation)===Number(a.generation)&&
     row.host_mode==='native-processing');
    const nativeSame=nativeCandidate===undefined?[]:rows(await client.query(HOST_ALLOCATION_SQL.lock,[a.hostId,a.generation]));
    const nativeRow=nativeSame.length===1?nativeSame[0]:null;
    record=prepareHostAllocation(raw,now(),nativeRow);check();
    for(const row of existing){
     const other=row.host_mode??'legacy';
     const sameKey=row.host_id===a.hostId&&Number(row.generation)===Number(a.generation);
     if(sameKey){
      // An existing pre-effect row is completed by the later same-row branch; active replay stays exact.
      if(['reserved','dispatching','unknown'].includes(row.state))continue;
      if(row.state!=='active'||row.allocation_sha256!==hash(a)||row.record_sha256!==hash(record))fail();
      continue;
     }
     // Legacy is exclusive in both directions; a DIFFERENT explicit purpose coexists; the SAME purpose refuses.
     if(purpose==='legacy'||other==='legacy'||other===purpose)fail();
    }
    // NATIVE admission is SAME-ROW ONLY: complete an existing dispatching/unknown reservation, or accept an
    // exact active replay. It never INSERTs a fresh active row after an external effect.
    if(nativeRow!==null){
     if(purpose!=='native-processing'||nativeRow.allocation_json?.hostMode!=='native-processing')fail();
     if(nativeRow.state==='active'){
      const saved=allocationRow(nativeRow);
      if(!same(saved.record,record))fail();
      const current=await requireCurrentNativeAuthority(readCurrentNativeAuthority,client,{allocation:a,binding:record.originalBinding,signal,now});
     grantUntil=current.currentUntilMs;
      return saved.record;
     }
     if(!['dispatching','unknown'].includes(nativeRow.state))fail();
     const promotedAuthority=await requireCurrentNativeAuthority(readCurrentNativeAuthority,client,{allocation:a,binding:record.originalBinding,signal,now});
     grantUntil=promotedAuthority.currentUntilMs;
     const decl=assertNativeDeclaration(nativeRow.declaration_json);
     if(hash(nativeRow.allocation_json)!==hash(a)||hash(nativeRow.original_binding_json)!==hash(record.originalBinding)||
      nativeRow.owner_instance_id!==record.ownerInstanceId||decl.imageDigest!==a.imageDigest||
      decl.leaseDeadlineMs!==a.leaseDeadlineMs||nativeRow.declaration_sha256!==hash(decl))fail();
     const observed=nativeRow.observed_instance_json;
     assertNativeBootstrapAdmission({row:nativeRow,record});
     if(observed===null||observed===undefined||observed.instanceId!==record.hostIdentity.instanceId)return fail();
     if(observed.privateIp!==null&&observed.privateIp!==record.endpoint.address)fail();
     if(until(record)<=now())fail();
     await client.query(NATIVE_RESERVATION_SQL.admitNative,[a.hostId,a.generation,record.hostIdentity,
      hash(record.hostIdentity),record.endpoint,hash(record),record.hostCertificate.fingerprintSha256,
      record.hostCertificate.dnsName,record.hostCertificate.notAfterMs,record.serverCertificateNotAfterMs,
      nativeRow.declaration_sha256]);
     const done=rows(await client.query(HOST_ALLOCATION_SQL.lock,[a.hostId,a.generation]));
     if(done.length!==1)fail();
     const active=allocationRow(done[0]);
     if(active.state!=='active'||!same(active.record,record))fail();
     const commitAuthority=await requireCurrentNativeAuthority(readCurrentNativeAuthority,client,{allocation:a,binding:record.originalBinding,signal,now});
     grantUntil=commitAuthority.currentUntilMs;
     return active.record;
    }
    // A native admission without a pre-existing reservation is refused; no fresh active INSERT.
    if(purpose==='native-processing')fail();
    await client.query(HOST_ALLOCATION_SQL.insert,[a.hostId,a.generation,a.tenantId,a.conversationId,a,hash(a),record.originalBinding,
     record.hostIdentity,hash(record.hostIdentity),record.ownerInstanceId,record.endpoint,hash(record),record.hostCertificate.fingerprintSha256,
     record.hostCertificate.dnsName,record.hostCertificate.notAfterMs,record.serverCertificateNotAfterMs,a.leaseDeadlineMs]);check();
    const found=rows(await client.query(HOST_ALLOCATION_SQL.lock,[a.hostId,a.generation]));if(found.length!==1)fail();
    const saved=allocationRow(found[0]);if(saved.state!=='active'||!same(saved.record,record))fail();return saved.record;
   },{check,unavailable:'BROWSER_HOST_ALLOCATION_REFUSED',uncertain:'BROWSER_HOST_ALLOCATION_UNKNOWN'});
  },
  /** Read-only pre-effect ownership check under the SAME admission lock used by admit. A caller may only
   * recover an exact existing native row; any other non-terminated purpose owns the conversation. */
  async inspect({binding:raw,signal}){
   nativeSignal(signal);const binding=assertRequestedBinding(raw),check=()=>signal?.throwIfAborted();
   return transact(pool,async client=>{
    check();
    const iso=(await client.query('SHOW transaction_isolation')).rows?.[0]?.transaction_isolation;
    if(iso!=='read committed')fail();
    await client.query(HOST_ALLOCATION_SQL.admission,[binding.tenantId,binding.conversationId]);check();
    const candidates=list(await client.query(HOST_ALLOCATION_SQL.purposeRows,[binding.tenantId,binding.conversationId]));
    // purposeRows is a narrow projection; reconstitute each full row through the existing canonical lock before any
    // caller reads originalBinding/allocation. One row per key, never a fabricated shape.
    const full=[];
    for(const row of candidates){
     const found=rows(await client.query(HOST_ALLOCATION_SQL.lock,[row.host_id,row.generation]));
     if(found.length!==1)fail();full.push(found[0]);
    }
    return {rows:full};
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
  /** Read the EXACT canonical original host row for Control-owned teardown. This is the same
   * host_allocations row/record used by admission; no second allocation or receipt is created. */
  async readNativeHostTeardown(raw){
   const {hostId,generation,signal}=own(raw,['hostId','generation'],['signal']);nativeSignal(signal);
   if(!UUID.test(hostId)||!Number.isSafeInteger(generation)||generation<1)fail();
   const check=()=>signal?.throwIfAborted();
   return transact(pool,async client=>{
    const found=rows(await client.query(HOST_ALLOCATION_SQL.lockWriter,[hostId,generation]));check();
    if(found.length!==1)fail();
    // Managed cleanup can finish before guest admission. Its retained canonical evidence does not
    // require (and must not invent) a guest identity, endpoint, certificate record or full receipt.
    if(found[0].declaration_json?.schema===NATIVE_DECLARATION_V2&&['reserved','dispatching','unknown','refused'].includes(found[0].state)){
     const row=found[0],a=assertNativeHostAllocation(row.allocation_json),b=assertHostRunBindingPin(a,row.original_binding_json),
      declaration=assertNativeDeclaration(row.declaration_json),physical=readNativePhysicalRow(row,{
       hostId,generation,originalBindingSha256:hash(b),declarationSha256:row.declaration_sha256});
     return Object.freeze({allocation:a,binding:b,hostIdentity:null,state:row.state,record:null,declaration,physical});
    }
    const saved=allocationRow(found[0]),r=saved.record;
    const a=assertNativeHostAllocation(r.allocation),b=assertHostRunBindingPin(a,r.originalBinding),
     i=assertD005HostIdentityShape(r.hostIdentity,b,a);
    const observer=found[0].declaration_json?.schema===NATIVE_DECLARATION_V2?{
     declaration:assertNativeDeclaration(found[0].declaration_json),physical:readNativePhysicalRow(found[0],{
      hostId,generation,originalBindingSha256:hash(b),declarationSha256:found[0].declaration_sha256})}:{};
    return Object.freeze({allocation:a,binding:b,hostIdentity:i,state:saved.state,record:r,...observer,
     ...(saved.state==='terminated'?{teardown:found[0].teardown_json??null,
      teardownSha256:found[0].teardown_sha256??null}:{})});
   },{check,unavailable:'BROWSER_HOST_TEARDOWN_REFUSED',uncertain:'BROWSER_HOST_TEARDOWN_UNKNOWN'});
  },
  /** Only the trusted provisioning/teardown owner calls this with its own
   * createConversationHostTeardown result. No public viewer route accepts it.
   * An unknown ACK is recovered by replaying the same receipt, not teardown. */
  async recordTeardown({hostId,generation,receipt,signal}){
   nativeSignal(signal);const key=hostKey({hostId,generation}),check=()=>signal?.throwIfAborted();
   return transact(pool,async client=>{
    const found=rows(await client.query(HOST_ALLOCATION_SQL.lockWriter,[key.hostId,key.generation]));check();if(found.length!==1)fail();
    const row=found[0],saved=allocationRow(row),verified=verifiedTeardownReceipt(receipt,saved.record,now()),digest=hash(verified);
    if(saved.state==='terminated'){
     if(row.teardown_sha256!==digest||!same(row.teardown_json,verified))fail();
     return {terminated:true,receiptSha256:digest};
    }
    if(row.declaration_json?.schema===NATIVE_DECLARATION_V2)await finishPhysicalFullTeardown(client,row,verified,now());
    await client.query(HOST_ALLOCATION_SQL.terminate,[key.hostId,key.generation,verified,digest]);check();
    return {terminated:true,receiptSha256:digest};
   },{check,unavailable:'BROWSER_HOST_TEARDOWN_REFUSED',uncertain:'BROWSER_HOST_TEARDOWN_UNKNOWN'});
  },
  ...(nativeReservations??{}),
  ...nativePhysical,
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
   check();
   // Custody selects the exact physical key; the conversation branch selects by PURPOSE so a coexisting native row cannot
   // break browser cardinality (and is never returned to the browser reader).
   const found=rows(await client.query(custody?HOST_ALLOCATION_SQL.lockServing:HOST_ALLOCATION_SQL.browserConversation,
    custody?[custody.hostId,custody.generation]:[binding.tenantId,binding.conversationId]));check();
   if(found.length!==1)fail();
   const saved=allocationRow(found[0]),r=saved.record,a=r.allocation;
   // Common to the custody and conversation branches: a processing allocation is not browser authority.
   assertBrowserHostAllocation(a);
   if(saved.state!=='active'||until(r)<=now()||a.tenantId!==binding.tenantId||a.conversationId!==binding.conversationId||
     custody&&(custody.ownerInstanceId!==r.ownerInstanceId||custody.hostId!==a.hostId||custody.generation!==a.generation))fail();
   const current=await readCanonicalRun(client,{allocation:a,originalBinding:r.originalBinding,binding,custody,signal});check();
   if(!same(current.binding,binding)||current.browserAdmitted!==true||!Number.isSafeInteger(current.currentUntilMs)||current.currentUntilMs<=now())fail();
   return Object.freeze({binding,allocation:a,ownerInstanceId:r.ownerInstanceId,endpoint:r.endpoint,
    expiresAtMs:Math.min(until(r),current.currentUntilMs),recordSha256:hash(r)});
  },{check,unavailable:'BROWSER_HOST_ALLOCATION_REFUSED',uncertain:'BROWSER_HOST_ALLOCATION_UNKNOWN'});
 }});
}

/** ACTUAL native allocation reader: purpose-filtered selection, same-transaction canonical native currentness. The
 * physical allocation alone never grants processing authority; the canonical producer must return a fresh matching receipt. */
export function createPostgresNativeAllocationReader({pool,readCanonicalNative,now=Date.now}){
 assertPool(pool);if(typeof readCanonicalNative!=='function')fail();
 return Object.freeze({
  async ready(raw){
   const {binding:input,policySha256,signal}=own(raw,['binding','policySha256'],['signal']);
   nativeSignal(signal);const binding=assertRequestedBinding(input);
   if(typeof policySha256!=='string'||!/^[a-f0-9]{64}$/u.test(policySha256))fail();
   const check=()=>signal?.throwIfAborted();
   return transact(pool,async client=>{
    check();
    const candidates=list(await client.query(HOST_ALLOCATION_SQL.nativeRows,[binding.tenantId,binding.conversationId]));check();
    const matching=[];
    for(const row of candidates){
     const a=assertNativeHostAllocation(row.allocation_json);
     const original=assertHostRunBindingPin(a,row.original_binding_json);
     if(row.declaration_sha256!==hash(row.declaration_json))fail();
     const declaration=assertNativeDeclaration(row.declaration_json);
     if(a.tenantId!==binding.tenantId||a.conversationId!==binding.conversationId||
      a.leaseDeadlineMs!==declaration.leaseDeadlineMs)fail();
     if(same(original,binding))matching.push({row,a,declaration});
     else if(row.state==='active')fail();
    }
    if(matching.length===0)return Object.freeze({status:'absent',binding});
    if(matching.length!==1)fail();
    const {row,a,declaration}=matching[0];
    if(['revoked','quarantined','terminated'].includes(row.state))fail();
    if(!['reserved','dispatching','active','unknown'].includes(row.state))fail();
    if(row.state==='unknown')fail();
    if(a.leaseDeadlineMs<=now())return Object.freeze({status:'not-ready',binding,state:'expired'});
    if(declaration.bootstrapSpec.control.policySha256!==policySha256)fail();
    if(row.state!=='active')return Object.freeze({status:'not-ready',binding,state:row.state,
     generation:a.generation,leaseDeadlineMs:a.leaseDeadlineMs});
    const saved=allocationRow(row),r=saved.record;
    assertNativeBootstrapAdmission({row,record:r});
    const receipt=await readCanonicalNative(client,{allocation:a,binding,signal,
     deadlineMs:Math.min(until(r),now()+60000)});
    check();
    const currentUntilMs=Math.min(until(r),receipt.currentUntilMs);
    if(!same(receipt.binding,binding)||receipt.policySha256!==policySha256||
     !Number.isSafeInteger(receipt.currentUntilMs)||!Number.isSafeInteger(r.hostCertificate.notAfterMs)||
     r.hostCertificate.notAfterMs<=now()||!Number.isSafeInteger(r.serverCertificateNotAfterMs)||
     r.serverCertificateNotAfterMs<=now()||!Number.isSafeInteger(currentUntilMs)||currentUntilMs<=now())fail();
    return Object.freeze({status:'ready',binding,generation:a.generation,ownerInstanceId:r.ownerInstanceId,
     leaseDeadlineMs:a.leaseDeadlineMs,policySha256,currentUntilMs,
     bootstrapReady:true,recordSha256:hash(r)});
   },{check,unavailable:'NATIVE_HOST_ALLOCATION_REFUSED',uncertain:'NATIVE_HOST_ALLOCATION_UNKNOWN'});
  },
  async resolve(raw){
  const {binding:input,custody,declaration,signal}=own(raw,['binding','custody','declaration'],['signal']);
  nativeSignal(signal);
  const binding=assertRequestedBinding(input);
  if(custody===null||typeof custody!=='object'||declaration===null||typeof declaration!=='object')fail();
  const check=()=>signal?.throwIfAborted();
  return transact(pool,async client=>{
   check();
   const found=rows(await client.query(HOST_ALLOCATION_SQL.nativeConversation,[binding.tenantId,binding.conversationId]));
   check();
   if(found.length!==1)fail();
   const saved=allocationRow(found[0]),r=saved.record,a=r.allocation;
   // ONLY an explicit native-processing allocation may resolve here.
   if(a.hostMode!=='native-processing')fail();
   if(saved.state!=='active'||until(r)<=now()||a.tenantId!==binding.tenantId||a.conversationId!==binding.conversationId)fail();
   assertNativeUploadCustody(custody,{binding,declaration});
   const receipt=await readCanonicalNative(client,{allocation:a,binding,custody,declaration,signal,
    deadlineMs:Math.min(until(r),now()+60000)});
   check();
   // The canonical receipt carries allocation/binding/policy/phase/client/current window - never a second allocation.
   if(!same(receipt.binding,binding))fail();
   if(receipt.selectedClientId!==(custody.owner?.clientId??null))fail();
   if(!Number.isSafeInteger(receipt.currentUntilMs)||receipt.currentUntilMs<=now()||
    typeof receipt.policySha256!=='string')fail();
   return Object.freeze({allocation:a,hostIdentity:r.hostIdentity,endpoint:r.endpoint,ownerInstanceId:r.ownerInstanceId,
    recordSha256:hash(r),expiresAtMs:Math.min(until(r),receipt.currentUntilMs)});
  },{check,unavailable:'NATIVE_HOST_ALLOCATION_REFUSED',uncertain:'NATIVE_HOST_ALLOCATION_UNKNOWN'});
 }});
}

/** Real canonical writer.recordTeardown over a transactional in-memory store, with native and browser receipts. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
const R=new URL('../../../',import.meta.url).href;
const tls=await import(R+'apps/worker/conversation/host/control/tls.mjs');
mock.module(R+'apps/worker/conversation/host/control/tls.mjs',{exports:{...tls,
 checkedCertificate:(raw,{nowMs,notAfterMs})=>({fingerprintSha256:(raw==='client'?'a':'b').repeat(64),notAfterMs:notAfterMs??nowMs+60000})}});
const {canonicalSha256:hash}=await import(R+'packages/contracts/validate.mjs');
const {prepareHostAllocation}=await import(R+'apps/control/browser-hosts/allocation.mjs');
const {createPostgresHostAllocationWriter,HOST_ALLOCATION_SQL:S}=await import(R+'apps/control/browser-hosts/postgres-allocations.mjs');
const {canonicalEvidence}=await import(R+'apps/runtime/test/native-physical-evidence-fixture.mjs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.now();
const binding={tenantId:'tenant',actorId:id(2),conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:id(1),generation:1,
 hostId:id(7),hostMode:'native-processing',imageDigest:'sha256:'+'c'.repeat(64),leaseDeadlineMs:now+600000};
const identity={schema:'meri-d005-host-identity/1',hostId:id(7),conversationId:id(1),instanceId:'i-0123456789abcdef0',bootId:id(8)};
function prepared(mode='native-processing'){
 const allocation2={...allocation,hostMode:mode};
 const raw={allocation:allocation2,originalBinding:binding,hostIdentity:identity,ownerInstanceId:id(9),
  endpoint:{address:'10.0.0.11',port:9443,serverName:'host.example'},hostCertificate:'client',serverCertificate:'server'};
 const r=prepareHostAllocation(raw,now);
 return {r,allocation:r.allocation,raw};
}
function writerFor(mode='native-processing'){
 const {r}=prepared(mode);const rows=new Map(),key=r.allocation.hostId+':1';
 const row={host_id:r.allocation.hostId,generation:1,tenant_id:'tenant',conversation_id:id(1),allocation_json:r.allocation,
  allocation_sha256:hash(r.allocation),original_binding_json:r.originalBinding,host_identity_json:r.hostIdentity,
  host_identity_sha256:hash(r.hostIdentity),owner_instance_id:r.ownerInstanceId,endpoint_json:r.endpoint,
  record_sha256:hash(r),client_cert_sha256:r.hostCertificate.fingerprintSha256,client_dns_name:r.hostCertificate.dnsName,
  client_cert_not_after_ms:r.hostCertificate.notAfterMs,server_cert_not_after_ms:r.serverCertificateNotAfterMs,
  credential_revision:1,lease_deadline_ms:r.allocation.leaseDeadlineMs,state:'active'};
 rows.set(key,row);
 const client={async query(sql,args=[]){
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL '))return {rows:[]};
  if(sql===S.lockWriter){const x=rows.get(args[0]+':'+args[1]);return {rows:x?[x]:[]};}
  if(sql===S.terminate){const x=rows.get(args[0]+':'+args[1]);x.state='terminated';x.teardown_json=args[2];x.teardown_sha256=args[3];return {rows:[]};}
  throw Error('UNEXPECTED_SQL '+sql);
 },release(){}};
 return {r,row,pool:{async connect(){return client;}}};
}
const nativeReceipt=r=>({schema:'meri-d005-host-teardown/1',allocationSha256:hash(r.allocation),bindingSha256:hash(r.originalBinding),
 hostIdentitySha256:hash(r.hostIdentity),reason:'revoked',startedAtMs:now-5000,processScope:'native-processing-descendants',
 browserEgress:'not-applicable',bashEgress:'not-applicable',processes:'exited',browserState:'not-applicable',
 cgroup:'removed',networkNamespace:'removed',hostDestroy:'requested',hostAbsence:'confirmed',status:'VERIFIED',
 physicalProtocolVersion:1,
 physicalEvidence:canonicalEvidence({instanceId:identity.instanceId,rootVolumeId:'vol-0123456789abcdef0',
  networkInterfaceIds:['eni-0123456789abcdef0'],startedAtMs:now-5000,nowMs:now})});

test('the canonical writer accepts one exact native VERIFIED receipt and terminates once',async()=>{
 const f=writerFor();const w=createPostgresHostAllocationWriter({pool:f.pool,now:()=>now});
 const done=await w.recordTeardown({hostId:f.r.allocation.hostId,generation:1,receipt:nativeReceipt(f.r)});
 assert.equal(done.terminated,true);assert.equal(f.row.state,'terminated');
 // exact replay of the same immutable receipt is idempotent
 const again=await w.recordTeardown({hostId:f.r.allocation.hostId,generation:1,receipt:nativeReceipt(f.r)});
 assert.equal(again.terminated,true);
});
test('native receipts that are unknown, cross-purpose or incomplete are refused',async()=>{
 for(const mutate of [r=>({...nativeReceipt(r),status:'UNKNOWN'}),r=>({...nativeReceipt(r),browserEgress:'closed'}),
  r=>({...nativeReceipt(r),processScope:'browser-host-descendants'}),r=>({...nativeReceipt(r),cgroup:'unknown'}),
  r=>{const x=nativeReceipt(r);delete x.hostIdentitySha256;return x;}]){
  const f=writerFor();const w=createPostgresHostAllocationWriter({pool:f.pool,now:()=>now});
  await assert.rejects(()=>w.recordTeardown({hostId:f.r.allocation.hostId,generation:1,receipt:mutate(f.r)}),{message:'BROWSER_HOST_TEARDOWN_REFUSED'});
  assert.equal(f.row.state,'active');
 }
});
test('a browser/legacy allocation still refuses a native receipt (purpose boundary)',async()=>{
 const f=writerFor('browser-only');const w=createPostgresHostAllocationWriter({pool:f.pool,now:()=>now});
 await assert.rejects(()=>w.recordTeardown({hostId:f.r.allocation.hostId,generation:1,receipt:nativeReceipt(f.r)}),
  {message:'BROWSER_HOST_TEARDOWN_REFUSED'});
});

/** Independent connection of real execution journal/row decoder, upload store, Core adapter and retention gate.
 * Only SQL storage and external authority responses are inert. No database/socket/native acceptance claim. */
import test from 'node:test';
import {createPostgresNativeAllocationReader,HOST_ALLOCATION_SQL} from '../../../../apps/control/browser-hosts/postgres-allocations.mjs';
import {hostClientDnsName} from '../../../../apps/worker/conversation/host/control/protocol.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createExecutionJournal} from '../../../../apps/control/conversations/execution-journal.mjs';
import {rowRun} from '../../../../apps/control/conversations/boundary.mjs';
import {createCanonicalNativeCurrentness} from '../../../../apps/control/browser-hosts/native-currentness.mjs';
import {createPostgresUploadStore} from '../../../../apps/control/uploads/postgres-store.mjs';
import {createRetentionReadGate} from '../../../../apps/control/retention/suppression.mjs';
import {nativeUploadCustody} from '../../../../apps/runtime/uploads/native-host-contract.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const b={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const bytes=Buffer.from('independent execution currentness');
const declaration={filename:'note.txt',mimeType:'text/plain',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
const image='sha256:'+'b'.repeat(64),policy='f'.repeat(64);
const unused=()=>{throw Error('UNEXPECTED_NESTED_TRANSACTION');};
function fixture({clientId=null,defect}={}){
 const now=Date.now(),expires=now+30000;
 const scopes=[{tenantId:b.tenantId,kind:clientId===null?'private-user':'client',resourceId:clientId??b.actorId,policyRevision:'p1'}];
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:b.tenantId,conversationId:b.conversationId,
  generation:3,hostId:id(7),hostMode:'native-processing',imageDigest:image,leaseDeadlineMs:now+600000};
 const record={uploadId:id(20),requestId:id(21),owner:{tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,clientId},
  declaration,scopes,objectId:id(22),object:{objectId:id(22),versionId:'V',sha256:declaration.sha256,bytes:bytes.length,scopes},
  state:'stored',inspection:null,createdAtMs:now-1000,updatedAtMs:now-1000,revision:2};
 const custody=nativeUploadCustody(record,{binding:b,scopes,selectedClientId:clientId,checkedAtMs:now,expiresAtMs:expires});
 const projection={binding:b,state:defect==='terminal'?'completed':'running',scopes,policyRevision:'p1',createdAt:new Date(now-1000).toISOString(),
  versions:{imageDigest:image,sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'}};
 const request={requestId:id(21)};
 const run={tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,request_id:request.requestId,
  projection,projection_sha256:hash(projection),request,request_sha256:hash(request),last_sequence:3,sequence_end:null};
 const execution={binding:b,executionKey:hash(b),executionId:hash(b),planSha256:'c'.repeat(64),
  expiresAtMs:defect==='expired'?now-1:expires,runtimeSessionId:'conversation-'+hash(b),phase:defect==='stopping'?'stopping':'started',native:null};
 const erow={tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,execution_key:execution.executionKey,
  execution_id:execution.executionId,record:execution,record_sha256:defect==='corrupt'?'a'.repeat(64):hash(execution)};
 let sqlReads=0,coreReads=0;const seen=[];
 const client={async query(sql,args){
  sqlReads++;seen.push(sql);
  if(sql===HOST_ALLOCATION_SQL.nativeConversation){
   const identity={schema:'meri-d005-host-identity/1',hostId:allocation.hostId,conversationId:b.conversationId,instanceId:'i-0123456789abcdef0',bootId:id(8)};
   const r={allocation,originalBinding:b,hostIdentity:identity,ownerInstanceId:id(9),endpoint:{address:'10.1.2.3',port:9443,serverName:'host.example',serverFingerprintSha256:'b'.repeat(64)},hostCertificate:{fingerprintSha256:'a'.repeat(64),dnsName:hostClientDnsName(allocation),notAfterMs:expires},serverCertificateNotAfterMs:expires};
   return {rows:[{host_id:allocation.hostId,generation:allocation.generation,tenant_id:b.tenantId,conversation_id:b.conversationId,allocation_json:allocation,allocation_sha256:hash(allocation),original_binding_json:b,host_identity_json:identity,host_identity_sha256:hash(identity),owner_instance_id:r.ownerInstanceId,endpoint_json:r.endpoint,record_sha256:hash(r),client_cert_sha256:r.hostCertificate.fingerprintSha256,client_dns_name:r.hostCertificate.dnsName,client_cert_not_after_ms:expires,server_cert_not_after_ms:expires,credential_revision:1,lease_deadline_ms:allocation.leaseDeadlineMs,state:'active'}]};
  }
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL '))return {rows:[]};
  if(sql.includes('meri_conversations.native_executions')){assert.deepEqual(args,[b.tenantId,b.conversationId,b.runId]);return {rows:[erow]};}
  if(sql.includes('meri_conversations.runs')){
   assert.deepEqual(args,sql.includes('run_id=$3')?[b.tenantId,b.conversationId,b.runId]:[b.tenantId,b.conversationId]);
   if(defect==='successor'&&!sql.includes('run_id=$3')){
    const p={...projection,binding:{...b,runId:id(40),writerFence:2}};
    return {rows:[run,{...run,run_id:p.binding.runId,projection:p,projection_sha256:hash(p)}]};
   }
   return {rows:[run]};
  }
  if(sql.includes('meri_uploads.originals')){assert.deepEqual(args,[b.tenantId,b.actorId,b.conversationId,record.uploadId]);
   return {rows:[{record,record_sha256:hash(record),tenant_id:b.tenantId,owner_actor_id:b.actorId,conversation_id:b.conversationId,
    upload_id:record.uploadId,request_id:record.requestId,revision:record.revision}]};}
  throw Error('UNEXPECTED_SQL '+sql);
 }};
 const executions=createExecutionJournal({tx:unused,rowRun,now:()=>now});
 const uploads=createPostgresUploadStore({pool:{connect:unused}});
 const core={async readCurrent(q){coreReads++;assert.equal(q.clientId,clientId);return {principal:{tenantId:b.tenantId,actorId:b.actorId},
  role:'standard_user',permissions:[],clientIds:clientId===null?[]:[clientId],identityRevision:'1'.repeat(64),membershipRevision:'2'.repeat(64),
  contextRevision:'3'.repeat(64),conversationId:b.conversationId,selectedClientId:clientId,checkedAtMs:now,expiresAtMs:expires};}};
 const nativeCredentials={async nativeCredentialFor(q){assert.deepEqual(q.binding,b);assert.equal(q.selectedClientId,clientId);
  return {credential:'synthetic-credential',expiresAtMs:expires};}};
 const retentionGate=createRetentionReadGate({journal:{get:async()=>null},serving:{isEnabled:()=>true}});
 const producer=createCanonicalNativeCurrentness({executions,uploads,core,nativeCredentials,retentionGate,now:()=>now,policySha256:policy,maxFreshMs:5000});
 client.release=()=>{};const reader=createPostgresNativeAllocationReader({pool:{connect:async()=>client},readCanonicalNative:producer.readCanonicalNative,now:()=>now});
 return {read:(extra={})=>reader.resolve({binding:b,custody,declaration,...extra}),seen,
  counts:()=>({sqlReads,coreReads}),now};
}
for(const clientId of [null,id(30)])test(`POSITIVE native reader resolves real canonical currentness for ${clientId===null?'General':'selected client'}`,async()=>{
 const f=fixture({clientId});
 const resolved=await f.read();
 assert.equal(resolved.allocation.hostMode,'native-processing');
 assert.equal(typeof resolved.ownerInstanceId,'string');
 assert.equal(resolved.expiresAtMs>Date.now(),true);
 assert.equal(f.counts().coreReads,1,'the canonical Core adapter was consulted once');
 assert.ok(f.seen.some(sql=>sql.includes('meri_uploads.originals')),'the saved row was read on the SAME client');
 assert.ok(f.seen.includes(HOST_ALLOCATION_SQL.nativeConversation));
});
for(const [name,defect] of [['terminal execution','terminal'],['stopping execution','stopping'],
 ['expired authority','expired'],['corrupt execution record','corrupt'],['successor run','successor']])
test(`DENIED native reader refuses ${name}`,async()=>{
 const f=fixture({defect});
 await assert.rejects(f.read(),{message:'NATIVE_HOST_ALLOCATION_REFUSED'});
});
test('DENIED native reader refuses a cancelled operation before any authority read',async()=>{
 const f=fixture();const controller=new AbortController();controller.abort();
 await assert.rejects(f.read({signal:controller.signal}),{message:'NATIVE_HOST_ALLOCATION_REFUSED'});
});

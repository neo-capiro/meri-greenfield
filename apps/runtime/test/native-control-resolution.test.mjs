/** Actual Control/session/retention/execution/upload/reader owners with inert SQL, identity/Core, Temporal,
 * listener and S3 boundaries. General and selected-client native resolutions happen before the first listener;
 * each case starts its own Control (no same-Control multi-conversation claim, no native guest execution). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {startControl,assembleControl} from '../control.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {uploadsFamily} from '../product-ports/uploads.mjs';
import {HOST_ALLOCATION_SQL} from '../../control/browser-hosts/postgres-allocations.mjs';
import {hostClientDnsName} from '../../worker/conversation/host/control/protocol.mjs';
import {nativeUploadCustody} from '../uploads/native-host-contract.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const IMAGE='sha256:'+'b'.repeat(64),POLICY='f'.repeat(64);
const bytes=Buffer.from('native Control integration');
const declaration={filename:'note.txt',mimeType:'text/plain',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};

async function fixture({clientId=null,n=3,missingOwner=false}={}){
 const at=Date.now(),expires=at+60000;
 const binding={tenantId:id(1),actorId:id(2),conversationId:id(n),runId:id(100+n),attemptId:id(5),workerId:id(6),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:clientId===null?'private-user':'client',resourceId:clientId??binding.actorId,policyRevision:'p1'}];
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,
  generation:3,hostId:id(200+n),hostMode:'native-processing',imageDigest:IMAGE,leaseDeadlineMs:at+600000};
 const hostIdentity={schema:'meri-d005-host-identity/1',hostId:allocation.hostId,conversationId:binding.conversationId,
  instanceId:'i-0123456789abcdef0',bootId:id(8)};
 const endpoint={address:`10.1.2.${n}`,port:9443,serverName:'host.example',serverFingerprintSha256:'b'.repeat(64)};
 const allocationRecord={allocation,originalBinding:binding,hostIdentity,ownerInstanceId:id(9),endpoint,
  hostCertificate:{fingerprintSha256:'a'.repeat(64),dnsName:hostClientDnsName(allocation),notAfterMs:expires},serverCertificateNotAfterMs:expires};
 const upload={uploadId:id(300+n),requestId:id(400+n),owner:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,clientId},
  declaration,scopes,objectId:id(500+n),object:{objectId:id(500+n),versionId:'V',sha256:declaration.sha256,bytes:bytes.length,scopes},
  state:'stored',inspection:null,createdAtMs:at-1000,updatedAtMs:at-1000,revision:2};
 const custody=nativeUploadCustody(upload,{binding,scopes,selectedClientId:clientId,checkedAtMs:at,expiresAtMs:expires});
 const projection={binding,state:'running',scopes,policyRevision:'p1',createdAt:new Date(at-1000).toISOString(),
  versions:{imageDigest:IMAGE,sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'}};
 const request={requestId:upload.requestId};
 const run={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,request_id:request.requestId,
  projection,projection_sha256:hash(projection),request,request_sha256:hash(request),last_sequence:3,sequence_end:null};
 const state={expired:false,reads:[],coreReads:0,borrowed:0,closes:new Map(),events:[],listeners:0,preListen:null};
 const close=name=>state.closes.set(name,(state.closes.get(name)??0)+1);
 const sql=async(sql,args=[],connectionId='pool')=>{
  state.reads.push({sql,args,connectionId});
  if(/pg_advisory_unlock/u.test(sql))return {rows:[{unlocked:true}],rowCount:1};
  if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|SELECT pg_advisory)/u.test(sql))return {rows:[],rowCount:0};
  if(sql===HOST_ALLOCATION_SQL.nativeConversation)return {rows:[{host_id:allocation.hostId,generation:allocation.generation,
   tenant_id:binding.tenantId,conversation_id:binding.conversationId,allocation_json:allocation,allocation_sha256:hash(allocation),
   original_binding_json:binding,host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),owner_instance_id:allocationRecord.ownerInstanceId,
   endpoint_json:endpoint,record_sha256:hash(allocationRecord),client_cert_sha256:allocationRecord.hostCertificate.fingerprintSha256,
   client_dns_name:allocationRecord.hostCertificate.dnsName,client_cert_not_after_ms:expires,server_cert_not_after_ms:expires,
   credential_revision:1,lease_deadline_ms:allocation.leaseDeadlineMs,state:'active'}],rowCount:1};
  if(sql.includes('unnest'))return {rows:(args[0]??[]).map(name=>({name,relation:name})),rowCount:args[0]?.length??0};
  if(sql.includes("to_regclass('meri_conversations.runs')"))return {rows:[{runs:'meri_conversations.runs',events:'meri_conversations.events',controls:'meri_conversations.controls',selected_outputs:'meri_conversations.selected_outputs',initial_inputs:'meri_conversations.initial_inputs'}],rowCount:1};
  if(sql.startsWith('SELECT s.projection'))return {rows:[{projection:null,projection_sha256:null,state:null,ledger_sequence:null,watermark_sequence:null,watermark_entry_sha256:null}],rowCount:1};
  if(sql.includes('retention_recovery_watermark'))return {rows:[],rowCount:0};
  if(sql.includes('meri_conversations.native_executions')){
   assert.deepEqual(args,[binding.tenantId,binding.conversationId,binding.runId]);
   const execution={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'c'.repeat(64),expiresAtMs:state.expired?at-1:expires,
    runtimeSessionId:'conversation-'+hash(binding),phase:'started',native:null};
   return {rows:[{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,execution_key:execution.executionKey,
    execution_id:execution.executionId,record:execution,record_sha256:hash(execution)}],rowCount:1};
  }
  if(sql.includes('meri_conversations.runs'))return {rows:[run],rowCount:1};
  if(sql.includes('meri_uploads.originals')){
   assert.deepEqual(args,[binding.tenantId,binding.actorId,binding.conversationId,upload.uploadId]);
   return {rows:[{record:upload,record_sha256:hash(upload),tenant_id:binding.tenantId,owner_actor_id:binding.actorId,conversation_id:binding.conversationId,
    upload_id:upload.uploadId,request_id:upload.requestId,revision:upload.revision}],rowCount:1};
  }
  throw Error('UNEXPECTED_SQL '+sql);
 };
 const pool={query:(q,a)=>sql(q,a),async connect(){const connectionId=++state.borrowed;return {query:(q,a)=>sql(q,a,connectionId),release(){}};},async end(){close('pool');}};
 const identityContext={async verifyIdentity({credential}){assert.equal(credential,'synthetic-native');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'i1',checkedAtMs:Date.now(),expiresAtMs:expires};},
  async resolveContext({identitySha256,hints}){assert.equal(hints.conversationId,binding.conversationId);assert.equal(hints.clientId,clientId);
   return {identitySha256,binding,scopes,selectedClientId:clientId,contextRevision:'c1',checkedAtMs:Date.now(),expiresAtMs:expires};}};
 const core={async readCurrent(q){state.coreReads++;assert.equal(q.clientId,clientId);return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},role:'standard_user',permissions:[],clientIds:clientId===null?[]:[clientId],
  identityRevision:'1'.repeat(64),membershipRevision:'2'.repeat(64),contextRevision:'3'.repeat(64),conversationId:binding.conversationId,selectedClientId:clientId,checkedAtMs:Date.now(),expiresAtMs:expires};}};
 const base=agentcoreControlFixture().configuration;
 const configuration={...base,sourceEnabled:true,artifacts:{enabled:true,region:'us-east-1',bucket:'synthetic-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',
  kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001'},retention:{enabled:true,purge:{enabled:false}},
  uploads:{enabled:true,native:{enabled:true,host:{tls:{certPath:'/t/c.pem',keyPath:'/t/k.pem',caPath:'/t/ca.pem'},maxRequestMs:3000},policySha256:POLICY}}};
 let assembly,relay;
 const candidate={execution:{authenticate(){throw Error('unexpected execution');}},native:{async readiness(){},async call(){throw Error('unexpected native call');}},
  productPorts:Object.freeze({}),application:{async handle(){return null;}},bindApplication(){},async close(){close('candidate');}};
 const owners={async readMaterial(path){return Buffer.from(path===configuration.database.connectionFile?'postgresql://database.synthetic.invalid/meri?sslmode=verify-full':'synthetic');},
  async tls(){return {synthetic:true};},createPool(){return pool;},
  async connect(){return {async withDeadline(_a,fn){return fn();},async withAbortSignal(_s,fn){return fn();},workflowService:{async describeNamespace(){return {};}},async close(){close('temporal');}};},
  createClient(){return {workflow:{async start(){return {};},getHandle(){return {};}}};},async startCandidate(){return candidate;},
  assemble(options){relay=options.nativeAllocations;assembly=assembleControl(options);state.events.push('assembled');return assembly;},
  async listen(){
   if(!missingOwner&&state.listeners===0){await assembly.sessions.issue({identityCredential:'synthetic-native',hints:{conversationId:binding.conversationId,clientId},deadlineMs:Date.now()+5000});
    state.preListen=await relay.resolve({binding,custody,declaration});state.events.push('resolved');}
   const name='listener:'+ ++state.listeners;state.events.push(name);
   return {address:{port:1},async close(){close(name);}};
  }};
 const productPortsFactory=context=>{const family=uploadsFamily({createS3Client:()=>({async send(){throw Error('unexpected S3');}}),ids:()=>id(999)})(context);
  return {...family.ports,identityContext,...(missingOwner?{}:{browserHostCore:core}),retentionLedgerSink:{async append(){throw Error('unexpected ledger write');},async read(){return [];}}};};
 const runtime=await startControl(configuration,{productPortsFactory,testOwners:owners});
 return {runtime,relay,assembly,state,binding,custody,declaration,endpoint,allocation};
}

for(const [label,clientId,n] of [['General',null,3],['selected client',id(30),4]])test('actual Control native '+label+' resolution and exact close',async()=>{
 const f=await fixture({clientId,n});
 try{
  assert.equal(f.state.preListen.allocation.hostId,f.allocation.hostId);
  assert.equal(f.state.preListen.endpoint.address,f.endpoint.address);
  assert.deepEqual(f.state.events.slice(0,3),['assembled','resolved','listener:1']);
  const firstReads=f.state.reads.filter(x=>x.sql===HOST_ALLOCATION_SQL.nativeConversation||x.sql.includes('meri_conversations.native_executions')||x.sql.includes('meri_uploads.originals'));
  assert.equal(new Set(firstReads.map(x=>x.connectionId)).size,1,'allocation/execution/upload use one reader lease');
  assert.equal(f.state.coreReads,1);
  f.state.expired=true;await assert.rejects(async()=>f.relay.resolve({binding:f.binding,custody:f.custody,declaration:f.declaration}));
  f.state.expired=false;await assert.rejects(async()=>f.relay.resolve({binding:f.binding,custody:f.custody,declaration:{...f.declaration,sha256:'0'.repeat(64)}}));
 }finally{await Promise.all([f.runtime.close(),f.runtime.close()]);}
 for(const name of ['pool','temporal','candidate',...Array.from({length:f.state.listeners},(_,i)=>'listener:'+(i+1))])assert.equal(f.state.closes.get(name),1,name+' closes exactly once');
 const reads=f.state.reads.length;
 await assert.rejects(async()=>f.relay.resolve({binding:f.binding,custody:f.custody,declaration:f.declaration}));
 assert.equal(f.state.reads.length,reads,'closed relay performs no further SQL');
});
test('actual Control without native Core owner remains unavailable',async()=>{
 const f=await fixture({missingOwner:true});
 try{const reads=f.state.reads.length;await assert.rejects(async()=>f.relay.resolve({binding:f.binding,custody:f.custody,declaration:f.declaration}));
  assert.equal(f.state.reads.length,reads);assert.equal(f.state.coreReads,0);
 }finally{await f.runtime.close();}
});

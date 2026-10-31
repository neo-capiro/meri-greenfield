/** CONNECTED native wire: REAL pinned client -> REAL captured currentness server -> REAL Postgres store native method
 * -> canonical native callback. Only the TLS module, the https stream pair and the SQL transaction are inert. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertNativeHostCurrent} from '../../worker/conversation/host/binding.mjs';
import {hostClientDnsName} from '../../worker/conversation/host/control/protocol.mjs';
import {nativeUploadCustody} from '../../runtime/uploads/native-host-contract.mjs';

mock.module('../../worker/conversation/host/control/tls.mjs',{exports:{
 privateAddress:value=>value,dnsName:value=>value,fingerprint:value=>value,tlsBytes:value=>Buffer.from(value),
 MAX_CERT_LIFETIME_MS:900000,sha256Der:()=> 'd'.repeat(64),
 checkedCertificate:(_raw,{nowMs})=>Object.freeze({fingerprintSha256:'d'.repeat(64),notAfterMs:nowMs+300000}),
}});

const NOW=Date.now(),clock={get now(){return Date.now();}};
const sha=b=>createHash('sha256').update(b).digest('hex');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const BYTES=Buffer.from('native wire exact bytes\n');
const DECLARATION={filename:'note.txt',mimeType:'text/plain',bytes:BYTES.length,sha256:sha(BYTES)};
const IMAGE=`sha256:${'b'.repeat(64)}`,LEASE=NOW+600000,POLICY='f'.repeat(64);
const BINDING={tenantId:uuid(1),actorId:uuid(2),conversationId:uuid(3),runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),
 writerFence:1};
const SCOPES=[{tenantId:BINDING.tenantId,kind:'private-user',resourceId:BINDING.actorId,policyRevision:'p1'}];
const ALLOCATION={schema:'meri-conversation-host-allocation/1',tenantId:BINDING.tenantId,
 conversationId:BINDING.conversationId,generation:3,hostId:uuid(7),hostMode:'native-processing',imageDigest:IMAGE,
 leaseDeadlineMs:LEASE};
const IDENTITY={schema:'meri-d005-host-identity/1',hostId:uuid(7),conversationId:BINDING.conversationId,
 instanceId:'i-0123456789abcdef0',bootId:uuid(8)};
const RECORD={uploadId:uuid(20),requestId:uuid(21),
 owner:{tenantId:BINDING.tenantId,actorId:BINDING.actorId,conversationId:BINDING.conversationId,clientId:null},
 declaration:DECLARATION,scopes:SCOPES,objectId:uuid(22),
 object:{objectId:uuid(22),versionId:'V',sha256:DECLARATION.sha256,bytes:DECLARATION.bytes,scopes:SCOPES},
 state:'stored',inspection:null,createdAtMs:NOW-1000,updatedAtMs:NOW-1000,revision:2};
const CUSTODY=nativeUploadCustody(RECORD,{binding:BINDING,scopes:SCOPES,selectedClientId:null,
 checkedAtMs:NOW-500,expiresAtMs:LEASE});
import {createCanonicalNativeCurrentness} from '../../control/browser-hosts/native-currentness.mjs';
import {createPostgresUploadStore} from '../../control/uploads/postgres-store.mjs';
import {createRetentionReadGate} from '../../control/retention/suppression.mjs';
import {createNativeProcessingVerifier} from '../../runtime/native-processing-host/verifier.mjs';
function canonicalFor({coreDenied=false}={}){
 const uploads=createPostgresUploadStore({pool:{connect:()=>{throw Error('NESTED_TRANSACTION');}}});
 const core={readCurrent:async()=>{if(coreDenied)throw Object.assign(Error('CORE_CURRENT_REFUSED'),{code:'CORE_CURRENT_REFUSED'});return ({principal:{tenantId:BINDING.tenantId,actorId:BINDING.actorId},role:'standard_user',permissions:[],clientIds:[],identityRevision:'1'.repeat(64),membershipRevision:'2'.repeat(64),contextRevision:'3'.repeat(64),conversationId:BINDING.conversationId,selectedClientId:null,checkedAtMs:Date.now(),expiresAtMs:Date.now()+4000});}};
 const nativeCredentials={nativeCredentialFor:async()=>({credential:'synthetic-native-only',expiresAtMs:NOW+4000})};
 const retentionGate=createRetentionReadGate({journal:{get:async()=>null},serving:{isEnabled:()=>true}});
 // Sole domain owner stub: canonical execution result. SQL transport, credential/Core responses and journal storage inert.
 const executions={readCurrentOnClient:async()=>({binding:BINDING,scopes:SCOPES,run:{state:'running'},executionPhase:'started',deadlineMs:NOW+4000})};
 return createCanonicalNativeCurrentness({executions,uploads,core,nativeCredentials,retentionGate,now:()=>clock.now,policySha256:POLICY,maxFreshMs:5000});
}
const peerName=hostClientDnsName(ALLOCATION);

function wire(captured){
 return {request(options,callback){
  const emitter=new EventEmitter();
  let body=Buffer.alloc(0);
  emitter.write=chunk=>{body=Buffer.concat([body,Buffer.from(chunk)]);return true;};
  emitter.end=async chunk=>{ if(chunk) body=Buffer.concat([body,Buffer.from(chunk)]);
   const req=Readable.from([body]);
   req.httpVersion='1.1';req.method='POST';req.url=options.path;
   req.rawHeaders=['host','host.example','content-type','application/json','content-length',String(body.length)];
   req.socket={authorized:true,getPeerCertificate:()=>({raw:Buffer.from('peer')})};
   const response=new EventEmitter();
   response.statusCode=0;let out=Buffer.alloc(0);
   response.writeHead=(status,headers)=>{response.statusCode=status;response.headers=headers;};
   response.end=chunk=>{if(chunk)out=Buffer.concat([out,Buffer.from(chunk)]);
    callback(response);setImmediate(()=>{response.emit('data',out);response.emit('end');});};
   response.destroy=()=>{};response.resume=()=>{};response.setEncoding=()=>{};
   response.on=(event,fn)=>{EventEmitter.prototype.on.call(response,event,fn);return response;};
   await captured.handler(req,response);
  };
  emitter.on=(event,fn)=>{if(event==='error')emitter._error=fn;return emitter;};
  emitter.destroy=()=>{};
  return emitter;
 }};
}

async function compose({readCanonicalNative,nonceRows=1,coreDenied=false}={}){
 let uploadPresent=true;
 const clientQuery={async query(sql,params){
  if(/FROM meri_uploads.originals/u.test(sql)&&!uploadPresent)return {rows:[]};
  if(/FROM meri_uploads.originals/u.test(sql))return {rows:[{record:RECORD,record_sha256:hash(RECORD),tenant_id:BINDING.tenantId,owner_actor_id:BINDING.actorId,conversation_id:BINDING.conversationId,upload_id:RECORD.uploadId,request_id:RECORD.requestId,revision:RECORD.revision}]};
  if(/lock_allocation/u.test(sql))return {rows:[{allocation_json:ALLOCATION,allocation_sha256:hash(ALLOCATION),
   host_identity_json:IDENTITY,host_identity_sha256:hash(IDENTITY),client_cert_sha256:'d'.repeat(64),
   client_dns_name:peerName,client_cert_not_after_ms:String(LEASE),lease_deadline_ms:String(LEASE),state:'active'}]};
  if(/request_nonces/u.test(sql))return {rows:nonceRows?[{nonce_sha256:params[2]}]:[]};
  if(/now_ms/u.test(sql))return {rows:[{now_ms:String(clock.now)}]};
  throw Error('UNEXPECTED_SQL '+sql);
 }};
 const {createPostgresHostCurrentnessStore}=await import('../../worker/conversation/host/control/postgres-store.mjs');
 const store=createPostgresHostCurrentnessStore({transact:async work=>work(clientQuery),maxLeaseMs:5000,
  readCanonicalNative:readCanonicalNative??canonicalFor({coreDenied}).readCanonicalNative,
  readCanonicalRun:async()=>{throw Error('browser run must not run');},
  readCanonicalFacts:async()=>{throw Error('browser facts must not run');},
  resolveWorkflow:async()=>{throw Error('browser workflow must not run');},
  holdCustody:async()=>{throw Error('browser hold must not run');},
  decideBrowserApproval:async()=>{throw Error('browser decide must not run');},
  recordBrowserReceipt:async()=>{throw Error('browser receipt must not run');}});
 const captured={handler:null};const fake=new EventEmitter();
 fake.listening=false;fake.listen=()=>{fake.listening=true;fake.emit('listening');};
 fake.address=()=>({address:'127.0.0.1',port:8443});fake.close=cb=>cb?.();
 const {createHostCurrentnessServer}=await import('../../worker/conversation/host/control/server.mjs');
 createHostCurrentnessServer({bind:{address:'127.0.0.1',port:8443},
  tls:{serverName:'host.example',cert:Buffer.from('c'),key:Buffer.from('k'),clientCa:Buffer.from('ca')},
  store,maxFreshMs:5000,requestMs:5000,now:()=>clock.now,
  httpsModule:{createServer:(_options,handler)=>{captured.handler=handler;return fake;}}});
 const {createHostCurrentnessClient}=await import('../../worker/conversation/host/control/client.mjs');
 const createNative=()=>createHostCurrentnessClient({allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  purpose:'native-processing',endpoint:{address:'127.0.0.1',port:8443,serverName:'host.example',
   serverFingerprintSha256:'d'.repeat(64)},tls:{cert:Buffer.from('c'),key:Buffer.from('k'),ca:Buffer.from('ca')},
  maxFreshMs:5000,timeoutMs:5000,now:()=>clock.now,httpsModule:wire(captured)});
 const browser=()=>createHostCurrentnessClient({allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  purpose:'browser',endpoint:{address:'127.0.0.1',port:8443,serverName:'host.example',
   serverFingerprintSha256:'d'.repeat(64)},tls:{cert:Buffer.from('c'),key:Buffer.from('k'),ca:Buffer.from('c')},
  maxFreshMs:5000,timeoutMs:5000,now:()=>clock.now,httpsModule:wire(captured)});
 return {native:createNative(),createNative,browser,store,transport:wire(captured),removeUpload(){uploadPresent=false;}};
}


export {compose,BYTES,DECLARATION,IMAGE,LEASE,POLICY,BINDING,SCOPES,RECORD,CUSTODY,ALLOCATION,IDENTITY,sha,uuid};

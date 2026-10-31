import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs'
import {NATIVE_PHYSICAL_OPERATION_MS} from '../../../packages/contracts/native-physical-absence.mjs';
import {createControlNativeHostTeardown} from '../native-control-teardown.mjs';
import {hostClientDnsName} from '../../worker/conversation/host/control/protocol.mjs';
import {productFailure} from '../../control/product-access/errors.mjs';
import {createNativeHostLifecycle} from '../native-host-lifecycle.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant',actorId:id(2),conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const hostId=id(9),generation=1,now=100000;
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation,hostId,hostMode:'native-processing',imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:now+600000};
const hostIdentity={schema:'meri-d005-host-identity/1',hostId,conversationId:binding.conversationId,instanceId:'i-0123456789abcdef0',bootId:id(7)};
const endpoint={address:'10.0.0.11',port:9443,serverName:'host.example',serverFingerprintSha256:'b'.repeat(64)};
const record={allocation,originalBinding:binding,hostIdentity,ownerInstanceId:id(8),endpoint,
 hostCertificate:{fingerprintSha256:'c'.repeat(64),dnsName:hostClientDnsName(allocation),notAfterMs:now+600000},
 serverCertificateNotAfterMs:now+600000};
const row={host_id:hostId,generation,tenant_id:binding.tenantId,conversation_id:binding.conversationId,
 allocation_json:allocation,allocation_sha256:hash(allocation),original_binding_json:binding,
 host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),owner_instance_id:record.ownerInstanceId,
 endpoint_json:endpoint,record_sha256:hash(record),client_cert_sha256:record.hostCertificate.fingerprintSha256,
 client_dns_name:record.hostCertificate.dnsName,client_cert_not_after_ms:record.hostCertificate.notAfterMs,
 server_cert_not_after_ms:record.serverCertificateNotAfterMs,credential_revision:1,lease_deadline_ms:allocation.leaseDeadlineMs,state:'active'};
const configuration={uploads:{native:{enabled:true,host:{tls:{certPath:'/synthetic/cert',keyPath:'/synthetic/key',
 caPath:'/synthetic/ca',clientName:'control.meri.internal'},maxRequestMs:30000,policySha256:'d'.repeat(64),
 deployment:{accountId:'967807252336',region:'us-east-1',amiId:'ami-0123456789abcdef0',
  vpcId:'vpc-0123456789abcdef0',subnetId:'subnet-0123456789abcdef0',securityGroupId:'sg-0123456789abcdef0',
  rootDeviceName:'/dev/xvda'}}}}};
function pool(){
 const queries=[];
 const client={async query(sql,args=[]){queries.push(sql);
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL ')||sql==='SHOW transaction_isolation')return {rows:[]};
  if(sql.startsWith('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1'))return {rows:row.state==='missing'?[]:[row]};
  if(sql.startsWith('UPDATE meri_host_control.host_allocations SET state=')){row.state='terminated';row.teardown_json=args[2];row.teardown_sha256=args[3];return {rows:[]};}
  throw Error('UNEXPECTED_SQL '+sql);},release(){}};
 return {queries,async connect(){return client;},async end(){}};
}
function owners(calls){
 let ownerNow,preAt,deadline;
 const volumeId='vol-0123456789abcdef0',eniId='eni-0123456789abcdef0';
 const digests={allocationSha256:hash(allocation),bindingSha256:hash(binding),hostIdentitySha256:hash(hostIdentity)};
 const stamp=()=>ownerNow();
 const client={async close(){calls.push('remote-close');return {closed:true,status:'closed',observedAtMs:stamp()};},
  async processes(){return {schema:'meri-d005-process-absence/1',...digests,observedAtMs:stamp(),scope:'native-processing-descendants',exited:true,remainingPids:[]};},
  async observe(){return {schema:'meri-d005-native-absence/1',...digests,observedAtMs:stamp(),scope:'native-processing-descendants',cgroup:'removed',networkNamespace:'removed',status:'absent'};},
  async dispose(){calls.push('client-dispose');return {disposed:true};}};
 const physical={async destroy(){calls.push('host-destroy');preAt=stamp();deadline=preAt+NATIVE_PHYSICAL_OPERATION_MS;
   return {requested:true,instanceId:hostIdentity.instanceId,rootVolumeId:volumeId,networkInterfaceIds:[eniId]};},
  async observeAbsent(){calls.push('host-absent');
   const terminalAt=stamp(),firstAt=stamp(),secondAt=stamp(),observedAtMs=stamp();
   const meta=requestId=>({requestId,httpStatusCode:200});
   const evidence={schema:'meri-native-correlated-absence/1',protocolVersion:1,operationDeadlineMs:deadline,
    accountId:'967807252336',region:'us-east-1',caller:{accountId:'967807252336',region:'us-east-1',
     arn:'arn:aws:sts::967807252336:assumed-role/Control/session',userId:'AROAEXAMPLE:session'},
    instanceId:hostIdentity.instanceId,rootVolumeId:volumeId,networkInterfaceIds:[eniId],
    preObservation:{schema:'meri-native-preobservation/1',accountId:'967807252336',region:'us-east-1',
     instanceId:hostIdentity.instanceId,rootVolumeId:volumeId,networkInterfaceIds:[eniId],
     rootVolumeDeleteOnTermination:true,atMs:preAt,...meta('pre-1'),
     attachments:[{id:eniId,attachmentId:'eni-attach-0123456789abcdef0',deleteOnTermination:true,deviceIndex:0}],
     volume:{volumeId,state:'in-use',attachmentInstanceId:hostIdentity.instanceId,deleteOnTermination:true,...meta('pre-volume')},
     networkInterfaces:[{id:eniId,attachmentInstanceId:hostIdentity.instanceId,deleteOnTermination:true,...meta('pre-eni')}]},
    terminalObservation:{atMs:terminalAt,instanceId:hostIdentity.instanceId,state:'terminated',...meta('terminal')},
    resources:[{kind:'volume',id:volumeId,observations:[firstAt,secondAt].map((atMs,i)=>({atMs,absent:true,
     resourceId:volumeId,errorCode:'InvalidVolume.NotFound',requestId:'volume-'+i,httpStatusCode:400}))},
     {kind:'network-interface',id:eniId,observations:[firstAt,secondAt].map((atMs,i)=>({atMs,absent:true,
      resourceId:eniId,errorCode:'InvalidNetworkInterfaceID.NotFound',requestId:'eni-'+i,httpStatusCode:400}))}]};
   return {schema:'meri-d005-physical-absence/1',...digests,instanceId:hostIdentity.instanceId,rootVolumeId:volumeId,
    networkInterfaceIds:[eniId],observedAtMs,instanceState:'terminated',rootVolumeAbsent:true,networkInterfacesAbsent:true,evidence};}};
 return {calls,createPhysical:({now})=>{ownerNow=now;return physical;},
  createLifecycleClient:({now})=>{ownerNow=now;return client;},readMaterial:async file=>Buffer.from('synthetic:'+file)};
}

test('D3: legacy active/unknown cleanup never re-enters effects, including a fresh owner',async()=>{
 const p=pool(),calls=[];let clock=now-1000;
 const forbidden={readMaterial:async()=>{calls.push('tls');throw Error('unexpected');},
  createLifecycleClient:()=>{calls.push('client');},createPhysical:()=>{calls.push('physical');},
  createEc2Client:()=>{calls.push('sdk');},verifyCaller:()=>{calls.push('sts');}};
 for(const state of ['active','quarantined']){
  row.state=state;row.teardown_json={status:'UNKNOWN'};row.teardown_sha256=hash(row.teardown_json);
  const before=hash(row);
  for(let restart=0;restart<2;restart++){
   const teardown=createControlNativeHostTeardown({configuration,pool:p,owners:forbidden,now:()=>clock++});
   assert.deepEqual(await teardown.settle({binding,generation,hostId}),{binding,generation,hostId,closed:false,verified:false});
   await teardown.close();
  }
  assert.equal(hash(row),before,'historical custody remains unchanged');
 }
 assert.deepEqual(calls,[]);
});

test('legacy verified terminal receipt is recoverable without TLS or physical effects',async()=>{
 // Construct historical evidence with the canonical coordinator and inert ports, independently of Control admission.
 let clock=now-1000;const old=owners([]),oldNow=()=>clock++;
 const lifecycle=createNativeHostLifecycle({allocation,binding,hostIdentity,now:oldNow,
  client:old.createLifecycleClient({now:oldNow}),physical:old.createPhysical({now:oldNow}),
  writer:{recordTeardown:async({receipt})=>{row.teardown_json=receipt;row.teardown_sha256=hash(receipt);return {terminated:true};}}});
 await lifecycle.settle({reason:'conversation-end'});row.state='terminated';
 const before=hash(row),calls=[];
 for(let restart=0;restart<2;restart++){
  const teardown=createControlNativeHostTeardown({configuration,pool:pool(),now:oldNow,
   owners:{readMaterial:async()=>{calls.push('tls');throw Error('unexpected');}}});
  const value=await teardown.settle({binding,generation,hostId});
  assert.equal(value.verified,true);assert.equal(value.closed,true);assert.equal(value.receipt.status,'VERIFIED');
  await teardown.close();
 }
 assert.deepEqual(calls,[]);assert.equal(hash(row),before);
});
test('teardown refuses a request without the exact canonical host row',async()=>{
 const p=pool(),calls=[];let clock=now-1000;const teardown=createControlNativeHostTeardown({configuration,pool:p,owners:owners(calls),now:()=>clock++});
 row.state='missing';
 await assert.rejects(async()=>teardown.settle({binding,generation,hostId}),error=>productFailure(error)?.code==='BROWSER_HOST_TEARDOWN_REFUSED');
 await teardown.close();
});

/** End-to-end source observer with SDK/SQL transport fixtures; no real cloud/database qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeObserverRuntime} from '../native-observer-runtime.mjs';
import {observerFixture,instanceId,volumeId,eniId,uuid} from './native-observer-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {hostClientDnsName} from '../../worker/conversation/host/control/protocol.mjs';
import {HOST_TEARDOWN_SCHEMA} from '../../worker/conversation/host/teardown.mjs';
import {createNativePhysicalOwner} from '../../control/browser-hosts/native-physical-owner.mjs';
import {createControlNativeHostTeardown} from '../native-control-teardown.mjs';
import {createNativeHostLifecycle} from '../native-host-lifecycle.mjs';
import {physicalTriplet} from '../../control/browser-hosts/native-physical-journal.mjs';
import {assertNativeRetainedPhysical} from '../../../packages/contracts/native-observer.mjs';
import {createNativeWorkerOwners} from '../native-worker-owners.mjs';
async function fixture(){
 const f=await observerFixture();let row=structuredClone(f.row),backup,time=2000,terminations=0,sessions=0,managedTerminated=false;const calls=[];
 row.host_identity_json={schema:'meri-d005-host-identity/1',instanceId,bootId:uuid(91),conversationId:f.allocation.conversationId,hostId:f.allocation.hostId};
 const pool={async connect(){return {async query(sql,args=[]){
  if(sql==='BEGIN'){backup=structuredClone(row);return {rows:[]};}
  if(sql==='ROLLBACK'){row=backup;return {rows:[]};}
  if(sql==='COMMIT'||sql.startsWith('SET LOCAL'))return {rows:[]};
  if(sql==='SHOW transaction_isolation')return {rows:[{transaction_isolation:'read committed'}]};
  if(sql.includes('AS now_ms'))return {rows:[{now_ms:String(time)}]};
  if(sql.startsWith('SELECT *'))return {rows:[structuredClone(row)]};
  if(sql.startsWith('UPDATE meri_host_control.host_allocations SET native_physical_')){
   for(const m of sql.matchAll(/(native_physical_[a-z0-9_]+)=\$(\d+)/gu))row[m[1]]=structuredClone(args[Number(m[2])-1]);return {rows:[],rowCount:1};
  }
  if(sql.startsWith('UPDATE meri_host_control.host_allocations SET observed_instance_json')){
   row.observed_instance_json=structuredClone(args[2]);return {rows:[],rowCount:1};}
  if(sql.startsWith("UPDATE meri_host_control.host_allocations SET state='terminated'")){
   row.state='terminated';row.teardown_json=structuredClone(args[2]);row.teardown_sha256=args[3];return {rows:[],rowCount:1};}
  throw Error(`Unexpected SQL ${sql}`);
 },release(){}};}};
 const createSession=async()=>{sessions++;return {close(){},async send({api,input}){
  calls.push({api,input});time+=10;
  if(api==='TerminateInstances'){terminations++;return f.responses.TerminateInstances;}
  if((terminations||managedTerminated)&&api==='DescribeInstances'){
   const r=structuredClone(f.responses.DescribeInstances);r.Reservations[0].Instances[0].State={Name:'terminated',Code:48};return r;
  }
  if((terminations||managedTerminated)&&['DescribeVolumes','DescribeNetworkInterfaces'].includes(api))throw Object.assign(Error('missing'),{
   name:api==='DescribeVolumes'?'InvalidVolume.NotFound':'InvalidNetworkInterfaceID.NotFound',
   $metadata:{requestId:`actual-${api}-${time}`,httpStatusCode:400}});
  return f.responses[api];
 }};};
 const runtime=()=>createNativeObserverRuntime({pool,now:()=>time,createSession,sleep:async ms=>{time+=ms;}});
 return {...f,pool,createSession,now:()=>time,row:()=>row,runtime,calls,clock:t=>{time=t;},managedTerminated:()=>{managedTerminated=true;},counts:()=>({terminations,sessions})};
}
function setSlot(row,name,value){const [json,sha,canonical]=physicalTriplet(name,value);
 Object.assign(row,{[`native_physical_${name}_json`]:json,[`native_physical_${name}_sha256`]:sha,[`native_physical_${name}_canonical`]:canonical});}
function controlConfiguration(f){const d=f.declaration;return {uploads:{native:{enabled:true,host:{
 tls:{certPath:'/fixture/cert',keyPath:'/fixture/key',caPath:'/fixture/ca'},maxRequestMs:3000,
 observer:{keyId:'fixture-key',keyPath:'/fixture/observer'},deployment:{accountId:d.accountId,region:d.region,amiId:d.launch.ImageId,
 vpcId:d.placement.vpcId,subnetId:d.placement.subnetId,securityGroupId:d.placement.securityGroupIds[0],rootDeviceName:'/dev/xvda'}}}}};}
function guest(f){const digests={allocationSha256:hash(f.allocation),bindingSha256:hash(f.binding),hostIdentitySha256:hash(f.row().host_identity_json)};
 return {async close(){return {closed:true,status:'closed'};},async processes(){return {schema:'meri-d005-process-absence/1',...digests,
  observedAtMs:f.now(),scope:'native-processing-descendants',exited:true,remainingPids:[]};},async observe(){return {
  schema:'meri-d005-native-absence/1',...digests,observedAtMs:f.now(),scope:'native-processing-descendants',cgroup:'removed',networkNamespace:'removed',status:'absent'};}};}
function managedRequest(f,mode){const w=f.declaration.watchdog;return {schema:'meri-native-watchdog-request/1',hostId:f.key.hostId,generation:1,
 allocationSha256:f.row().allocation_sha256,provisionToken:f.declaration.token,executionArn:w.executionArn,originalInputSha256:w.inputSha256,
 bridgeProtocol:'native-observer-around-managed/1',bridgeFunctionVersionArn:f.declaration.physicalObserver.bridgeFunctionVersionArn,
 mode,requestId:uuid(88),issuedAtMs:f.now(),expiresAtMs:f.now()+3000};}
function activate(f){
 const row=f.row(),record={allocation:row.allocation_json,originalBinding:row.original_binding_json,hostIdentity:row.host_identity_json,
  ownerInstanceId:row.owner_instance_id,endpoint:{address:'10.0.0.5',port:9443,serverName:'host.example',serverFingerprintSha256:'a'.repeat(64)},
  hostCertificate:{fingerprintSha256:'b'.repeat(64),dnsName:hostClientDnsName(f.allocation),notAfterMs:61000},serverCertificateNotAfterMs:61000};
 Object.assign(row,{state:'active',host_identity_sha256:hash(record.hostIdentity),endpoint_json:record.endpoint,record_sha256:hash(record),
  tenant_id:f.allocation.tenantId,conversation_id:f.allocation.conversationId,lease_deadline_ms:f.allocation.leaseDeadlineMs,
  client_cert_sha256:record.hostCertificate.fingerprintSha256,client_dns_name:record.hostCertificate.dnsName,
  client_cert_not_after_ms:61000,server_cert_not_after_ms:61000,credential_revision:1});return record;
}
test('ordinary runtime captures, sends once, reauthenticates after destroy signal closes, and returns retained canonical proof',async()=>{
 const f=await fixture(),runtime=f.runtime(),row=f.row(),port=runtime.ordinaryPort(row),controller=new AbortController();
 const request={allocation:row.allocation_json,binding:row.original_binding_json,hostIdentity:row.host_identity_json};
 const destroyed=await port.destroy(request,{signal:controller.signal});controller.abort();
 assert.equal(destroyed.requested,true);
 const resources={instanceId,rootVolumeId:volumeId,networkInterfaceIds:[eniId]};
 const absent=await port.observeAbsent({...request,resources},{signal:new AbortController().signal});
 assert.equal(absent.instanceState,'terminated');assert.equal(absent.evidence.protocolVersion,1);
 assert.equal(absent.evidence.operationDeadlineMs,27000);assert.deepEqual(f.counts(),{terminations:1,sessions:2});
 const restarted=f.runtime(),again=restarted.ordinaryPort(f.row());
 const count=f.calls.length;await again.destroy(request);const retained=await again.observeAbsent({...request,resources});
 assert.deepEqual(retained.evidence,absent.evidence);assert.equal(f.calls.length,count);
 assert.equal(f.counts().terminations,1);runtime.close();restarted.close();
});
test('managed preparation captures without any termination method or ordinary context',async()=>{
 const f=await fixture();f.clock(62000);const runtime=f.runtime(),w=f.declaration.watchdog;
 const reply=await runtime.observeIntent({schema:'meri-native-watchdog-request/1',hostId:f.key.hostId,generation:1,
  allocationSha256:f.row().allocation_sha256,provisionToken:f.declaration.token,executionArn:w.executionArn,originalInputSha256:w.inputSha256,
  bridgeProtocol:'native-observer-around-managed/1',bridgeFunctionVersionArn:f.declaration.physicalObserver.bridgeFunctionVersionArn,
  mode:'prepare',requestId:uuid(88),issuedAtMs:62000,expiresAtMs:65000},{deadlineMs:65000});
 assert.equal(reply.disposition,'pending');assert.ok(reply.resourcesSha256);assert.equal(f.counts().terminations,0);
 const state=await runtime.writer.readNativePhysicalState({key:f.key});assert.equal(state.context.ordinary,null);assert.ok(state.resources.managed);
 runtime.close();
});
test('full receipt fence drains original pending slots, blocks new intake and commits an immutable terminal row',async()=>{
 const f=await fixture(),runtime=f.runtime(),row=f.row(),port=runtime.ordinaryPort(row);
 const request={allocation:row.allocation_json,binding:row.original_binding_json,hostIdentity:row.host_identity_json};
 await port.destroy(request);const absence=await port.observeAbsent({...request,resources:{instanceId,rootVolumeId:volumeId,networkInterfaceIds:[eniId]}});
 const record=activate(f);
 const receipt={schema:HOST_TEARDOWN_SCHEMA,allocationSha256:hash(f.allocation),bindingSha256:hash(f.binding),hostIdentitySha256:hash(record.hostIdentity),
  reason:'conversation-end',startedAtMs:1990,browserEgress:'not-applicable',bashEgress:'not-applicable',processes:'exited',
  browserState:'not-applicable',hostDestroy:'requested',hostAbsence:'confirmed',status:'VERIFIED',processScope:'native-processing-descendants',
  cgroup:'removed',networkNamespace:'removed',physicalProtocolVersion:1,physicalEvidence:absence.evidence};
 await assert.rejects(()=>runtime.writer.prepareNativeFullTeardown({key:f.key,receipt:{...receipt,cgroup:'unknown'}}));
 assert.equal((await runtime.writer.readNativePhysicalState({key:f.key})).observations.closedForFullTeardown,null);
 const writer=createNativePhysicalOwner({pool:f.pool,now:f.now,requestDeadlineMs:()=>f.now()+500});
 const pending=await writer.reserveNativePhysicalOperation({key:f.key,phase:'managed',stage:'authentication',sessionId:uuid(70),operationId:uuid(71),request:{api:'GetCallerIdentity'}});
 await runtime.writer.prepareNativeFullTeardown({key:f.key,receipt});
 const fenced=structuredClone(f.row()),unexpected=()=>{throw Error('restart cannot reconstruct original guest receipt');};
 const restarted=createControlNativeHostTeardown({configuration:controlConfiguration(f),pool:f.pool,now:f.now,
  owners:{readMaterial:unexpected,createObserverSession:unexpected}});
 const recovery=await restarted.settle({binding:f.binding,hostId:f.key.hostId,generation:1});
 assert.equal(recovery.closed,false);assert.equal(recovery.physical.ordinary.disposition,'verified-absent');
 assert.deepEqual(f.row(),fenced);await restarted.close();
 await assert.rejects(()=>writer.reserveNativePhysicalOperation({key:f.key,phase:'managed',stage:'authentication',sessionId:uuid(72),operationId:uuid(73),request:{api:'GetCallerIdentity'}}));
 await assert.rejects(()=>runtime.writer.recordTeardown({hostId:f.key.hostId,generation:1,receipt}));
 assert.notEqual(f.row().state,'terminated');
 await runtime.drainFullTeardown({key:f.key,receipt,deadlineMs:f.now()+1000});
 assert.ok(f.now()>=pending.event.callDeadlineMs);
 await runtime.writer.recordTeardown({hostId:f.key.hostId,generation:1,receipt});
 assert.equal(f.row().state,'terminated');const retained=await runtime.writer.readNativePhysicalState({key:f.key});
 assert.equal(retained.result.managed.reason,'superseded-by-full-teardown');
 await assert.rejects(()=>writer.completeNativePhysicalOperation({key:f.key,operationId:uuid(71),completion:{completedAtMs:f.now(),outcome:'transport-unknown',requestId:null,httpStatusCode:null,errorCode:null,facts:null}}));
 assert.deepEqual(await runtime.writer.recordTeardown({hostId:f.key.hostId,generation:1,receipt}),{terminated:true,receiptSha256:hash(receipt)});
 assert.equal(f.counts().terminations,1);runtime.close();
});
test('expired ordinary recovery through the actual Control owner reads the canonical row before any TLS or SDK work',async()=>{
 const f=await fixture(),runtime=f.runtime(),row=f.row(),port=runtime.ordinaryPort(row);
 const request={allocation:row.allocation_json,binding:row.original_binding_json,hostIdentity:row.host_identity_json};
 await port.destroy(request);activate(f);f.clock(27001);const effects=[];
 const d=f.declaration,configuration={uploads:{native:{enabled:true,policySha256:d.bootstrapSpec.control.policySha256,
  host:{tls:{certPath:'/fixture/cert',keyPath:'/fixture/key',caPath:'/fixture/ca'},maxRequestMs:3000,
   deployment:{accountId:d.accountId,region:d.region,amiId:d.launch.ImageId,vpcId:d.placement.vpcId,subnetId:d.placement.subnetId,
    securityGroupId:d.placement.securityGroupIds[0],rootDeviceName:'/dev/xvda'}}}}};
 const unexpected=()=>{effects.push('unexpected');throw Error('Recovery must not start privileged work');};
 const owner=createControlNativeHostTeardown({configuration,pool:f.pool,now:f.now,
  owners:{readMaterial:unexpected,createLifecycleClient:unexpected,createEc2Client:unexpected,verifyCaller:unexpected}});
 const reply=await owner.settle({binding:f.binding,hostId:f.key.hostId,generation:1});
 assert.equal(reply.closed,false);assert.equal(reply.verified,false);assert.deepEqual(effects,[]);
 assert.equal(reply.physical.ordinary.disposition,'unknown');assert.equal(reply.physical.ordinary.reason,'deadline');
 assertNativeRetainedPhysical(reply.physical,{allocation:f.allocation,binding:f.binding,declaration:f.declaration,nowMs:f.now()});
 assert.equal(f.counts().terminations,1);await owner.close();runtime.close();
});

test('Control starts the first independent O after M expires, even with four orphan M calls',async()=>{
 const f=await fixture();activate(f);
 const writer=createNativePhysicalOwner({pool:f.pool,now:f.now,requestDeadlineMs:()=>5000});
 for(let n=0;n<4;n++)await writer.reserveNativePhysicalOperation({key:f.key,phase:'managed',stage:'authentication',sessionId:uuid(100+n),
  operationId:uuid(110+n),request:{api:'GetCallerIdentity'}});
 f.clock(87000);const owner=createControlNativeHostTeardown({configuration:controlConfiguration(f),pool:f.pool,
  now:()=>{f.clock(f.now()+1);return f.now();},owners:{readMaterial:async()=>Buffer.from('fixture'),
   createObserverSession:f.createSession,createLifecycleClient:()=>guest(f)}});
 const reply=await owner.settle({binding:f.binding,hostId:f.key.hostId,generation:1});
 const state=await writer.readNativePhysicalState({key:f.key});
 assert.equal(state.context.managed.deadlineMs,86000);assert.ok(state.context.ordinary.startedAtMs>=87000);
 assert.equal(state.context.ordinary.deadlineMs,state.context.ordinary.startedAtMs+25000);
 assert.equal(state.result.managed.reason,'deadline');assert.equal(f.counts().terminations,1);
 assert.equal(reply.physical.ordinary.disposition,'verified-absent');await owner.close();
});

test('protected Control deployment mismatch refuses both producer paths before SDK or TLS',async()=>{
 for(const [field,value] of Object.entries({accountId:'222233334444',region:'us-west-2',amiId:'ami-11111111',vpcId:'vpc-11111111',
  subnetId:'subnet-11111111',securityGroupId:'sg-11111111'})){
  const f=await fixture();activate(f);const config=controlConfiguration(f);config.uploads.native.host.deployment[field]=value;let effects=0;
  const unexpected=()=>{effects++;throw Error('unexpected material or SDK access');};
  const owner=createControlNativeHostTeardown({configuration:config,pool:f.pool,now:f.now,owners:{readMaterial:unexpected,createObserverSession:unexpected}});
  await assert.rejects(()=>owner.settle({binding:f.binding,hostId:f.key.hostId,generation:1}));
  const runtime=createNativeObserverRuntime({pool:f.pool,now:f.now,expected:config.uploads.native.host.deployment,createSession:unexpected});
  await assert.rejects(()=>runtime.read(f.key.hostId,1));assert.equal(effects,0);runtime.close();await owner.close();
 }
});

test('restart after dispatch crash recovers with or without a journal completion and never retransmits',async()=>{
 for(const completed of [false,true]){
  const f=await fixture(),first=f.runtime(),row=f.row(),request={allocation:f.allocation,binding:f.binding,hostIdentity:row.host_identity_json};
  await first.ordinaryPort(row).destroy(request);first.close();setSlot(row,'dispatch_result',null);
  if(!completed){const journal=structuredClone(row.native_physical_observations_json);
   journal.entries.find(e=>e.stage==='termination').completion=null;setSlot(row,'observations',journal);}
  f.clock(5500);const restarted=f.runtime(),port=restarted.ordinaryPort(row);await port.destroy(request);
  const result=await port.observeAbsent({...request,resources:{instanceId,rootVolumeId:volumeId,networkInterfaceIds:[eniId]}});
  assert.equal(result.instanceState,'terminated');assert.equal(f.counts().terminations,1);
  assert.equal(result.evidence.operationDeadlineMs,27000);restarted.close();
 }
});

test('lifecycle retries persistence of the same full receipt after a pending fence without repeating cleanup',async()=>{
 const f=await fixture(),runtime=f.runtime(),client=guest(f);let guestCalls=0,recordCalls=0,retained;
 const close=client.close;client.close=async()=>{guestCalls++;return close();};
 const lifecycle=createNativeHostLifecycle({client,physical:runtime.ordinaryPort(f.row()),allocation:f.allocation,binding:f.binding,
  hostIdentity:f.row().host_identity_json,now:f.now,localCleanupMs:3000,hostCleanupMs:3000,writer:{async recordTeardown({receipt}){
   recordCalls++;if(retained===undefined){retained=receipt;throw Error('original pending operation has not drained');}
   assert.strictEqual(receipt,retained);return {terminated:true};}}});
 await assert.rejects(()=>lifecycle.settle());const before=f.calls.length;
 const result=await lifecycle.settle();assert.equal(result.verified,true);assert.equal(guestCalls,1);assert.equal(recordCalls,2);
 assert.equal(f.calls.length,before);assert.equal(f.counts().terminations,1);runtime.close();
});

test('managed journal proof survives expiry through Control and worker without SDK calls or a fabricated guest receipt',async()=>{
 for(const state of ['active','dispatching','unknown']){
 const f=await fixture(),runtime=f.runtime(),w=f.declaration.watchdog;
 if(state==='active'){activate(f);await runtime.writer.beginNativeOrdinaryPhysical({key:f.key,requestId:uuid(33)});}
 else {f.row().state=state;f.row().host_identity_json=null;}
 f.clock(62000);await runtime.observeIntent(managedRequest(f,'prepare'));
 const marker={instanceId,attemptId:`${w.executionArn}:${instanceId}`,attemptedAtMs:63000};
 const historyState=(id,previousEventId,type,name,at)=>({id,previousEventId,type,timestamp:new Date(at),
  [type.endsWith('Entered')?'stateEnteredEventDetails':'stateExitedEventDetails']:{name,
   [type.endsWith('Entered')?'input':'output']:JSON.stringify(marker),[type.endsWith('Entered')?'inputDetails':'outputDetails']:{truncated:false}}});
 f.responses.GetExecutionHistory={...f.meta,events:[historyState(20,19,'PassStateExited','CaptureManagedAttempt',63001),
  historyState(21,20,'PassStateEntered','MarkManagedAttempt',63002),historyState(22,21,'PassStateExited','MarkManagedAttempt',63003),
  historyState(23,22,'ChoiceStateEntered','TerminateBudget',63004),historyState(24,23,'ChoiceStateExited','TerminateBudget',63005),
  historyState(25,24,'TaskStateEntered','TerminateOwned',63006),{id:26,previousEventId:25,type:'TaskScheduled',timestamp:new Date(63007),
   taskScheduledEventDetails:{resourceType:'aws-sdk:ec2',resource:'terminateInstances',region:'us-east-1',parameters:JSON.stringify({InstanceIds:[instanceId]}),timeoutInSeconds:10}}]};
 f.responses.DescribeExecution={...f.meta,executionArn:w.executionArn,stateMachineArn:w.stateMachineVersionArn.replace(/:7$/u,''),
  stateMachineVersionArn:w.stateMachineVersionArn,input:JSON.stringify(w.input),inputDetails:{included:true},redriveCount:0,status:'RUNNING',startDate:new Date(1001)};
 f.managedTerminated();f.clock(65000);assert.equal((await runtime.observeIntent(managedRequest(f,'observe'))).disposition,'verified-absent');
 f.clock(90000);const snapshot=structuredClone(f.row()),calls=f.calls.length;
 const unexpected=()=>{throw Error('post-deadline recovery cannot read material or call providers');};
 const control=createControlNativeHostTeardown({configuration:controlConfiguration(f),pool:f.pool,now:f.now,
  owners:{readMaterial:unexpected,createObserverSession:unexpected}});
 const reply=await control.settle({binding:f.binding,hostId:f.key.hostId,generation:1});
 assert.equal(reply.closed,false);assert.equal(reply.verified,false);assert.equal(reply.receipt,undefined);
 assert.equal(reply.physical.managed.disposition,'verified-absent');assert.equal(reply.physical.managed.reason,null);
 assertNativeRetainedPhysical(reply.physical,{allocation:f.allocation,binding:f.binding,declaration:f.declaration,nowMs:f.now()});
 assert.deepEqual(f.row(),snapshot);assert.equal(f.calls.length,calls);
 for(const alter of [p=>{p.allocationSha256='0'.repeat(64);},p=>{p.managed.resultSha256=null;},p=>{p.managed.deadlineMs++;},p=>{p.managed.extra=true;}]){
  const changed=structuredClone(reply.physical);alter(changed);
  assert.throws(()=>assertNativeRetainedPhysical(changed,{allocation:f.allocation,binding:f.binding,declaration:f.declaration,nowMs:f.now()}));
 }
 const d=f.declaration,configuration={nativeProvisioning:{enabled:true,databaseFile:'/fixture/db',issuerCaCertFile:'/fixture/ca',issuerCaKeyFile:'/fixture/key',
  deployment:Object.fromEntries(['accountId','region','placement','launch','imageDigest','sourceCommit','bootstrapSha256','bootstrapSpec','physicalObserver','launchTagPolicy'].map(k=>[k,d[k]])),
  watchdog:{stateMachineVersionArn:w.stateMachineVersionArn,definitionSha256:w.definitionSha256,qualificationEvidenceSha256:w.qualificationEvidenceSha256}},limits:{requestMs:3000}};
 const worker=await createNativeWorkerOwners({configuration,now:f.now,native:{async call(method,input){assert.equal(method,'execution/native/host-teardown');return control.settle(input);}},
  owners:{readSecret:async path=>Buffer.from(path==='/fixture/db'?'postgresql://fixture.invalid/meri?sslmode=verify-full':'fixture'),
   createPool:()=>f.pool,createEc2Client:()=>({send:unexpected}),createSsmTransport:()=>({}),createIssuer:()=>({}),
   createMaterial:()=>({forHost:unexpected,close:async()=>({closed:true})}),createSfnClient:()=>({send:unexpected})}});
 await assert.rejects(()=>worker.hostTeardown({binding:f.binding,hostId:f.key.hostId,generation:1}),error=>{
  assert.ok(error.receipt,error.stack);
  assert.equal(error.receipt.closed,false);assert.equal(error.receipt.verified,false);assert.equal(error.receipt.managed.status,'VERIFIED');
  assert.equal(error.receipt.managed.proof,'canonical-control-observer/2');assert.equal(error.receipt.managed.quarantine,true);return true;
 });
 assert.deepEqual(f.row(),snapshot);assert.equal(f.calls.length,calls);assert.equal(f.counts().terminations,0);
 await worker.close();await control.close();runtime.close();
 }
});

test('an original live producer crossing its phase deadline persists unknown-final without extending either window',async()=>{
 for(const phase of ['ordinary','managed']){
  const f=await fixture();if(phase==='managed')f.clock(84000);
  const runtime=createNativeObserverRuntime({pool:f.pool,now:f.now,createSession:async()=>({close(){},async send(){
   f.clock(phase==='ordinary'?27001:86001);return f.responses.GetCallerIdentity;}})});
  if(phase==='ordinary')await assert.rejects(()=>runtime.ordinaryPort(f.row()).destroy({allocation:f.allocation,binding:f.binding,hostIdentity:f.row().host_identity_json}));
  else await assert.rejects(()=>runtime.observeIntent({...managedRequest(f,'prepare'),expiresAtMs:86000}));
  const state=await runtime.writer.readNativePhysicalState({key:f.key});assert.equal(state.result[phase].status,'unknown-final');
  assert.equal(state.result[phase].reason,'deadline');assert.equal(state.context[phase].deadlineMs,phase==='ordinary'?27000:86000);
  assert.equal(state.observations.entries.filter(e=>e.completion===null).length,0);runtime.close();
 }
});

test('unadmitted retained recovery validates original binding and canonical evidence without granting a guest lifecycle',async()=>{
 const f=await fixture();f.row().state='reserved';f.row().host_identity_json=null;f.clock(90000);const before=structuredClone(f.row());let effects=0;
 const unexpected=()=>{effects++;throw Error('unadmitted row cannot construct guest or provider work');};
 const owner=createControlNativeHostTeardown({configuration:controlConfiguration(f),pool:f.pool,now:f.now,
  owners:{readMaterial:unexpected,createObserverSession:unexpected,createLifecycleClient:unexpected}});
 const request={binding:f.binding,hostId:f.key.hostId,generation:1};
 const reply=await owner.settle(request);assert.equal(reply.closed,false);assert.equal(reply.physical.ordinary,null);
 assert.equal(reply.physical.managed.disposition,'unknown');assert.equal(reply.physical.managed.resultSha256,null);
 await assert.rejects(()=>owner.settle({...request,binding:{...f.binding,runId:uuid(998)}}));
 assert.deepEqual(f.row(),before);f.row().native_physical_context_canonical+=' ';
 await assert.rejects(()=>owner.settle(request));assert.equal(effects,0);await owner.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNativeWorkerOwners} from '../native-worker-owners.mjs';
import {createBrokerActivity} from '../temporal-worker.mjs';
import {createManagedWatchdogReadback} from '../native-watchdog-readback.mjs';
const PEM=readFileSync('apps/runtime/certs/rds-global-bundle.pem','ascii').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/u)[0];
const binding={tenantId:'tenant',actorId:'00000000-0000-4000-8000-000000000001',conversationId:'00000000-0000-4000-8000-000000000002',
 runId:'00000000-0000-4000-8000-000000000003',attemptId:'00000000-0000-4000-8000-000000000004',workerId:'00000000-0000-4000-8000-000000000005',writerFence:1};
const deployment={accountId:'111122223333',region:'us-east-1',
 physicalObserver:{schema:'meri-native-managed-observer/1',protocol:'native-observer-around-managed/1',
  route:'/v1/execution/native/physical-observer',authenticationPrincipal:'native-watchdog-observer-v1',
  bridgeFunctionVersionArn:'arn:aws:lambda:us-east-1:111122223333:function:observer:3'},
 launchTagPolicy:'instance-and-root-volume-owner-tags/1',
 placement:{availabilityZone:'us-east-1a',vpcId:'vpc-0123456789abcdef0',subnetId:'subnet-0123456789abcdef0',securityGroupIds:['sg-0123456789abcdef0'],iamInstanceProfile:'meri-host-profile'},
 launch:{ImageId:'ami-0123456789abcdef0',InstanceType:'c7g.large',SubnetId:'subnet-0123456789abcdef0',SecurityGroupIds:['sg-0123456789abcdef0'],IamInstanceProfile:{Name:'meri-host-profile'}},
 imageDigest:'sha256:'+'a'.repeat(64),sourceCommit:'b'.repeat(40),bootstrapSha256:'c'.repeat(64),maxLifetimeMs:600000,
 bootstrapSpec:{schema:'meri-native-bootstrap-spec/1',document:{name:'meri-bootstrap',version:'1',sha256:'a'.repeat(64),pluginName:'nativeBootstrap'},programSha256:'b'.repeat(64),profileSha256:'c'.repeat(64),hostEndpoint:{port:9443,serverName:'host.example'},control:{endpoint:{address:'10.0.0.1',port:443,serverName:'control.example'},clientName:'control.meri.internal',serverCertificate:PEM,clientCertificate:PEM,caCertificate:PEM,policySha256:'d'.repeat(64)},issuerCaCertificate:PEM}};
const configuration={nativeProvisioning:{enabled:true,databaseFile:'/synthetic/db',issuerCaCertFile:'/synthetic/ca',issuerCaKeyFile:'/synthetic/key',deployment,
 watchdog:{stateMachineVersionArn:'arn:aws:states:us-east-1:111122223333:stateMachine:meri-host-watchdog:7',definitionSha256:'a'.repeat(64),qualificationEvidenceSha256:'b'.repeat(64)}},limits:{requestMs:1000,shutdownMs:1000}};
const connection='postgresql://synthetic.invalid/meri?sslmode=verify-full';
function boundaries(){
 const calls=[],reads=[],releases=[];
 const pool={async connect(){return {async query(){return {rows:[]};},release(){}};},async end(){calls.push('pool-end');}};
 const ec2={async send(){throw Error('no cloud effect in construction');},async destroy(){calls.push('ec2-destroy');}};
 const ssm={async close(){calls.push('ssm-close');}};
 const issuer={async issue(){throw Error('no issuer effect in construction');}};
 const material={async forHost(){throw Error('no material effect in construction');},async close(){calls.push('material-close');}};
 const sfn={async destroy(){calls.push('sfn-destroy');}};
 const owners={readSecret:async file=>{reads.push(file);return Buffer.from(file==='/synthetic/db'?connection:'synthetic-cert');},
  createPool:options=>{calls.push('pool-create');assert.equal(options.connectionString,connection);return pool;},
  createEc2Client:()=>ec2,createSsmTransport:()=>ssm,createIssuer:()=>issuer,createMaterial:()=>material,
  createSfnClient:()=>sfn,
  createSfnClient:()=>sfn};
 const native={async call(){throw Error('no remote authority call during construction');},async readiness(){}};
 return {calls,reads,releases,owners,native,pool};
}
test('disabled native provisioning reads no database/issuer material and creates no owner',async()=>{
 const b=boundaries();
 for(const disabled of [undefined,{enabled:false}]){
  const owners={...b.owners,readSecret:async file=>{b.reads.push(file);return Buffer.from('x');}};
  const value=await createNativeWorkerOwners({configuration:{...configuration,nativeProvisioning:disabled},native:b.native,owners});
  assert.equal(value,null);assert.deepEqual(b.calls,[]);assert.deepEqual(b.reads,[]);
 }
});
test('D1: enabled legacy deployment refuses before privileged material or owner construction',async()=>{
 const b=boundaries(),legacy=structuredClone(deployment);delete legacy.physicalObserver;delete legacy.launchTagPolicy;
 delete legacy.placement.vpcId;
 await assert.rejects(createNativeWorkerOwners({configuration:{...configuration,
  nativeProvisioning:{...configuration.nativeProvisioning,deployment:legacy}},native:b.native,owners:b.owners}),
  {code:'NATIVE_PROVISIONING_CONFIGURATION'});
 assert.deepEqual(b.reads,[]);assert.deepEqual(b.calls,[]);
});
test('enabled native provisioning constructs the actual allocator, authority and provisioning owners and disposes them',async()=>{
 const b=boundaries();
 const value=await createNativeWorkerOwners({configuration,native:b.native,owners:b.owners});
 assert.ok(value);
 assert.deepEqual(b.reads,['/synthetic/db','/synthetic/ca','/synthetic/key']);
 assert.equal(typeof value.authority.verifyInTransaction,'function');
 assert.equal(typeof value.authority.preflight,'function');
 for(const name of ['readNativeReservation','reserveNativeHost','claimNativeHostDispatch','recordNativeHostInstance',
  'reserveBootstrapOperation','claimBootstrapDispatch','recordBootstrapCommand','readBootstrapOperation',
  'recordBootstrapObservation','admit','recordTeardown'])assert.equal(typeof value.writer[name],'function',name);
 assert.equal(typeof value.provisioner.provision,'function');
 assert.equal(value.generationFor(binding),1);
 await assert.rejects(async()=>value.generationFor({...binding,writerFence:0}),{code:'NATIVE_WORKER_OWNERS_CONFIGURATION'});
 await value.close();
 assert.deepEqual(b.calls,['pool-create','material-close','ssm-close','sfn-destroy','ec2-destroy','pool-end']);
});
test('activity verifies the prompt ACK then requests canonical need and provisions only native',async()=>{
 const calls=[];let heartbeat=0;
 const native={async call(method,input){calls.push(method);
  if(method==='execution/kickoff')return {binding:input.binding,executionId:input.executionKey,expiresAtMs:100000};
  if(method==='execution/native/prerequisite')return {kind:'native-processing',hostMode:'native-processing',policySha256:'d'.repeat(64),uploadCount:1};
  if(method==='execution/kickoff/status')return {binding:input.binding,executionId:input.executionId,state:calls.filter(x=>x.endsWith('status')).length>1?'completed':'executing',expiresAtMs:100000};
  if(method==='execution/kickoff/stop')return {stopped:true};
  throw Error(method);}};
 const provisioner={async provision({binding:b,generation,signal}){calls.push('provision');assert.equal(generation,1);assert.equal(signal.aborted,false);return {state:'existing',instanceId:'i-0123456789abcdef0'};}};
 const activity=createBrokerActivity({native,provisioner,now:()=>1000,pollMs:10,context:()=>({cancellationSignal:new AbortController().signal,heartbeat(){heartbeat++;}})});
 const result=await activity({binding});
 assert.deepEqual(result,{state:'completed'});
 assert.equal(calls[0],'execution/kickoff');assert.equal(calls[1],'execution/native/prerequisite');assert.equal(calls[2],'provision');
 assert.ok(calls.filter(x=>x==='execution/kickoff/status').length>=2);assert.ok(heartbeat>=2);
});
test('ordinary non-native activity performs no allocation and needs no provisioner',async()=>{
 const calls=[];
 const native={async call(method,input){calls.push(method);
  if(method==='execution/kickoff')return {binding:input.binding,executionId:input.executionKey,expiresAtMs:100000};
  if(method==='execution/native/prerequisite')return {kind:'none'};
  if(method==='execution/kickoff/status')return {binding:input.binding,executionId:input.executionId,state:'completed',expiresAtMs:100000};
  throw Error(method);}};
 const activity=createBrokerActivity({native,now:()=>1000,pollMs:10,context:()=>({cancellationSignal:new AbortController().signal,heartbeat(){}})});
 assert.deepEqual(await activity({binding}),{state:'completed'});
 assert.equal(calls.includes('provision'),false);
});
test('required native need without a provisioner is a refusal, not a no-native success',async()=>{
 const native={async call(method,input){
  if(method==='execution/kickoff')return {binding:input.binding,executionId:input.executionKey,expiresAtMs:100000};
  if(method==='execution/native/prerequisite')return {kind:'native-processing',hostMode:'native-processing',policySha256:'d'.repeat(64),uploadCount:1};
  if(method==='execution/kickoff/stop')return {binding:input.binding,executionId:input.executionId,expiresAtMs:100000};
  throw Error(method);}};
 const activity=createBrokerActivity({native,now:()=>1000,context:()=>({cancellationSignal:new AbortController().signal,heartbeat(){}})});
 await assert.rejects(async()=>activity({binding}),{code:'BROKER_NATIVE_PROVISION_UNAVAILABLE'});
});
test('startTemporalWorker constructs the default native owners only when enabled and disposes them on close',async()=>{
 const calls=[],reads=[];
 let workerOptionsValue,state='INITIALIZED';
 const pool={async connect(){return {async query(){return {rows:[]};},release(){}};},async end(){calls.push('pool-end');}};
 const ec2={async send(){throw Error('unused');},async destroy(){calls.push('ec2-destroy');}};
 const ssm={async close(){calls.push('ssm-close');}};
 const issuer={async issue(){throw Error('unused');}};
 const material={async forHost(){throw Error('unused');},async close(){calls.push('material-close');}};
 const sfn={async destroy(){calls.push('sfn-destroy');}};
 const owners={async tls(){return {};},async readMaterial(){return Buffer.from('synthetic-capability');},
  readSecret:async file=>{reads.push(file);return Buffer.from(file==='/synthetic/db'?connection:'synthetic-cert');},
  createPool:()=>pool,createEc2Client:()=>ec2,createSsmTransport:()=>ssm,createIssuer:()=>issuer,createMaterial:()=>material,
  createSfnClient:()=>sfn,
  nativeClient(){return {async readiness(){},async call(){throw Error('no activity in startup');}};},
  async connect(){return {async close(){calls.push('connection-close');}};},
  async createWorker(options){workerOptionsValue=options;return {getState:()=>state,run(){state='RUNNING';return Promise.resolve();},shutdown(){state='STOPPED';}};},
  async listen(){return {address:'synthetic',async close(){calls.push('listener-close');}};}};
 const {startTemporalWorker}=await import('../temporal-worker.mjs');
 const runtime=await startTemporalWorker({...configuration,native:{capabilityFile:'/synthetic/cap'},temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri',taskQueue:'meri-conversations',tls:{}},http:{}},
  {testOwners:owners});
 try{
  assert.deepEqual(reads,['/synthetic/db','/synthetic/ca','/synthetic/key']);
  assert.equal(typeof workerOptionsValue.activities.executeConversation,'function');
  assert.ok(workerOptionsValue.activities.executeConversation.length>=1);
 }finally{await runtime.close();}
 assert.deepEqual(calls,['listener-close','material-close','ssm-close','sfn-destroy','ec2-destroy','pool-end','connection-close']);
});
function activityNative(calls,{state='completed',prerequisite={kind:'native-processing',hostMode:'native-processing',policySha256:'d'.repeat(64),uploadCount:1},onStatus}={}){
 let statusCalls=0;
 return {async call(method,input){calls.push(method);
  if(method==='execution/kickoff')return {binding:input.binding,executionId:input.executionKey,expiresAtMs:100000};
  if(method==='execution/native/prerequisite')return prerequisite;
  if(method==='execution/kickoff/status'){statusCalls++;const next=onStatus?onStatus(statusCalls):state;return {binding:input.binding,executionId:input.executionId,state:next,expiresAtMs:100000};}
  if(method==='execution/kickoff/stop')return {binding:input.binding,executionId:input.executionId,expiresAtMs:100000};
  throw Error(method);}};
}
test('activity retry/reconciliation uses the canonical writer fence generation and keeps provider invocation out of the activity',async()=>{
 const calls=[];let provisions=0;
 const native=activityNative(calls);
 const provisioner={async provision({generation}){provisions++;assert.equal(generation,binding.writerFence);return {state:'existing'};}};
 const activity=createBrokerActivity({native,provisioner,now:()=>1000,pollMs:10,context:()=>({cancellationSignal:new AbortController().signal,heartbeat(){}})});
 await activity({binding});await activity({binding});
 assert.equal(provisions,2);assert.equal(calls.includes('provider.invoke'),false);
});
test('activity cancellation propagates to provisioning and remains a refusal',async()=>{
 const calls=[],controller=new AbortController();let seen;
 const native=activityNative(calls);
 const provisioner={async provision({signal}){seen=signal;await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('CANCELLED'),{code:'CANCELLED'})),{once:true}));}};
 const activity=createBrokerActivity({native,provisioner,now:()=>1000,context:()=>({cancellationSignal:controller.signal,heartbeat(){}})});
 const pending=activity({binding});setTimeout(()=>controller.abort(Error('caller stopped')),10);
 await assert.rejects(async()=>pending,error=>error?.code==='CANCELLED'||error?.cause?.code==='CANCELLED');
 assert.equal(seen.aborted,true);
});
test('unknown provisioning outcome is explicit and not converted to completion',async()=>{
 const calls=[];const native=activityNative(calls);
 const provisioner={async provision(){throw Object.assign(Error('NATIVE_HOST_PROVISION_UNKNOWN'),{code:'NATIVE_HOST_PROVISION_UNKNOWN'});}};
 const activity=createBrokerActivity({native,provisioner,now:()=>1000,context:()=>({cancellationSignal:new AbortController().signal,heartbeat(){}})});
 await assert.rejects(async()=>activity({binding}),{code:'NATIVE_HOST_PROVISION_UNKNOWN'});
});
test('activity drives the actual native provisioning coordinator to one acknowledged launch',async()=>{
 const {createNativeHostProvisioning}=await import('../native-host-provisioning.mjs');
 const {canonicalSha256:hash}=await import('../../../packages/contracts/validate.mjs');
 const calls=[];let launches=0,admissions=0;
 let reservation;
 const writer={
  async readNativeReservation(){return null;},
  async reserveNativeHost({allocation,originalBinding,ownerInstanceId,declaration}){reservation={allocation,originalBinding,ownerInstanceId,
   declaration,declarationSha256:hash(declaration),state:'reserved',observedInstance:null};return reservation;},
  async claimNativeHostDispatch(){return {disposition:'send-once'};},
  async recordNativeHostInstance({instanceId,privateIp}){reservation={...reservation,state:'dispatching',observedInstance:{instanceId,privateIp}};return reservation;},
  async admit({record}){admissions++;return {record};}};
 const launch={async reconcileOnly(){throw Error('not used');},async launchOnce(){launches++;return {state:'created',instanceId:'i-0123456789abcdef0',privateIp:'10.0.0.11'};}};
 const material={async forHost(){return {hostIdentity:{schema:'meri-d005-host-identity/1',hostId:reservation.allocation.hostId,
   conversationId:binding.conversationId,instanceId:'i-0123456789abcdef0',bootId:'00000000-0000-4000-8000-000000000009'},
   endpoint:{address:'10.0.0.11',port:9443,serverName:'host.example'},hostCertificate:'host-cert',serverCertificate:'server-cert',
   ownerInstanceId:reservation.ownerInstanceId,leaseDeadlineMs:reservation.allocation.leaseDeadlineMs};}};
 const authority={async verify(){return {currentUntilMs:50000,executionDeadlineMs:900000};}};
 const producer=createManagedWatchdogReadback({...configuration.nativeProvisioning.watchdog,now:()=>1000});
 const watchdog={makeIntent:p=>producer.makeIntent(p),
  async arm({intent}){return {armed:true,executionArn:intent.executionArn,hostId:intent.input.hostId,
   generation:intent.input.generation,t0Ms:intent.t0Ms,deadlineMs:intent.deadlineMs,
   cleanupCeilingMs:intent.cleanupCeilingMs};},
  async verify(){return {armed:true};}};
 const provisioner=createNativeHostProvisioning({writer,launch,material,deployment,authority,watchdog,now:()=>1000,
  ownerId:()=>'00000000-0000-4000-8000-000000000008'});
 const native=activityNative(calls);
 const activity=createBrokerActivity({native,provisioner,now:()=>1000,pollMs:10,context:()=>({cancellationSignal:new AbortController().signal,heartbeat(){}})});
 const result=await activity({binding});
 assert.deepEqual(result,{state:'completed'});
 assert.equal(launches,1);assert.equal(admissions,1);
 assert.equal(calls.filter(x=>x==='provision').length,0,'activity uses the actual coordinator, not a fake provision handler');
});

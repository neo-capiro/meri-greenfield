/** Coordinator over the REAL canonical writer with an inert stateful EC2 boundary. No AWS/SQL effect. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,X509Certificate} from 'node:crypto';
const root=new URL('../../../',import.meta.url).href;
const tls=await import(root+'apps/worker/conversation/host/control/tls.mjs');
mock.module(root+'apps/worker/conversation/host/control/tls.mjs',{exports:{...tls,
 checkedCertificate:(raw,{nowMs,notAfterMs})=>({fingerprintSha256:raw?.startsWith('-----')?createHash('sha256').update(new X509Certificate(raw).raw).digest('hex'):(raw==='synthetic-client'?'a':'b').repeat(64),
  notAfterMs:notAfterMs??nowMs+60000})}});
const {canonicalSha256:hash}=await import(root+'packages/contracts/validate.mjs');
const {createPostgresHostAllocationWriter,HOST_ALLOCATION_SQL:H}=await import(root+'apps/control/browser-hosts/postgres-allocations.mjs');
const {NATIVE_RESERVATION_SQL:N}=await import(root+'apps/control/browser-hosts/native-reservations.mjs');
const {hostAllocationRecord,allocationRow}=await import(root+'apps/control/browser-hosts/allocation.mjs');
const B=await import(root+'packages/contracts/native-bootstrap.mjs');
const {PHYSICAL_COLUMNS}=await import(root+'apps/control/browser-hosts/native-physical-journal.mjs');
const {createManagedWatchdogReadback}=await import(root+'apps/runtime/native-watchdog-readback.mjs');
const physicalObserver={schema:'meri-native-managed-observer/1',protocol:'native-observer-around-managed/1',
 route:'/v1/execution/native/physical-observer',authenticationPrincipal:'native-watchdog-observer-v1',
 bridgeFunctionVersionArn:'arn:aws:lambda:us-east-1:111122223333:function:observer:3'};
const {createNativeHostProvisioning,createEc2NativeHostLaunchPort,nativeHostId}=await import(root+'apps/runtime/native-host-provisioning.mjs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const PEM=readFileSync('apps/runtime/certs/rds-global-bundle.pem','ascii').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/u)[0];
const now=Date.now();
const binding={tenantId:'tenant',actorId:id(2),conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const bootstrapSpec={schema:'meri-native-bootstrap-spec/1',document:{name:'meri-bootstrap',version:'1',
 sha256:'a'.repeat(64),pluginName:'nativeBootstrap'},programSha256:'b'.repeat(64),profileSha256:'c'.repeat(64),
 hostEndpoint:{port:9443,serverName:'host.example'},control:{endpoint:{address:'10.0.0.1',port:443,serverName:'control.example'},
 clientName:'control.meri.internal',serverCertificate:PEM,clientCertificate:PEM,
 caCertificate:PEM,policySha256:'d'.repeat(64)},issuerCaCertificate:PEM};
const launchSpec={ImageId:'ami-0123456789abcdef0',InstanceType:'c7g.large',SubnetId:'subnet-0123456789abcdef0',
 SecurityGroupIds:['sg-0123456789abcdef0'],IamInstanceProfile:{Name:'meri-host-profile'}};
const deployment={accountId:'111122223333',region:'us-east-1',physicalObserver,launchTagPolicy:'instance-and-root-volume-owner-tags/1',
 placement:{availabilityZone:'us-east-1a',vpcId:'vpc-0123456789abcdef0',
 subnetId:launchSpec.SubnetId,securityGroupIds:launchSpec.SecurityGroupIds,iamInstanceProfile:'meri-host-profile'},
 launch:launchSpec,imageDigest:'sha256:'+'c'.repeat(64),sourceCommit:'d'.repeat(40),bootstrapSha256:'e'.repeat(64),
 bootstrapSpec};

function store(){
 const rows=new Map();
 const pool={async connect(){return {async query(sql,args=[]){
  if(sql==='SHOW transaction_isolation')return {rows:[{transaction_isolation:'read committed'}]};
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL '))return {rows:[]};
  const key=args[0]+':'+args[1];
  if(sql===H.admission||sql===H.conversation||sql.startsWith('SELECT meri_host_control.lock_conversation_admission'))return {rows:[]};
  if(sql.startsWith('SELECT * FROM meri_host_control.host_allocations WHERE tenant_id'))return {rows:[...rows.values()].filter(r=>r.tenant_id===args[0]&&r.conversation_id===args[1]&&r.state!=='terminated'&&r.state!=='refused')};
  if(sql===H.purposeRows)return {rows:[...rows.values()].filter(r=>r.tenant_id===args[0]&&r.conversation_id===args[1]&&r.state!=='terminated')};
  if(sql===N.reserve||sql===N.reserveObserver){if(!rows.has(key))rows.set(key,{host_id:args[0],generation:args[1],tenant_id:args[2],
   conversation_id:args[3],allocation_json:args[4],allocation_sha256:args[5],original_binding_json:args[6],
   owner_instance_id:args[7],declaration_json:args[8],declaration_sha256:args[9],lease_deadline_ms:args[10],
   credential_revision:1,state:'reserved',host_mode:'native-processing',observed_instance_json:null,
   dispatch_started_at_ms:null,bootstrap_prepare_json:null,bootstrap_install_json:null,
   ...Object.fromEntries(Object.keys(PHYSICAL_COLUMNS).flatMap(name=>['json','sha256','canonical'].map(suffix=>
    [`native_physical_${name}_${suffix}`,name==='context'?args[11+['json','sha256','canonical'].indexOf(suffix)]:null])))});return {rows:[]};}
  if(sql===N.claimDispatch){const r=rows.get(key);if(r?.state==='reserved'&&r.declaration_sha256===args[2]){
   r.state='dispatching';r.dispatch_started_at_ms=args[3];}return {rows:[]};}
  if(sql===N.recordInstance){const r=rows.get(key);if(r&&r.observed_instance_json===null)r.observed_instance_json=args[2];return {rows:[]};}
  if(sql===N.recordInstanceAddress){const r=rows.get(key);
   if(r&&r.observed_instance_json?.instanceId===args[2]&&r.observed_instance_json?.privateIp===null)
    r.observed_instance_json={instanceId:args[2],privateIp:args[3]};return {rows:[]};}
  if(sql.startsWith('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2'))
   {const r=rows.get(key);return {rows:r?[r]:[]};}
  if(sql===H.lock||sql===H.lockWriter){const r=rows.get(key);return {rows:r?[r]:[]};}
  if(sql===N.admitNative){const r=rows.get(key);
   if(r&&['dispatching','unknown'].includes(r.state)&&r.declaration_sha256===args[10]){
    r.host_identity_json=args[2];r.host_identity_sha256=args[3];r.endpoint_json=args[4];r.record_sha256=args[5];
    r.client_cert_sha256=args[6];r.client_dns_name=args[7];r.client_cert_not_after_ms=args[8];
    r.server_cert_not_after_ms=args[9];r.state='active';}return {rows:[]};}
  throw Error('UNEXPECTED_SQL '+sql.slice(0,60));
 },release(){}};}};
 return {rows,writer:createPostgresHostAllocationWriter({pool,now:()=>now,
  readCurrentNativeAuthority:async(_c,{allocation:a,binding:b})=>({currentUntilMs:now+600000,allocation:a,binding:b})})};
}
function ec2(){
 const instances=new Map();let launches=0,loseAck=false;
 async function send(command){
  const name=command.constructor.name;
  if(name==='DescribeInstancesCommand'){const token=command.input.Filters[0].Values[0];
   const found=[...instances.values()].filter(i=>i.token===token&&['pending','running'].includes(i.state));
   return {Reservations:found.map(i=>({Instances:[{InstanceId:i.instanceId,State:{Name:i.state},
    PrivateIpAddress:i.privateIp,Tags:Object.entries(i.tags).map(([Key,Value])=>({Key,Value}))}]}))};}
  if(name==='RunInstancesCommand'){launches++;const token=command.input.ClientToken;
   const tags=Object.fromEntries(command.input.TagSpecifications[0].Tags.map(t=>[t.Key,t.Value]));
   const existing=[...instances.values()].find(i=>i.token===token);
   if(existing)return {Instances:[{InstanceId:existing.instanceId,PrivateIpAddress:existing.privateIp}]};
   const instanceId='i-'+String(launches).padStart(17,'0');const rec={token,instanceId,privateIp:'10.0.0.'+(10+launches),
    state:'running',tags};instances.set(instanceId,rec);
   if(loseAck){loseAck=false;throw Object.assign(Error('lost ack'),{code:'EC2_ACK_LOST'});}
   return {Instances:[{InstanceId:instanceId,PrivateIpAddress:rec.privateIp}]};}
  throw Error('UNEXPECTED_EC2 '+name);
 }
 return {send,instances,launches:()=>launches,loseNextAck(){loseAck=true;}};
}
const certs=[...readFileSync('apps/runtime/certs/rds-global-bundle.pem','ascii').matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/gu)].map(m=>m[0]);
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bootstrap(writer,rows,input){
 const res=await writer.readNativeReservation({hostId:input.hostId,generation:input.generation});
 const c1=new X509Certificate(certs[0]),c2=new X509Certificate(certs[1]);
 const spki=c=>sha(Buffer.from(c.publicKey.export({type:'spki',format:'der'})));
 const scope={allocation:res.allocation,originalBinding:res.originalBinding,ownerInstanceId:res.ownerInstanceId,
  cleanupCeilingMs:res.declaration.watchdog.cleanupCeilingMs,
  instanceId:res.observedInstance.instanceId,endpoint:{address:'10.0.0.11',port:9443,serverName:'host.example'},
  source:{imageDigest:input.declaration.imageDigest,sourceCommit:input.declaration.sourceCommit,bootstrapSha256:input.declaration.bootstrapSha256},
  declarationSha256:res.declarationSha256,bootstrapSpecSha256:hash(bootstrapSpec)};
 const prepId=B.nativeBootstrapOperationId({hostId:input.hostId,generation:input.generation,step:'prepare'});
 const prepReq=B.createNativeBootstrapRequest({schema:'meri-native-bootstrap-prepare-request/1',operationId:prepId,scope,bootstrapSpec});
 const prepObs={schema:'meri-native-bootstrap-prepare/1',operationId:prepId,requestSha256:hash(prepReq),scope,bootId:id(50),
  preparedAtMs:now+1000,hostCsrPem:'-----BEGIN CERTIFICATE REQUEST-----\nQUJD\n-----END CERTIFICATE REQUEST-----',
  serverCsrPem:'-----BEGIN CERTIFICATE REQUEST-----\nREVG\n-----END CERTIFICATE REQUEST-----',
  hostSpkiSha256:spki(c1),serverSpkiSha256:spki(c2),hostProofBase64:'QUJD',serverProofBase64:'REVG'};
 const instId=B.nativeBootstrapOperationId({hostId:input.hostId,generation:input.generation,step:'install'});
 const instReq=B.createNativeBootstrapRequest({schema:'meri-native-bootstrap-install-request/1',operationId:instId,scope,bootstrapSpec,
  prepareOperationId:prepId,prepareRequestSha256:hash(prepReq),prepareObservationSha256:hash(prepObs),bootId:id(50),
  hostCertificate:certs[0],serverCertificate:certs[1]});
 const proj={schema:B.NATIVE_BOOTSTRAP_INSTALLED,scope,bootId:id(50),prepareOperationId:prepId,prepareRequestSha256:hash(prepReq),
  prepareObservationSha256:hash(prepObs),installOperationId:instId,installRequestSha256:hash(instReq),
  hostCertificateSha256:sha(Buffer.from(c1.raw)),serverCertificateSha256:sha(Buffer.from(c2.raw)),
  hostSpkiSha256:spki(c1),serverSpkiSha256:spki(c2)};
 const instObs={schema:'meri-native-bootstrap-install/1',operationId:instId,requestSha256:hash(instReq),scope,
  prepareOperationId:prepId,prepareRequestSha256:hash(prepReq),prepareObservationSha256:hash(prepObs),bootId:id(50),
  installedAtMs:now+2000,hostSpkiSha256:spki(c1),serverSpkiSha256:spki(c2),hostCertificateSha256:sha(Buffer.from(c1.raw)),
  serverCertificateSha256:sha(Buffer.from(c2.raw)),configSha256:hash(proj)};
 const row=rows.get(input.hostId+':'+input.generation);
 row.bootstrap_prepare_json={step:'prepare',dispatchId:prepId,requestSha256:hash(prepReq),request:prepReq,
  state:'succeeded',commandId:'cmd-prepare',observation:prepObs};
 row.bootstrap_install_json={step:'install',dispatchId:instId,requestSha256:hash(instReq),request:instReq,
  state:'succeeded',commandId:'cmd-install',observation:instObs};
}
const materialFor=(writer,rows)=>({async forHost(input){await bootstrap(writer,rows,input);
 return {...six(input),leaseDeadlineMs:rows.get(input.hostId+':'+input.generation).allocation_json.leaseDeadlineMs};}});
function six({binding,generation,hostId,declaration,instanceId,state,privateIp,signal}){
 assert.deepEqual(Object.keys({binding,generation,hostId,declaration,instanceId,state,privateIp,signal}).sort(),
  ['binding','declaration','generation','hostId','instanceId','privateIp','signal','state']);
 assert.ok(['created','existing'].includes(state));
 return {hostIdentity:{schema:'meri-d005-host-identity/1',hostId,conversationId:binding.conversationId,
  instanceId,bootId:id(50)},endpoint:{address:privateIp,port:9443,serverName:'host.example'},
  hostCertificate:certs[0],serverCertificate:certs[1],
  ownerInstanceId:id(9),leaseDeadlineMs:now+600000};
}

const watchdogProducer=createManagedWatchdogReadback({stateMachineVersionArn:'arn:aws:states:us-east-1:111122223333:stateMachine:meri:7',
 definitionSha256:'a'.repeat(64),qualificationEvidenceSha256:'b'.repeat(64),now:()=>now});
const watchdogStub={
 makeIntent:p=>watchdogProducer.makeIntent(p),
 async arm({intent}){return {armed:true,executionArn:intent.executionArn,hostId:intent.input.hostId,
  generation:intent.input.generation,t0Ms:intent.t0Ms,deadlineMs:intent.deadlineMs,
  cleanupCeilingMs:intent.cleanupCeilingMs};},
 async verify(input){return {armed:true,hostId:input.hostId,generation:input.generation,t0Ms:input.t0Ms,
  deadlineMs:input.deadlineMs};}};
const coordinator=(s,e,options={})=>createNativeHostProvisioning({writer:s.writer,deployment:options.deployment??deployment,
 launch:createEc2NativeHostLaunchPort({ec2:e,launch:launchSpec}),material:materialFor(s.writer,s.rows),
 authority:{verify:async()=>({currentUntilMs:now+600000,executionDeadlineMs:now+900000})},
 watchdog:options.watchdog??watchdogStub,now:()=>now,ownerId:()=>id(9),...options});

test('reserve, one acknowledged launch, lost ACK recovery and restart keep ONE row/instance',async()=>{
 const s=store(),e=ec2();e.loseNextAck();
 const first=await coordinator(s,e).provision({binding,generation:1});
 assert.ok(['created','existing'].includes(first.state));assert.equal(e.launches(),1);assert.equal(s.rows.size,1);
 const row=[...s.rows.values()][0];assert.equal(row.state,'active');
 const second=await coordinator(s,e).provision({binding,generation:1});
 assert.equal(second.instanceId,first.instanceId);assert.equal(e.launches(),1);assert.equal(s.rows.size,1);
});

test('C2: original reservation reserves signing headroom and same-row admission binds server ceiling',async()=>{
 const s=store(),e=ec2();
 await coordinator(s,e,{deployment:{...deployment,maxLifetimeMs:900000}}).provision({binding,generation:1});
 const row=[...s.rows.values()][0],lease=row.allocation_json.leaseDeadlineMs;
 assert.equal(lease,now+900000-25000-2000);
 assert.equal(row.declaration_json.watchdog.cleanupCeilingMs,lease+25000);
 assert.equal(row.client_cert_not_after_ms,lease);
 assert.equal(row.server_cert_not_after_ms,lease+25000);
 const record=allocationRow(row).record;
 assert.deepEqual(hostAllocationRecord(record,row),record);
 assert.throws(()=>hostAllocationRecord({...record,serverCertificateNotAfterMs:lease+25001},row));
 assert.throws(()=>hostAllocationRecord({...record,hostCertificate:{...record.hostCertificate,notAfterMs:lease+1}},row));
 for(const change of [r=>{delete r.bootstrap_prepare_json.observation.scope.cleanupCeilingMs;},
  r=>{r.bootstrap_install_json.observation.scope.cleanupCeilingMs++;},
  r=>{r.declaration_json.schema='meri-native-provisioning-declaration/1';}]){
  const old=structuredClone(row);change(old);assert.throws(()=>hostAllocationRecord(record,old));
 }
});
test('a short authority grant does not clamp the resource lease; execution deadline governs both paths',async()=>{
 const s=store(),e=ec2();let clock=now;
 const authority={verify:async()=>({currentUntilMs:clock+30000,executionDeadlineMs:clock+900000})};
 const send=e.send.bind(e);e.send=async command=>{const result=await send(command);clock+=35000;return result;};
 const coordinator=()=>createNativeHostProvisioning({writer:s.writer,deployment,
  launch:createEc2NativeHostLaunchPort({ec2:e,launch:launchSpec}),material:materialFor(s.writer,s.rows),
  authority,watchdog:watchdogStub,now:()=>clock,ownerId:()=>id(9)});
 const first=await coordinator().provision({binding,generation:1});
 const row=[...s.rows.values()][0];
 assert.ok(row.allocation_json.leaseDeadlineMs>now+30000,'resource lease is not the short authority grant');
 assert.ok(['created','existing'].includes(first.state));
 const second=await coordinator().provision({binding,generation:1});
 assert.equal(second.instanceId,first.instanceId);assert.equal(e.launches(),1);assert.equal(s.rows.size,1);
});
test('an existing reservation with empty discovery refuses and never launches',async()=>{
 const s=store(),e=ec2();
 const first=await coordinator(s,e).provision({binding,generation:1});
 e.instances.delete(first.instanceId);
 await assert.rejects(()=>coordinator(s,e).provision({binding,generation:1}),{code:'NATIVE_HOST_EFFECT_UNKNOWN'});
 assert.equal(e.launches(),1);assert.equal(s.rows.size,1);assert.equal([...s.rows.values()][0].state,'active');
});
test('a different physical instance cannot replace the retained observed identity',async()=>{
 const s=store(),e=ec2();const first=await coordinator(s,e).provision({binding,generation:1});
 const old=e.instances.get(first.instanceId);e.instances.delete(first.instanceId);
 e.instances.set('i-99999999999999999',{...old,instanceId:'i-99999999999999999',privateIp:'10.0.0.99'});
 await assert.rejects(()=>coordinator(s,e).provision({binding,generation:1}),{code:'NATIVE_HOST_PROVISION_REFUSED'});
 assert.equal(e.launches(),1);assert.equal([...s.rows.values()][0].state,'active');
});
test('different binding/source cannot reuse an existing reservation',async()=>{
 const s=store(),e=ec2();await coordinator(s,e).provision({binding,generation:1});
 const changed={...binding,runId:id(7)};
 await assert.rejects(()=>coordinator(s,e).provision({binding:changed,generation:1}));
 assert.equal(e.launches(),1);
});

test('changed protected source rejects before material or provider effects on recovery',async()=>{
 const s=store(),e=ec2();await coordinator(s,e).provision({binding,generation:1});let calls=0;
 await assert.rejects(()=>coordinator(s,e,{deployment:{...deployment,bootstrapSha256:'f'.repeat(64)},
  material:{async forHost(x){calls++;return material.forHost(x);}}}).provision({binding,generation:1}));
 assert.equal(calls,0);assert.equal(e.launches(),1);
});
test('caller cancellation during material cannot admit an active host',async()=>{
 const s=store(),e=ec2(),controller=new AbortController();
 const cancel={async forHost(input){controller.abort();return material.forHost(input);}};
 await assert.rejects(()=>coordinator(s,e,{material:cancel}).provision({binding,generation:1,signal:controller.signal}));
 assert.notEqual([...s.rows.values()][0].state,'active');assert.equal(e.launches(),1);
});
test('noncooperative initial canonical read is bounded by one operation deadline',async()=>{
 const s=store(),e=ec2();const hang={...s.writer,readNativeReservation:()=>new Promise(()=>{})};
 const operation=createNativeHostProvisioning({writer:hang,deployment,
  launch:createEc2NativeHostLaunchPort({ec2:e,launch:launchSpec}),material:materialFor(s.writer,s.rows),
  authority:{verify:async()=>({currentUntilMs:now+600000,executionDeadlineMs:now+900000})},watchdog:watchdogStub,now:Date.now,ownerId:()=>id(9),
  effectTimeoutMs:1000}).provision({binding,generation:1}).then(()=> 'resolved',()=> 'rejected');
 assert.equal(await Promise.race([operation,new Promise(r=>setTimeout(()=>r('pending'),1250))]),'rejected');
 assert.equal(e.launches(),0);
});
test('deployment placement and launch drift refuses before any effect',async()=>{
 const s=store(),e=ec2();
 assert.throws(()=>coordinator(s,e,{deployment:{...deployment,placement:{...deployment.placement,
  subnetId:'subnet-aaaaaaaaaaaaaaaaa'}}}));
 assert.equal(e.launches(),0);assert.equal(s.rows.size,0);
});

test('the prearmed watchdog is read back before creation and the same execution is recovered after lost ACK',async()=>{
 const s=store(),e=ec2();e.loseNextAck();const seen=[];
 const watchdog={...watchdogStub,async arm({intent}){
  if(seen.length===0)assert.equal(e.launches(),0);
  seen.push({hostId:intent.input.hostId,generation:intent.input.generation,t0Ms:intent.t0Ms,
   deadlineMs:intent.deadlineMs,executionArn:intent.executionArn});
  return {armed:true,executionArn:intent.executionArn,hostId:intent.input.hostId,
   generation:intent.input.generation,t0Ms:intent.t0Ms,deadlineMs:intent.deadlineMs,
   cleanupCeilingMs:intent.cleanupCeilingMs};}};
 const first=await coordinator(s,e,{watchdog}).provision({binding,generation:1});
 const second=await coordinator(s,e,{watchdog}).provision({binding,generation:1});
 assert.equal(second.instanceId,first.instanceId);assert.equal(e.launches(),1);assert.equal(seen.length,2);
 assert.equal(seen[0].hostId,seen[1].hostId);assert.equal(seen[0].t0Ms,seen[1].t0Ms);
});

test('default reservation arms the real managed execution before EC2, and lost Start ACK recovers the same execution',async()=>{
 const s=store(),e=ec2();const order=[];let lose=true;
 const reserve=s.writer.reserveNativeHost.bind(s.writer);
 s.writer={...s.writer,async reserveNativeHost(input){order.push('reserve');return reserve(input);}};
 const ec2send=e.send.bind(e);e.send=async command=>{order.push('ec2:'+command.constructor.name);return ec2send(command);};
 const definition=JSON.stringify((await import('../../../infra/browser-enforcement/workflow.mjs')).compileNativeWatchdogDefinition({physicalObserver}));
 const {createManagedWatchdogReadback}=await import('../native-watchdog-readback.mjs');
 const {createHash}=await import('node:crypto');
 const versionArn='arn:aws:states:us-east-1:111122223333:stateMachine:meri:7';
 const owner=createManagedWatchdogReadback({stateMachineVersionArn:versionArn,
  definitionSha256:createHash('sha256').update(definition).digest('hex'),qualificationEvidenceSha256:'b'.repeat(64),now:()=>now});
 let execution=null;
 class StartExecutionCommand{constructor(input){this.input=input;}}
 class DescribeExecutionCommand{constructor(input){this.input=input;}}
 class DescribeStateMachineCommand{constructor(input){this.input=input;}}
 const sfn={sdk:{StartExecutionCommand,DescribeExecutionCommand,DescribeStateMachineCommand},async send(command){
  if(command instanceof StartExecutionCommand){order.push('sfn:start');
   if(execution)throw Object.assign(Error('exists'),{name:'ExecutionAlreadyExists'});
   execution={executionArn:`arn:aws:states:us-east-1:111122223333:execution:meri:${command.input.name}`,
    stateMachineArn:versionArn.replace(/:7$/u,''),stateMachineVersionArn:versionArn,status:'RUNNING',
    startDate:new Date(now),input:command.input.input};
   if(lose){lose=false;throw Error('lost response');}
   return {executionArn:execution.executionArn};}
  if(command instanceof DescribeExecutionCommand){order.push('sfn:describe');
   if(!execution)throw Object.assign(Error('absent'),{name:'ExecutionDoesNotExist'});return execution;}
  if(command instanceof DescribeStateMachineCommand)return {stateMachineArn:versionArn,revisionId:'revision-1',
   type:'STANDARD',status:'ACTIVE',definition};
  throw Error('unexpected');}};
 const watchdog={makeIntent:args=>owner.makeIntent(args),arm:args=>owner.arm({...args,stepFunctions:sfn}),
  verify:args=>owner.verify({...args,stepFunctions:sfn})};
 await assert.rejects(()=>coordinator(s,e,{watchdog}).provision({binding,generation:1}),/lost response|NATIVE/);
 assert.equal(order.includes('reserve'),true);assert.equal(order.includes('sfn:start'),true);
 assert.equal(order.some(x=>x.startsWith('ec2:RunInstances')),false);
 const row=[...s.rows.values()][0];assert.equal(row.state,'reserved');
 const firstStart=order.filter(x=>x==='sfn:start').length;
 const out=await coordinator(s,e,{watchdog}).provision({binding,generation:1});
 assert.equal(order.filter(x=>x==='sfn:start').length,firstStart,'fresh owner reuses retained execution');
 assert.ok(['created','existing'].includes(out.state));assert.equal(e.launches(),1);
});

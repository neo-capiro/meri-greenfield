/** Real canonical writer reservation/bootstrap methods over an explicit in-memory SQL transport. No provider or
 * SSM effect; this is not real-PG race/qualification evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const {createPostgresHostAllocationWriter}=await import('../postgres-allocations.mjs');
const {NATIVE_RESERVATION_SQL:S,assertNativeDeclaration}=await import('../native-reservations.mjs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.now();
const binding={tenantId:'tenant',actorId:id(2),conversationId:id(1),runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1};
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:id(1),generation:1,
 hostId:id(7),hostMode:'native-processing',imageDigest:'sha256:'+'c'.repeat(64),leaseDeadlineMs:now+600000};
const PEM=readFileSync('apps/runtime/certs/rds-global-bundle.pem','ascii').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/u)[0];
const bootstrapSpec={schema:'meri-native-bootstrap-spec/1',document:{name:'meri-bootstrap',version:'1',sha256:'a'.repeat(64),pluginName:'nativeBootstrap'},programSha256:'b'.repeat(64),profileSha256:'c'.repeat(64),hostEndpoint:{port:9443,serverName:'host.example'},control:{endpoint:{address:'10.0.0.1',port:443,serverName:'control.example'},clientName:'control.meri.internal',serverCertificate:PEM,clientCertificate:PEM,caCertificate:PEM,policySha256:'d'.repeat(64)},issuerCaCertificate:PEM};
const declaration=assertNativeDeclaration({schema:'meri-native-provisioning-declaration/1',imageDigest:allocation.imageDigest,
 sourceCommit:'d'.repeat(40),bootstrapSha256:'e'.repeat(64),accountId:'111122223333',region:'us-east-1',
 placement:{availabilityZone:'us-east-1a',subnetId:'subnet-0123456789abcdef0',securityGroupIds:['sg-0123456789abcdef0'],iamInstanceProfile:'meri-host-profile'},
 launch:{ImageId:'ami-0123456789abcdef0',InstanceType:'c7g.large',SubnetId:'subnet-0123456789abcdef0',SecurityGroupIds:['sg-0123456789abcdef0'],IamInstanceProfile:{Name:'meri-host-profile'}},
 token:'f'.repeat(64),tags:{MeriHostId:id(7),MeriProvisionToken:'f'.repeat(64),MeriGeneration:'1'}, leaseDeadlineMs:allocation.leaseDeadlineMs,bootstrapSpec});
function store(authority={verify:async(_c,{allocation:a,binding:b})=>({currentUntilMs:a.leaseDeadlineMs,allocation:a,binding:b})},clock=()=>now){
 const rows=new Map(),queries=[],key=allocation.hostId+':1';
 const client={async query(sql,args=[]){
  queries.push(sql);
  if(sql==='SHOW transaction_isolation')return {rows:[{transaction_isolation:'read committed'}]};
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL '))return {rows:[]};
  if(sql.includes('lock_conversation_admission'))return {rows:[]};
  if(sql.startsWith('SELECT * FROM meri_host_control.host_allocations WHERE tenant_id'))return {rows:[...rows.values()]};
  if(sql===S.reserve){const k=args[0]+':'+args[1];if(!rows.has(k))rows.set(k,{host_id:args[0],generation:args[1],tenant_id:args[2],
    conversation_id:args[3],allocation_json:args[4],allocation_sha256:hash(args[4]),original_binding_json:args[6],
    owner_instance_id:args[7],declaration_json:args[8],declaration_sha256:hash(args[8]),state:'reserved',
    observed_instance_json:null,dispatch_started_at_ms:null,bootstrap_prepare_json:null,bootstrap_install_json:null});return {rows:[]};}
  if(sql.includes('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2 FOR UPDATE'))
   {const r=rows.get(args[0]+':'+args[1]);return {rows:r?[r]:[]};}
  if(sql.startsWith("SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2"))
   {const r=rows.get(args[0]+':'+args[1]);return {rows:r?[r]:[]};}
  if(sql===S.claimDispatch){const r=rows.get(args[0]+':'+args[1]);if(r.state==='reserved'&&r.declaration_sha256===args[2]){r.state='dispatching';r.dispatch_started_at_ms=clock();}return {rows:[]};}
  if(sql===S.recordInstance){const r=rows.get(args[0]+':'+args[1]);if(r.observed_instance_json===null)r.observed_instance_json=args[2];return {rows:[]};}
  if(sql===S.recordInstanceAddress){const r=rows.get(args[0]+':'+args[1]);
   if(r&&r.observed_instance_json?.instanceId===args[2]&&r.observed_instance_json?.privateIp===null)
    r.observed_instance_json={instanceId:args[2],privateIp:args[3]};return {rows:[]};}
  if(sql===S.setPrepare||sql===S.setInstall){const r=rows.get(args[0]+':'+args[1]);
   if(sql===S.setPrepare)r.bootstrap_prepare_json=args[2];else r.bootstrap_install_json=args[2];return {rows:[]};}
  throw Error('UNEXPECTED_SQL '+sql);
 },release(){}};
 const pool={async connect(){return client;}};
 return {rows,queries,writer:createPostgresHostAllocationWriter({pool,now:clock,readCurrentNativeAuthority:authority.verify})};
}
const reserveInput=()=>({allocation,originalBinding:binding,ownerInstanceId:id(9),declaration});

test('reserve is idempotent, changed declaration refuses, claim grants one send-once then reconcile',async()=>{
 const {rows,writer}=store();
 const a=await writer.reserveNativeHost(reserveInput());assert.equal(a.state,'reserved');
 const b=await writer.reserveNativeHost(reserveInput());assert.equal(b.declarationSha256,a.declarationSha256);
 await assert.rejects(()=>writer.reserveNativeHost({...reserveInput(),declaration:{...declaration,bootstrapSha256:'a'.repeat(64)}}),
  {message:'BROWSER_HOST_ALLOCATION_REFUSED'});
 const claim=await writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:a.declarationSha256});
 assert.equal(claim.disposition,'send-once');
 const again=await writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:a.declarationSha256});
 assert.equal(again.disposition,'reconcile');assert.equal(rows.size,1);
});
test('the observed instance binds once and cannot be replaced',async()=>{
 const {writer}=store();await writer.reserveNativeHost(reserveInput());
 await writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration)});
 const one=await writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration),
  instanceId:'i-0123456789abcdef0',privateIp:'10.0.0.11'});
 assert.equal(one.observedInstance.instanceId,'i-0123456789abcdef0');
 await assert.rejects(()=>writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,
  declarationSha256:hash(declaration),instanceId:'i-99999999999999999',privateIp:'10.0.0.12'}),
  {message:'BROWSER_HOST_ALLOCATION_REFUSED'});
});

test('a null observed address may fill once for the same instance only',async()=>{
 const {writer}=store();await writer.reserveNativeHost(reserveInput());
 await writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration)});
 const nullAddr=await writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration),
  instanceId:'i-0123456789abcdef0',privateIp:null});
 assert.equal(nullAddr.observedInstance.privateIp,null);
 const known=await writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration),
  instanceId:'i-0123456789abcdef0',privateIp:'10.0.0.11'});
 assert.equal(known.observedInstance.privateIp,'10.0.0.11');
 const replay=await writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration),
  instanceId:'i-0123456789abcdef0',privateIp:'10.0.0.11'});
 assert.equal(hash(replay),hash(known));
 for(const bad of [{instanceId:'i-9999999999999999',privateIp:'10.0.0.12'},
  {instanceId:'i-0123456789abcdef0',privateIp:'10.0.0.12'},
  {instanceId:'i-0123456789abcdef0',privateIp:null}])
  await assert.rejects(()=>writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,
   declarationSha256:hash(declaration),...bad}),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});
 for(const bad of ['10.evil','10.0.0.256','010.0.0.1','127.0.0.1','192.168.1.999'])
  await assert.rejects(()=>writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,
   declarationSha256:hash(declaration),instanceId:'i-0123456789abcdef0',privateIp:bad}),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});
});
test('bootstrap prepare retains one exact request and grants one send-once, then reconcile',async()=>{
 const {writer,queries}=store();await writer.reserveNativeHost(reserveInput());
 await writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration)});
 await writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration),
  instanceId:'i-0123456789abcdef0',privateIp:'10.0.0.11'});
 queries.length=0;
 const reservation=await writer.readNativeReservation({hostId:allocation.hostId,generation:1});
 const {createNativeBootstrapRequest,nativeBootstrapOperationId}=await import('../../../../packages/contracts/native-bootstrap.mjs');
 const scope={allocation:reservation.allocation,originalBinding:reservation.originalBinding,
  ownerInstanceId:reservation.ownerInstanceId,instanceId:reservation.observedInstance.instanceId,
  endpoint:{address:'10.0.0.11',port:9443,serverName:'host.example'},
  source:{imageDigest:declaration.imageDigest,sourceCommit:declaration.sourceCommit,bootstrapSha256:declaration.bootstrapSha256},
  declarationSha256:reservation.declarationSha256,bootstrapSpecSha256:hash(bootstrapSpec)};
 const request=createNativeBootstrapRequest({schema:'meri-native-bootstrap-prepare-request/1',
  operationId:nativeBootstrapOperationId({hostId:allocation.hostId,generation:1,step:'prepare'}),scope,
  bootstrapSpec:declaration.bootstrapSpec});
 const op=await writer.reserveBootstrapOperation({hostId:allocation.hostId,generation:1,step:'prepare',request});
 assert.equal(op.state,'reserved');
 const admission=queries.findIndex(sql=>sql.includes('lock_conversation_admission'));
 const hostLock=queries.findIndex(sql=>sql.includes('host_allocations WHERE host_id=$1 AND generation=$2 FOR UPDATE'));
 assert.ok(admission>=0&&hostLock>admission,'conversation admission precedes the host row lock');
 const replay=await writer.reserveBootstrapOperation({hostId:allocation.hostId,generation:1,step:'prepare',request});
 assert.equal(replay.dispatchId,op.dispatchId);assert.equal(replay.requestSha256,op.requestSha256);
 await assert.rejects(()=>writer.reserveBootstrapOperation({hostId:allocation.hostId,generation:1,step:'prepare',
  request:{...request,Comment:'changed'}}),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});
 queries.length=0;
 const claim=await writer.claimBootstrapDispatch({hostId:allocation.hostId,generation:1,step:'prepare',requestSha256:op.requestSha256});
 assert.equal(claim.disposition,'send-once');
 const cAdmission=queries.findIndex(sql=>sql.includes('lock_conversation_admission'));
 const cHostLock=queries.findIndex(sql=>sql.includes('host_allocations WHERE host_id=$1 AND generation=$2 FOR UPDATE'));
 assert.ok(cAdmission>=0&&cHostLock>cAdmission,'claim takes conversation admission before the host row lock');
 const again=await writer.claimBootstrapDispatch({hostId:allocation.hostId,generation:1,step:'prepare',requestSha256:op.requestSha256});
 assert.equal(again.disposition,'reconcile');
 const cmd=await writer.recordBootstrapCommand({hostId:allocation.hostId,generation:1,step:'prepare',
  dispatchId:op.dispatchId,requestSha256:op.requestSha256,commandId:'cmd-1'});
 assert.equal(cmd.commandId,'cmd-1');
});

test('positive prepare and install observations persist exact joined custody',async()=>{
 const {writer}=store();await writer.reserveNativeHost(reserveInput());
 await writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration)});
 await writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration),
  instanceId:'i-0123456789abcdef0',privateIp:'10.0.0.11'});
 const {createNativeBootstrapRequest,nativeBootstrapOperationId,NATIVE_BOOTSTRAP_INSTALLED}=
  await import('../../../../packages/contracts/native-bootstrap.mjs');
 const {X509Certificate,createHash}=await import('node:crypto');const {readFileSync}=await import('node:fs');
 const bundle=readFileSync('apps/runtime/certs/rds-global-bundle.pem','ascii');
 const certs=[...bundle.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/gu)].map(m=>m[0]);
 assert.ok(certs.length>=2);const c1=new X509Certificate(certs[0]),c2=new X509Certificate(certs[1]);
 const sha=b=>createHash('sha256').update(b).digest('hex');const spki=c=>sha(Buffer.from(c.publicKey.export({type:'spki',format:'der'})));
 let res=await writer.readNativeReservation({hostId:allocation.hostId,generation:1});
 const scope={allocation:res.allocation,originalBinding:res.originalBinding,ownerInstanceId:res.ownerInstanceId,
  instanceId:res.observedInstance.instanceId,endpoint:{address:'10.0.0.11',port:9443,serverName:'host.example'},
  source:{imageDigest:declaration.imageDigest,sourceCommit:declaration.sourceCommit,bootstrapSha256:declaration.bootstrapSha256},
  declarationSha256:res.declarationSha256,bootstrapSpecSha256:hash(bootstrapSpec)};
 const prepareOp=nativeBootstrapOperationId({hostId:allocation.hostId,generation:1,step:'prepare'});
 const prepareRequest=createNativeBootstrapRequest({schema:'meri-native-bootstrap-prepare-request/1',operationId:prepareOp,
  scope,bootstrapSpec:declaration.bootstrapSpec});
 const p=await writer.reserveBootstrapOperation({hostId:allocation.hostId,generation:1,step:'prepare',request:prepareRequest});
 await writer.claimBootstrapDispatch({hostId:allocation.hostId,generation:1,step:'prepare',requestSha256:p.requestSha256});
 const prepareCommand='cmd-prepare-1';
 await writer.recordBootstrapCommand({hostId:allocation.hostId,generation:1,step:'prepare',dispatchId:p.dispatchId,
  requestSha256:p.requestSha256,commandId:prepareCommand});
 const bootId=id(8);
 const prepareObservation={schema:'meri-native-bootstrap-prepare/1',operationId:prepareOp,requestSha256:hash(prepareRequest),
  scope,bootId,preparedAtMs:now+1000,hostCsrPem:'-----BEGIN CERTIFICATE REQUEST-----\nQUJD\n-----END CERTIFICATE REQUEST-----',
  serverCsrPem:'-----BEGIN CERTIFICATE REQUEST-----\nREVG\n-----END CERTIFICATE REQUEST-----',
  hostSpkiSha256:spki(c1),serverSpkiSha256:spki(c2),hostProofBase64:'QUJD',serverProofBase64:'REVG'};
 const prepRecord=await writer.recordBootstrapObservation({hostId:allocation.hostId,generation:1,step:'prepare',dispatchId:p.dispatchId,
  requestSha256:p.requestSha256,commandId:prepareCommand,observation:prepareObservation});
 const prepReplay=await writer.recordBootstrapObservation({hostId:allocation.hostId,generation:1,step:'prepare',dispatchId:p.dispatchId,
  requestSha256:p.requestSha256,commandId:prepareCommand,observation:prepareObservation});
 assert.equal(hash(prepReplay),hash(prepRecord));
 const mid=await writer.readNativeReservation({hostId:allocation.hostId,generation:1});
 assert.equal(mid.bootstrap.prepare.state,'succeeded');assert.equal(mid.bootstrap.prepare.observation.bootId,bootId);
 const installOp=nativeBootstrapOperationId({hostId:allocation.hostId,generation:1,step:'install'});
 const installRequest=createNativeBootstrapRequest({schema:'meri-native-bootstrap-install-request/1',operationId:installOp,
  scope,bootstrapSpec:declaration.bootstrapSpec,prepareOperationId:prepareOp,prepareRequestSha256:hash(prepareRequest),
  prepareObservationSha256:hash(prepareObservation),bootId,hostCertificate:certs[0],serverCertificate:certs[1]});
 const ins=await writer.reserveBootstrapOperation({hostId:allocation.hostId,generation:1,step:'install',request:installRequest});
 await writer.claimBootstrapDispatch({hostId:allocation.hostId,generation:1,step:'install',requestSha256:ins.requestSha256});
 const installCommand='cmd-install-1';
 await writer.recordBootstrapCommand({hostId:allocation.hostId,generation:1,step:'install',dispatchId:ins.dispatchId,
  requestSha256:ins.requestSha256,commandId:installCommand});
 const projection={schema:NATIVE_BOOTSTRAP_INSTALLED,scope,bootId,prepareOperationId:prepareOp,
  prepareRequestSha256:hash(prepareRequest),prepareObservationSha256:hash(prepareObservation),installOperationId:installOp,
  installRequestSha256:hash(installRequest),hostCertificateSha256:sha(Buffer.from(c1.raw)),
  serverCertificateSha256:sha(Buffer.from(c2.raw)),hostSpkiSha256:spki(c1),serverSpkiSha256:spki(c2)};
 await writer.recordBootstrapObservation({hostId:allocation.hostId,generation:1,step:'install',dispatchId:ins.dispatchId,
  requestSha256:ins.requestSha256,commandId:installCommand,
  observation:{schema:'meri-native-bootstrap-install/1',operationId:installOp,requestSha256:hash(installRequest),scope,
   prepareOperationId:prepareOp,prepareRequestSha256:hash(prepareRequest),prepareObservationSha256:hash(prepareObservation),
   bootId,installedAtMs:now+2000,hostSpkiSha256:spki(c1),serverSpkiSha256:spki(c2),
   hostCertificateSha256:sha(Buffer.from(c1.raw)),serverCertificateSha256:sha(Buffer.from(c2.raw)),configSha256:hash(projection)}});
 const cmdReplay=await writer.recordBootstrapCommand({hostId:allocation.hostId,generation:1,step:'install',dispatchId:ins.dispatchId,
  requestSha256:ins.requestSha256,commandId:installCommand});
 assert.equal(cmdReplay.commandId,installCommand);
 await assert.rejects(()=>writer.recordBootstrapCommand({hostId:allocation.hostId,generation:1,step:'install',dispatchId:ins.dispatchId,
  requestSha256:ins.requestSha256,commandId:'cmd-changed'}),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});
 res=await writer.readNativeReservation({hostId:allocation.hostId,generation:1});
 assert.equal(res.bootstrap.prepare.state,'succeeded');assert.equal(res.bootstrap.install.state,'succeeded');
 assert.equal(res.bootstrap.install.observation.configSha256,hash(projection));
 assert.equal(res.bootstrap.install.observation.bootId,bootId);
});
test('claim refuses when the original lease falls below 30000ms during authority work',async()=>{
 let t=now,calls=0;const clock=()=>t;
 const {createNativeBootstrapRequest,nativeBootstrapOperationId}=await import('../../../../packages/contracts/native-bootstrap.mjs');
 const verify=async(_c,{allocation:a,binding:b})=>{calls++;if(calls===4)t=a.leaseDeadlineMs-20000;
  return {currentUntilMs:a.leaseDeadlineMs,allocation:a,binding:b};};
 const {writer}=store({verify},clock);await writer.reserveNativeHost(reserveInput());
 await writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration)});
 await writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration),
  instanceId:'i-0123456789abcdef0',privateIp:'10.0.0.11'});
 const request=createNativeBootstrapRequest({schema:'meri-native-bootstrap-prepare-request/1',
  operationId:nativeBootstrapOperationId({hostId:allocation.hostId,generation:1,step:'prepare'}),
  scope:{allocation,originalBinding:binding,ownerInstanceId:id(9),instanceId:'i-0123456789abcdef0',
   endpoint:{address:'10.0.0.11',port:9443,serverName:'host.example'},
   source:{imageDigest:declaration.imageDigest,sourceCommit:declaration.sourceCommit,bootstrapSha256:declaration.bootstrapSha256},
   declarationSha256:hash(declaration),bootstrapSpecSha256:hash(bootstrapSpec)},bootstrapSpec:declaration.bootstrapSpec});
 const op=await writer.reserveBootstrapOperation({hostId:allocation.hostId,generation:1,step:'prepare',request});
 await assert.rejects(()=>writer.claimBootstrapDispatch({hostId:allocation.hostId,generation:1,step:'prepare',requestSha256:op.requestSha256}),
  {message:'BROWSER_HOST_ALLOCATION_REFUSED'});
});
test('effect grants require a fresh canonical authority callback and never grant send-once without it',async()=>{
 let calls=0;
 const good=store({verify:async(_c,{allocation:a,binding:b})=>{calls++;return {currentUntilMs:a.leaseDeadlineMs,allocation:a,binding:b};}});
 await good.writer.reserveNativeHost(reserveInput());
 const claim=await good.writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration)});
 assert.equal(claim.disposition,'send-once');assert.ok(calls>=2,'authority is invoked at reserve and dispatch');
 const bad=store({verify:async(_c,{allocation:a,binding:b})=>({currentUntilMs:now-1,allocation:a,binding:b})});
 await assert.rejects(()=>bad.writer.reserveNativeHost(reserveInput()),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});
 const refused=store({verify:async()=>{throw Object.assign(Error('REVOKED'),{code:'REVOKED'});}});
 await assert.rejects(()=>refused.writer.reserveNativeHost(reserveInput()),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});
});

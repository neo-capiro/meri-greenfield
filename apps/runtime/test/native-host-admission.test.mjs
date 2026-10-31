/** Complete native admission through the REAL canonical writer: reserve -> claim -> observed instance -> admit.
 * Strict synthetic certificate boundary; no provider/AWS/PKI effect. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,X509Certificate} from 'node:crypto';
const R=new URL('../../../',import.meta.url).href;
const tls=await import(R+'apps/worker/conversation/host/control/tls.mjs');
mock.module(R+'apps/worker/conversation/host/control/tls.mjs',{exports:{...tls,
 checkedCertificate:(raw,{nowMs,notAfterMs})=>({fingerprintSha256:raw?.startsWith('-----')?
  createHash('sha256').update(new X509Certificate(raw).raw).digest('hex'):(raw==='client'?'a':'b').repeat(64),
  notAfterMs:notAfterMs??nowMs+60000})}});
const B=await import(R+'packages/contracts/native-bootstrap.mjs');
const {canonicalSha256:hash}=await import(R+'packages/contracts/validate.mjs');
const {prepareHostAllocation}=await import(R+'apps/control/browser-hosts/allocation.mjs');
const {createPostgresHostAllocationWriter,HOST_ALLOCATION_SQL:H}=await import(R+'apps/control/browser-hosts/postgres-allocations.mjs');
const {NATIVE_RESERVATION_SQL:N,assertNativeDeclaration}=await import(R+'apps/control/browser-hosts/native-reservations.mjs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.now(),lease=now+600000;
const binding={tenantId:'tenant',actorId:id(2),conversationId:id(1),runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1};
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:id(1),generation:1,
 hostId:id(7),hostMode:'native-processing',imageDigest:'sha256:'+'c'.repeat(64),leaseDeadlineMs:lease};
const PEM=readFileSync('apps/runtime/certs/rds-global-bundle.pem','ascii').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/u)[0];
const bootstrapSpec={schema:'meri-native-bootstrap-spec/1',document:{name:'meri-bootstrap',version:'1',sha256:'a'.repeat(64),pluginName:'nativeBootstrap'},programSha256:'b'.repeat(64),profileSha256:'c'.repeat(64),hostEndpoint:{port:9443,serverName:'host.example'},control:{endpoint:{address:'10.0.0.1',port:443,serverName:'control.example'},clientName:'control.meri.internal',serverCertificate:PEM,clientCertificate:PEM,caCertificate:PEM,policySha256:'d'.repeat(64)},issuerCaCertificate:PEM};
const declaration=assertNativeDeclaration({schema:'meri-native-provisioning-declaration/1',imageDigest:allocation.imageDigest,
 sourceCommit:'d'.repeat(40),bootstrapSha256:'e'.repeat(64),accountId:'111122223333',region:'us-east-1',
 placement:{availabilityZone:'us-east-1a',subnetId:'subnet-0123456789abcdef0',securityGroupIds:['sg-0123456789abcdef0'],iamInstanceProfile:'meri-host-profile'},
 launch:{ImageId:'ami-0123456789abcdef0',InstanceType:'c7g.large',SubnetId:'subnet-0123456789abcdef0',SecurityGroupIds:['sg-0123456789abcdef0'],IamInstanceProfile:{Name:'meri-host-profile'}},
 token:'f'.repeat(64),tags:{MeriHostId:id(7),MeriProvisionToken:'f'.repeat(64)},leaseDeadlineMs:lease,bootstrapSpec});
const certs=[...readFileSync('apps/runtime/certs/rds-global-bundle.pem','ascii').matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/gu)].map(m=>m[0]);
const raw={allocation,originalBinding:binding,hostIdentity:{schema:'meri-d005-host-identity/1',hostId:id(7),
 conversationId:id(1),instanceId:'i-0123456789abcdef0',bootId:id(8)},
 ownerInstanceId:id(9),endpoint:{address:'10.0.0.11',port:9443,serverName:'host.example'},
 hostCertificate:certs[0],serverCertificate:certs[1]};
const record=prepareHostAllocation(raw,now);

function store({expiry=null}={}){
 let clockMs=now;
 const rows=new Map(),key=allocation.hostId+':1';let inserted=0,adopted=0;
 const authority=async(_c,{allocation:a,originalBinding:b})=>({currentUntilMs:expiry==='authority'?now+10:a.leaseDeadlineMs,allocation:a,binding:b});
 const client={async query(sql,args=[]){
  if(sql==='SHOW transaction_isolation')return {rows:[{transaction_isolation:'read committed'}]};
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL '))return {rows:[]};
  if(sql.includes('lock_conversation_admission'))return {rows:[]};
  if(sql.startsWith('SELECT * FROM meri_host_control.host_allocations WHERE tenant_id'))return {rows:[...rows.values()]};
  if(sql===H.purposeRows)return {rows:[...rows.values()].map(r=>({host_id:r.host_id,generation:r.generation,state:r.state,allocation_sha256:r.allocation_sha256,record_sha256:r.record_sha256,host_mode:r.allocation_json.hostMode??null}))};
  if(sql===N.reserve){assert.match(sql,/lease_deadline_ms,\s*credential_revision,state/u);
   assert.equal(args.length,11);assert.equal(args[10],lease);
   if(!rows.has(key))rows.set(key,{host_id:args[0],generation:args[1],tenant_id:args[2],conversation_id:args[3],
    allocation_json:args[4],allocation_sha256:hash(args[4]),original_binding_json:args[6],owner_instance_id:args[7],
    declaration_json:args[8],declaration_sha256:hash(args[8]),lease_deadline_ms:args[10],credential_revision:1,
    state:'reserved',observed_instance_json:null,dispatch_started_at_ms:null,bootstrap_prepare_json:null,
    bootstrap_install_json:null,host_identity_json:null,endpoint_json:null,record_sha256:null,client_cert_sha256:null,
    client_dns_name:null,client_cert_not_after_ms:null,server_cert_not_after_ms:null,host_mode:'native-processing'});return {rows:[]};}
  if(sql.startsWith('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2'))
   {const r=rows.get(args[0]+':'+args[1]);return {rows:r?[r]:[]};}
  if(sql===N.claimDispatch){const r=rows.get(args[0]+':'+args[1]);if(r.state==='reserved'){r.state='dispatching';r.dispatch_started_at_ms=args[3];}if(expiry!==null)clockMs=expiry==='lease'?lease+1:now+20;return {rows:[]};}
  if(sql===N.recordInstance){const r=rows.get(args[0]+':'+args[1]);if(r.observed_instance_json===null)r.observed_instance_json=args[2];return {rows:[]};}
  if(sql===N.setPrepare||sql===N.setInstall){const r=rows.get(args[0]+':'+args[1]);
   if(sql===N.setPrepare)r.bootstrap_prepare_json=args[2];else r.bootstrap_install_json=args[2];return {rows:[]};}
  if(sql===N.admitNative){adopted++;const r=rows.get(args[0]+':'+args[1]);
   r.host_identity_json=args[2];r.host_identity_sha256=args[3];r.endpoint_json=args[4];r.record_sha256=args[5];r.client_cert_sha256=args[6];
   r.client_dns_name=args[7];r.client_cert_not_after_ms=args[8];r.server_cert_not_after_ms=args[9];r.state='active';return {rows:[]};}
  if(sql===H.insert){inserted++;return {rows:[]};}
  if(sql===H.lock||sql===H.lockWriter){const r=rows.get(args[0]+':'+args[1]);return {rows:r?[r]:[]};}
  throw Error('UNEXPECTED_SQL '+sql);
 },release(){}};
 const writer=createPostgresHostAllocationWriter({pool:{connect:async()=>client},now:()=>clockMs,readCurrentNativeAuthority:authority});
 return {rows,writer,inserted:()=>inserted,adopted:()=>adopted};
}

async function bootstrap(f){
 const res=await f.writer.readNativeReservation({hostId:allocation.hostId,generation:1});
 const sha=b=>createHash('sha256').update(b).digest('hex');
 const c1=new X509Certificate(certs[0]),c2=new X509Certificate(certs[1]);
 const spki=c=>sha(Buffer.from(c.publicKey.export({type:'spki',format:'der'})));
 const scope={allocation:res.allocation,originalBinding:res.originalBinding,ownerInstanceId:res.ownerInstanceId,
  instanceId:res.observedInstance.instanceId,endpoint:{address:'10.0.0.11',port:9443,serverName:'host.example'},
  source:{imageDigest:declaration.imageDigest,sourceCommit:declaration.sourceCommit,bootstrapSha256:declaration.bootstrapSha256},
  declarationSha256:res.declarationSha256,bootstrapSpecSha256:hash(bootstrapSpec)};
 const prepId=B.nativeBootstrapOperationId({hostId:allocation.hostId,generation:1,step:'prepare'});
 const prepReq=B.createNativeBootstrapRequest({schema:'meri-native-bootstrap-prepare-request/1',operationId:prepId,
  scope,bootstrapSpec:declaration.bootstrapSpec});
 const prep=await f.writer.reserveBootstrapOperation({hostId:allocation.hostId,generation:1,step:'prepare',request:prepReq});
 await f.writer.claimBootstrapDispatch({hostId:allocation.hostId,generation:1,step:'prepare',requestSha256:prep.requestSha256});
 await f.writer.recordBootstrapCommand({hostId:allocation.hostId,generation:1,step:'prepare',dispatchId:prep.dispatchId,
  requestSha256:prep.requestSha256,commandId:'cmd-prepare'});
 const prepObs={schema:'meri-native-bootstrap-prepare/1',operationId:prepId,requestSha256:hash(prepReq),scope,bootId:id(8),
  preparedAtMs:now+1000,hostCsrPem:'-----BEGIN CERTIFICATE REQUEST-----\nQUJD\n-----END CERTIFICATE REQUEST-----',serverCsrPem:'-----BEGIN CERTIFICATE REQUEST-----\nREVG\n-----END CERTIFICATE REQUEST-----',
  hostSpkiSha256:spki(c1),serverSpkiSha256:spki(c2),hostProofBase64:'QUJD',serverProofBase64:'REVG'};
 await f.writer.recordBootstrapObservation({hostId:allocation.hostId,generation:1,step:'prepare',dispatchId:prep.dispatchId,
  requestSha256:prep.requestSha256,commandId:'cmd-prepare',observation:prepObs});
 const instId=B.nativeBootstrapOperationId({hostId:allocation.hostId,generation:1,step:'install'});
 const instReq=B.createNativeBootstrapRequest({schema:'meri-native-bootstrap-install-request/1',operationId:instId,
  scope,bootstrapSpec:declaration.bootstrapSpec,prepareOperationId:prepId,prepareRequestSha256:hash(prepReq),
  prepareObservationSha256:hash(prepObs),bootId:id(8),hostCertificate:certs[0],serverCertificate:certs[1]});
 const ins=await f.writer.reserveBootstrapOperation({hostId:allocation.hostId,generation:1,step:'install',request:instReq});
 await f.writer.claimBootstrapDispatch({hostId:allocation.hostId,generation:1,step:'install',requestSha256:ins.requestSha256});
 await f.writer.recordBootstrapCommand({hostId:allocation.hostId,generation:1,step:'install',dispatchId:ins.dispatchId,
  requestSha256:ins.requestSha256,commandId:'cmd-install'});
 const proj={schema:B.NATIVE_BOOTSTRAP_INSTALLED,scope,bootId:id(8),prepareOperationId:prepId,
  prepareRequestSha256:hash(prepReq),prepareObservationSha256:hash(prepObs),installOperationId:instId,
  installRequestSha256:hash(instReq),hostCertificateSha256:sha(Buffer.from(c1.raw)),
  serverCertificateSha256:sha(Buffer.from(c2.raw)),hostSpkiSha256:spki(c1),serverSpkiSha256:spki(c2)};
 const instObs={schema:'meri-native-bootstrap-install/1',operationId:instId,requestSha256:hash(instReq),scope,
  prepareOperationId:prepId,prepareRequestSha256:hash(prepReq),prepareObservationSha256:hash(prepObs),bootId:id(8),
  installedAtMs:now+2000,hostSpkiSha256:spki(c1),serverSpkiSha256:spki(c2),
  hostCertificateSha256:sha(Buffer.from(c1.raw)),serverCertificateSha256:sha(Buffer.from(c2.raw)),configSha256:hash(proj)};
 await f.writer.recordBootstrapObservation({hostId:allocation.hostId,generation:1,step:'install',dispatchId:ins.dispatchId,
  requestSha256:ins.requestSha256,commandId:'cmd-install',observation:instObs});
}
test('complete native flow: one reserved row is promoted in place; no fresh INSERT',async()=>{
 const f=store();
 await f.writer.reserveNativeHost({allocation,originalBinding:binding,ownerInstanceId:id(9),declaration});
 const claim=await f.writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration)});
 assert.equal(claim.disposition,'send-once');
 await f.writer.recordNativeHostInstance({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration),
  instanceId:'i-0123456789abcdef0',privateIp:'10.0.0.11'});
 await bootstrap(f);
 const active=await f.writer.admit({record:raw});
 assert.equal(active.allocation.hostId,allocation.hostId);
 assert.equal(f.rows.size,1);assert.equal(f.inserted(),0);assert.equal(f.adopted(),1);
 const row=f.rows.get(allocation.hostId+':1');
 assert.equal(row.state,'active');assert.equal(row.owner_instance_id,id(9));assert.equal(row.lease_deadline_ms,lease);
 assert.equal(row.allocation_json.leaseDeadlineMs,lease);
 const replay=await f.writer.admit({record:raw});
 assert.equal(replay.allocation.hostId,allocation.hostId);assert.equal(f.adopted(),1,'active replay does not promote again');
});
test('native admission without a reservation refuses and never inserts',async()=>{
 const f=store();
 await assert.rejects(()=>f.writer.admit({record:raw}),{message:'BROWSER_HOST_ALLOCATION_REFUSED'});
 assert.equal(f.inserted(),0);assert.equal(f.rows.size,0);
});

for(const expiry of ['lease','authority'])test('dispatch cannot grant send permission after '+expiry+' expires before commit',async()=>{
 const f=store({expiry});
 await f.writer.reserveNativeHost({allocation,originalBinding:binding,ownerInstanceId:id(9),declaration});
 await assert.rejects(()=>f.writer.claimNativeHostDispatch({hostId:allocation.hostId,generation:1,declarationSha256:hash(declaration)}),
  {message:'BROWSER_HOST_ALLOCATION_REFUSED'});
});

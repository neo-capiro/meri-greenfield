/** FINITE97: real prepare -> install -> validated DEFAULT config -> actual currentness client with distinct roots.
 *  Only the SSM network, writer persistence, OS identity and 127.0.0.1 are inert; cryptography and contracts are real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:https';
import {createHash,X509Certificate} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {createLifecycleHandler} from './lifecycle-http.mjs';
import {decodeNativeBootstrapPayload,assertNativeBootstrapSpec,nativeBootstrapOperationId} from
 '@capiro/meri-contracts/native-bootstrap';
import {canonicalSha256} from '@capiro/meri-contracts/node';
import {prepareProtectedGuest,installProtectedGuest,bootstrapStdout,readInstalledTls,installedRuntimeConfig,
 PROTECTED_PROGRAM,PROTECTED_IDENTITY} from './protected-bootstrap.mjs';
import {createNativeHostMaterialOwner} from '../native-authority/native-host-material.mjs';
import {createNativeBootstrapSsmTransport} from '../native-authority/native-host-bootstrap-ssm.mjs';
import {createNativeHostCertificateIssuerFromMaterial} from '../native-authority/native-host-certificate-issuer.mjs';
import {connect} from 'node:tls';
import {createHostCurrentnessClient} from '../../worker/conversation/host/control/client.mjs';
import {prepareHostHierarchy,releaseOwnedHierarchy} from './hierarchy.mjs';
import {makeInertHierarchyPort} from './test-hierarchy-port.mjs';
import {createRunnerPoststartCsr as createRunner} from '../native-authority/runner-poststart-csr.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const BOOT=id(8),INSTANCE='i-0123456789abcdef0',PRIVATE_IP='10.0.0.11',SERVER_NAME='native-host.example';
const CONTROL_SERVER='control.example',CONTROL_CLIENT='control.meri.internal';
const sha=b=>createHash('sha256').update(b).digest('hex');
const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const PROGRAM_READER=path=>{if(path==='/opt/meri/native-bootstrap.mjs')return Buffer.from('program-bytes');
 if(path==='/opt/meri/meri-host-launcher')return Buffer.from('helper-bytes');throw Error('unexpected file');};
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:id(1),conversationId:id(3),hostId:id(7),
 generation:1,hostMode:'native-processing',imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+600000};
const source={imageDigest:allocation.imageDigest,sourceCommit:'b'.repeat(40),bootstrapSha256:'c'.repeat(64)};
const profileBytes=Buffer.from(JSON.stringify({programSha256:sha(Buffer.from('program-bytes')),helperSha256:sha(Buffer.from('helper-bytes')),
 sourceCommit:source.sourceCommit,imageDigest:source.imageDigest,bootstrapSha256:source.bootstrapSha256,
 layout:{limits:{cpuQuotaUs:50000,periodUs:100000,memoryBytes:268435456,pidsMax:16,deadlineMaxMs:5000,bodyBytes:1100000},
  paths:{helperPath:'/opt/meri/meri-host-launcher',nodePath:'/usr/local/bin/node',home:'/run/meri/processing',
   childPath:'/opt/meri/child-cli.mjs',definitionsRoot:'/run/meri/upload-definitions',extractorPath:'/opt/meri/extract.py',
   scratchRoot:'/run/meri/upload-scratch'}}}));
let SPEC;

function pki(t,prefix){
 const dir=mkdtempSync(join(tmpdir(),prefix));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'ca.key'),'-out',join(dir,'ca.pem'),
  '-days','2','-subj',`/CN=${prefix}`],{stdio:'ignore'});
 const pem=new X509Certificate(readFileSync(join(dir,'ca.pem'),'utf8')).toString();
 return {pem,issuer:createNativeHostCertificateIssuerFromMaterial({caPem:Buffer.from(pem),keyPem:readFileSync(join(dir,'ca.key'))})};
}

async function fixture(t,{protectedCleanup=false}={}){
 const native=pki(t,'meri-native97-'),control=pki(t,'meri-control97-');
 const at=Date.now();
 const csr=()=>({csrPem:createRunner().csrPem,keyPem:createRunner().keyPem});
 const controlServerCsr=createRunner(),controlClientCsr=createRunner();
 const controlServerCert=(await control.issuer.issue({kind:'server',san:CONTROL_SERVER,csrPem:controlServerCsr.csrPem,
  notAfterMs:allocation.leaseDeadlineMs,leaseDeadlineMs:allocation.leaseDeadlineMs})).certPem;
 const controlClientUntil=allocation.leaseDeadlineMs+(protectedCleanup?60000:0);
 const controlClientCert=(await control.issuer.issue({kind:'client',san:CONTROL_CLIENT,csrPem:controlClientCsr.csrPem,
  notAfterMs:controlClientUntil,leaseDeadlineMs:controlClientUntil})).certPem;
 void csr;void at;
 SPEC=assertNativeBootstrapSpec({schema:'meri-native-bootstrap-spec/1',
  document:{name:'meri-bootstrap',version:'1',sha256:'d'.repeat(64),pluginName:'nativeBootstrap'},
  programSha256:JSON.parse(profileBytes).programSha256,profileSha256:sha(profileBytes),
  hostEndpoint:{port:9443,serverName:SERVER_NAME},
  control:{endpoint:{address:'10.0.0.1',port:8443,serverName:CONTROL_SERVER},clientName:CONTROL_CLIENT,
   serverCertificate:controlServerCert,clientCertificate:controlClientCert,caCertificate:control.pem,policySha256:'e'.repeat(64)},
  issuerCaCertificate:native.pem});
 const full={schema:protectedCleanup?'meri-native-provisioning-declaration/2':'meri-native-provisioning-declaration/1',
  ...source,bootstrapSpec:SPEC,...(protectedCleanup?{watchdog:{leaseDeadlineMs:allocation.leaseDeadlineMs,
   cleanupCeilingMs:allocation.leaseDeadlineMs+25000}}:{})};
 const files=new Map([['profile.json',profileBytes],[PROTECTED_IDENTITY,Buffer.from(JSON.stringify({bootId:BOOT,instanceId:INSTANCE}))]]);
 const issued=new Map();
 const store={files,stat:()=>0o040700,read:n=>files.get(n)??null,
  write:(n,b)=>{if(!files.has(n))files.set(n,Buffer.from(b));return null;}};
 const writer={async readNativeReservation(){return {allocation,originalBinding:binding,
   observedInstance:{instanceId:INSTANCE,privateIp:PRIVATE_IP},ownerInstanceId:id(9),declaration:full,
   declarationSha256:canonicalSha256(full)};},
  async readBootstrapOperation({step}){return issued.get(step)??null;},
  async reserveBootstrapOperation({step,request}){if(!issued.has(step))issued.set(step,{step,dispatchId:`d-${step}`,
   requestSha256:canonicalSha256(request),request,state:'reserved',commandId:null,observation:null});
   return issued.get(step);},
  async claimBootstrapDispatch({step}){const op=issued.get(step);
   if(op?.state==='reserved'){op.state='dispatching';return {disposition:'send-once',operation:{...op}};}
   return {disposition:'reconcile',operation:{...op}};},
  async recordBootstrapCommand({step,commandId}){Object.assign(issued.get(step),{commandId});},
  async recordBootstrapObservation({step,observation}){Object.assign(issued.get(step),{observation,state:'succeeded'});}};
 const sdk={SendCommandCommand:class{constructor(input){this.input=input;}},
  GetCommandInvocationCommand:class{constructor(input){this.input=input;}}};
 let sends=0;
 const client={async send(command){
  const input=command.input??command;
  if(input.CommandId!==undefined){
   const row=JSON.parse(store.read('stdout/'+input.CommandId).toString('utf8'));
   return {CommandId:input.CommandId,InstanceId:input.InstanceId,DocumentName:row.documentName,
    DocumentVersion:row.documentVersion,PluginName:'nativeBootstrap',Status:'Success',StatusDetails:'Success',
    ResponseCode:0,StandardErrorContent:'',StandardOutputContent:row.stdout};
  }
  sends+=1;
  const encoded=input.Parameters.Payload[0],decoded=decodeNativeBootstrapPayload(encoded);
  const step=decoded.prepareOperationId===undefined?'prepare':'install';
  const identity={uid:0,euid:0,bootId:()=>BOOT};
  const result=step==='prepare'
   ?await prepareProtectedGuest({request:input,payload:encoded,store,identity,now:()=>Date.now()})
   :await installProtectedGuest({request:input,payload:encoded,store,identity,now:()=>Date.now()});
  const observation=result.observation??result;
  const awsId=id(40+sends);
  store.files.set('stdout/'+awsId,Buffer.from(JSON.stringify({documentName:input.DocumentName,
   documentVersion:input.DocumentVersion,stdout:bootstrapStdout(observation)})));
  return {Command:{CommandId:awsId}};
 }};
 return {native,control,writer,store,controlLeaf:controlServerCert,controlClientLeaf:controlClientCert,
  controlServerKey:controlServerCsr.keyPem,controlClientKey:controlClientCsr.keyPem,sends:()=>sends,
  transport:await createNativeBootstrapSsmTransport({client,sdk})};
}

test('DEFAULT JOIN: real prepare/install produce a complete validated default config',async t=>{
 const f=await fixture(t);
 const owner=await createNativeHostMaterialOwner({writer:f.writer,
  issuer:{issue:value=>f.native.issuer.issue(value)},transport:f.transport});
 const material=await owner.forHost({binding,generation:1,hostId:id(7),declaration:source,instanceId:INSTANCE,
  state:'created',privateIp:PRIVATE_IP});
 assert.equal(material.hostIdentity.bootId,BOOT);
 assert.deepEqual(Object.keys(material).sort(),['endpoint','hostCertificate','hostIdentity','leaseDeadlineMs',
  'ownerInstanceId','serverCertificate']);
 const config=installedRuntimeConfig({store:f.store,readFile:PROGRAM_READER});
 assert.equal(config.installed,true);
 assert.equal(config.hostIdentity.instanceId,INSTANCE);
 assert.equal(config.hostIdentity.bootId,BOOT);
 assert.equal(config.listen.address,PRIVATE_IP,'the listener binds its saved declared endpoint');
 assert.equal(config.tls.peerSan,CONTROL_CLIENT,'inbound peer is the Control CLIENT identity');
 assert.equal(config.tls.peerFingerprint,sha(Buffer.from(new X509Certificate(f.controlClientLeaf).raw)));
 assert.equal(config.control.serverFingerprintSha256,sha(Buffer.from(new X509Certificate(f.controlLeaf).raw)));
 assert.equal(config.paths.childSettings.runtimeUid,1000);
 assert.ok(config.paths.childSettings.credentialPaths.includes('/var/lib/meri/native-bootstrap/identity.json'));
});

test('C2 CLEANUP JOIN: protected install retains bounded server authentication after workload expiry',async t=>{
 const f=await fixture(t,{protectedCleanup:true});
 const owner=await createNativeHostMaterialOwner({writer:f.writer,issuer:f.native.issuer,transport:f.transport});
 t.after(async()=>{await owner.close();await f.transport.close?.();});
 const material=await owner.forHost({binding,generation:1,hostId:id(7),declaration:source,instanceId:INSTANCE,
  state:'created',privateIp:PRIVATE_IP});
 const config=installedRuntimeConfig({store:f.store,readFile:PROGRAM_READER});
 const server=new X509Certificate(material.serverCertificate),client=new X509Certificate(material.hostCertificate);
 const lease=allocation.leaseDeadlineMs,ceiling=lease+25000;
 assert.ok(Date.parse(server.validTo)>lease);
 assert.ok(Date.parse(server.validTo)<=ceiling);
 assert.ok(Date.parse(server.validTo)-Date.parse(server.validFrom)<=900000);
 assert.ok(Date.parse(client.validTo)<=lease,'host client/currentness credentials do not extend');
 assert.equal(config.allocation.leaseDeadlineMs,lease);
 assert.equal(config.tls.cleanupCeilingMs,ceiling);
 assert.ok(config.tls.peerNotAfterMs>ceiling,'Control certificate authentication retains its actual expiry');
 const installed=readInstalledTls({store:f.store});
 assert.equal(installed.observation.scope.cleanupCeilingMs,ceiling);
 let at=lease+1,peerExpiry=config.tls.peerNotAfterMs,quiesce=0;
 const handler=createLifecycleHandler({config:{...config,allocation:{...config.allocation,
  instanceId:config.hostIdentity.instanceId,bootId:config.hostIdentity.bootId}},now:()=>at,
  peerNotAfterMs:Math.min(config.tls.peerNotAfterMs,config.tls.cleanupCeilingMs),
  authenticate:async()=>({verified:true,notAfterMs:peerExpiry}),
  readBody:async()=>Buffer.from(JSON.stringify({schema:'meri-native-host-lifecycle/1',action:'close',
   allocation:config.allocation,binding:config.binding,hostIdentity:config.hostIdentity})),
  lifecycle:{close:async()=>{quiesce++;return {closed:true};},processes:async()=>{},observe:async()=>{}}});
 const invoke=async()=>{let status,body;
  const req=Object.assign(new EventEmitter(),{method:'POST',url:'/v1/native-processing/lifecycle',socket:{encrypted:true},complete:true});
  const res=Object.assign(new EventEmitter(),{writeHead(n){status=n;},end(bytes){body=JSON.parse(bytes);this.writableEnded=true;}});
  await handler(req,res);return {status,body};};
 assert.deepEqual(await invoke(),{status:200,body:{closed:true}});
 peerExpiry=at;
 assert.equal((await invoke()).status,408,'expired Control credential cannot authorize cleanup');
 peerExpiry=config.tls.peerNotAfterMs;at=ceiling;
 assert.equal((await invoke()).status,408,'the original cleanup ceiling cannot renew');
 assert.equal(quiesce,1);
});

test('DEFAULT JOIN: a verifying TLS client accepts only the pinned Control identity',async t=>{
 const f=await fixture(t);
 const server=createServer({key:f.controlServerKey,cert:f.controlLeaf,ca:f.control.pem,requestCert:true},
  (req,res)=>{res.writeHead(503);res.end('unavailable');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const pin=sha(Buffer.from(new X509Certificate(f.controlLeaf).raw));
 const exchange=()=>new Promise((resolve,reject)=>{
  const socket=connect({host:'127.0.0.1',port:server.address().port,ca:f.control.pem,servername:CONTROL_SERVER,
   rejectUnauthorized:true,key:f.controlClientKey,cert:f.controlClientLeaf},()=>{
   const peer=socket.getPeerCertificate();socket.end();
   resolve(sha(Buffer.from(peer.raw)));
  });
  socket.on('error',reject);
 });
 assert.equal(await exchange(),pin,'verified peer equals the pinned Control certificate');
 // A different root cannot be verified with the same pin/CA.
 const wrong=(()=>{try{return new X509Certificate(f.controlLeaf).fingerprint256;}catch{return null;}})();void wrong;
 const other=connect({host:'127.0.0.1',port:server.address().port,ca:f.native.pem,servername:CONTROL_SERVER,
  rejectUnauthorized:true,key:f.controlClientKey,cert:f.controlClientLeaf});
 await assert.rejects(()=>new Promise((resolve,reject)=>{other.on('secureConnect',resolve);other.on('error',reject);
  other.on('close',()=>reject(Error('closed')));}),'the native root cannot verify the Control server');
});

test('DEFAULT JOIN: actual client constructs from the installed native pair and hierarchy consumes the boot identity',async t=>{
 const f=await fixture(t);
 const owner=await createNativeHostMaterialOwner({writer:f.writer,
  issuer:{issue:value=>f.native.issuer.issue(value)},transport:f.transport});
 let client;let record;
 try{
  await owner.forHost({binding,generation:1,hostId:id(7),declaration:source,instanceId:INSTANCE,state:'created',privateIp:PRIVATE_IP});
  const config=installedRuntimeConfig({store:f.store,readFile:PROGRAM_READER}),installed=readInstalledTls({store:f.store});
  let requests=0;
  client=createHostCurrentnessClient({allocation:config.allocation,binding:config.binding,hostIdentity:config.hostIdentity,
   purpose:'native-processing',endpoint:config.control,
   tls:{key:installed.tls.clientKey,cert:installed.tls.clientCert,ca:installed.tls.controlCa},
   maxFreshMs:5000,timeoutMs:1000,httpsModule:{request(){requests+=1;throw Error('no network');}}});
  assert.ok(client);
  assert.equal(requests,0,'the canonical client constructs from the installed native CLIENT pair without a socket');
  const port=makeInertHierarchyPort({boot:BOOT});
  record=await prepareHostHierarchy({config,port,supervisorPid:1234});
  assert.ok(record,'actual hierarchy startup uses config.hostIdentity.bootId');
 }finally{
  if(record)await releaseOwnedHierarchy({record,port:makeInertHierarchyPort({boot:BOOT})});
  await client?.close?.();await owner.close?.();await f.transport.close?.();
 }
});

/** FINITE95 CONNECTED: the actual canonical path — guest prepare -> real signer -> guest install -> material owner over the
 *  canonical writer claim shape and real SSM transport -> shared observation validation -> installed dualTLS bundle read back by
 *  the DEFAULT reader. Only the SSM network, the writer's persistence and the guest filesystem are inert.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {X509Certificate} from 'node:crypto';
import {decodeNativeBootstrapPayload,assertNativeBootstrapSpec} from '@capiro/meri-contracts/native-bootstrap';
import {canonicalSha256} from '@capiro/meri-contracts/node';
import {prepareProtectedGuest,installProtectedGuest,bootstrapStdout,readInstalledTls} from './protected-bootstrap.mjs';
import {createNativeHostMaterialOwner} from '../native-authority/native-host-material.mjs';
import {createNativeBootstrapSsmTransport} from '../native-authority/native-host-bootstrap-ssm.mjs';
import {createNativeHostCertificateIssuerFromMaterial} from '../native-authority/native-host-certificate-issuer.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const BOOT=id(8),INSTANCE='i-0123456789abcdef0',PRIVATE_IP='10.0.0.11';
const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:id(1),conversationId:id(3),hostId:id(7),
 generation:1,hostMode:'native-processing',imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+600000};
const source={imageDigest:allocation.imageDigest,sourceCommit:'f'.repeat(40),bootstrapSha256:'a'.repeat(64)};
let spec;

function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'meri-connected95-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'ca.key'),'-out',join(dir,'ca.pem'),
  '-days','2','-subj','/CN=connected95-ca'],{stdio:'ignore'});
 const caPem=new X509Certificate(readFileSync(join(dir,'ca.pem'),'utf8')).toString(),keyPem=readFileSync(join(dir,'ca.key'));
 spec=assertNativeBootstrapSpec({schema:'meri-native-bootstrap-spec/1',
  document:{name:'meri-bootstrap',version:'1',sha256:'b'.repeat(64),pluginName:'nativeBootstrap'},
  programSha256:'c'.repeat(64),profileSha256:'d'.repeat(64),hostEndpoint:{port:9443,serverName:'native-host.example'},
  control:{endpoint:{address:'10.0.0.1',port:8443,serverName:'control.example'},clientName:'control.meri.internal',
   serverCertificate:caPem,clientCertificate:caPem,caCertificate:caPem,policySha256:'e'.repeat(64)},issuerCaCertificate:caPem});
 return {dir,caPem,issuer:createNativeHostCertificateIssuerFromMaterial({caPem:Buffer.from(caPem),keyPem})};
}

const fullDeclaration=()=>({schema:'meri-native-provisioning-declaration/1',...source,accountId:'111122223333',
 region:'us-east-1',bootstrapSpec:spec,leaseDeadlineMs:allocation.leaseDeadlineMs});

function guestStore(){const files=new Map();
 return {files,stat:()=>0o040700,read:n=>files.get(n)??null,write:(n,b)=>{if(!files.has(n))files.set(n,Buffer.from(b));return null;}};}

function writerFixture(){
 const ops=new Map(),calls={sendCommand:0,claim:0},key=(h,g,s)=>`${h}/${g}/${s}`;
 return {ops,calls,
  async readNativeReservation(){const d=fullDeclaration();return {allocation,originalBinding:binding,
   observedInstance:{instanceId:INSTANCE,privateIp:PRIVATE_IP},ownerInstanceId:id(9),declaration:d,
   declarationSha256:canonicalSha256(d)};},
  async readBootstrapOperation({hostId,generation,step}){return ops.get(key(hostId,generation,step))??null;},
  async reserveBootstrapOperation({hostId,generation,step,request}){
   const k=key(hostId,generation,step);
   if(!ops.has(k))ops.set(k,{step,dispatchId:`dispatch-${step}`,requestSha256:canonicalSha256(request),request,
    state:'reserved',commandId:null,observation:null});
   return ops.get(k);},
  async claimBootstrapDispatch({hostId,generation,step}){
   calls.claim+=1;const op=ops.get(key(hostId,generation,step));
   if(op?.state==='reserved'){op.state='dispatching';return {disposition:'send-once',operation:{...op}};}
   return {disposition:'reconcile',operation:{...op}};},
  async recordBootstrapCommand({hostId,generation,step,commandId}){Object.assign(ops.get(key(hostId,generation,step)),{commandId});},
  async recordBootstrapObservation({hostId,generation,step,observation}){
   Object.assign(ops.get(key(hostId,generation,step)),{observation,state:'succeeded'});}};
}

function ssmFixture({store,identity,writer,caPem}){
 const sdk={SendCommandCommand:class{constructor(input){this.input=input;}},
  GetCommandInvocationCommand:class{constructor(input){this.input=input;}}};
 const client={async send(command){
  const input=command.input??command;
  if(input.CommandId!==undefined){
   const row=writer.ops.get(`stdout/${input.CommandId}`);
   return {CommandId:input.CommandId,InstanceId:input.InstanceId,DocumentName:row.documentName,
    DocumentVersion:row.documentVersion,PluginName:'nativeBootstrap',Status:'Success',StatusDetails:'Success',
    ResponseCode:0,StandardErrorContent:'',StandardOutputContent:row.stdout};
  }
  writer.calls.sendCommand+=1;
  const encoded=input.Parameters.Payload[0],decoded=decodeNativeBootstrapPayload(encoded);
  const step=decoded.prepareOperationId===undefined?'prepare':'install';
  const result=step==='prepare'
   ?await prepareProtectedGuest({request:input,payload:encoded,store,identity,now:()=>Date.now()})
   :await installProtectedGuest({request:input,payload:encoded,store,identity,now:()=>Date.now()});
  const observation=result.observation??result;
  const awsId=`11111111-2222-3333-4444-${String(writer.calls.sendCommand).padStart(12,'0')}`;
  writer.ops.set(`stdout/${awsId}`,{documentName:input.DocumentName,documentVersion:input.DocumentVersion,
   stdout:bootstrapStdout(observation)});
  return {Command:{CommandId:awsId}};
 }};
 return createNativeBootstrapSsmTransport({client,sdk});
}

test('CONNECTED: canonical path returns the six fields and the DEFAULT reader sees distinct installed identities',async t=>{
 const f=fixture(t),store=guestStore(),writer=writerFixture(),identity={uid:0,euid:0,bootId:()=>BOOT};
 const transport=await ssmFixture({store,identity,writer,caPem:f.caPem});
 const owner=await createNativeHostMaterialOwner({writer,issuer:f.issuer,transport});
 const material=await owner.forHost({binding,generation:1,hostId:id(7),declaration:source,instanceId:INSTANCE,
  state:'created',privateIp:PRIVATE_IP});
 assert.deepEqual(Object.keys(material).sort(),['endpoint','hostCertificate','hostIdentity','leaseDeadlineMs',
  'ownerInstanceId','serverCertificate']);
 assert.equal(material.hostIdentity.bootId,BOOT);
 assert.equal(material.ownerInstanceId,id(9));
 assert.equal(material.leaseDeadlineMs,allocation.leaseDeadlineMs);
 assert.equal(writer.calls.sendCommand,2,'exactly one SendCommand per step');
 const host=new X509Certificate(material.hostCertificate),server=new X509Certificate(material.serverCertificate),
  ca=new X509Certificate(f.caPem);
 assert.equal(host.subjectAltName,`DNS:h-${id(7).replace(/-/gu,'')}-g1.host.meri.internal`);
 assert.equal(server.subjectAltName,'DNS:native-host.example');
 assert.deepEqual(host.keyUsage,['1.3.6.1.5.5.7.3.2']);
 assert.deepEqual(server.keyUsage,['1.3.6.1.5.5.7.3.1']);
 assert.equal(host.checkIssued(ca),true);
 assert.equal(server.checkIssued(ca),true);
 // The DEFAULT reader consumes exactly the installed protected bundle (no fabricated config inspection).
 const installed=readInstalledTls({store});
 assert.equal(new X509Certificate(installed.tls.clientCert).subjectAltName,host.subjectAltName);
 assert.equal(new X509Certificate(installed.tls.serverCert).subjectAltName,server.subjectAltName);
 assert.notEqual(new X509Certificate(installed.tls.clientCert).fingerprint256,
  new X509Certificate(installed.tls.serverCert).fingerprint256);
 assert.ok(!JSON.stringify(material).includes('PRIVATE KEY'));
 assert.ok(!JSON.stringify(installed.observation).includes('PRIVATE KEY'));
});

test('CONNECTED: a fully succeeded operation is recovered without a second send or a new certificate',async t=>{
 const f=fixture(t),store=guestStore(),writer=writerFixture(),identity={uid:0,euid:0,bootId:()=>BOOT};
 const transport=await ssmFixture({store,identity,writer,caPem:f.caPem});
 const owner=await createNativeHostMaterialOwner({writer,issuer:f.issuer,transport});
 const first=await owner.forHost({binding,generation:1,hostId:id(7),declaration:source,instanceId:INSTANCE,
  state:'created',privateIp:PRIVATE_IP});
 const sendsAfterFirst=writer.calls.sendCommand;
 const fresh=await createNativeHostMaterialOwner({writer,issuer:{issue:async()=>{throw Error('must not reissue');}},transport});
 const recovered=await fresh.forHost({binding,generation:1,hostId:id(7),declaration:source,instanceId:INSTANCE,
  state:'existing',privateIp:PRIVATE_IP});
 assert.equal(writer.calls.sendCommand,sendsAfterFirst,'recovery never sends');
 assert.equal(recovered.hostCertificate,first.hostCertificate);
 assert.equal(recovered.serverCertificate,first.serverCertificate);
 assert.equal(recovered.hostIdentity.bootId,first.hostIdentity.bootId);
});

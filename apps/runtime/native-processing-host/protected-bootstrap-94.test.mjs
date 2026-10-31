/** FINITE95 refusals: exact prepare replay, partial/foreign state, reboot, instance/source/lease mismatch with zero sends. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {X509Certificate} from 'node:crypto';
import {assertNativeBootstrapSpec,createNativeBootstrapRequest,nativeBootstrapOperationId} from
 '@capiro/meri-contracts/native-bootstrap';
import {canonicalSha256} from '@capiro/meri-contracts/node';
import {prepareProtectedGuest} from './protected-bootstrap.mjs';
import {createNativeHostCertificateIssuerFromMaterial} from '../native-authority/native-host-certificate-issuer.mjs';
import {createNativeHostMaterialOwner} from '../native-authority/native-host-material.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const BOOT=id(8),INSTANCE='i-0123456789abcdef0',PRIVATE_IP='10.0.0.11';
const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:id(1),conversationId:id(3),hostId:id(7),
 generation:1,hostMode:'native-processing',imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+600000};
const source={imageDigest:allocation.imageDigest,sourceCommit:'f'.repeat(40),bootstrapSha256:'a'.repeat(64)};

function pki(){
 const dir=mkdtempSync(join(tmpdir(),'meri-refuse95-'));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'ca.key'),'-out',join(dir,'ca.pem'),
  '-days','2','-subj','/CN=refuse95'],{stdio:'ignore'});
 return {dir,caPem:new X509Certificate(readFileSync(join(dir,'ca.pem'),'utf8')).toString(),keyPem:readFileSync(join(dir,'ca.key'))};
}
function specFor(caPem){return assertNativeBootstrapSpec({schema:'meri-native-bootstrap-spec/1',
 document:{name:'meri-bootstrap',version:'1',sha256:'b'.repeat(64),pluginName:'nativeBootstrap'},
 programSha256:'c'.repeat(64),profileSha256:'d'.repeat(64),hostEndpoint:{port:9443,serverName:'native-host.example'},
 control:{endpoint:{address:'10.0.0.1',port:8443,serverName:'control.example'},clientName:'control.meri.internal',
  serverCertificate:caPem,clientCertificate:caPem,caCertificate:caPem,policySha256:'e'.repeat(64)},issuerCaCertificate:caPem});}
function guestStore(){const files=new Map();
 return {files,stat:()=>0o040700,read:n=>files.get(n)??null,write:(n,b)=>{if(!files.has(n))files.set(n,Buffer.from(b));return null;}};}
function makeRequest(caPem){
 const spec=specFor(caPem),declaration={schema:'meri-native-provisioning-declaration/1',...source,bootstrapSpec:spec};
 return createNativeBootstrapRequest({schema:'meri-native-bootstrap-prepare-request/1',
  operationId:nativeBootstrapOperationId({hostId:id(7),generation:1,step:'prepare'}),
  scope:{allocation,originalBinding:binding,ownerInstanceId:id(9),instanceId:INSTANCE,
   endpoint:{address:PRIVATE_IP,port:9443,serverName:'native-host.example'},source,
   declarationSha256:canonicalSha256(declaration),bootstrapSpecSha256:canonicalSha256(spec)},
  bootstrapSpec:spec});
}

test('REFUSALS: exact prepare replay is immutable; partial or foreign retained state refuses',async t=>{
 const f=pki();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
 const store=guestStore(),identity={uid:0,euid:0,bootId:()=>BOOT};
 const request=makeRequest(f.caPem),payload=request.Parameters.Payload[0];
 const first=await prepareProtectedGuest({request,payload,store,identity,now:()=>Date.now()});
 assert.deepEqual(await prepareProtectedGuest({request,payload,store,identity,now:()=>Date.now()+1000}),first);
 const saved=JSON.parse(store.read('prepare.json').toString('utf8'));
 store.files.set('prepare.json',Buffer.from(JSON.stringify({...saved,hostKeyPem:undefined})));
 await assert.rejects(()=>prepareProtectedGuest({request,payload,store,identity,now:()=>Date.now()}));
 store.files.set('prepare.json',Buffer.from(JSON.stringify({...saved,observation:{...first,operationId:'0'.repeat(64)}})));
 await assert.rejects(()=>prepareProtectedGuest({request,payload,store,identity,now:()=>Date.now()}));
 store.files.set('prepare.json',Buffer.from(JSON.stringify(saved)));
 await assert.rejects(()=>prepareProtectedGuest({request,payload,store,
  identity:{uid:0,euid:0,bootId:()=>id(12)},now:()=>Date.now()}),'reboot refuses the retained state');
});

test('REFUSALS: instance/source/lease mismatch and a reconcile claim refuse with ZERO sends',async t=>{
 const f=pki();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
 const spec=specFor(f.caPem);
 const full={schema:'meri-native-provisioning-declaration/1',...source,bootstrapSpec:spec};
 const reservation={allocation,originalBinding:binding,observedInstance:{instanceId:INSTANCE,privateIp:PRIVATE_IP},
  ownerInstanceId:id(9),declaration:full,declarationSha256:canonicalSha256(full)};
 const calls={send:0};
 const writer={async readNativeReservation(){return reservation;},async readBootstrapOperation(){return null;},
  async reserveBootstrapOperation({step,request}){return {step,dispatchId:`d-${step}`,requestSha256:canonicalSha256(request),request,state:'reserved'};},
  async claimBootstrapDispatch(){return {disposition:'reconcile',operation:{state:'unknown'}};},
  async recordBootstrapCommand(){},async recordBootstrapObservation(){}};
 const transport={async sendOnce(){calls.send+=1;throw Error('must not send');},async observe(){throw Error('no custody');}};
 const issue=()=>createNativeHostCertificateIssuerFromMaterial({caPem:Buffer.from(f.caPem),keyPem:f.keyPem});
 const owner=await createNativeHostMaterialOwner({writer,issuer:issue(),transport});
 const base={binding,generation:1,hostId:id(7),declaration:source,instanceId:INSTANCE,state:'created',privateIp:PRIVATE_IP};
 await assert.rejects(()=>owner.forHost({...base,instanceId:'i-00000000000000000'}),e=>e.code==='NATIVE_HOST_RESERVATION_REFUSED');
 await assert.rejects(()=>owner.forHost({...base,declaration:{...source,sourceCommit:'e'.repeat(40)}}),
  e=>e.code==='NATIVE_HOST_RESERVATION_REFUSED');
 await assert.rejects(()=>owner.forHost({...base,declaration:{...source,bootstrapSpec:spec}}),e=>e.code==='NATIVE_HOST_MATERIAL_REFUSED');
 const expiredOwner=await createNativeHostMaterialOwner({writer:{...writer,
  async readNativeReservation(){return {...reservation,allocation:{...allocation,leaseDeadlineMs:Date.now()-1}};}},
  issuer:issue(),transport});
 await assert.rejects(()=>expiredOwner.forHost(base),e=>e.code==='NATIVE_HOST_MATERIAL_CANCELLED');
 const reconcileOwner=await createNativeHostMaterialOwner({writer,issuer:issue(),transport});
 await assert.rejects(()=>reconcileOwner.forHost(base),e=>e.code==='NATIVE_HOST_MATERIAL_UNKNOWN');
 assert.equal(calls.send,0,'no SSM send for refused or reconciled steps');
});

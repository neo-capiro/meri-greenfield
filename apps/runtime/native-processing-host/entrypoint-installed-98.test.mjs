/** FINITE98: the ACTUAL default entrypoint starts from the validated installed configuration and composes the real native
 *  currentness client + real TLS listener identity. Only low-level OS/network/hierarchy effects are inert. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,X509Certificate} from 'node:crypto';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {decodeNativeBootstrapPayload,assertNativeBootstrapSpec,nativeBootstrapOperationId} from
 '@capiro/meri-contracts/native-bootstrap';
import {canonicalSha256} from '@capiro/meri-contracts/node';
import {prepareProtectedGuest,installProtectedGuest,bootstrapStdout,installedRuntimeConfig,PROTECTED_IDENTITY}
 from './protected-bootstrap.mjs';
import {startNativeProcessingHost} from './entrypoint.mjs';
import {makeInertHierarchyPort} from './test-hierarchy-port.mjs';
import {createNativeHostMaterialOwner} from '../native-authority/native-host-material.mjs';
import {createNativeBootstrapSsmTransport} from '../native-authority/native-host-bootstrap-ssm.mjs';
import {createNativeHostCertificateIssuerFromMaterial} from '../native-authority/native-host-certificate-issuer.mjs';
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

function pki(t,prefix){
 const dir=mkdtempSync(join(tmpdir(),prefix));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'ca.key'),'-out',join(dir,'ca.pem'),
  '-days','2','-subj',`/CN=${prefix}`],{stdio:'ignore'});
 const pem=new X509Certificate(readFileSync(join(dir,'ca.pem'),'utf8')).toString();
 return {pem,issuer:createNativeHostCertificateIssuerFromMaterial({caPem:Buffer.from(pem),keyPem:readFileSync(join(dir,'ca.key'))})};
}

async function fixture(t){
 const native=pki(t,'meri-native98-'),control=pki(t,'meri-control98-');
 const controlServerCsr=createRunner(),controlClientCsr=createRunner();
 const lease=allocation.leaseDeadlineMs;
 const controlServerCert=(await control.issuer.issue({kind:'server',san:CONTROL_SERVER,csrPem:controlServerCsr.csrPem,
  notAfterMs:lease,leaseDeadlineMs:lease})).certPem;
 const controlClientCert=(await control.issuer.issue({kind:'client',san:CONTROL_CLIENT,csrPem:controlClientCsr.csrPem,
  notAfterMs:lease,leaseDeadlineMs:lease})).certPem;
 const spec=assertNativeBootstrapSpec({schema:'meri-native-bootstrap-spec/1',
  document:{name:'meri-bootstrap',version:'1',sha256:'d'.repeat(64),pluginName:'nativeBootstrap'},
  programSha256:JSON.parse(profileBytes).programSha256,profileSha256:sha(profileBytes),
  hostEndpoint:{port:9443,serverName:SERVER_NAME},
  control:{endpoint:{address:'10.0.0.1',port:8443,serverName:CONTROL_SERVER},clientName:CONTROL_CLIENT,
   serverCertificate:controlServerCert,clientCertificate:controlClientCert,caCertificate:control.pem,policySha256:'e'.repeat(64)},
  issuerCaCertificate:native.pem});
 const full={schema:'meri-native-provisioning-declaration/1',...source,bootstrapSpec:spec};
 const files=new Map([['profile.json',profileBytes],[PROTECTED_IDENTITY,Buffer.from(JSON.stringify({bootId:BOOT,instanceId:INSTANCE}))]]);
 const store={files,stat:()=>0o040700,read:n=>files.get(n)??null,
  write:(n,b)=>{if(!files.has(n))files.set(n,Buffer.from(b));return null;}};
 const ops=new Map();
 const writer={async readNativeReservation(){return {allocation,originalBinding:binding,
   observedInstance:{instanceId:INSTANCE,privateIp:PRIVATE_IP},ownerInstanceId:id(9),declaration:full,
   declarationSha256:canonicalSha256(full)};},
  async readBootstrapOperation({step}){return ops.get(step)??null;},
  async reserveBootstrapOperation({step,request}){if(!ops.has(step))ops.set(step,{step,dispatchId:`d-${step}`,
   requestSha256:canonicalSha256(request),request,state:'reserved',commandId:null,observation:null});return ops.get(step);},
  async claimBootstrapDispatch({step}){const op=ops.get(step);
   if(op?.state==='reserved'){op.state='dispatching';return {disposition:'send-once',operation:{...op}};}
   return {disposition:'reconcile',operation:{...op}};},
  async recordBootstrapCommand({step,commandId}){Object.assign(ops.get(step),{commandId});},
  async recordBootstrapObservation({step,observation}){Object.assign(ops.get(step),{observation,state:'succeeded'});}};
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
 const transport=await createNativeBootstrapSsmTransport({client,sdk});
 return {native,control,writer,store,lease,controlClientCert,transport,
  fingerprint:pem=>sha(Buffer.from(new X509Certificate(pem).raw))};
}

test('DEFAULT ENTRYPOINT: starts from the validated installed config and composes the real currentness client',async t=>{
 const f=await fixture(t);
 const owner=await createNativeHostMaterialOwner({writer:f.writer,
  issuer:{issue:value=>f.native.issuer.issue(value)},transport:f.transport});
 t.after(async()=>{await owner.close?.();await f.transport.close?.();});
 await owner.forHost({binding,generation:1,hostId:id(7),declaration:source,instanceId:INSTANCE,state:'created',privateIp:PRIVATE_IP});
 const config=installedRuntimeConfig({store:f.store,readFile:PROGRAM_READER});
 const lifecyclePorts={async readBootId(){return BOOT;},
  async openGroup(){return {async readEvents(){return 'populated 0\nfrozen 0\n';},async close(){}};}};
 let listenerHandler=null,listened=null;
 const started=await startNativeProcessingHost({config,
  hierarchyPort:makeInertHierarchyPort({boot:BOOT}),lifecyclePorts,
  lifecycleLstat:()=>{const error=Error('ENOENT');error.code='ENOENT';throw error;},
  readFile:()=>{throw Error('environment TLS must not be used for an installed host');},
  definitionsRun:async()=>({stdout:Buffer.alloc(0),receipt:{exitCode:0,leaderClosed:true,groupAbsent:true,settlement:'closed'}}),
  authenticatePeer:async()=>({verified:true,notAfterMs:f.lease,fingerprintSha256:f.fingerprint(f.controlClientCert)}),
  serverFactory:(options,handler)=>{listenerHandler=handler;return {once(){},listen(port,address,callback){listened={port,address};callback();},
   close(callback){callback?.();}};},
  openHost:async()=>{throw Error('no inspection is expected during startup');}});
 assert.equal(started.started,true,'the installed configuration starts the actual host');
 assert.ok(started.lifecycle,'the real lifecycle producer is mounted');
 assert.deepEqual(listened,{port:config.listen.port,address:config.listen.address});
 assert.equal(typeof started.close,'function');
 const request=Object.assign(Readable.from([Buffer.from(JSON.stringify({schema:'meri-native-host-lifecycle/1',action:'close',
  allocation:config.allocation,binding:config.binding,hostIdentity:config.hostIdentity}))]),
 {method:'POST',url:'/v1/native-processing/lifecycle',socket:{encrypted:true},complete:true});
 let status,body;
 const response=Object.assign(new EventEmitter(),{writeHead(n){status=n;},end(bytes){body=JSON.parse(bytes);this.writableEnded=true;}});
 await listenerHandler(request,response);
 assert.equal(status,200,'the mounted route joins the separately installed physical identity');
 assert.equal(body.status,'closed');
 const closed=await started.close({deadlineMs:Date.now()+5000});
 assert.equal(typeof closed,'object');
});

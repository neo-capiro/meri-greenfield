/** FINITE95: restored 93 intentions in canonical form — fixed document shape/refusals, bounded stdout, and the transport's
 *  lost-ACK / null-CommandId / early-absence dispositions against the shared public request. */
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
import {createNativeBootstrapDocument,assertNativeBootstrapDocument,assertNativeBootstrapStdout,
 NATIVE_BOOTSTRAP_PROGRAM} from './bootstrap-document.mjs';
import {createNativeBootstrapSsmTransport} from '../native-authority/native-host-bootstrap-ssm.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sdk={SendCommandCommand:class{constructor(input){this.input=input;}},
 GetCommandInvocationCommand:class{constructor(input){this.input=input;}}};

function pki(t){
 const dir=mkdtempSync(join(tmpdir(),'meri-doc95-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'ca.key'),'-out',join(dir,'ca.pem'),
  '-days','2','-subj','/CN=doc95'],{stdio:'ignore'});
 return new X509Certificate(readFileSync(join(dir,'ca.pem'),'utf8')).toString();
}

function requestFor(caPem){
 const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:id(1),conversationId:id(3),hostId:id(7),
  generation:1,hostMode:'native-processing',imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+600000};
 const spec=assertNativeBootstrapSpec({schema:'meri-native-bootstrap-spec/1',
  document:{name:'meri-bootstrap',version:'1',sha256:'b'.repeat(64),pluginName:'nativeBootstrap'},
  programSha256:'c'.repeat(64),profileSha256:'d'.repeat(64),hostEndpoint:{port:9443,serverName:'native-host.example'},
  control:{endpoint:{address:'10.0.0.1',port:8443,serverName:'control.example'},clientName:'control.meri.internal',
   serverCertificate:caPem,clientCertificate:caPem,caCertificate:caPem,policySha256:'e'.repeat(64)},issuerCaCertificate:caPem});
 const declaration={schema:'meri-native-provisioning-declaration/1',imageDigest:allocation.imageDigest,
  sourceCommit:'f'.repeat(40),bootstrapSha256:'a'.repeat(64),bootstrapSpec:spec};
 return createNativeBootstrapRequest({schema:'meri-native-bootstrap-prepare-request/1',
  operationId:nativeBootstrapOperationId({hostId:id(7),generation:1,step:'prepare'}),
  scope:{allocation,originalBinding:binding,ownerInstanceId:id(9),instanceId:'i-0123456789abcdef0',
   endpoint:{address:'10.0.0.11',port:9443,serverName:'native-host.example'},
   source:{imageDigest:allocation.imageDigest,sourceCommit:'f'.repeat(40),bootstrapSha256:'a'.repeat(64)},
   declarationSha256:canonicalSha256(declaration),bootstrapSpecSha256:canonicalSha256(spec)},bootstrapSpec:spec});
}

test('DOCUMENT: the fixed schema-2.2 nativeBootstrap document is produced and validated',()=>{
 const document=createNativeBootstrapDocument();
 assert.equal(assertNativeBootstrapDocument(document).program,NATIVE_BOOTSTRAP_PROGRAM);
 assert.equal(document.parameters.Payload.interpolationType,'ENV_VAR');
});

test('DOCUMENT: extra steps, extra parameters and payload interpolation are refused',()=>{
 const base=createNativeBootstrapDocument();
 assert.throws(()=>assertNativeBootstrapDocument({...base,mainSteps:[...base.mainSteps,base.mainSteps[0]]}),
  e=>e.code==='NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 assert.throws(()=>assertNativeBootstrapDocument({...base,parameters:{...base.parameters,Other:{type:'String'}}}),
  e=>e.code==='NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 assert.throws(()=>assertNativeBootstrapDocument({...base,mainSteps:[{...base.mainSteps[0],
  inputs:{...base.mainSteps[0].inputs,runCommand:['echo {{Payload}}']}}]}),e=>e.code==='NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
});

test('STDOUT: exactly one final LF inside the 20000-byte bound',()=>{
 assert.equal(assertNativeBootstrapStdout('{"a":1}\n'),'{"a":1}');
 assert.throws(()=>assertNativeBootstrapStdout('{"a":1}'),e=>e.code==='NATIVE_BOOTSTRAP_STDOUT_REFUSED');
 assert.throws(()=>assertNativeBootstrapStdout('a\nb\n'),e=>e.code==='NATIVE_BOOTSTRAP_STDOUT_REFUSED');
 assert.throws(()=>assertNativeBootstrapStdout(`${'x'.repeat(20000)}\n`),e=>e.code==='NATIVE_BOOTSTRAP_STDOUT_REFUSED');
});

test('TRANSPORT: lost ACK, null CommandId and early absence are UNKNOWN with exactly one send',async t=>{
 const request=requestFor(pki(t));
 const lost={calls:[],async send(command){this.calls.push(command);throw Error('network');}};
 const lostTransport=await createNativeBootstrapSsmTransport({client:lost,sdk});
 await assert.rejects(()=>lostTransport.sendOnce(request),e=>e.code==='NATIVE_BOOTSTRAP_UNKNOWN');
 assert.equal(lost.calls.length,1,'a lost ACK never retries');
 const empty={calls:[],async send(command){this.calls.push(command);return {Command:{}};}};
 const emptyTransport=await createNativeBootstrapSsmTransport({client:empty,sdk});
 await assert.rejects(()=>emptyTransport.sendOnce(request),e=>e.code==='NATIVE_BOOTSTRAP_UNKNOWN');
 assert.equal(empty.calls.length,1,'a null CommandId never retries');
 const absent={calls:[],async send(command){this.calls.push(command);
  throw Object.assign(Error('absent'),{name:'InvocationDoesNotExist'});}};
 const absentTransport=await createNativeBootstrapSsmTransport({client:absent,sdk});
 await assert.rejects(()=>absentTransport.observe({commandId:id(10),instanceId:request.InstanceIds[0],request}),
  e=>e.code==='NATIVE_BOOTSTRAP_UNKNOWN');
 assert.equal(absent.calls.length,1,'early absence is reconcile-only, never a resend');
});

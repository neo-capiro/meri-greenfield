/** Connected host tests over the REAL inspection/request/result validators; only native/TLS/fs effects are substituted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectFixed,childSettings} from './child-cli.mjs';
import {nativeInspectionBody,createInspectionHandler,NATIVE_INSPECTION_SCHEMA,NATIVE_INSPECTION_PATH} from './service.mjs';
import {childInvocation,assertHostMatch,openNativeProcessingHost} from './bootstrap.mjs';
import {uploadInspectionBody} from '../uploads/agentcore-contract.mjs';
import {createUploadInspection} from '../../control/uploads/extraction.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const BYTES=Buffer.from('# fixed inspection content\n');
const DECLARATION=Object.freeze({filename:'note.md',mimeType:'text/markdown',bytes:BYTES.length,sha256:sha(BYTES)});
const IMAGE=`sha256:${'b'.repeat(64)}`;
const REQUEST=Object.freeze({kind:'upload-inspection',requestId:'a'.repeat(64),imageDigest:IMAGE,
 declaration:DECLARATION,bytesBase64:BYTES.toString('base64'),inputSha256:sha(BYTES),deadlineMs:Date.now()+5000});
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const HOST_ID=uuid(7),CONV=uuid(3),TENANT=uuid(1);
const ALLOCATION=Object.freeze({schema:'meri-conversation-host-allocation/1',tenantId:TENANT,conversationId:CONV,
 generation:3,hostId:HOST_ID,imageDigest:IMAGE,leaseDeadlineMs:Date.now()+600000});
const BINDING=Object.freeze({tenantId:TENANT,actorId:uuid(2),conversationId:CONV,runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),writerFence:1});
const IDENTITY=Object.freeze({schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef0',bootId:uuid(8),conversationId:CONV,hostId:HOST_ID});
const LIMITS=Object.freeze({cpuQuotaUs:50000,periodUs:100000,memoryBytes:268435456,pidsMax:16,deadlineMaxMs:30000,bodyBytes:1100000});
const CHILD_SETTINGS=Object.freeze({runtimeUid:1000,runtimeGid:1000,imageDigest:IMAGE,
 definitionsRoot:'/run/meri/upload-definitions',extractorPath:'/opt/meri/extract.py',scratchRoot:'/run/meri/upload-scratch',
 credentialPaths:['/proc/1/environ']});
const CONFIG=Object.freeze({image:{digest:IMAGE},allocation:{hostId:HOST_ID,generation:3,conversationId:CONV},
 limits:LIMITS,paths:{nodePath:'/usr/local/bin/node',childPath:'/opt/meri/child-cli.mjs',helperPath:'/usr/lib/meri/meri-host-launcher',
  home:'/run/meri/processing',runtimeUid:1000,runtimeGid:1000,childSettings:CHILD_SETTINGS}});

/** Real receipt shapes required by extraction.mjs. */
const scanReceipt=(file,status='clean',reason=null)=>({sourceSha256:file.sha256,sourceBytes:file.bytes,
 checkedAtMs:Date.now(),status,...(status==='unavailable'?{tool:null,definitionsSha256:null}:
 {tool:{name:'clamav',version:'1.4.2',binarySha256:'a'.repeat(64)},definitionsSha256:'b'.repeat(64)}),reason});
const extractReceipt=file=>({sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:Date.now(),status:'available',
 tool:{name:'meri-upload-extractor',version:'3.13.16',binarySha256:'c'.repeat(64)},segments:[],limitations:[]});

function resultBody(status='clean'){
 const inspection=createUploadInspection({now:Date.now,
  scanner:{async scan({file}){return scanReceipt(file,status,status==='clean'?null:status==='infected'?'MALWARE_DETECTED':'SCANNER_UNAVAILABLE');}},
  extractor:{async extract({file}){return extractReceipt(file);}}});
 return inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+2000}).then(value=>
  uploadInspectionBody({requestId:REQUEST.requestId,imageDigest:IMAGE,value}));
}

function ports({peer=true,custody=true,own=true,cleanup={closed:true},dispatch=null}={}) {
  const calls=[];
  const handler=createInspectionHandler({
    authenticate:async()=>{calls.push('authenticate');return {verified:peer};},
    verifyCustody:async()=>{calls.push('custody');return {authorized:custody,allocation:ALLOCATION,binding:BINDING,
      hostIdentity:IDENTITY,currentness:{readCurrent:async()=>({})}};},
    openHost:async()=>{calls.push('open');return {runRequest:async({requestDocument})=>{
      calls.push('dispatch');
      const body=dispatch===null?await resultBody():dispatch;
      return {stdout:Buffer.from(JSON.stringify(body))};},
      close:async()=>{calls.push('close');return cleanup;}};},
    readBody:async()=>Buffer.from(JSON.stringify({schema:NATIVE_INSPECTION_SCHEMA,allocation:ALLOCATION,
      hostIdentity:IDENTITY,binding:BINDING,custody:{uploadId:uuid(9)},request:REQUEST})),
    limits:{deadlineMaxMs:30000,bodyBytes:1100000}});
  return {handler,calls};
}
const req=(o={})=>({method:'POST',url:NATIVE_INSPECTION_PATH,socket:{encrypted:true},headers:{},once(){},removeListener(){},...o});
const res=()=>{const r={status:0,body:''};r.writeHead=s=>{r.status=s;};r.end=b=>{r.body=b;};return r;};

test('every refusal throws: route, TLS, peer, absent verifier and denied custody never dispatch', async () => {
  const cases=[];
  const route=ports(); cases.push([route,req({url:'/other'}),404]);
  const tls=ports(); cases.push([tls,req({socket:{encrypted:false}}),403]);
  const peer=ports({peer:false}); cases.push([peer,req(),403]);
  const custody=ports({custody:false}); cases.push([custody,req(),400]);
  for(const [p,r,status] of cases){const out=res();await p.handler(r,out);assert.equal(out.status,status);
   assert.equal(p.calls.filter(c=>c==='dispatch').length,0,'no dispatch after a refusal');}
  const noVerifier=createInspectionHandler({authenticate:async()=>({verified:true}),openHost:async()=>{throw Error('x');},
   readBody:async()=>Buffer.from('{}'),limits:{deadlineMaxMs:1000,bodyBytes:1024}});
  const out=res(); await noVerifier(req(),out);
  assert.equal(out.status,503);
  assert.deepEqual(JSON.parse(out.body),{error:'NATIVE_INSPECTION_CUSTODY_UNBOUND'});
});

test('the closed envelope is required and malformed envelopes/requests are refused before dispatch', async () => {
  const {handler,calls}=ports();
  const h2=createInspectionHandler({authenticate:async()=>({verified:true}),verifyCustody:async()=>({authorized:true}),
   openHost:async()=>{calls.push('open');return {runRequest:async()=>({}),close:async()=>({closed:true})};},
   readBody:async()=>Buffer.from(JSON.stringify({schema:NATIVE_INSPECTION_SCHEMA,allocation:{},hostIdentity:{},
    binding:{},custody:{},request:{...REQUEST,requestId:'nothex'}})),
   limits:{deadlineMaxMs:1000,bodyBytes:1024}});
  const out=res(); await h2(req(),out);
  assert.equal(out.status,400);
  assert.equal(calls.filter(c=>c==='open').length,0);
  const extra=res();
  await createInspectionHandler({authenticate:async()=>({verified:true}),verifyCustody:async()=>({authorized:true}),
   openHost:async()=>({runRequest:async()=>({}),close:async()=>({closed:true})}),
   readBody:async()=>Buffer.from(JSON.stringify({schema:NATIVE_INSPECTION_SCHEMA,allocation:{},hostIdentity:{},binding:{},
    custody:{},request:{...REQUEST,command:'/bin/sh'}})),limits:{deadlineMaxMs:1000,bodyBytes:1024}})(req(),extra);
  assert.equal(extra.status,400);
  assert.ok(nativeInspectionBody({schema:NATIVE_INSPECTION_SCHEMA,allocation:{},hostIdentity:{},binding:{},custody:{},
   request:REQUEST}).request);
});

test('a real clean inspection is returned, the owned operation is closed, and cleanup unknown is never a success', async () => {
  const ok=ports(); const r=res(); await ok.handler(req(),r);
  assert.equal(r.status,200);
  assert.deepEqual(ok.calls,['authenticate','custody','open','dispatch','close']);
  const body=JSON.parse(r.body);
  assert.equal(body.kind,'upload-inspection-result');
  assert.equal(body.requestId,REQUEST.requestId);
  assert.equal(body.scan.status,'clean');
  assert.equal(body.provenance.imageObserved,false);

  const leaked=ports({cleanup:{closed:false,code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'}});
  const r2=res(); await leaked.handler(req(),r2);
  assert.equal(r2.status,503);
  assert.equal(JSON.parse(r2.body).error,'NATIVE_INSPECTION_CLEANUP_UNKNOWN');
});

test('an infected scan produces no extraction, through the real createUploadInspection pipeline', async () => {
  let extracted=0;
  const host={scanner:{async scan({file}){return scanReceipt(file,'infected','MALWARE_DETECTED');}},
   extractor:{async extract({file}){extracted+=1;return extractReceipt(file);}},describe(){return {};}};
  const out=await inspectFixed({raw:REQUEST,deadlineMs:REQUEST.deadlineMs,settings:CHILD_SETTINGS,now:Date.now,
   compose:async()=>host,run:async()=>({stdout:Buffer.alloc(0)})});
  assert.equal(out.body.scan.status,'infected');
  assert.equal(out.body.extraction.segments.length,0);
  assert.equal(extracted,0,'no extraction after an infected scan');
});

test('an unavailable scan is refused as a result and never becomes clean', async () => {
  const host={scanner:{async scan({file}){return scanReceipt(file,'unavailable','SCANNER_UNAVAILABLE');}},
   extractor:{async extract(){throw Error('must not run');}},describe(){return {};}};
  const out=await inspectFixed({raw:REQUEST,deadlineMs:REQUEST.deadlineMs,settings:CHILD_SETTINGS,now:Date.now,
   compose:async()=>host,run:async()=>({stdout:Buffer.alloc(0)})});
  assert.equal(out.body.scan.status,'unavailable');
  assert.notEqual(out.body.scan.status,'clean');
});

test('the child settings and the fixed invocation are closed and UID1000-only', () => {
  assert.equal(childSettings(CHILD_SETTINGS).paths.definitionsRoot,'/run/meri/upload-definitions');
  assert.throws(()=>childSettings({...CHILD_SETTINGS,runtimeUid:0}),e=>e?.code==='UPLOAD_INSPECTION_REQUEST_REFUSED');
  assert.throws(()=>childSettings({...CHILD_SETTINGS,credentialPaths:[]}),e=>e?.code==='UPLOAD_INSPECTION_REQUEST_REFUSED');
  const invocation=childInvocation(CONFIG);
  assert.equal(invocation.command,'/usr/local/bin/node');
  assert.deepEqual(invocation.args,['/opt/meri/child-cli.mjs']);
});

test('the authorized allocation cannot name a different host, image or expired lease', () => {
  assert.equal(assertHostMatch({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY}),true);
  for(const bad of [{...ALLOCATION,hostId:uuid(90)},{...ALLOCATION,imageDigest:`sha256:${'e'.repeat(64)}`},
   {...ALLOCATION,leaseDeadlineMs:Date.now()-1}]){
    assert.throws(()=>assertHostMatch({config:CONFIG,allocation:bad,binding:BINDING,hostIdentity:IDENTITY}),
     e=>e?.code==='NATIVE_PROCESSING_ALLOCATION_REFUSED');
  }
});

test('partial setup failure closes the compartment it opened and reports the unwind truthfully', async () => {
  let closed=0;
  const compartment={async close(){closed+=1;return {closed:true};}};
  const error=await openNativeProcessingHost({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
   authority:{readCurrent:async()=>({})},openCompartment:async()=>compartment,
   openPlacement:async()=>{throw Object.assign(Error('HOST_CGROUP_OCCUPIED'),{code:'HOST_CGROUP_OCCUPIED'});}})
   .then(()=>null,e=>e);
  assert.equal(error?.code,'HOST_CGROUP_OCCUPIED');
  assert.equal(error?.partialCleanup,'removed');
  assert.equal(closed,1);
});

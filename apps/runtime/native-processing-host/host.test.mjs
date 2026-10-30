/** Connected host tests: actual handler -> actual bootstrap serialization -> actual childMain -> real validators.
 *  Only native/TLS/FS/authority and scanner/extractor PROCESS effects are inert. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable,Writable} from 'node:stream';
import {childMain,childSettings,inspectFixed} from './child-cli.mjs';
import {nativeInspectionBody,createInspectionHandler,NATIVE_INSPECTION_SCHEMA,NATIVE_INSPECTION_PATH} from './service.mjs';
import {childInvocation,assertHostMatch,openNativeProcessingHost} from './bootstrap.mjs';
import {uploadInspectionBody,UPLOAD_INSPECTION_WIRE_BYTES} from '../uploads/agentcore-contract.mjs';
import {createUploadInspection} from '../../control/uploads/extraction.mjs';
import {NATIVE_BODY_LIMIT} from './config.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const BYTES=Buffer.from('# fixed inspection content\n');
const DECLARATION=Object.freeze({filename:'note.md',mimeType:'text/markdown',bytes:BYTES.length,sha256:sha(BYTES)});
const IMAGE=`sha256:${'b'.repeat(64)}`;
const REQUEST=Object.freeze({kind:'upload-inspection',requestId:'a'.repeat(64),imageDigest:IMAGE,
 declaration:DECLARATION,bytesBase64:BYTES.toString('base64'),inputSha256:sha(BYTES),deadlineMs:Date.now()+5000});
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const HOST_ID=uuid(7),CONV=uuid(3),TENANT=uuid(1),BOOT=uuid(8),INSTANCE='i-0123456789abcdef0';
const ALLOCATION=Object.freeze({schema:'meri-conversation-host-allocation/1',tenantId:TENANT,conversationId:CONV,
 generation:3,hostId:HOST_ID,hostMode:'native-processing',imageDigest:IMAGE,leaseDeadlineMs:Date.now()+600000});
const BINDING=Object.freeze({tenantId:TENANT,actorId:uuid(2),conversationId:CONV,runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),writerFence:1});
const IDENTITY=Object.freeze({schema:'meri-d005-host-identity/1',instanceId:INSTANCE,bootId:BOOT,conversationId:CONV,hostId:HOST_ID});
const LIMITS=Object.freeze({cpuQuotaUs:50000,periodUs:100000,memoryBytes:268435456,pidsMax:16,deadlineMaxMs:30000,
 bodyBytes:NATIVE_BODY_LIMIT,cleanupMs:200});
const RAW_SETTINGS=Object.freeze({runtimeUid:1000,runtimeGid:1000,imageDigest:IMAGE,
 definitionsRoot:'/run/meri/upload-definitions',extractorPath:'/opt/meri/extract.py',scratchRoot:'/run/meri/upload-scratch',
 credentialPaths:['/proc/1/environ']});
const CONFIG=Object.freeze({image:{digest:IMAGE},allocation:{hostId:HOST_ID,generation:3,conversationId:CONV,
 tenantId:TENANT,instanceId:INSTANCE,bootId:BOOT,hostMode:'native-processing',leaseDeadlineMs:Date.now()+600000},
 limits:LIMITS,paths:{nodePath:'/usr/local/bin/node',childPath:'/opt/meri/child-cli.mjs',
  helperPath:'/usr/lib/meri/meri-host-launcher',home:'/run/meri/processing',runtimeUid:1000,runtimeGid:1000,
  childSettings:RAW_SETTINGS}});

const scanReceipt=(file,status='clean',reason=null,at=Date.now())=>({sourceSha256:file.sha256,sourceBytes:file.bytes,
 checkedAtMs:at,status,...(status==='unavailable'?{tool:null,definitionsSha256:null}:
 {tool:{name:'clamav',version:'1.4.2',binarySha256:'a'.repeat(64)},definitionsSha256:'b'.repeat(64)}),reason});
const extractReceipt=(file,at=Date.now())=>({sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:at,status:'available',
 tool:{name:'meri-upload-extractor',version:'3.13.16',binarySha256:'c'.repeat(64)},segments:[],limitations:[]});

/** A real child composition with inert scanner/extractor PROCESS effects. */
function childCompose({status='clean',clock}={}) {
 const compose=async({run:ignoredRun,...rest})=>{
  void ignoredRun; void rest;
  const inspection=createUploadInspection({now:clock??Date.now,
   scanner:{async scan({file}){return scanReceipt(file,status,status==='clean'?null:
     (status==='infected'?'MALWARE_DETECTED':'SCANNER_UNAVAILABLE'),(clock??Date.now)());}},
   extractor:{async extract({file}){return extractReceipt(file,(clock??Date.now)());}}});
  return {scanner:{scan:(input)=>inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+2000})
    .then(value=>({...value.scan}))},
   extractor:{extract:(input)=>inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+2000})
    .then(value=>value.extraction)},describe(){return {};}};
 };
 return compose;
}

/** Actual bootstrap serialization -> actual childMain (injected stdin/stdout) -> real validators. */
function realChildRunner({status='clean',clock,delayMs=0} = {}, composeOverride) {
 const calls=[];
 const run=async(command,args,{input,deadlineMs})=>{
  calls.push({command,args,input:Buffer.from(input)});
  if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
  let captured=Buffer.alloc(0);
  const stdout=new Writable({write(chunk,_e,cb){captured=Buffer.concat([captured,Buffer.from(chunk)]);cb();}});
  await childMain({stdin:Readable.from([input]),stdout,now:clock,identity:()=>({uid:1000,gid:1000}),
   inspect:argsIn=>inspectFixed({...argsIn,compose:composeOverride??childCompose({status,clock}),
    run:async()=>({stdout:Buffer.alloc(0)})})});
  return {stdout:captured};
 };
 return {run,calls};
}

function handlerFor({peer=true,custody=true,runner,complete=true,lateSetup=null,cleanup={closed:true},requestOverride=null}={}) {
 const wireRequest=requestOverride??REQUEST;
 const calls=[];
 const handler=createInspectionHandler({
  authenticate:async()=>{calls.push('authenticate');return {verified:peer};},
  verifyCustody:async()=>{calls.push('custody');return {authorized:custody,allocation:ALLOCATION,binding:BINDING,
    hostIdentity:IDENTITY,currentness:{readCurrent:async()=>({})}};},
  openHost:async input=>{
   calls.push('open');
   if(lateSetup)return lateSetup(input);
   return openNativeProcessingHost({config:CONFIG,...input,
     openCompartment:async()=>({close:async()=>({closed:true})}),
     openPlacement:async args=>({run:runner.run,
       close:async()=>({closed:true})})});
  },
  readBody:async(req,limit,deadline,signal)=>new Promise((resolve,reject)=>{
   if(signal?.aborted)return reject(Object.assign(Error('UPLOAD_INSPECTION_REQUEST_REFUSED'),{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'}));
   const timer=setTimeout(()=>reject(Object.assign(Error('UPLOAD_INSPECTION_REQUEST_REFUSED'),{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'})),Math.max(1,deadline-Date.now()));
   setTimeout(()=>{clearTimeout(timer);resolve(Buffer.from(JSON.stringify({schema:NATIVE_INSPECTION_SCHEMA,
     allocation:ALLOCATION,hostIdentity:IDENTITY,binding:BINDING,custody:{uploadId:uuid(9)},request:wireRequest})));},0);
  }),
  limits:LIMITS});
 return {handler,calls};
}

function req({complete=true,encrypted=true}={}) {
 const listeners=new Map();
 return {method:'POST',url:NATIVE_INSPECTION_PATH,complete,socket:{encrypted},headers:{},
  once(event,fn){listeners.set(event,fn);},
  removeListener(event){listeners.delete(event);},
  emit(event){listeners.get(event)?.();}};
}
const res=()=>{const r={status:0,body:'',writableEnded:false,listeners:new Map()};
 r.writeHead=s=>{r.status=s;};r.end=b=>{r.body=b;r.writableEnded=true;};
 r.once=(event,fn)=>{r.listeners.set(event,fn);};r.removeListener=e=>{r.listeners.delete(e);};return r;};

test('CONNECTED: a normal completed request inspects end-to-end through bootstrap, childMain and real validators', async () => {
  const runner=realChildRunner();
  const {handler,calls}=handlerFor({runner});
  const r=res();
  await handler(req({complete:true}),r);
  assert.equal(r.status,200,`unexpected ${r.status} ${r.body}`);
  const body=JSON.parse(r.body);
  assert.equal(body.kind,'upload-inspection-result');
  assert.equal(body.requestId,REQUEST.requestId);
  assert.equal(body.scan.status,'clean');
  assert.deepEqual(calls,['authenticate','custody','open']);
  assert.equal(runner.calls.length,1,'exactly one fixed child invocation');
  const sent=JSON.parse(runner.calls[0].input.toString('utf8'));
  assert.equal(sent.settings.imageDigest,IMAGE);
  assert.equal(sent.request.inputSha256,REQUEST.inputSha256);
});

test('CONNECTED: an ordinary completed HTTP body does not cancel, while a premature disconnect does', async () => {
  const runner=realChildRunner();
  const normal=handlerFor({runner}); const ok=res(); const normalReq=req({complete:true});
  const pending=normal.handler(normalReq,ok); normalReq.emit('close');   // Node24 close after complete
  await pending; assert.equal(ok.status,200);

  const aborted=handlerFor({runner}); const bad=res(); const badReq=req({complete:false});
  const pendingBad=aborted.handler(badReq,bad); badReq.emit('close');     // premature disconnect
  await pendingBad; assert.notEqual(bad.status,200);
  assert.equal(aborted.calls.includes('open'),false);
});

test('CONNECTED: late setup after cancellation is unwound once and never reports success', async () => {
  let closed=0;
  const lateSetup=async()=>{await new Promise(r=>setTimeout(r,30));
   return {runRequest:async()=>({}),close:async()=>{closed+=1;return {closed:true};}};};
  const {handler}=handlerFor({runner:realChildRunner(),lateSetup});
  const r=res(); const badReq=req({complete:false});
  const pending=handler(badReq,r); setTimeout(()=>badReq.emit('close'),5);
  await pending;
  assert.notEqual(r.status,200,'a cancelled operation never yields a successful inspection');
  await new Promise(resolve=>setTimeout(resolve,90));
  assert.equal(closed,1,'the late owner was closed exactly once');
  assert.notEqual(JSON.parse(r.body).error,'NATIVE_INSPECTION_CLEANUP_UNKNOWN',
   'a proven unwind is reported as the cancellation, not as cleanup unknown');
});
test('CONNECTED: a non-clean scan yields no extraction through the real pipeline', async () => {
  const runner=realChildRunner({status:'infected'});
  const {handler}=handlerFor({runner}); const r=res();
  await handler(req(),r);
  assert.equal(r.status,200);
  const body=JSON.parse(r.body);
  assert.equal(body.scan.status,'infected');
  assert.equal(body.extraction.segments.length,0);
});

test('CONNECTED: realistic elapsed inspection passes the real result time window', async () => {
  const slowCompose=async()=>{
   const inspection=createUploadInspection({now:Date.now,
    scanner:{async scan({file}){await new Promise(r=>setTimeout(r,3));return scanReceipt(file,'clean',null,Date.now());}},
    extractor:{async extract({file}){await new Promise(r=>setTimeout(r,3));return extractReceipt(file,Date.now());}}});
   return {scanner:{scan:()=>inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+5000}).then(v=>v.scan)},
    extractor:{extract:()=>inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+5000}).then(v=>v.extraction)},
    describe(){return {};}};
  };
  const runner=realChildRunner({},slowCompose);
  const {handler}=handlerFor({runner}); const r=res();
  await handler(req(),r);
  assert.equal(r.status,200,`unexpected ${r.status} ${r.body}`);
});

test('the child normalizes settings exactly once and refuses normalized or unknown shapes', async () => {
  const normalized=childSettings(RAW_SETTINGS);
  assert.equal(normalized.image.digest,IMAGE);
  assert.throws(()=>childSettings(normalized),e=>e?.code==='UPLOAD_INSPECTION_REQUEST_REFUSED');
  assert.throws(()=>childSettings({...RAW_SETTINGS,extra:1}),e=>e?.code==='UPLOAD_INSPECTION_REQUEST_REFUSED');
  assert.throws(()=>childSettings({...RAW_SETTINGS,runtimeUid:0}),e=>e?.code==='UPLOAD_INSPECTION_REQUEST_REFUSED');
  const invocation=childInvocation(CONFIG);
  assert.deepEqual(invocation.args,['/opt/meri/child-cli.mjs']);
});

test('host identity, purpose, lease and image are pinned; request image must match', () => {
  assert.equal(assertHostMatch({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,request:REQUEST}),true);
  for(const bad of [{...ALLOCATION,hostMode:'browser-only'},{...ALLOCATION,hostId:uuid(90)},
   {...ALLOCATION,imageDigest:`sha256:${'e'.repeat(64)}`},{...ALLOCATION,leaseDeadlineMs:Date.now()-1}]){
    assert.throws(()=>assertHostMatch({config:CONFIG,allocation:bad,binding:BINDING,hostIdentity:IDENTITY}),
     e=>e?.code==='NATIVE_PROCESSING_ALLOCATION_REFUSED');
  }
  for(const badIdentity of [{...IDENTITY,instanceId:'i-ffffffffffffffff'},{...IDENTITY,bootId:uuid(99)}]){
    assert.throws(()=>assertHostMatch({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:badIdentity}),
     e=>e?.code==='NATIVE_PROCESSING_ALLOCATION_REFUSED');
  }
});

test('the body bound derives from the canonical inspection wire limit, not an invented cap', () => {
  assert.equal(NATIVE_BODY_LIMIT,UPLOAD_INSPECTION_WIRE_BYTES+65536);
  assert.ok(NATIVE_BODY_LIMIT>10*1024*1024);
});

test('partial setup failure closes the compartment it opened and reports the unwind truthfully', async () => {
  let closed=0;
  const error=await openNativeProcessingHost({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
   authority:{readCurrent:async()=>({})},openCompartment:async()=>({close:async()=>{closed+=1;return {closed:true};}}),
   openPlacement:async()=>{throw Object.assign(Error('HOST_CGROUP_OCCUPIED'),{code:'HOST_CGROUP_OCCUPIED'});}})
   .then(()=>null,e=>e);
  assert.equal(error?.code,'HOST_CGROUP_OCCUPIED');
  assert.equal(error?.partialCleanup,'removed');
  assert.equal(closed,1);
});

test('cleanup unknown is never reported as a successful inspection', async () => {
  const runner=realChildRunner();
  const {handler}=handlerFor({runner});
  const handlerLeaky=createInspectionHandler({
   authenticate:async()=>({verified:true}),
   verifyCustody:async()=>({authorized:true,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
     currentness:{readCurrent:async()=>({})}}),
   openHost:async()=>({runRequest:async()=>runner.run('x',[],{input:Buffer.from(JSON.stringify({settings:RAW_SETTINGS,
     request:REQUEST,deadlineMs:Date.now()+5000}))}),close:async()=>({closed:false,code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'})}),
   readBody:async()=>Buffer.from(JSON.stringify({schema:NATIVE_INSPECTION_SCHEMA,allocation:ALLOCATION,hostIdentity:IDENTITY,
    binding:BINDING,custody:{uploadId:uuid(9)},request:REQUEST})),
   limits:{deadlineMaxMs:30000,bodyBytes:NATIVE_BODY_LIMIT}});
  void handler;
  const r=res(); await handlerLeaky(req({complete:true}),r);
  assert.equal(r.status,503);
  assert.equal(JSON.parse(r.body).error,'NATIVE_INSPECTION_CLEANUP_UNKNOWN');
});

test('STARTUP: readiness evaluates without a ReferenceError and names the pending canonical join', async () => {
 const {nativeProcessingReadiness}=await import('./entrypoint.mjs');
 const readiness=nativeProcessingReadiness({config:{},verifyCustody:undefined});
 assert.equal(readiness.ready,false);
 assert.deepEqual(readiness.missing,['canonical.custody:pending-parent']);
 assert.equal(readiness.endpoint,NATIVE_INSPECTION_PATH);
});

test('AUTH NEGATIVES: route, plaintext, peer, absent verifier and denied custody never dispatch', async () => {
 const mk=({peer=true,custody=true,url=NATIVE_INSPECTION_PATH,encrypted=true}={})=>{
  const calls=[];
  const handler=createInspectionHandler({
   authenticate:async()=>{calls.push('authenticate');return {verified:peer};},
   verifyCustody:async()=>{calls.push('custody');return {authorized:custody};},
   openHost:async()=>{calls.push('open');return {runRequest:async()=>({}),close:async()=>({closed:true})};},
   readBody:async()=>Buffer.from(JSON.stringify({schema:NATIVE_INSPECTION_SCHEMA,allocation:ALLOCATION,
    hostIdentity:IDENTITY,binding:BINDING,custody:{uploadId:uuid(9)},request:REQUEST})),
   limits:{deadlineMaxMs:2000,bodyBytes:NATIVE_BODY_LIMIT}});
  return {handler,calls,request:{method:'POST',url,socket:{encrypted},headers:{},once(){},removeListener(){}}};
 };
 const cases=[['route',{url:'/nope'},404],['tls',{encrypted:false},403],['peer',{peer:false},403],['custody',{custody:false},400]];
 for(const [name,options,status] of cases){
  const {handler,calls,request}=mk(options); const out=res();
  await handler(request,out);
  assert.equal(out.status,status,`${name}: ${out.body}`);
  assert.equal(calls.includes('open'),false,`${name} dispatched`);
 }
 const noVerifier=createInspectionHandler({authenticate:async()=>({verified:true}),openHost:async()=>{throw Error('x');},
  readBody:async()=>Buffer.from('{}'),limits:{deadlineMaxMs:1000,bodyBytes:4096}});
 const out=res(); await noVerifier({method:'POST',url:NATIVE_INSPECTION_PATH,socket:{encrypted:true},headers:{},
  once(){},removeListener(){}},out);
 assert.equal(out.status,503);
 assert.equal(JSON.parse(out.body).error,'NATIVE_INSPECTION_CUSTODY_UNBOUND');
});

test('LIFECYCLE: a permanently stalled setup is bounded, and a later owner is closed exactly once', async () => {
 let resolveSetup=null,closed=0;
 const stalling=async()=>new Promise(resolve=>{resolveSetup=()=>resolve({runRequest:async()=>({}),
  close:async()=>{closed+=1;return {closed:true};}});});
 const {handler,calls}=handlerFor({runner:realChildRunner(),lateSetup:stalling});
 const out=res(); const began=Date.now();
 await handler(req({complete:true}),out);
 assert.ok(Date.now()-began<5000,'the operation settled instead of waiting for the stalled setup');
 assert.notEqual(out.status,200);
 assert.equal(calls.includes('open'),true);
 resolveSetup();                                   // fulfillment AFTER the bounded cleanup window
 await new Promise(r=>setTimeout(r,150));
 assert.equal(closed,1,'the late owner is still closed exactly once');
});

test('LIFECYCLE: a request whose deadline already passed dispatches nothing', async () => {
 const {handler,calls}=handlerFor({runner:realChildRunner(),
  requestOverride:{...REQUEST,deadlineMs:Date.now()-1}});
 const out=res(); await handler(req({complete:true}),out);
 assert.notEqual(out.status,200);
 assert.equal(calls.includes('open'),false);
});

test('CHILD: the actual process identity must be UID/GID 1000', async () => {
 await assert.rejects(childMain({stdin:Readable.from([Buffer.from('{}')]),
  stdout:new Writable({write(_c,_e,cb){cb();}}),identity:()=>({uid:0,gid:0})}),
  e=>e?.code==='UPLOAD_INSPECTION_REQUEST_REFUSED');
});

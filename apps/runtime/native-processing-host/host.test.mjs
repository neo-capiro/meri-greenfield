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
const LEASE=Date.now()+600000;
const ALLOCATION=Object.freeze({schema:'meri-conversation-host-allocation/1',tenantId:TENANT,conversationId:CONV,
 generation:3,hostId:HOST_ID,hostMode:'native-processing',imageDigest:IMAGE,leaseDeadlineMs:LEASE});
const BINDING=Object.freeze({tenantId:TENANT,actorId:uuid(2),conversationId:CONV,runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),writerFence:1});
const IDENTITY=Object.freeze({schema:'meri-d005-host-identity/1',instanceId:INSTANCE,bootId:BOOT,conversationId:CONV,hostId:HOST_ID});
const LIMITS=Object.freeze({cpuQuotaUs:50000,periodUs:100000,memoryBytes:268435456,pidsMax:16,deadlineMaxMs:30000,
 bodyBytes:NATIVE_BODY_LIMIT,cleanupMs:200});
const RAW_SETTINGS=Object.freeze({runtimeUid:1000,runtimeGid:1000,imageDigest:IMAGE,
 definitionsRoot:'/run/meri/upload-definitions',extractorPath:'/opt/meri/extract.py',scratchRoot:'/run/meri/upload-scratch',
 credentialPaths:['/proc/1/environ']});
const HOST_ENV=Object.freeze({
 MERI_NATIVE_PROCESSING_PORT:'9443',MERI_NATIVE_PROCESSING_ADDRESS:'127.0.0.1',
 MERI_NATIVE_PROCESSING_TLS_KEY:'/run/meri/tls.key',MERI_NATIVE_PROCESSING_TLS_CERT:'/run/meri/tls.crt',
 MERI_NATIVE_PROCESSING_TLS_CA:'/run/meri/ca.crt',MERI_NATIVE_PROCESSING_PEER_SAN:'control.meri.internal',
 MERI_NATIVE_PROCESSING_PEER_FINGERPRINT:'a'.repeat(64),MERI_NATIVE_PROCESSING_PEER_MAX_LIFETIME_MS:'900000',
 MERI_NATIVE_PROCESSING_PEER_NOT_AFTER_MS:String(Date.now()+600000),
 MERI_NATIVE_PROCESSING_IMAGE_DIGEST:IMAGE,MERI_NATIVE_PROCESSING_HOST_ID:HOST_ID,
 MERI_NATIVE_PROCESSING_GENERATION:'3',MERI_NATIVE_PROCESSING_CONVERSATION_ID:CONV,
 MERI_NATIVE_PROCESSING_TENANT_ID:TENANT,MERI_NATIVE_PROCESSING_INSTANCE_ID:INSTANCE,
 MERI_NATIVE_PROCESSING_BOOT_ID:BOOT,MERI_NATIVE_PROCESSING_HOST_MODE:'native-processing',
 MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS:String(LEASE),
 MERI_NATIVE_PROCESSING_CPU_QUOTA_US:'50000',MERI_NATIVE_PROCESSING_CPU_PERIOD_US:'100000',
 MERI_NATIVE_PROCESSING_MEMORY_BYTES:'268435456',MERI_NATIVE_PROCESSING_PIDS_MAX:'16',
 MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS:'30000',MERI_NATIVE_PROCESSING_BODY_BYTES:String(NATIVE_BODY_LIMIT),
 MERI_NATIVE_PROCESSING_HELPER:'/usr/lib/meri/meri-host-launcher',MERI_NATIVE_PROCESSING_NODE:'/usr/local/bin/node',
 MERI_NATIVE_PROCESSING_CHILD:'/opt/meri/child-cli.mjs',MERI_NATIVE_PROCESSING_HOME:'/run/meri/processing',
 MERI_NATIVE_PROCESSING_DEFINITIONS:'/run/meri/upload-definitions',
 MERI_NATIVE_PROCESSING_EXTRACTOR:'/opt/meri/extract.py',MERI_NATIVE_PROCESSING_SCRATCH:'/run/meri/upload-scratch',
 MERI_NATIVE_PROCESSING_RUNTIME_UID:'1000',MERI_NATIVE_PROCESSING_RUNTIME_GID:'1000',
 MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'});
const CONFIG=Object.freeze({image:{digest:IMAGE},allocation:{hostId:HOST_ID,generation:3,conversationId:CONV,
 tenantId:TENANT,instanceId:INSTANCE,bootId:BOOT,hostMode:'native-processing',leaseDeadlineMs:LEASE},
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
  assert.ok(['NATIVE_INSPECTION_CLEANUP_UNKNOWN','CANCELLED'].includes(JSON.parse(r.body).error),
   'the cancellation is reported without a false success');
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
 const {handler,calls}=handlerFor({runner:realChildRunner(),lateSetup:stalling,
  requestOverride:{...REQUEST,deadlineMs:Date.now()+400}});
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

/** A REAL inert IncomingMessage substitute: a Readable body with the HTTP properties the handler uses. */
function streamRequest({body, complete=true, url=NATIVE_INSPECTION_PATH}={}) {
 const stream=Readable.from([Buffer.from(JSON.stringify(body))]);
 stream.method='POST';
 stream.url=url;
 stream.headers={};
 stream.complete=complete;
 stream.socket={encrypted:true};
 return stream;
}
const ENVELOPE=()=>({schema:NATIVE_INSPECTION_SCHEMA,allocation:ALLOCATION,hostIdentity:IDENTITY,binding:BINDING,
 custody:{uploadId:uuid(9)},request:{...REQUEST,deadlineMs:Date.now()+5000}});
const SCOPED_CUSTODY={authorized:true,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
 currentness:{readCurrent:async()=>({})}};

test('ENTRYPOINT SUCCESS: inert server factory wiring drives the real handler through bootstrap+childMain', async () => {
 const {startNativeProcessingHost}=await import('./entrypoint.mjs');
 const runner=realChildRunner();
 let captured=null,options=null;
 const serverFactory=(opts,handler)=>{options=opts;captured=handler;
  return {once(){},listen(_port,_addr,cb){cb();},close(cb){cb?.();}};};
 const openHost=async input=>openNativeProcessingHost({config:CONFIG,...input,
  openCompartment:async()=>({close:async()=>({closed:true})}),
  openPlacement:async()=>({run:runner.run,close:async()=>({closed:true})})});
 const started=await startNativeProcessingHost({env:HOST_ENV,verifyCustody:async()=>SCOPED_CUSTODY,
  openHost,serverFactory,authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+60000}),
  definitionsOwner:null,readFile:()=>Buffer.from('-----BEGIN-----')});
 assert.equal(started.started,true);
 assert.equal(options.minVersion,'TLSv1.3');
 assert.equal(options.maxVersion,'TLSv1.3');
 assert.equal(options.requestCert,true);
 assert.equal(options.rejectUnauthorized,true);
 assert.ok(Buffer.isBuffer(options.key)&&Buffer.isBuffer(options.cert)&&Buffer.isBuffer(options.ca));
 const out=res();
 await captured(streamRequest({body:ENVELOPE()}),out);
 assert.equal(out.status,200,`unexpected ${out.status} ${out.body}`);
 assert.equal(JSON.parse(out.body).requestId,REQUEST.requestId);
 assert.equal(runner.calls.length,1);
 assert.deepEqual(await started.close(),{closed:true,pending:0});
});

test('ENTRYPOINT SHUTDOWN: an unresolved setup keeps close false until its owner settles', async () => {
 const {startNativeProcessingHost}=await import('./entrypoint.mjs');
 let resolveSetup=null,closedOwners=0,captured=null,entered=null;
 const setupEntered=new Promise(resolve=>{entered=resolve;});
 const serverFactory=(_opts,handler)=>{captured=handler;
  return {once(){},listen(_p,_a,cb){cb();},close(cb){cb?.();}};};
 const started=await startNativeProcessingHost({env:HOST_ENV,verifyCustody:async()=>SCOPED_CUSTODY,
  serverFactory,authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+60000}),definitionsOwner:null,
  readFile:()=>Buffer.from('x'),
  openHost:async()=>{entered();return new Promise(resolve=>{resolveSetup=()=>resolve({runRequest:async()=>({}),
   close:async()=>{closedOwners+=1;return {closed:true};}});});}});
 const out=res();
 const pending=captured(streamRequest({body:ENVELOPE()}),out);
 await setupEntered;                                    // the deferred handshake, not a sleep
 const early=await started.close();
 assert.equal(early.closed,false,'shutdown never claims closed while an owner is unresolved');
 resolveSetup();
 await pending;
 await new Promise(r=>setTimeout(r,60));
 assert.equal(closedOwners,1,'the unresolved owner is closed once when it finally arrives');
 assert.notEqual(out.status,200);
});

test('OWNERSHIP: a timely host whose close times out later releases activity when it succeeds', async () => {
 const releases=[];let finishClose=null;
 const handler=createInspectionHandler({
  authenticate:async()=>({verified:true}),
  verifyCustody:async()=>SCOPED_CUSTODY,
  openHost:async()=>({runRequest:async()=>({}),close:()=>new Promise(resolve=>{finishClose=()=>resolve({closed:true});})}),
  readBody:async()=>Buffer.from(JSON.stringify(ENVELOPE())),
  limits:{deadlineMaxMs:400,bodyBytes:NATIVE_BODY_LIMIT,cleanupMs:40},
  onActivity:()=>{const release=()=>releases.push('released');return release;}});
 const out=res();
 const started=Date.now();
 await handler(streamRequest({body:ENVELOPE()}),out);
 assert.ok(Date.now()-started<1500,'bounded wait');
 finishClose();                                        // the late close succeeds AFTER the timeout
 await new Promise(r=>setTimeout(r,60));
 assert.deepEqual(releases,['released'],'a late successful close releases the retained activity');
 assert.notEqual(out.status,200);
});

test('OWNERSHIP: a late rejection with a proven unwind releases activity; unknown keeps it', async () => {
 for(const [partialCleanup,expected] of [['removed',1]]){
  const releases=[];
  const handler=createInspectionHandler({
   authenticate:async()=>({verified:true}),
   verifyCustody:async()=>SCOPED_CUSTODY,
   openHost:async()=>{await new Promise(r=>setTimeout(r,30));
    throw Object.assign(Error('HOST_CGROUP_OCCUPIED'),{code:'HOST_CGROUP_OCCUPIED',partialCleanup});},
   readBody:async()=>Buffer.from(JSON.stringify(ENVELOPE())),
   limits:{deadlineMaxMs:400,bodyBytes:NATIVE_BODY_LIMIT,cleanupMs:200},
   onActivity:()=>{const release=()=>releases.push('released');return release;}});
  const out=res();
  await handler(streamRequest({body:ENVELOPE()}),out);
  await new Promise(r=>setTimeout(r,80));
  assert.equal(releases.length,expected,`partialCleanup ${partialCleanup}`);
  assert.notEqual(out.status,200);
 }
});

test('DEFINITION PORTS: inspection roles and definition programs use separate fixed runners', async () => {
 const {composeUploadNativeHost}=await import('../uploads/composition.mjs');
 const roleCalls=[],programCalls=[];
 const run=async(role,options)=>{roleCalls.push(role);return {stdout:Buffer.from('')};};
 const definitionsRun=async(program,args,options)=>{programCalls.push([program,args]);return {stdout:Buffer.alloc(0)};};
 const host=await composeUploadNativeHost({configuration:{uploads:{native:{enabled:true,imageDigest:IMAGE}}},
  run,definitionsRun,now:Date.now,deadlineMs:Date.now()+2000});
 assert.ok(host);
 assert.equal(roleCalls.some(role=>role==='sigtool'||role==='freshclam'),false,
  'definition programs never reach the inspection role port');
 assert.ok(['sigtool','freshclam'].includes(programCalls[0]?.[0])||programCalls.length===0);
});

test('DEFINITION OWNER: a pin is held through child closure and prune never runs while pinned', async () => {
 const {createDefinitionSnapshotOwner}=await import('./definitions-owner.mjs');
 let released=0,prunes=0,releaseOk=true;
 const definitions={async snapshot(){return {databaseDirectory:'/run/meri/upload-definitions/snapshots/x',
   sha256:'a'.repeat(64),reader:{release(){released+=1;return releaseOk;}}};},
  async prune(){prunes+=1;return {storage:{overBound:false}};}};
 const owner=createDefinitionSnapshotOwner({definitions});
 const pin=await owner.pin({deadlineMs:Date.now()+1000});
 assert.equal(pin.sha256,'a'.repeat(64));
 const skipped=await owner.pruneIfIdle({});
 assert.equal(skipped.skipped,true);
 assert.equal(prunes,0,'no prune while a reader is pinned');
 releaseOk=false;
 const unknown=pin.release({completed:false});
 assert.deepEqual(unknown,{released:false,code:'UPLOAD_DEFINITIONS_RELEASE_UNKNOWN'});
 assert.equal(owner.active(),1,'an unproven release keeps the pin');
 releaseOk=true;
 assert.deepEqual(pin.release({completed:true}),{released:true});
 assert.equal(owner.active(),0);
 assert.deepEqual(pin.release({completed:true}),{released:true,already:true});
});

test('CHILD PIN: a malformed host pin is refused before any child work', async () => {
 const {pinnedDefinitions}=await import('./child-cli.mjs');
 for(const bad of [{databaseDirectory:'relative',sha256:'b'.repeat(64),publishedAtMs:1,files:[{name:'x',format:'cvd',sha256:'b'.repeat(64),bytes:1}]},
  {databaseDirectory:'/x',sha256:'nothash',publishedAtMs:1,files:[{name:'x',format:'cvd',sha256:'b'.repeat(64),bytes:1}]},
  {databaseDirectory:'/x',sha256:'b'.repeat(64),publishedAtMs:1,files:[]}]){
  assert.throws(()=>pinnedDefinitions(bad),e=>e?.code==='UPLOAD_INSPECTION_REQUEST_REFUSED');
 }
});

test('CANONICAL MAX: a 10MiB original is accepted; one byte above max is refused', () => {
 const limit=10*1024*1024;
 const big=Buffer.alloc(limit,0x61);
 const declaration={filename:'big.txt',mimeType:'text/plain',bytes:big.length,sha256:sha(big)};
 const envelope={schema:NATIVE_INSPECTION_SCHEMA,allocation:ALLOCATION,hostIdentity:IDENTITY,binding:BINDING,
  custody:{uploadId:uuid(9)},request:{kind:'upload-inspection',requestId:'c'.repeat(64),imageDigest:IMAGE,declaration,
   bytesBase64:big.toString('base64'),inputSha256:sha(big),deadlineMs:Date.now()+5000}};
 assert.equal(nativeInspectionBody(envelope).bytes.length,limit);
 const over=Buffer.alloc(limit+1,0x62);
 const overDeclaration={filename:'big.txt',mimeType:'text/plain',bytes:over.length,sha256:sha(over)};
 assert.throws(()=>nativeInspectionBody({...envelope,request:{...envelope.request,declaration:overDeclaration,
  bytesBase64:over.toString('base64'),inputSha256:sha(over)}}),
  e=>e?.code==='UPLOAD_INSPECTION_REQUEST_REFUSED');
});

test('OWNERSHIP: a valid result whose cleanup times out then succeeds still releases activity', async () => {
 const releases=[];let finishClose=null;
 const runner=realChildRunner();
 const handler=createInspectionHandler({
  authenticate:async()=>({verified:true}),
  verifyCustody:async()=>SCOPED_CUSTODY,
  openHost:async()=>({runRequest:async()=>runner.run('node',[],{input:Buffer.from(JSON.stringify({settings:RAW_SETTINGS,
    request:{...REQUEST,deadlineMs:Date.now()+5000},deadlineMs:Date.now()+5000}))}),
   close:()=>new Promise(resolve=>{finishClose=()=>resolve({closed:true});})}),
  readBody:async()=>Buffer.from(JSON.stringify(ENVELOPE())),
  limits:{deadlineMaxMs:2000,bodyBytes:NATIVE_BODY_LIMIT,cleanupMs:30},
  onActivity:()=>{const release=()=>releases.push('released');return release;}});
 const out=res();
 await handler(streamRequest({body:ENVELOPE()}),out);
 assert.notEqual(out.status,200,'cleanup unknown is not a success');
 finishClose();
 await new Promise(r=>setTimeout(r,60));
 assert.deepEqual(releases,['released'],'the late successful close releases activity');
});

/** Build a REAL signed-snapshot layout the existing store accepts; the sigtool signature effect is inert. */
async function signedSnapshot(root){
 const {mkdir,writeFile}=await import('node:fs/promises');
 const {join}=await import('node:path');
 const {definitionsSnapshotId,UPLOAD_DEFINITIONS_SCHEMA}=await import('../uploads/native-definitions.mjs');
 const main=Buffer.from('CVD main fixture'),daily=Buffer.from('CVD daily fixture');
 const files=[{name:'main.cvd',bytes:main.length,sha256:sha(main),format:'cvd'},
  {name:'daily.cvd',bytes:daily.length,sha256:sha(daily),format:'cvd'}];
 const id=definitionsSnapshotId(files);
 const dir=join(root,'snapshots',id);
 await mkdir(join(dir,'database'),{recursive:true});
 await writeFile(join(dir,'database','main.cvd'),main);
 await writeFile(join(dir,'database','daily.cvd'),daily);
 await writeFile(join(dir,'snapshot.json'),JSON.stringify({schema:UPLOAD_DEFINITIONS_SCHEMA,sha256:id,
  publishedAt:new Date(Date.now()-1000).toISOString(),publishedAtMs:Date.now()-1000,signatureVerified:true,
  version:'fixture-1',files}));
 await mkdir(root,{recursive:true});
 await writeFile(join(root,'current'),id);
 return {id,dir,main,daily,files};
}

test('REAL STORE: snapshot, pin, unknown reader retention and late completion', async () => {
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {createSignedDefinitionStore}=await import('../uploads/native-definitions.mjs');
 const {createDefinitionSnapshotOwner}=await import('./definitions-owner.mjs');
 const root=await mkdtemp(join(tmpdir(),'meri-defs-'));
 try{
  const fixture=await signedSnapshot(root);
  const calls=[];
  const store=createSignedDefinitionStore({root,now:Date.now,run:async(program,args)=>{calls.push([program,args]);
   return {stdout:Buffer.alloc(0)};}});
  const owner=createDefinitionSnapshotOwner({definitions:store});
  const first=await owner.pin({deadlineMs:Date.now()+2000});
  const second=await owner.pin({deadlineMs:Date.now()+2000});
  assert.equal(first.sha256,fixture.id);
  assert.equal(first.databaseDirectory,join(fixture.dir,'database'));
  assert.ok(calls.some(([program])=>program==='sigtool'),'the real store verified the CVD with sigtool');
  assert.equal(calls.some(([program])=>program==='freshclam'),false,'no provisioning inside this owner');
  assert.equal((await owner.pruneIfIdle({})).skipped,true,'prune refused while two readers are pinned');
  assert.deepEqual(first.release({completed:false}),{released:false,code:'UPLOAD_DEFINITIONS_RELEASE_UNKNOWN',retained:true});
  assert.equal(owner.active(),2,'an unknown reader keeps its pin');
  assert.deepEqual(second.release({completed:true}),{released:true});
  assert.equal(owner.active(),1);
  assert.deepEqual(first.release({completed:true}),{released:true},'a late proven completion closes the same token');
  assert.equal(owner.active(),0);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('CHILD PIN: the real store descriptor verifies exact bytes and fails closed on tamper', async () => {
 const {mkdtemp,rm,writeFile}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {createSignedDefinitionStore}=await import('../uploads/native-definitions.mjs');
 const {pinnedDefinitions}=await import('./child-cli.mjs');
 const root=await mkdtemp(join(tmpdir(),'meri-defs-'));
 try{
  const fixture=await signedSnapshot(root);
  const store=createSignedDefinitionStore({root,now:Date.now,run:async()=>({stdout:Buffer.alloc(0)})});
  const snapshot=await store.snapshot({deadlineMs:Date.now()+2000});
  const defs=pinnedDefinitions({databaseDirectory:snapshot.databaseDirectory,sha256:snapshot.sha256,
   publishedAtMs:snapshot.publishedAtMs,files:snapshot.files.map(f=>({name:f.name,format:f.format,sha256:f.sha256,bytes:f.bytes}))});
  const bound=await defs.snapshot({});
  assert.equal(bound.databaseDirectory,join(fixture.dir,'database'));
  assert.equal(bound.sha256,fixture.id);
  await writeFile(join(fixture.dir,'database','main.cvd'),Buffer.from('tampered'));
  await assert.rejects(defs.snapshot({}),e=>e?.code==='UPLOAD_DEFINITIONS_CORRUPT');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('BOOTSTRAP: a definition pin is held until the placement/compartment close proves closure', async () => {
 let pinReleased=null;
 const definitionsOwner={async pin({deadlineMs,signal}){void signal;void deadlineMs;
  return {databaseDirectory:'/run/meri/upload-definitions/snapshots/x/database',sha256:'b'.repeat(64),
   publishedAtMs:Date.now()-1,files:[],release(args){pinReleased=args;return {released:args.completed===true};}};}};
 let placementClosed=false;
 const host=await openNativeProcessingHost({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  authority:{readCurrent:async()=>({})},definitionsOwner,
  openCompartment:async()=>({close:async()=>({closed:true})}),
  openPlacement:async()=>({run:async(command,args,{input})=>{
    const parsed=JSON.parse(Buffer.from(input).toString('utf8'));
    assert.equal(parsed.settings.snapshot.sha256,'b'.repeat(64),'the pin descriptor crosses on closed stdin');
    return {stdout:Buffer.from('{}'),receipt:{exitCode:0}};},
   close:async()=>{placementClosed=true;return {closed:true};}})});
 await host.runRequest({requestDocument:REQUEST,deadlineMs:Date.now()+2000});
 assert.equal(placementClosed,false,'the pin is not released before the host closes');
 assert.equal(pinReleased,null,'no release at dispatch');
 assert.deepEqual(await host.close(),{closed:true});
 assert.deepEqual(pinReleased,{completed:true},'released only after proven placement closure');
});

test('BOOTSTRAP: a pin settling after close is released and never dispatched', async () => {
 let releaseArgs=null,resolvePin=null;
 const definitionsOwner={pin:()=>new Promise(resolve=>{resolvePin=resolve;})};
 let ran=0;
 const host=await openNativeProcessingHost({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  authority:{readCurrent:async()=>({})},definitionsOwner,
  openCompartment:async()=>({close:async()=>({closed:true})}),
  openPlacement:async()=>({run:async()=>{ran+=1;return {stdout:Buffer.from('{}'),receipt:{exitCode:0}};},
   close:async()=>({closed:true})})});
 const call=host.runRequest({requestDocument:REQUEST,deadlineMs:Date.now()+2000}).catch(e=>e);
 await new Promise(resolve=>setImmediate(resolve));
 const closed=await host.close();
 assert.equal(closed.closed,true);
 resolvePin({databaseDirectory:'/d',sha256:'c'.repeat(64),publishedAtMs:1,files:[],
  release(args){releaseArgs=args;return {released:false};}});
 const error=await call;
 assert.equal(error?.code,'NATIVE_PROCESSING_CLOSED','no dispatch after close');
 assert.equal(ran,0,'the child never ran');
 assert.deepEqual(releaseArgs,{completed:false},'the late token was still released, not leaked');
});

test('BOOTSTRAP: a release refusal keeps the host unknown and retains the token', async () => {
 let refusal=0;
 const definitionsOwner={async pin(){return {databaseDirectory:'/d',sha256:'d'.repeat(64),publishedAtMs:1,files:[],
  release(){refusal+=1;return {released:false};}};}};
 const host=await openNativeProcessingHost({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  authority:{readCurrent:async()=>({})},definitionsOwner,
  openCompartment:async()=>({close:async()=>({closed:true})}),
  openPlacement:async()=>({run:async()=>({stdout:Buffer.from('{}'),receipt:{exitCode:0}}),close:async()=>({closed:true})})});
 await host.runRequest({requestDocument:REQUEST,deadlineMs:Date.now()+2000});
 const closed=await host.close();
 assert.equal(closed.closed,false,'a refused release is not closure');
 assert.equal(refusal,1);
});

test('BOOTSTRAP: a successful run with unknown placement closure retains its pin', async () => {
 let released=0;
 const definitionsOwner={async pin(){return {databaseDirectory:'/d',sha256:'e'.repeat(64),publishedAtMs:1,files:[],
  release(){released+=1;return {released:true};}};}};
 const host=await openNativeProcessingHost({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  authority:{readCurrent:async()=>({})},definitionsOwner,
  openCompartment:async()=>({close:async()=>({closed:true})}),
  openPlacement:async()=>({run:async()=>({stdout:Buffer.from('{}'),receipt:{exitCode:0}}),
   close:async()=>({closed:false,code:'HOST_CGROUP_CLEANUP_UNKNOWN'})})});
 await host.runRequest({requestDocument:REQUEST,deadlineMs:Date.now()+2000});
 const closed=await host.close();
 assert.equal(closed.closed,false);
 assert.equal(released,0,'exit status never releases a pin without proven closure');
});

test('BOOTSTRAP: a failed run with PROVEN closure releases as incomplete', async () => {
 const seen=[];
 const definitionsOwner={async pin(){return {databaseDirectory:'/d',sha256:'f'.repeat(64),publishedAtMs:1,files:[],
  release(args){seen.push(args);return {released:true};}};}};
 const host=await openNativeProcessingHost({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  authority:{readCurrent:async()=>({})},definitionsOwner,
  openCompartment:async()=>({close:async()=>({closed:true})}),
  openPlacement:async()=>({run:async()=>{throw Object.assign(Error('child failed'),{code:'HOST_LAUNCH_FAILED'});},
   close:async()=>({closed:true})})});
 await assert.rejects(host.runRequest({requestDocument:REQUEST,deadlineMs:Date.now()+2000}));
 const closed=await host.close();
 assert.equal(closed.closed,true);
 assert.deepEqual(seen,[{completed:false}]);
});

test('BOOTSTRAP: concurrent calls release their OWN exact tokens', async () => {
 const seen=[];
 let n=0;
 const definitionsOwner={async pin(){const id=++n;return {databaseDirectory:`/d${id}`,sha256:String(id).repeat(64).slice(0,64),
  publishedAtMs:1,files:[],release(args){seen.push({id,...args});return {released:true};}};}};
 const host=await openNativeProcessingHost({config:CONFIG,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  authority:{readCurrent:async()=>({})},definitionsOwner,
  openCompartment:async()=>({close:async()=>({closed:true})}),
  openPlacement:async()=>({run:async(command,args,{input})=>{const doc=JSON.parse(Buffer.from(input).toString('utf8'));
    const id=doc.settings.snapshot.databaseDirectory;
    return {stdout:Buffer.from('{}'),receipt:{exitCode:id==='/d1'?0:1}};},close:async()=>({closed:true})})});
 const first=host.runRequest({requestDocument:REQUEST,deadlineMs:Date.now()+2000});
 const second=host.runRequest({requestDocument:REQUEST,deadlineMs:Date.now()+2000});
 await Promise.allSettled([first,second]);
 const closed=await host.close();
 assert.equal(closed.closed,true);
 assert.deepEqual(seen.sort((a,b)=>a.id-b.id),[ {id:1,completed:true},{id:2,completed:false} ]);
});

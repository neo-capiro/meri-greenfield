/** ACTUAL joined production path, authored from the independent review witness: real startNativeProcessingHost ->
 *  real definition composition/updater (synthetic CVD published through the generated config) -> real store/pins ->
 *  real bootstrap -> closed stdin -> real childMain/inspectFixed -> real composeUploadNativeHost ->
 *  createUploadNativeInspection/createUploadInspection -> real cleanup/release.
 *  ONLY low-level system effects are inert (TLS byte loading, compartment, placement spawn, sigtool/freshclam execution,
 *  scanner/extractor process receipts). No compose/store/owner result is replaced. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable,Writable} from 'node:stream';
import {mkdtemp,mkdir,readFile,writeFile,realpath,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {startNativeProcessingHost} from './entrypoint.mjs';
import {makeInertHierarchyPort} from './test-hierarchy-port.mjs';
import {openNativeProcessingHost} from './bootstrap.mjs';
import {childMain,inspectFixed} from './child-cli.mjs';
import {composeUploadNativeHost} from '../uploads/composition.mjs';
import {nativeUploadCustody,NATIVE_UPLOAD_INSPECTION_PATH,NATIVE_UPLOAD_INSPECTION_SCHEMA} from '../uploads/native-host-contract.mjs';
import {UPLOAD_CHILD_ENV,UPLOAD_SCAN_INPUT} from '../uploads/native-sandbox.mjs';
import {RENDERER_PROBE_SCHEMA} from '../../artifacts/renderer-qualification.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const closedReceipt=()=>({exitCode:0,leaderClosed:true,groupAbsent:true,settlement:'closed'});
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const BYTES=Buffer.from('review exact original\n');
const DECLARATION={filename:'review.txt',mimeType:'text/plain',bytes:BYTES.length,sha256:sha(BYTES)};
const IMAGE=`sha256:${'b'.repeat(64)}`;
const LEASE=Date.now()+600000;
const BINDING={tenantId:uuid(1),actorId:uuid(2),conversationId:uuid(3),runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),
 writerFence:1};
const SCOPES=[{tenantId:BINDING.tenantId,kind:'private-user',resourceId:BINDING.actorId,policyRevision:'p1'}];
const OWNER={tenantId:BINDING.tenantId,actorId:BINDING.actorId,conversationId:BINDING.conversationId,clientId:null};
const RECORD={uploadId:uuid(20),requestId:uuid(21),owner:OWNER,declaration:DECLARATION,scopes:SCOPES,objectId:uuid(22),
 object:{objectId:uuid(22),versionId:'SYNTHETIC_REVIEW_VERSION',sha256:DECLARATION.sha256,bytes:DECLARATION.bytes,
  scopes:SCOPES},state:'stored',inspection:null,createdAtMs:Date.now(),updatedAtMs:Date.now(),revision:2};
const CUSTODY=nativeUploadCustody(RECORD,{binding:BINDING,scopes:SCOPES,selectedClientId:null,
 checkedAtMs:Date.now(),expiresAtMs:LEASE});
const ALLOCATION={schema:'meri-conversation-host-allocation/1',tenantId:BINDING.tenantId,conversationId:BINDING.conversationId,
 generation:3,hostId:uuid(7),hostMode:'native-processing',imageDigest:IMAGE,leaseDeadlineMs:LEASE};
const IDENTITY={schema:'meri-d005-host-identity/1',hostId:uuid(7),conversationId:BINDING.conversationId,
 instanceId:'i-0123456789abcdef0',bootId:uuid(8)};

async function boot({root,scratch,mode='success'}){
 const childSettings={runtimeUid:1000,runtimeGid:1000,imageDigest:IMAGE,definitionsRoot:'/fixture/definitions',
  extractorPath:'/fixture/extract.py',scratchRoot:'/fixture/scratch',credentialPaths:['/proc/1/environ']};
 
// Synthetic low-level Linux ports: only the kernel effect is inert; the producer is the REAL one.
const lifecyclePortsFor=boot=>({async readBootId(){return boot;},
 async openGroup(){return {async readEvents(){return 'populated 0\nfrozen 0\n';},async close(){}};}});
const lifecycleLstat=()=>{throw Object.assign(Error('ENOENT'),{code:'ENOENT'});};
const config={listen:{address:'127.0.0.1',port:9443},
  tls:{keyPath:'/fixture/key',certPath:'/fixture/cert',caPath:'/fixture/ca',peerSan:'control.meri.internal',
   peerFingerprint:'a'.repeat(64),peerNotAfterMs:LEASE,maxPeerLifetimeMs:900000},
  image:{digest:IMAGE},binding:BINDING,allocation:{...ALLOCATION,instanceId:IDENTITY.instanceId,bootId:IDENTITY.bootId},
  limits:{cpuQuotaUs:50000,periodUs:100000,memoryBytes:268435456,pidsMax:16,deadlineMaxMs:5000,bodyBytes:15000000},
  paths:{definitionsRoot:root,helperPath:'/fixed/helper',nodePath:'/fixed/node',childPath:'/fixed/child-cli.mjs',
   home:'/fixture/home',runtimeUid:1000,runtimeGid:1000,childSettings}};
 const programs=[],roles=[],scanDirectories=[],compositions=[];
 let signatures=0,releaseVerification=null,listener=null,started=null,activeAtPlacementClose=null;
 const definitionsRun=async(program,args)=>{
  programs.push(program);
  if(program==='sigtool'&&++signatures===3&&mode==='late-pin')await new Promise(resolve=>{releaseVerification=resolve;});
  if(program==='freshclam'){const conf=await readFile(args[0].slice('--config-file='.length),'utf8');
   const database=conf.split('\n').find(line=>line.startsWith('DatabaseDirectory ')).slice('DatabaseDirectory '.length);
   await writeFile(join(database,'main.cvd'),Buffer.from('synthetic main CVD'));
   await writeFile(join(database,'daily.cvd'),Buffer.from('synthetic daily CVD'));}
  return {stdout:Buffer.alloc(0),receipt:closedReceipt()};
 };
 const zero='0'.repeat(16);
 const roleRun=async(role,options)=>{
  roles.push(role);
  if(role==='probe')return {stdout:Buffer.from(JSON.stringify({schema:RENDERER_PROBE_SCHEMA,inputValid:true,
    platform:'linux',uid:[1000,1000,1000,1000],gid:[1000,1000,1000,1000],noNewPrivs:1,
    capabilities:{CapInh:zero,CapPrm:zero,CapEff:zero,CapBnd:zero,CapAmb:zero},rootMountOptions:'ro,relatime',
    interfaces:['lo'],cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},
    envNames:[...UPLOAD_CHILD_ENV],cwd:options.cwd,home:options.cwd,tmpdir:options.cwd,
    workspace:{mode:0o700,uid:1000},
    credentialPathsReadable:JSON.parse(options.input).credentialPaths.map(path=>({path,readable:false}))})),
   receipt:closedReceipt()};
  if(options.mode==='version')return {stdout:Buffer.from(role==='scan'?'ClamAV 1.4.2/27450/x\n':'Python 3.13.16\n'),
   receipt:closedReceipt()};
  if(role==='scan'){scanDirectories.push(options.definitionsRoot);
   assert.deepEqual(await readFile(join(options.cwd,UPLOAD_SCAN_INPUT)),BYTES,'the scanner saw the exact original bytes');
   return {stdout:Buffer.from(UPLOAD_SCAN_INPUT+': OK\n'),receipt:closedReceipt()};}
  return {stdout:Buffer.from(JSON.stringify({status:'available',segments:[],limitations:[]})),receipt:closedReceipt()};
 };
 started=await startNativeProcessingHost({hierarchyPort:makeInertHierarchyPort(),config,lifecyclePorts:lifecyclePortsFor(IDENTITY.bootId),lifecycleLstat,readFile:()=>Buffer.from('synthetic TLS bytes'),definitionsRun,
  authenticatePeer:async()=>({verified:true,notAfterMs:LEASE}),
  verifyCustody:async()=>({authorized:true,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
   currentness:{policySha256:'f'.repeat(64),maxFreshMs:1000,readCurrent:async({allocation,binding})=>({allocation,binding,policySha256:'f'.repeat(64),phase:'active',checkedAtMs:Date.now(),currentUntilMs:Date.now()+500})}}),
  serverFactory:(_opts,handler)=>{listener=handler;return {once(){},listen(_p,_a,cb){cb();},close(cb){cb?.();}};},
  openHost:input=>openNativeProcessingHost({...input,
   openCompartment:async()=>({close:async()=>({closed:true})}),
   openPlacement:async()=>({run:async(_command,_args,{input:stdin})=>{
     if(mode==='failed-child')throw Object.assign(Error('SYNTHETIC_CHILD_FAILURE'),{code:'ARTIFACT_PROCESS_FAILED'});
     let captured=Buffer.alloc(0);
     await childMain({stdin:Readable.from([stdin]),
      stdout:new Writable({write(chunk,_e,cb){captured=Buffer.concat([captured,Buffer.from(chunk)]);cb();}}),
      identity:()=>({uid:1000,gid:1000}),
      inspect:args=>inspectFixed({...args,run:roleRun,
       compose:async options=>{const result=await composeUploadNativeHost({...options,tempRoot:scratch,
        configuration:{uploads:{native:{...options.configuration.uploads.native,definitionsRoot:root}}},
        readFileImpl:async path=>Buffer.from('fixed-tool:'+path)});
        compositions.push({missing:result.missing,reason:result.reason});return result;}})});
     return {stdout:captured,receipt:closedReceipt()};},
    close:async()=>{activeAtPlacementClose=started.definitionsOwner.active();return {closed:true};}})})});
 return {started,listener:()=>listener,programs,roles,scanDirectories,compositions,
  activeAtPlacementClose:()=>activeAtPlacementClose,releaseVerification:()=>releaseVerification,
  };
}

const requestFor=deadlineMs=>({kind:'upload-inspection',requestId:'a'.repeat(64),imageDigest:IMAGE,
 declaration:DECLARATION,bytesBase64:BYTES.toString('base64'),inputSha256:sha(BYTES),deadlineMs});
const envelope=deadlineMs=>({schema:NATIVE_UPLOAD_INSPECTION_SCHEMA,allocation:ALLOCATION,hostIdentity:IDENTITY,
 binding:BINDING,custody:CUSTODY,request:requestFor(deadlineMs)});
function requestStream(body){
 const stream=Readable.from([Buffer.from(JSON.stringify(body))]);
 Object.assign(stream,{method:'POST',url:NATIVE_UPLOAD_INSPECTION_PATH,headers:{},socket:{encrypted:true},complete:true});
 return stream;
}
const response=()=>{const r={status:0,body:'',listeners:new Map()};
 r.writeHead=s=>{r.status=s;};r.end=b=>{r.body=b;};r.once=(e,f)=>{r.listeners.set(e,f);};
 r.removeListener=e=>{r.listeners.delete(e);};return r;};

test('JOINED: real compose publishes/consumes the exact snapshot through the whole host path', async () => {
 const owned=await realpath(await mkdtemp(join(process.env.TMPDIR??process.env.TEMP??'.', 'meri-joined27-')));
 const root=join(owned,'definitions'),scratch=join(owned,'scratch');
 await mkdir(root);await mkdir(scratch);
 try{
  const host=await boot({root,scratch});
  await host.started.provisioning.completion;
  assert.ok(host.programs.includes('freshclam'),'updater ran');
  const expectedSnapshot=(await readFile(join(root,'current'),'utf8')).trim();
  const res=response();
  await host.listener()(requestStream(envelope(Date.now()+5000)),res);
  assert.equal(res.status,200,res.body+' compose='+JSON.stringify(host.compositions)+' roles='+JSON.stringify(host.roles));
  const result=JSON.parse(res.body);
  assert.equal(result.kind,'upload-inspection-result');
  assert.equal(result.scan.status,'clean');
  assert.equal(result.scan.definitionsSha256,expectedSnapshot,'the REAL published snapshot id was used');
  assert.equal(result.file.sha256,sha(BYTES),'the exact original bytes were inspected');
  assert.equal(result.extraction.status,'available');
  assert.deepEqual(host.scanDirectories,[join(root,'snapshots',expectedSnapshot,'database')]);
  assert.ok(host.roles.includes('probe'),'the real child probe ran first');
  assert.equal(host.programs.includes('freshclam'),true,'the real updater published the fixture');
  assert.equal(host.activeAtPlacementClose(),1,'the pin was held while the child was alive');
  assert.equal(host.started.definitionsOwner.active(),0,'released only after proven closure');
  assert.equal(host.compositions.length,1,'the real composeUploadNativeHost ran once');
  await host.started.close();
 }finally{await rm(owned,{recursive:true,force:true});}
});

test('JOINED defective child: a FAILED child with proven closure releases its pin', async () => {
 const owned=await realpath(await mkdtemp(join(process.env.TMPDIR??process.env.TEMP??'.', 'meri-fail27-')));
 const root=join(owned,'definitions'),scratch=join(owned,'scratch');
 await mkdir(root);await mkdir(scratch);
 try{
  const host=await boot({root,scratch,mode:'failed-child'});
  await host.started.provisioning.completion;
  const res=response();
  await host.listener()(requestStream(envelope(Date.now()+5000)),res);
  assert.notEqual(res.status,200,'a failed child never yields a successful inspection');
  assert.equal(host.started.definitionsOwner.active(),0,
   'proof of full closure means no future child, so its pin must not be retained');
 }finally{await rm(owned,{recursive:true,force:true});}
});

test('JOINED late pin: a verification completing after handler expiry is not lost', async () => {
 const owned=await realpath(await mkdtemp(join(process.env.TMPDIR??process.env.TEMP??'.', 'meri-late27-')));
 const root=join(owned,'definitions'),scratch=join(owned,'scratch');
 await mkdir(root);await mkdir(scratch);
 try{
  const host=await boot({root,scratch,mode:'late-pin'});
  await host.started.provisioning.completion;
  const res=response();
  await host.listener()(requestStream(envelope(Date.now()+200)),res);
  assert.notEqual(res.status,200,'an expired request is never served');
  const release=host.releaseVerification();
  assert.equal(typeof release,'function','the held verification was actually pending');
  release();                                     // INVOKE the resolver, so the held verification actually completes
  await new Promise(resolve=>setTimeout(resolve,80));
  assert.equal(host.started.definitionsOwner.active(),0,'a never-dispatched late pin cannot leak');
  assert.equal(host.compositions.length,0,'the expired request never dispatched a child');
  const closed=await host.started.close();
  assert.equal(closed.closed,true,'the definitive late release settles the host activity');
 assert.ok(Number.isSafeInteger(closed.quiescedAtMs));
 }finally{await rm(owned,{recursive:true,force:true});}
});

test('JOINED NEGATIVE: tampered custody is refused by the canonical parser, no child composition', async () => {
 const owned=await realpath(await mkdtemp(join(process.env.TMPDIR??process.env.TEMP??'.', 'meri-cust27-')));
 const root=join(owned,'definitions'),scratch=join(owned,'scratch');
 await mkdir(root);await mkdir(scratch);
 try{
  const host=await boot({root,scratch});
  await host.started.provisioning.completion;
  const bad=envelope(Date.now()+5000);
  bad.custody={...CUSTODY,sha256:'e'.repeat(64)};   // a REAL projection tampered to a different saved object hash
  const res=response();
  await host.listener()(requestStream(bad),res);
  assert.notEqual(res.status,200);
  assert.equal(JSON.parse(res.body).error,'NATIVE_UPLOAD_INSPECTION_REFUSED','canonical refusal: '+res.body);
  assert.equal(host.compositions.length,0,'no child composition ran');
  await host.started.close();
 }finally{await rm(owned,{recursive:true,force:true});}
});

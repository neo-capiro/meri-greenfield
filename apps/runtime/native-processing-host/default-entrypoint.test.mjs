import {compose,BYTES,DECLARATION,IMAGE,LEASE,POLICY,BINDING,SCOPES,RECORD,CUSTODY,ALLOCATION,IDENTITY,sha,uuid} from './currentness-fixture.mjs';
import https from 'node:https';
import {makeInertHierarchyPort} from './test-hierarchy-port.mjs';
import {assertNativeHostCurrent} from '../../worker/conversation/host/binding.mjs';
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
const {startNativeProcessingHost}=await import('./entrypoint.mjs');
import {openNativeProcessingHost} from './bootstrap.mjs';
import {childMain,inspectFixed} from './child-cli.mjs';
import {composeUploadNativeHost} from '../../runtime/uploads/composition.mjs';
import {nativeUploadCustody,NATIVE_UPLOAD_INSPECTION_PATH,NATIVE_UPLOAD_INSPECTION_SCHEMA} from '../../runtime/uploads/native-host-contract.mjs';
import {UPLOAD_CHILD_ENV,UPLOAD_SCAN_INPUT} from '../../runtime/uploads/native-sandbox.mjs';
import {RENDERER_PROBE_SCHEMA} from '../../artifacts/renderer-qualification.mjs';

async function boot({root,scratch,t,coreDenied=false,mode='success'}){
 const childSettings={runtimeUid:1000,runtimeGid:1000,imageDigest:IMAGE,definitionsRoot:'/fixture/definitions',
  extractorPath:'/fixture/extract.py',scratchRoot:'/fixture/scratch',credentialPaths:['/proc/1/environ']};
 
// Synthetic low-level Linux ports: only the kernel effect is inert; the producer is the REAL one.
const lifecyclePortsFor=boot=>({async readBootId(){return boot;},
 async openGroup(){return {async readEvents(){return 'populated 0\nfrozen 0\n';},async close(){}};}});
const lifecycleLstat=()=>{throw Object.assign(Error('ENOENT'),{code:'ENOENT'});};
const config={control:{clientKeyPath:'/fixture/client.key',clientCertPath:'/fixture/client.crt',caPath:'/fixture/control-ca.crt',address:'127.0.0.1',port:8443,serverName:'host.example',serverFingerprintSha256:'d'.repeat(64),policySha256:POLICY},listen:{address:'127.0.0.1',port:9443},
  tls:{keyPath:'/fixture/key',certPath:'/fixture/cert',caPath:'/fixture/ca',peerSan:'control.meri.internal',
   peerFingerprint:'a'.repeat(64),peerNotAfterMs:LEASE,maxPeerLifetimeMs:900000},
  image:{digest:IMAGE},binding:BINDING,allocation:{...ALLOCATION,instanceId:IDENTITY.instanceId,bootId:IDENTITY.bootId},
  limits:{cpuQuotaUs:50000,periodUs:100000,memoryBytes:268435456,pidsMax:16,deadlineMaxMs:5000,bodyBytes:15000000},
  paths:{definitionsRoot:root,helperPath:'/fixed/helper',nodePath:'/fixed/node',childPath:'/fixed/child-cli.mjs',
   home:'/fixture/home',runtimeUid:1000,runtimeGid:1000,childSettings}};
 const programs=[],roles=[],scanDirectories=[],compositions=[];
 let signatures=0,releaseVerification=null,listener=null,started=null,activeAtPlacementClose=null;
 const definitionsProgramRun=async(program,args)=>{
  programs.push(program);
  if(program==='sigtool'&&++signatures===3&&mode==='late-pin')await new Promise(resolve=>{releaseVerification=resolve;});
  if(program==='freshclam'){const conf=await readFile(args[0].slice('--config-file='.length),'utf8');
   const database=conf.split('\n').find(line=>line.startsWith('DatabaseDirectory ')).slice('DatabaseDirectory '.length);
   await writeFile(join(database,'main.cvd'),Buffer.from('synthetic main CVD'));
   await writeFile(join(database,'daily.cvd'),Buffer.from('synthetic daily CVD'));}
  return {stdout:Buffer.alloc(0),receipt:{exitCode:0}};
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
   receipt:{exitCode:0}};
  if(options.mode==='version')return {stdout:Buffer.from(role==='scan'?'ClamAV 1.4.2/27450/x\n':'Python 3.13.16\n'),
   receipt:{exitCode:0}};
  if(role==='scan'){scanDirectories.push(options.definitionsRoot);
   assert.deepEqual(await readFile(join(options.cwd,UPLOAD_SCAN_INPUT)),BYTES,'the scanner saw the exact original bytes');
   return {stdout:Buffer.from(UPLOAD_SCAN_INPUT+': OK\n'),receipt:{exitCode:0}};}
  return {stdout:Buffer.from(JSON.stringify({status:'available',segments:[],limitations:[]})),receipt:{exitCode:0}};
 };
 const control=await compose({coreDenied});t.mock.method(https,'request',control.transport.request);
 const definitionsRun=async(...args)=>{const value=await definitionsProgramRun(...args);
  if(args[0]==='freshclam'||args[0]==='sigtool')return {...value,receipt:{...(value?.receipt??{}),leaderClosed:true,groupAbsent:true,settlement:'closed'}};
  return value;};
 started=await startNativeProcessingHost({hierarchyPort:makeInertHierarchyPort(),config,lifecyclePorts:lifecyclePortsFor(IDENTITY.bootId),lifecycleLstat,readFile:()=>Buffer.from('synthetic TLS bytes'),definitionsRun,
  authenticatePeer:async()=>({verified:true,notAfterMs:LEASE,fingerprintSha256:'a'.repeat(64)}),
  serverFactory:(_opts,handler)=>{listener=handler;return {once(){},listen(_p,_a,cb){cb();},close(cb){cb?.();}};},
  openHost:input=>openNativeProcessingHost({...input,
   openCompartment:async()=>({close:async()=>({closed:true})}),
   openPlacement:async({authority})=>({run:async(_command,_args,{input:stdin})=>{
     const current=await authority.readCurrent();
     assertNativeHostCurrent({allocation:ALLOCATION,binding:BINDING,policySha256:POLICY,current,nowMs:Date.now(),maxFreshMs:5000});
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
     return {stdout:captured,receipt:{exitCode:0}};},
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

test('REVIEW46 DEFAULT entrypoint real verifier/currentness wire/canonical producer reaches actual child inspection and cleanup', async t => {
 const owned=await realpath(await mkdtemp(join(process.env.TMPDIR??process.env.TEMP??'.', 'meri-default46-')));
 const root=join(owned,'definitions'),scratch=join(owned,'scratch');
 await mkdir(root);await mkdir(scratch);
 try{
  const host=await boot({root,scratch,t});
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


test('REVIEW46 DEFAULT entrypoint refuses current Core denial before native inspection',async t=>{
 const owned=await realpath(await mkdtemp(join(process.env.TMPDIR??process.env.TEMP??'.','meri-default46-denied-')));
 const root=join(owned,'definitions'),scratch=join(owned,'scratch');await mkdir(root);await mkdir(scratch);
 let host;
 try{
  host=await boot({root,scratch,t,coreDenied:true});await host.started.provisioning.completion;
  const res=response();await host.listener()(requestStream(envelope(Date.now()+3000)),res);
  assert.notEqual(res.status,200);assert.equal(host.compositions.length,0);assert.equal(host.roles.length,0);
  assert.equal(host.started.definitionsOwner.active(),0);
 }finally{if(host)assert.equal((await host.started.close()).closed,true);await rm(owned,{recursive:true,force:true});}
});

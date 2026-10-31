/** FINITE79: the ACTUAL entrypoint composition. The producer is the real openNativeLifecycle; only the kernel surface
 *  (cgroup ports/lstat) and the socket/TLS/program effects are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {startNativeProcessingHost} from './entrypoint.mjs';
import {makeInertHierarchyPort} from './test-hierarchy-port.mjs';
import {runParent} from './hierarchy.mjs';
import {UPLOAD_DEFINITIONS_SCHEMA,definitionsSnapshotId} from '../uploads/native-definitions.mjs';
import {nativeProcessingConfig} from './config.mjs';
import {openNativeProcessingHost} from './bootstrap.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const IMAGE=`sha256:${'b'.repeat(64)}`;
const TENANT=uuid(1),CONV=uuid(3),HOST=uuid(7),BOOT=uuid(8);
const BINDING={tenantId:TENANT,actorId:uuid(2),conversationId:CONV,runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),writerFence:1};
const EVENTS0='populated 0'+String.fromCharCode(10)+'frozen 0'+String.fromCharCode(10);
const ENV=Object.freeze({
 MERI_NATIVE_PROCESSING_CONTROL_ADDRESS:'10.0.0.5',MERI_NATIVE_PROCESSING_CONTROL_PORT:'9443',
 MERI_NATIVE_PROCESSING_CONTROL_SERVER_NAME:'control.meri.internal',
 MERI_NATIVE_PROCESSING_CONTROL_FINGERPRINT:'d'.repeat(64),MERI_NATIVE_PROCESSING_POLICY_SHA256:'f'.repeat(64),
 MERI_NATIVE_PROCESSING_PORT:'9443',MERI_NATIVE_PROCESSING_ADDRESS:'127.0.0.1',
 MERI_NATIVE_PROCESSING_TLS_KEY:'/run/meri/tls.key',MERI_NATIVE_PROCESSING_TLS_CERT:'/run/meri/tls.crt',
 MERI_NATIVE_PROCESSING_TLS_CA:'/run/meri/ca.crt',
 MERI_NATIVE_PROCESSING_CONTROL_CLIENT_KEY:'/run/meri/client.key',MERI_NATIVE_PROCESSING_CONTROL_CLIENT_CERT:'/run/meri/client.crt',
 MERI_NATIVE_PROCESSING_CONTROL_CA:'/run/meri/control-ca.crt',MERI_NATIVE_PROCESSING_PEER_SAN:'control.meri.internal',
 MERI_NATIVE_PROCESSING_PEER_FINGERPRINT:'a'.repeat(64),MERI_NATIVE_PROCESSING_PEER_MAX_LIFETIME_MS:'900000',
 MERI_NATIVE_PROCESSING_PEER_NOT_AFTER_MS:String(Date.now()+600000),MERI_NATIVE_PROCESSING_IMAGE_DIGEST:IMAGE,
 MERI_NATIVE_PROCESSING_HOST_ID:HOST,MERI_NATIVE_PROCESSING_GENERATION:'3',
 MERI_NATIVE_PROCESSING_CONVERSATION_ID:CONV,MERI_NATIVE_PROCESSING_TENANT_ID:TENANT,
 MERI_NATIVE_PROCESSING_INSTANCE_ID:'i-0123456789abcdef0',MERI_NATIVE_PROCESSING_BOOT_ID:BOOT,
 MERI_NATIVE_PROCESSING_HOST_MODE:'native-processing',MERI_NATIVE_PROCESSING_ORIGINAL_BINDING:JSON.stringify(BINDING),
 MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS:String(Date.now()+600000),
 MERI_NATIVE_PROCESSING_CPU_QUOTA_US:'50000',MERI_NATIVE_PROCESSING_CPU_PERIOD_US:'100000',
 MERI_NATIVE_PROCESSING_MEMORY_BYTES:'268435456',MERI_NATIVE_PROCESSING_PIDS_MAX:'16',
 MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS:'1000',MERI_NATIVE_PROCESSING_BODY_BYTES:'1100000',
 MERI_NATIVE_PROCESSING_CLEANUP_MS:'120',MERI_NATIVE_PROCESSING_HELPER:'/usr/lib/meri/meri-host-launcher',
 MERI_NATIVE_PROCESSING_NODE:'/usr/local/bin/node',MERI_NATIVE_PROCESSING_CHILD:'/opt/meri/child-cli.mjs',
 MERI_NATIVE_PROCESSING_HOME:'/run/meri/processing',MERI_NATIVE_PROCESSING_DEFINITIONS:'/run/meri/upload-definitions',
 MERI_NATIVE_PROCESSING_EXTRACTOR:'/opt/meri/extract.py',MERI_NATIVE_PROCESSING_SCRATCH:'/run/meri/upload-scratch',
 MERI_NATIVE_PROCESSING_RUNTIME_UID:'1000',
 MERI_NATIVE_PROCESSING_RUNTIME_GID:'1000',MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'});
async function publishDefinitions(root){
 const bufs=[Buffer.from('cvd main'),Buffer.from('cvd daily')];
 const files=['main.cvd','daily.cvd'].map((name,i)=>({name,bytes:bufs[i].length,
  sha256:createHash('sha256').update(bufs[i]).digest('hex'),format:'cvd'}));
 const id=definitionsSnapshotId(files);
 const dir=join(root,'snapshots',id);await mkdir(join(dir,'database'),{recursive:true});
 await Promise.all(files.map((f,i)=>writeFile(join(dir,'database',f.name),bufs[i])));
 const at=Date.now()-1000;
 await writeFile(join(dir,'snapshot.json'),JSON.stringify({schema:UPLOAD_DEFINITIONS_SCHEMA,sha256:id,
  publishedAt:new Date(at).toISOString(),publishedAtMs:at,signatureVerified:true,version:'fixture',files}));
 await writeFile(join(root,'current'),id);
}
const LSTAT=()=>{throw Object.assign(Error('ENOENT'),{code:'ENOENT'});};
const inertServer=()=>({once(){},listen(_p,_a,cb){cb();},close(cb){cb?.();}});
const defsRun=async()=>({stdout:Buffer.alloc(0)});

async function boot({t,openGroup,quiesceSeen,serverFactory=inertServer,definitionsRun=defsRun,extra={},definitionsRoot}={}){
 const root=definitionsRoot??await mkdtemp(join(tmpdir(),'meri-79-'));
 const config={...nativeProcessingConfig({env:ENV}),paths:{...nativeProcessingConfig({env:ENV}).paths,definitionsRoot:root}};
 const order=[];
 const ports={async readBootId(){return BOOT;},
  async openGroup(path){order.push('openGroup');return openGroup?openGroup(path):{async readEvents(){return EVENTS0;},
   async close(){order.push('closeGroup');}};}};
 const started=await startNativeProcessingHost({hierarchyPort:makeInertHierarchyPort(),config,readFile:()=>Buffer.from('synthetic TLS bytes'),
  lifecyclePorts:ports,lifecycleLstat:LSTAT,serverFactory:wrap(serverFactory,order),definitionsRun,
  authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+600000}),...extra});
 return {root,config,order,started};
}
const wrap=(factory,order)=>(opts,handler)=>{const s=factory(opts,handler);const listen=s.listen,close=s.close;
 return {...s,listen(p,a,cb){order.push('listen');return listen(p,a,cb);},close(cb){order.push('server.close');return close(cb);}};};

test('STARTUP: the real producer pins the guest root BEFORE the listener is exposed',async t=>{
 const {root,order,started}=await boot({t});
 try{
  assert.equal(started.started,true);
  assert.equal(typeof started.lifecycle?.close,'function','the ACTUAL producer handle is exposed');
  assert.deepEqual(order,['openGroup','listen'],'the root is pinned before listen');
 }finally{await started.close();await rm(root,{recursive:true,force:true});}
});

test('CLOSE: producer quiesce runs before the listener closes, then disposes exactly once',async t=>{
 const {root,order,started}=await boot({t});
 try{
  const first=await started.close();
  const second=await started.close();
  assert.equal(first.closed,true);
  assert.deepEqual(second,first,'the close result is cached');
  assert.equal(order.filter(x=>x==='server.close').length,1);
  assert.equal(order.filter(x=>x==='closeGroup').length,1,'the acquired descriptor is closed once');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('CLOSE: a SETTLED unknown definition receipt (group present) keeps the host UNKNOWN',async t=>{
 let dispatched=0;
 const run=async program=>{dispatched+=1;
  throw Object.assign(Error('ARTIFACT_CLEANUP_FAILED'),{code:'ARTIFACT_CLEANUP_FAILED',
   receipt:{leaderClosed:true,groupAbsent:false,settlement:'closed'}});};
 const {root,started}=await boot({t,definitionsRun:run});
 try{
  await started.provisioning.completion;
  assert.equal(dispatched>=1,true,'the low-level program runner was actually invoked');
  const closed=await started.close();
  assert.equal(closed.closed,false,'an unknown physical process cannot be promoted to closed');
  assert.equal(closed.code,'NATIVE_PROCESSING_CLEANUP_UNKNOWN');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('CLOSE: a MISSING receipt on a dispatched call keeps the host UNKNOWN',async t=>{
 const run=async()=>({stdout:Buffer.alloc(0)});
 const {root,started}=await boot({t,definitionsRun:run});
 try{
  await started.provisioning.completion;
  const closed=await started.close();
  assert.equal(closed.closed,false,'a result without a physical receipt is unknown');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('CLOSE: a truthful closed error receipt settles closed and no program runs after quiesce',async t=>{
 let dispatched=0;
 const run=async(...args)=>{dispatched+=1;
  if(args[0]==='freshclam')throw Object.assign(Error('PUBLISH_RETRY'),{code:'PUBLISH_RETRY',
   receipt:{leaderClosed:true,groupAbsent:true,settlement:'closed'}});
  return {stdout:Buffer.alloc(0),receipt:{leaderClosed:true,groupAbsent:true,settlement:'closed'}};};
 const {root,started}=await boot({t,definitionsRun:run});
 try{
  await started.provisioning.completion;
  const before=dispatched;
  const closed=await started.close();
  assert.equal(closed.closed,true,'a proven closed error receipt is honest closure');
  await started.provisioning.completion.catch(()=>{});
  assert.equal(dispatched,before,'no definition program is dispatched after quiesce closed admission');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('STARTUP: a held initial definition probe never exposes the listener',async t=>{
 let listens=0;
 const held=()=>new Promise(()=>{});
 const rootHolder=await mkdtemp(join(tmpdir(),'meri-79-held-'));
 await publishDefinitions(rootHolder);
 const {root,started}=await boot({t,definitionsRoot:rootHolder,definitionsRun:held,extra:{serverFactory:(_o,h)=>({once(){},listen(_p,_a,cb){listens+=1;cb?.();},
  close(cb){cb?.();}})}});
 try{
  assert.equal(started.started,false,'an unsettled probe cannot start the host');
  assert.equal(started.error,'UPLOAD_DEFINITIONS_PENDING');
  assert.equal(listens,0,'no listener is exposed while the initial verification is unsettled');
 }finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:50}).catch(()=>{});}
});

test('STARTUP: a throwing serverFactory disposes the acquired descriptor exactly once',async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-79-factory-'));
 const config={...nativeProcessingConfig({env:ENV}),paths:{...nativeProcessingConfig({env:ENV}).paths,definitionsRoot:root}};
 const order=[];
 try{
  const ports={async readBootId(){return BOOT;},async openGroup(){order.push('openGroup');
   return {async readEvents(){return EVENTS0;},async close(){order.push('closeGroup');}};}};
  const result=await startNativeProcessingHost({hierarchyPort:makeInertHierarchyPort(),config,readFile:()=>Buffer.from('inert'),
   lifecyclePorts:ports,lifecycleLstat:LSTAT,serverFactory(){throw Error('SERVER_FACTORY_FAILED');},
   definitionsRun:async()=>({stdout:Buffer.alloc(0),receipt:{leaderClosed:true,groupAbsent:true,settlement:'closed'}}),
   authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+600000})});
  assert.equal(result.started,false);
  assert.equal(order.filter(x=>x==='openGroup').length,1);
  assert.equal(order.filter(x=>x==='closeGroup').length,1,'the acquired descriptor is closed once');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('BOOTSTRAP: a lower unknown partial cleanup is never upgraded by outer unwind',async()=>{
 const config=nativeProcessingConfig({env:ENV});
 const a=config.allocation;
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:a.tenantId,conversationId:a.conversationId,
  generation:a.generation,hostId:a.hostId,imageDigest:config.image.digest,leaseDeadlineMs:a.leaseDeadlineMs,hostMode:a.hostMode};
 const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:a.instanceId,bootId:a.bootId,
  conversationId:a.conversationId,hostId:a.hostId};
 const base={config,allocation,binding:config.binding,hostIdentity,hierarchyPort:makeInertHierarchyPort({boot:config.allocation.bootId,existingHost:true}),authority:{policySha256:'f'.repeat(64),maxFreshMs:1000,readCurrent:async({allocation,binding})=>({allocation,binding,policySha256:'f'.repeat(64),phase:'active',checkedAtMs:Date.now(),currentUntilMs:Date.now()+500})}};
 for(const stage of ['compartment','placement']){
  let compartmentClose=0;
  const failure=Object.assign(Error('owned setup unknown'),{code:'SETUP_UNKNOWN',partialCleanup:'unknown'});
  const openCompartment=async()=>{if(stage==='compartment')throw failure;
   return {close:async()=>{compartmentClose+=1;return {closed:true};}};};
  await assert.rejects(openNativeProcessingHost({...base,openCompartment,
   openPlacement:async()=>{throw failure;}}),error=>{
    assert.equal(error.partialCleanup,'unknown',`${stage} unknown must not become closure`);
    return true;});
  assert.equal(compartmentClose,stage==='placement'?1:0);
 }
});

test('BOOTSTRAP: missing or occupied failing-stage evidence stays unknown; explicit lower proof is retained',async()=>{
 const config=nativeProcessingConfig({env:ENV}),a=config.allocation;
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:a.tenantId,conversationId:a.conversationId,
  generation:a.generation,hostId:a.hostId,imageDigest:config.image.digest,leaseDeadlineMs:a.leaseDeadlineMs,hostMode:a.hostMode};
 const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:a.instanceId,bootId:a.bootId,
  conversationId:a.conversationId,hostId:a.hostId};
 const base={config,allocation,binding:config.binding,hostIdentity,hierarchyPort:makeInertHierarchyPort({boot:config.allocation.bootId,existingHost:true}),authority:{policySha256:'f'.repeat(64),maxFreshMs:1000,readCurrent:async({allocation,binding})=>({allocation,binding,policySha256:'f'.repeat(64),phase:'active',checkedAtMs:Date.now(),currentUntilMs:Date.now()+500})}};
 for(const lower of [undefined,'occupied']){
  const failure=Object.assign(Error('placement failed'),{code:'SETUP_FAILED',...(lower===undefined?{}:{partialCleanup:lower})});
  await assert.rejects(openNativeProcessingHost({...base,openCompartment:async()=>({close:async()=>({closed:true})}),
   openPlacement:async()=>{throw failure;}}),error=>{
    assert.equal(error.partialCleanup,'unknown',`${lower??'missing'} evidence must stay unknown`);return true;});
 }
 for(const lower of ['not-created','removed']){
  const failure=Object.assign(Error('compartment refused'),{code:'SETUP_REFUSED',partialCleanup:lower});
  // Borrow an ALREADY-PRESENT run parent so no upper-owned hierarchy effect exists: the lower disposition is then the only one.
  const borrowed=makeInertHierarchyPort({boot:config.allocation.bootId,existingHost:true});
  borrowed.mkdir(runParent(config,config.binding));
  borrowed.nodes.get(runParent(config,config.binding)).enabled='cpu memory pids';
  await assert.rejects(openNativeProcessingHost({...base,hierarchyPort:borrowed,openCompartment:async()=>{throw failure;},
   openPlacement:async()=>{throw Error('unreachable');}}),error=>{
    assert.equal(error.partialCleanup,lower,'an explicit lower closure disposition is retained');return true;});
 }
});

test('STARTUP: a failed factory/listen starts no new updater work during cleanup',async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-82-norefresh-'));
 let chmods=0;
 try{
  const baseConfig=nativeProcessingConfig({env:ENV});
  const config={...baseConfig,paths:{...baseConfig.paths,definitionsRoot:root},
   limits:{...baseConfig.limits,deadlineMaxMs:200}};
  const result=await startNativeProcessingHost({hierarchyPort:makeInertHierarchyPort(),config,readFile:()=>Buffer.from('inert'),
   lifecyclePorts:{async readBootId(){return BOOT;},async openGroup(){return {async readEvents(){return EVENTS0;},async close(){}};}},
   lifecycleLstat:LSTAT,serverFactory(){throw Error('SERVER_FACTORY_FAILED');},
   definitionsRun:async()=>({stdout:Buffer.alloc(0),receipt:{leaderClosed:true,groupAbsent:true,settlement:'closed'}}),
   definitionsChmod:async()=>{chmods+=1;},
   authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+600000})});
  assert.equal(result.started,false);
  assert.equal(chmods,0,'cleanup may await retained work but must not start a new updater');
 }finally{await rm(root,{recursive:true,force:true}).catch(()=>{});}
});

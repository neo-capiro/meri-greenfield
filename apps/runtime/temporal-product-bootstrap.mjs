/** Owns task-local installation/lifetime of the genuine post-placement reply.
 * The issuer client, not metadata or this filesystem owner, proves identity. */
import * as nativeFs from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {posix} from 'node:path';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {readSecret} from './config.mjs';
import {parseTemporalIssuerDeliveryConfiguration} from './temporal-issuer/client.mjs';
import {assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
import {parseTemporalProductBootstrapConfiguration,temporalProductBootstrapPaths} from './temporal-product-bootstrap-configuration.mjs';
export {parseTemporalProductBootstrapConfiguration} from './temporal-product-bootstrap-configuration.mjs';

const {root,directory:identityRoot,lockPath}=temporalProductBootstrapPaths;
const deliveryKeys=['schemaVersion','issuerOrigin','audience','namespace','identity','publicKey','tls','requestTimeoutMs','maxReplyBytes'];
const fail=()=>{throw Object.assign(Error('TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'),{code:'TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const callable=value=>typeof value==='function'&&!types.isProxy(value);
const same=(a,b)=>['dev','ino','uid','gid'].every(key=>a[key]===b[key]);
const inode=st=>Object.fromEntries(['dev','ino','uid','gid'].map(key=>[key,st[key]]));

/** Same exclusive-file/inode/hash discipline as the canonical token writer.
 * No chmod/chown, recursive removal or adoption. A fresh empty target is first
 * reserved by exclusive mkdir; rename replaces only that owned placeholder. */
function bootstrapFiles(c,fs,runtimeIdentity,newId){
 let parent=null,ownedRoot=null;
 const directories=new Map(),files=new Map();
 const ownedFile=st=>st.isFile()&&!st.isSymbolicLink()&&st.uid===1000&&st.gid===1000&&(st.mode&0o777)===0o600&&st.nlink===1;
 const ownedDirectory=st=>st.isDirectory()&&!st.isSymbolicLink()&&st.uid===1000&&st.gid===1000&&(st.mode&0o777)===0o700;
 async function directory(path,expected){
  const st=await fs.lstat(path);if(!ownedDirectory(st)||await fs.realpath(path)!==path||expected&&!same(st,expected))fail();return inode(st);
 }
 async function parentCheck(){
  if(runtimeIdentity.platform!=='linux'||runtimeIdentity.uid!==1000||runtimeIdentity.gid!==1000)fail();
  const observed=await directory(root,parent);parent??=observed;
 }
 async function pathParent(path){await parentCheck();const parentPath=posix.dirname(path);
  if(parentPath!==root){const expected=directories.get(parentPath);if(!expected)fail();await directory(parentPath,expected);}}
 async function absent(path){try{await fs.lstat(path);}catch(error){if(error?.code==='ENOENT')return;throw error;}fail();}
 async function syncDirectory(path,expected,check=()=>{}){let handle;try{
  check();
  handle=await fs.open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  check();const st=await handle.stat();if(!ownedDirectory(st)||!same(st,expected))fail();check();await handle.sync();check();
 }finally{await handle?.close();}}
 async function inspectFile(record){let handle,bytes;try{
  await pathParent(record.path);
  handle=await fs.open(record.path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const st=await handle.stat();if(!ownedFile(st)||!same(st,record)||st.size>65536||record.bytes!==undefined&&st.size!==record.bytes)fail();
  bytes=Buffer.alloc(65537);let used=0;
  while(used<bytes.length){const part=await handle.read(bytes,used,bytes.length-used,used);if(part.bytesRead===0)break;used+=part.bytesRead;}
  const after=await handle.stat();if(!ownedFile(after)||!same(after,record)||used!==st.size||after.size!==st.size||used>65536||record.sha256!==undefined&&sha(bytes.subarray(0,used))!==record.sha256)fail();
 }finally{bytes?.fill(0);await handle?.close();}}
 async function inspectDirectory(record){
  await directory(record.path,record);const expected=[...files.keys(),...directories.keys()].filter(path=>path!==record.path&&posix.dirname(path)===record.path).map(path=>posix.basename(path)).sort();
  const entries=(await fs.readdir(record.path)).sort();if(JSON.stringify(entries)!==JSON.stringify(expected))fail();
 }
 async function createFile(path,bytes,check){let handle;try{
  await pathParent(path);check();handle=await fs.open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  // stat is required even after a late open so the newly created inode is
  // retained for cleanup; no write or sync follows an expired lifetime.
  const st=await handle.stat(),record={path,...inode(st)};files.set(path,record);check();if(!ownedFile(st))fail();
  await handle.writeFile(bytes);check();await handle.sync();check();const after=await handle.stat();
  if(!ownedFile(after)||!same(after,record)||after.size!==bytes.length)fail();record.bytes=bytes.length;record.sha256=sha(bytes);check();return record;
 }finally{await handle?.close();}}
 async function freshDirectory(path,check){await pathParent(path);check();await fs.mkdir(path,{mode:0o700});
  const record={path,...await directory(path)};directories.set(path,record);check();return record;}
 async function inspectAll(){await parentCheck();for(const record of directories.values())await inspectDirectory(record);for(const record of files.values())await inspectFile(record);}
 async function removeGeneration(path,check=()=>{}){
  const record=directories.get(path);if(!record)fail();await inspectAll();check();
  for(const [name,file]of [...files])if(posix.dirname(name)===path){await inspectFile(file);check();await fs.unlink(name);files.delete(name);check();}
  await directory(path,record);check();await fs.rmdir(path);directories.delete(path);check();await syncDirectory(identityRoot,ownedRoot,check);
 }
 return Object.freeze({
  async acquire(check){
   await parentCheck();check();await absent(identityRoot);await absent(c.keyFile);await absent(c.certFile);await absent(lockPath);
   await createFile(lockPath,Buffer.from('meri-temporal-bootstrap-v1\n'),check);await syncDirectory(root,parent,check);
   ownedRoot=await freshDirectory(identityRoot,check);await syncDirectory(root,parent,check);
  },
  async install(reply,check){
   await inspectAll();check();const id=newId();if(typeof id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(id))fail();
   const target=identityRoot+'/generation-'+id,stage=identityRoot+'/.generation-'+id+'.next';
   const reserved=await freshDirectory(target,check),staged=await freshDirectory(stage,check);
   await createFile(stage+'/client-key.pem',reply.keyPem,check);await createFile(stage+'/client-cert.pem',reply.certPem,check);
   await inspectAll();check();await syncDirectory(stage,staged,check);await directory(target,reserved);if((await fs.readdir(target)).length)fail();check();
   await fs.rename(stage,target);
   directories.delete(stage);directories.set(target,{...staged,path:target});
   for(const [path,record]of [...files])if(posix.dirname(path)===stage){files.delete(path);const moved=target+'/'+posix.basename(path);files.set(moved,{...record,path:moved});}
   check();await syncDirectory(identityRoot,ownedRoot,check);await inspectAll();check();
   return Object.freeze({directory:target,keyFile:target+'/client-key.pem',certFile:target+'/client-cert.pem'});
  },removeGeneration,
  async clear(){
   if(!parent)return;await inspectAll();
   for(const [path]of [...directories].filter(([path])=>path!==identityRoot))await removeGeneration(path);
   const rootRecord=directories.get(identityRoot),lockRecord=files.get(lockPath);
   if(rootRecord){await directory(identityRoot,rootRecord);if((await fs.readdir(identityRoot)).length)fail();await fs.rmdir(identityRoot);directories.delete(identityRoot);ownedRoot=null;}
   if(lockRecord){await inspectFile(lockRecord);await fs.unlink(lockRecord.path);files.delete(lockRecord.path);}
   await syncDirectory(root,parent);
  },
 });
}

/** Bounded startup retry of the INITIAL bootstrap only. The process asks the
 * issuer for its certificate about a second after its container starts, but
 * the issuer proves the caller through ECS DescribeServices/DescribeTasks and
 * requires the task RUNNING and the service's runningCount above zero, which
 * the ECS control plane shows only several seconds later. A one-shot attempt
 * therefore lost that race and control/temporal-worker crash-looped. Only an
 * attempt the issuer refused before any certificate could have been issued
 * (the client never sent its redeem request, and its transports settled to a
 * CLEAN receipt) is retried, on a fresh client, every RETRY_INTERVAL_MS until
 * the window closes. Rotations, material/config refusals, delivered-then-
 * failed attempts, unsettled transports and stop requests are terminal at
 * once, with the same content-free status as before. Reviewed constants, not
 * configuration: the closed runtime schema and rendered bindings stay as they
 * are. cli.mjs ends startup at limits.startupMs, so the window is also capped
 * by startupMs minus a reserve for the rest of startup (Temporal connection,
 * worker creation, listen); startup attempts never outlive that window. */
export const TEMPORAL_BOOTSTRAP_STARTUP_WINDOW_MS=180000,TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS=2500,TEMPORAL_BOOTSTRAP_STARTUP_RESERVE_MS=10000;
const retriedCodes=['TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED','TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'];
export function temporalBootstrapStartupWindowMs(limits){
 const startupMs=limits!==null&&typeof limits==='object'&&!types.isProxy(limits)?Object.getOwnPropertyDescriptor(limits,'startupMs')?.value:undefined;
 return integer(startupMs,100,30000)?Math.min(TEMPORAL_BOOTSTRAP_STARTUP_WINDOW_MS,startupMs-TEMPORAL_BOOTSTRAP_STARTUP_RESERVE_MS):TEMPORAL_BOOTSTRAP_STARTUP_WINDOW_MS;
}

/** Root serializes all delivery.read calls and rebuilds its mTLS client from
 * ensureCurrent's derived config. It drains the old client before registration
 * CAS can invalidate the predecessor; no stale client/config fallback exists. */
export async function startTemporalProductBootstrap(configuration,options={}){
 const o=own(options,[],['signal','onUnavailable','now','timers','testOwners']);nativeSignal(o.signal);
 const t=configuration?.temporal,c=parseTemporalProductBootstrapConfiguration(t?.issuerBootstrap,t?.issuerDelivery);
 if(!c.enabled){if(t?.issuerDelivery!==undefined||t?.tokenWriter?.enabled===true)fail();return null;}
 const delivery=parseTemporalIssuerDeliveryConfiguration(t.issuerDelivery),now=o.now??Date.now,timers=o.timers??{setTimeout,clearTimeout};
 if(!callable(now)||!callable(timers.setTimeout)||!callable(timers.clearTimeout)||!callable(o.onUnavailable)||types.isAsyncFunction(o.onUnavailable)||types.isGeneratorFunction(o.onUnavailable))fail();
 const tests=own(o.testOwners??{},[],['loadClient','readMaterial','filesystem','environment','runtimeIdentity','stagingId']);
 const fs=tests.filesystem??nativeFs,readMaterial=tests.readMaterial??readSecret,environment=tests.environment??process.env,
  loadClient=tests.loadClient??(()=>import('./temporal-issuer/bootstrap-client.mjs')),
  runtimeIdentity=tests.runtimeIdentity??{platform:process.platform,uid:process.getuid?.(),gid:process.getgid?.()},newId=tests.stagingId??randomUUID;
 if(!callable(readMaterial)||!callable(loadClient)||!callable(newId))fail();
 const files=bootstrapFiles(c,fs,runtimeIdentity,newId),buffers=new Set(),pending=new Set(),clients=new Set(),watchers=new Set();
 let current=null,revision=0,closed=false,failure=null,closing=null,refreshing=null,active=null,expiry=null,fileQueue=Promise.resolve(),stopFailed=false;
 let acquired=false,windowEndMs=null,retryable=false;
 const reserveMs=c.configuration.totalTimeoutMs+delivery.requestTimeoutMs+c.configuration.requestTimeoutMs;
 const unavailable=()=>Object.assign(Error('TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'),{code:'TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'});
 function clearExpiry(){if(expiry!==null)timers.clearTimeout(expiry);expiry=null;}
 function capture(value){
  const found=Buffer.isBuffer(value)?[value]:value&&typeof value==='object'&&!types.isProxy(value)?['keyPem','certPem'].map(key=>Object.getOwnPropertyDescriptor(value,key)?.value):[];
  for(const bytes of found)if(Buffer.isBuffer(bytes)){if(closed||failure)bytes.fill(0);else buffers.add(bytes);}return value;
 }
 function track(work){const promise=Promise.resolve().then(work).then(capture);pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;}
 function queued(work){const promise=fileQueue.then(work);fileQueue=promise.catch(()=>{});return promise;}
 function lifetime(signal,deadlineMs=now()+c.configuration.totalTimeoutMs){return createOperationLifetime({now,signal,deadlineMs,schedule:timers.setTimeout,unschedule:timers.clearTimeout,errorFactory:unavailable});}
 function sleep(ms,signal){return new Promise(resolve=>{const timer=timers.setTimeout(done,ms);function done(){timers.clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});});}
 function lose(){
  if(closed||failure)return;failure='TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE';clearExpiry();active?.abort();
  for(const watcher of watchers)try{watcher(failure);}catch{}
  try{const result=o.onUnavailable(failure);if(result!==undefined){if(types.isPromise(result))Promise.prototype.then.call(result,undefined,()=>{});stopFailed=true;}}catch{stopFailed=true;}
 }
 const healthy=()=>!closed&&!failure&&current!==null&&current.expiresAtMs>now();
 const status=()=>Object.freeze({enabled:true,state:closed?'closed':failure?'unavailable':healthy()?'current':'idle',revision:current?.revision??null,
  expiresAtMs:current?.expiresAtMs??null,certificateSha256:current?.certificateSha256??null,taskArn:current?.taskArn??null,failure,physicalStopProven:false});
 async function closeClients(){const results=await Promise.allSettled([...clients].map(client=>Promise.resolve().then(()=>client.close())));assertTemporalRuntimeCleanup(results);clients.clear();}
 function close(){
  if(closing)return closing;closed=true;clearExpiry();active?.abort();for(const bytes of buffers)bytes.fill(0);buffers.clear();
  closing=(async()=>{const life=lifetime();let summary;try{
   const results=await life.run(()=>Promise.allSettled([closeClients(),queued(()=>files.clear())]));assertTemporalRuntimeCleanup(results);
   if(pending.size||stopFailed)throw temporalCleanupUnknown({unsettledOperations:pending.size,stopFailed,physicalStopProven:false});
   return Object.freeze({closed:true,unsettledOperations:0,physicalStopProven:false});
  }catch(error){throw temporalCleanupUnknown(error);}finally{summary=life.close();watchers.clear();if(summary.unsettledOperations>0)failure='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN';}})();return closing;
 }
 /** The unchanged terminal path: lose, close, and rethrow content-free. */
 async function terminal(error){
  lose();try{await close();}catch(cleanup){throw temporalCleanupUnknown(new AggregateError([error,cleanup],'TEMPORAL_BOOTSTRAP_AND_CLEANUP_FAILED'));}
  if(error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN')throw error;
  throw unavailable();
 }
 /** One bootstrap attempt. `startup` marks an attempt inside the initial
  * window, the only kind that may end retryable instead of terminal. */
 function refresh(v,startup){
  refreshing=(async()=>{let life,client,reply,old=current,soft=false;active=new AbortController();const abort=()=>active?.abort();v.signal?.addEventListener('abort',abort,{once:true});
   if(v.signal?.aborted)abort();
   try{
    const started=now(),budget=started+c.configuration.totalTimeoutMs;
    life=lifetime(active.signal,old?Math.min(old.expiresAtMs,budget):startup&&windowEndMs!==null?Math.min(windowEndMs,budget):budget);
    const check=()=>{life.check();if(closed||failure)fail();};
    if(old){if(!callable(v.beforeRotation))fail();const receipt=await life.run(()=>track(()=>v.beforeRotation()));assertTemporalRuntimeCleanup([{status:'fulfilled',value:receipt}]);
     if(receipt===null||typeof receipt!=='object'||Object.getOwnPropertyDescriptor(receipt,'unsettledOperations')?.value!==0)
      throw temporalCleanupUnknown({reason:'MISSING_DRAIN_RECEIPT',physicalStopProven:false});check();}
    const module=await life.run(()=>track(loadClient));check();
    if(!callable(module.parseTemporalIssuerBootstrapClientConfiguration)||!callable(module.createTemporalIssuerBootstrapClient))fail();
    const clientConfiguration=module.parseTemporalIssuerBootstrapClientConfiguration({...c.configuration,metadataUri:environment.ECS_CONTAINER_METADATA_URI_V4});
    const serverCaPem=await life.run(()=>track(()=>readMaterial(c.serverCaFile))),clientCaPem=await life.run(()=>track(()=>readMaterial(c.clientCaFile)));check();
    if(!Buffer.isBuffer(serverCaPem)||!Buffer.isBuffer(clientCaPem)||serverCaPem.length<1||serverCaPem.length>32768||clientCaPem.length<1||clientCaPem.length>32768)fail();
    client=module.createTemporalIssuerBootstrapClient({configuration:clientConfiguration,serverCaPem,clientCaPem,now});
    if(callable(client?.close))clients.add(client);
    if(!callable(client?.available)||!callable(client?.bootstrap)||!callable(client?.close)||!callable(client?.issuanceRequested)||!callable(client?.settle)||client.available()!==true)fail();
    // The lock and identity root are acquired once; later startup attempts reuse them.
    if(!old&&!acquired){await life.run(()=>track(()=>queued(()=>files.acquire(check))));acquired=true;check();}
    let material;
    try{material=await life.run(signal=>track(()=>client.bootstrap({signal})));}
    catch(error){
     // Startup only: a refusal before the redeem request leaves no certificate
     // issuer-side. Wait for the client's transports to settle so its receipt
     // is CLEAN; anything else keeps the fence's cleanup-unknown semantics.
     if(startup&&!old&&!closed&&!failure&&!o.signal?.aborted&&retriedCodes.includes(error?.code)&&client.issuanceRequested()===false){
      await life.run(signal=>track(()=>client.settle({signal})));check();
      if(client.issuanceRequested()!==false)fail();
      const receipt=client.close();assertTemporalRuntimeCleanup([{status:'fulfilled',value:receipt}]);clients.delete(client);check();
      soft=true;
     }
     throw error;
    }
    reply=own(material,['schemaVersion','role','taskArn','certificateSha256','expiresAtMs','keyPem','certPem','registration']);check();
    const cluster=c.configuration.clusterArn.slice(c.configuration.clusterArn.indexOf('cluster/')+8),registration=own(reply.registration,['schemaVersion','state','certificateSha256','role','peerSanUri','taskArn','revision','expiresAtMs']);
    if(reply.schemaVersion!==1||reply.role!==c.configuration.role||typeof reply.taskArn!=='string'||
       !new RegExp(`^arn:aws:ecs:us-east-1:967807252336:task/${cluster}/[a-f0-9]{32}$`,'u').test(reply.taskArn)||!hex(reply.certificateSha256)||
       !integer(reply.expiresAtMs,now()+reserveMs+1,now()+300000)||!Buffer.isBuffer(reply.keyPem)||reply.keyPem.length<1||reply.keyPem.length>65536||
       !Buffer.isBuffer(reply.certPem)||reply.certPem.length<1||reply.certPem.length>16384||registration.schemaVersion!==1||registration.state!=='CURRENT'||
       registration.certificateSha256!==reply.certificateSha256||registration.role!==reply.role||registration.taskArn!==reply.taskArn||registration.revision!==c.configuration.revision||
       registration.expiresAtMs!==reply.expiresAtMs||registration.peerSanUri!==c.configuration.peerUriBase+encodeURIComponent(reply.taskArn)||old&&reply.taskArn!==old.taskArn)fail();
    const installed=await life.run(()=>track(()=>queued(()=>files.install(reply,check))));check();
    const results=await life.run(()=>track(()=>Promise.allSettled([Promise.resolve().then(()=>client.close())])));assertTemporalRuntimeCleanup(results);clients.delete(client);check();
    if(old)await life.run(()=>track(()=>queued(()=>files.removeGeneration(old.directory,check))));check();
    const rawDelivery=Object.fromEntries(deliveryKeys.map(key=>[key,delivery[key]])),issuerDeliveryConfiguration=data({...rawDelivery,tls:{...delivery.tls,clientKeyFile:installed.keyFile,clientCertFile:installed.certFile}});
    clearExpiry();revision++;current=Object.freeze({...installed,revision,issuerDeliveryConfiguration,expiresAtMs:reply.expiresAtMs,certificateSha256:reply.certificateSha256,taskArn:reply.taskArn});
    const heldRevision=revision;
    expiry=timers.setTimeout(()=>{if(current?.revision===heldRevision){lose();close().catch(()=>{});}},Math.max(1,current.expiresAtMs-now()));expiry?.unref?.();
    return Object.freeze({revision,issuerDeliveryConfiguration});
   }catch(error){
    // A settled, never-issued startup refusal does not poison the owner; the
    // startup loop decides whether the window still allows another attempt.
    if(soft&&!closed&&!failure&&pending.size===0&&life.pendingOperations()===0){retryable=true;throw error;}
    await terminal(error);}
   finally{const summary=life?.close();if(summary?.unsettledOperations>0)failure='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN';for(const bytes of buffers)bytes.fill(0);buffers.clear();v.signal?.removeEventListener('abort',abort);active=null;refreshing=null;}
  })();return refreshing;
 }
 function ensureCurrent(input={}){
  const v=own(input,[],['signal','beforeRotation']);nativeSignal(v.signal);
  if(closed||failure||v.signal?.aborted)return Promise.reject(unavailable());
  if(refreshing)return refreshing;
  if(healthy()&&current.expiresAtMs-now()>reserveMs)return Promise.resolve(Object.freeze({revision:current.revision,issuerDeliveryConfiguration:current.issuerDeliveryConfiguration}));
  return refresh(v,false);
 }
 /** Initial bootstrap inside the bounded startup window (see the constants). */
 async function startup(){
  const begun=now(),windowMs=temporalBootstrapStartupWindowMs(configuration?.limits);if(!Number.isSafeInteger(begun))fail();
  if(o.signal?.aborted)throw unavailable();
  windowEndMs=windowMs>0?begun+windowMs:null;
  try{
   for(;;){
    retryable=false;
    try{return await refresh({signal:o.signal},true);}
    catch(error){
     if(!retryable)throw error;
     if(closed||failure)await terminal(error);
     const at=now();
     // No attempt starts at or after the window's end; a running attempt's
     // own deadline is already capped there.
     if(o.signal?.aborted||windowEndMs===null||!Number.isSafeInteger(at)||at+TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS>=windowEndMs)await terminal(error);
     await sleep(TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS,o.signal);
     if(o.signal?.aborted||closed||failure)await terminal(error);
    }
   }
  }finally{windowEndMs=null;}
 }
 const owner=Object.freeze({ensureCurrent,close,healthy,status,watch(listener){if(!callable(listener))fail();watchers.add(listener);return ()=>watchers.delete(listener);}});
 await startup();return owner;
}

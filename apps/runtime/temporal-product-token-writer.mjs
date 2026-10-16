/** Disabled source interface for task-local Temporal token delivery. This is not an issuer HTTP client or signer.
 * Trusted startup supplies delivery.read after independently authenticating the workload and issuer. A matching echo here
 * is configuration consistency, never cryptographic proof. The application must watch authorization loss and stop its
 * existing Temporal connection; deleting a file cannot revoke a token already cached by another process or server. */
import {open,lstat,realpath,rename,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {posix} from 'node:path';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {parseTemporalAuthorizationConfiguration,createTemporalAuthorization} from './temporal-authorization.mjs';

const fail=code=>{throw Object.assign(Error('TEMPORAL_PRODUCT_TOKEN_'+code),{code:'TEMPORAL_PRODUCT_TOKEN_'+code});};
const safe=error=>{const code=typeof error?.code==='string'&&/^TEMPORAL_PRODUCT_TOKEN_[A-Z_]+$/u.test(error.code)?error.code:'TEMPORAL_PRODUCT_TOKEN_REFUSED';return Object.assign(Error(code),{code});};
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const name=value=>typeof value==='string'&&/^[A-Za-z0-9._:-]{1,128}$/u.test(value);
const same=(a,b)=>['dev','ino','uid','gid'].every(key=>a[key]===b[key]);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const validationTimers=Object.freeze({setTimeout:()=>Object.freeze({unref(){}}),clearTimeout(){}});

/** Absent configuration is disabled. Enabling declares a NEW supplied-port contract; no existing mint API is implied. */
export function parseTemporalProductTokenWriterConfiguration(value={enabled:false}){
 try{
  const header=own(value,['enabled'],['role','subject','workloadPrincipal','authorization','maxRequestMs']);
  if(header.enabled===false){own(value,['enabled']);return Object.freeze({enabled:false});}
  const c=data(own(value,['enabled','role','subject','workloadPrincipal','authorization','maxRequestMs']));
  if(c.enabled!==true||!['control','temporal-worker'].includes(c.role)||!name(c.subject)||!name(c.workloadPrincipal))fail('CONFIGURATION');
  const a=parseTemporalAuthorizationConfiguration(c.authorization),path=a.tokenFile;
  if(path!==posix.normalize(path)||path.endsWith('/')||path.includes('\\')||path.includes('//')||!/^\/[A-Za-z0-9._/-]+$/u.test(path)||
     !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(posix.basename(path))||
     a.maxLifetimeMs>300000||a.refreshMs>=a.maxLifetimeMs/2||!integer(c.maxRequestMs,1,Math.min(a.refreshMs,30000)))fail('CONFIGURATION');
  return Object.freeze({...c,authorization:a});
 }catch{fail('CONFIGURATION');}
}

async function acceptedDelivery(c,value,requestStartedAtMs,nowMs){
 try{
  const v=data(own(value,['schemaVersion','state','identity','observedAtMs','validUntilMs','token']));
  const identity=own(v.identity,['role','subject','workloadPrincipal']);
  if(v.schemaVersion!==1||!['CURRENT','REVOKED','UNAVAILABLE'].includes(v.state)||
     Object.keys(identity).some(key=>identity[key]!==c[key])||
     !integer(v.observedAtMs,requestStartedAtMs,nowMs))fail('DELIVERY');
  if(v.state!=='CURRENT'){
   if(v.validUntilMs!==null||v.token!==null)fail('DELIVERY');
   fail(v.state==='REVOKED'?'REVOKED':'UNAVAILABLE');
  }
  // Currentness is a short lease from the supplied authenticated owner, renewed on every delivery.
  if(!integer(v.validUntilMs,nowMs+c.maxRequestMs+1,v.observedAtMs+2*c.authorization.refreshMs))fail('CURRENTNESS');
  const token=data(own(v.token,['token','expiresAtMs','claims']));
  const authorization=createTemporalAuthorization({configuration:c.authorization,reader:{read:async()=>token},now:()=>nowMs,timers:validationTimers});
  try{await authorization.refresh();}finally{await authorization.close();}
  const expiresAtMs=Math.min(token.expiresAtMs,v.validUntilMs);
  if(expiresAtMs<=nowMs+c.maxRequestMs)fail('EXPIRY');
  return {token:token.token,expiresAtMs,claims:token.claims};
 }catch(error){throw safe(error);}
}

/** Offline port-contract validation. Returns no credential, subject, principal or token digest. */
export async function inspectTemporalProductTokenDelivery({configuration,value,requestStartedAtMs,nowMs}){
 const c=parseTemporalProductTokenWriterConfiguration(configuration);
 if(!c.enabled||!Number.isSafeInteger(requestStartedAtMs)||!Number.isSafeInteger(nowMs)||nowMs<requestStartedAtMs||nowMs-requestStartedAtMs>c.maxRequestMs)fail('DELIVERY');
 const t=await acceptedDelivery(c,value,requestStartedAtMs,nowMs);
 return Object.freeze({state:'CURRENT',expiresAtMs:t.expiresAtMs});
}

/** Credential-free authority lifecycle, shared by the writer and portable timer checks. Loss is synchronous; cleanup
 * is deliberately separate. An unresolved operation permanently quarantines this instance even if it later settles. */
export function createTemporalProductTokenLease({enabled=true,refreshMs,maxRequestMs,now=Date.now,timers={setTimeout,clearTimeout},renew,abort=()=>{},onExpiry=()=>{}}){
 if(typeof enabled!=='boolean'||!integer(refreshMs,1000,3600000)||!integer(maxRequestMs,1,refreshMs)||
    typeof now!=='function'||typeof timers?.setTimeout!=='function'||typeof timers?.clearTimeout!=='function'||
    typeof renew!=='function'||typeof abort!=='function'||typeof onExpiry!=='function')fail('CONFIGURATION');
 let current=null,failure=null,closed=false,quarantined=false,renewal=null,expiry=null;const watchers=new Set();
 const clear=()=>{if(renewal!==null)timers.clearTimeout(renewal);if(expiry!==null)timers.clearTimeout(expiry);renewal=expiry=null;};
 const notify=code=>{for(const listener of [...watchers])try{listener(code);}catch{}};
 function lose(code){
  if(!/^TEMPORAL_PRODUCT_TOKEN_[A-Z_]+$/u.test(code))fail('CONFIGURATION');
  const next=quarantined?'TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN':closed&&code!=='TEMPORAL_PRODUCT_TOKEN_CLEANUP_UNKNOWN'?'TEMPORAL_PRODUCT_TOKEN_CLOSED':code,changed=current!==null||failure!==next;
  current=null;failure=next;clear();abort();if(changed)notify(next);
 }
 function assertRefreshable(){if(quarantined)fail('IO_UNKNOWN');if(closed)fail('CLOSED');}
 function accountForLifetime(result){
  if(!integer(result?.unsettledOperations,0,Number.MAX_SAFE_INTEGER)||result.physicalStopProven!==false)fail('CONFIGURATION');
  if(result.unsettledOperations>0){quarantined=true;lose('TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN');}
 }
 function publish({expiresAtMs}){
  assertRefreshable();if(!enabled||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=now())fail('EXPIRY');
  clear();current={expiresAtMs};failure=null;const held=current;
  renewal=timers.setTimeout(()=>{Promise.resolve().then(renew).catch(()=>{});},Math.min(refreshMs,Math.max(1,expiresAtMs-now()-maxRequestMs)));renewal?.unref?.();
  expiry=timers.setTimeout(()=>{if(current===held&&!closed){lose('TEMPORAL_PRODUCT_TOKEN_EXPIRY');onExpiry();}},Math.max(1,expiresAtMs-now()));expiry?.unref?.();
 }
 const status=()=>Object.freeze({enabled,state:closed?'closed':!enabled?'disabled':current&&current.expiresAtMs>now()?'current':failure?'unavailable':'idle',expiresAtMs:current?.expiresAtMs??null,failure});
 return Object.freeze({publish,lose,assertRefreshable,accountForLifetime,status,
  healthy:()=>!closed&&!quarantined&&enabled&&failure===null&&current!==null&&current.expiresAtMs>now(),
  close(){closed=true;lose('TEMPORAL_PRODUCT_TOKEN_CLOSED');},
  watch(listener){if(typeof listener!=='function')fail('CONFIGURATION');watchers.add(listener);return ()=>watchers.delete(listener);},
  releaseWatchers(){watchers.clear();},
 });
}

/** Owns only an initially absent token path and its exclusive lock. A crash requires disposal/reconciliation of that
 * task-local volume, never automatic adoption or overwriting of a predecessor's credential. No mkdir/chmod/chown occurs.
 * Existing material-init includes a static token and still owns its receipt: a separate reviewed handoff must remove the
 * token from BOTH its inventory and receipt ownership, stop all old readers/writers, and provision an empty writer-owned
 * path/volume before starting this owner. This module never deletes/adopts that prewritten static token to make it fit. */
function tokenFiles(path){
 const directory=posix.dirname(path),lockPath=posix.join(directory,'.'+posix.basename(path)+'.writer.lock');
 let directoryIdentity=null,lock=null,current=null;const temporary=new Map();
 async function checkedDirectory(){
  if(process.platform!=='linux'||typeof process.getuid!=='function'||process.getuid()===0||process.getgid()===0)fail('PLATFORM');
  const st=await lstat(directory);
  if(!st.isDirectory()||st.isSymbolicLink()||st.uid!==process.getuid()||st.gid!==process.getgid()||
     (st.mode&0o777)!==0o700||await realpath(directory)!==directory||directoryIdentity&&!same(st,directoryIdentity))fail('DIRECTORY');
  return st;
 }
 function owned(st){return st.isFile()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&st.gid===process.getgid()&&(st.mode&0o777)===0o600&&st.nlink===1;}
 async function absent(target){try{await lstat(target);}catch(error){if(error?.code==='ENOENT')return;throw error;}fail('PATH_OCCUPIED');}
 async function inspect(record){
  let handle,bytes;try{
   await checkedDirectory();handle=await open(record.path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   const st=await handle.stat();if(!owned(st)||!same(st,record)||st.size>32768||record.bytes!==undefined&&st.size!==record.bytes)fail('OWNERSHIP');
   bytes=Buffer.alloc(32769);let used=0;
   while(used<bytes.length){const {bytesRead}=await handle.read(bytes,used,bytes.length-used,used);if(bytesRead===0)break;used+=bytesRead;}
   const after=await handle.stat();
   if(!owned(after)||!same(after,record)||used>32768||used!==st.size||used!==after.size||record.sha256!==undefined&&digest(bytes.subarray(0,used))!==record.sha256)fail('OWNERSHIP');
  }finally{bytes?.fill(0);await handle?.close();}
 }
 async function syncDirectory(){let h;try{h=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);if(!same(await h.stat(),directoryIdentity))fail('DIRECTORY');await h.sync();}finally{await h?.close();}}
 async function remove(record){await inspect(record);await checkedDirectory();await unlink(record.path);await syncDirectory();}
 async function create(target,bytes,remember,check){
  await checkedDirectory();check();let handle,record;
  try{
   handle=await open(target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   const st=await handle.stat();record={path:target,dev:st.dev,ino:st.ino,uid:st.uid,gid:st.gid};remember(record);
   if(!owned(st))fail('OWNERSHIP');await handle.writeFile(bytes);await handle.sync();
   const after=await handle.stat();if(!owned(after)||!same(after,record)||after.size!==bytes.length)fail('OWNERSHIP');
   record.bytes=bytes.length;record.sha256=digest(bytes);check();return record;
  }finally{await handle?.close();}
 }
 return Object.freeze({
  async acquire(check){
   if(lock){await inspect(lock);return;}
   directoryIdentity=await checkedDirectory();check();await absent(path);
   await create(lockPath,Buffer.from('meri-temporal-token-writer-v1\n'),record=>{lock=record;},check);await syncDirectory();
   await absent(path);check();
  },
  async replace(token,check){
   await inspect(lock);if(current)await inspect(current);else await absent(path);check();
   const temp=posix.join(directory,'.'+posix.basename(path)+'.next-'+randomUUID()),bytes=Buffer.from(JSON.stringify(token),'utf8');
   try{
    if(bytes.length>32768)fail('DELIVERY');
    const next=await create(temp,bytes,record=>temporary.set(temp,record),check);
    await checkedDirectory();if(current)await inspect(current);else await absent(path);check();
    await rename(temp,path);temporary.delete(temp);current={...next,path};await syncDirectory();check();await inspect(current);
   }finally{bytes.fill(0);}
  },
  async clear({release=false}={}){
   for(const [path,record] of temporary){await remove(record);temporary.delete(path);}
   if(current){await remove(current);current=null;}
   if(release&&lock){await remove(lock);lock=null;}
  },
 });
}

/** delivery.read(request) is an injected trusted source port, not a URL or ambient fetch. It must independently verify
 * current workload/issuer identity and revocation, and honor cancellation. Every reply is checked again before publication.
 * On any failure automatic renewal stops. Explicit refresh may recover after the trusted owner resolves the failure. */
export function createTemporalProductTokenWriter({configuration,delivery,now=Date.now,timers={setTimeout,clearTimeout}}={}){
 const c=parseTemporalProductTokenWriterConfiguration(configuration);
 if(typeof now!=='function'||typeof timers?.setTimeout!=='function'||typeof timers?.clearTimeout!=='function')fail('CONFIGURATION');
 let read;
 if(c.enabled){try{const port=own(delivery,['read']);if(typeof port.read!=='function'||types.isProxy(port.read))fail('CONFIGURATION');read=port.read.bind(delivery);}catch{fail('CONFIGURATION');}}
 const files=c.enabled?tokenFiles(c.authorization.tokenFile):null;
 let closed=false,refreshing=null,active=null,activeLife=null,closing=null,fileQueue=Promise.resolve();
 const lease=createTemporalProductTokenLease({enabled:c.enabled,refreshMs:c.authorization?.refreshMs??1000,maxRequestMs:c.maxRequestMs??1000,now,timers,
  renew:()=>refresh(),abort:()=>active?.abort(),onExpiry(){if(activeLife)lease.accountForLifetime(activeLife.close());clearOwned().catch(()=>{});}});
 // Lifetime cancellation bounds waiting; it cannot cancel an issued filesystem syscall. Every mutation and cleanup is
 // serialized, and a late operation must check the closed lifetime before another write/rename. Unknown work quarantines.
 function queued(operation){const work=fileQueue.then(operation);fileQueue=work.catch(()=>{});return work;}
 function lifetime(){return createOperationLifetime({now,deadlineMs:now()+c.maxRequestMs,schedule:timers.setTimeout,unschedule:timers.clearTimeout,errorFactory:()=>safe({code:'TEMPORAL_PRODUCT_TOKEN_CLEANUP_UNKNOWN'})});}
 async function clearOwned({release=false}={}){
  if(!files)return;const cleanup=lifetime();
  try{await cleanup.run(()=>queued(()=>files.clear({release})));}
  catch{lease.lose('TEMPORAL_PRODUCT_TOKEN_CLEANUP_UNKNOWN');throw safe({code:'TEMPORAL_PRODUCT_TOKEN_CLEANUP_UNKNOWN'});}
  finally{lease.accountForLifetime(cleanup.close());}
 }
 function refresh({signal}={}){
  nativeSignal(signal);try{lease.assertRefreshable();}catch(error){return Promise.reject(error);}
  if(!c.enabled)return Promise.resolve(lease.status());if(refreshing)return refreshing;
  refreshing=(async()=>{
   let life;active=new AbortController();const abort=()=>active?.abort();signal?.addEventListener('abort',abort,{once:true});
   try{
    signal?.throwIfAborted();const started=now();if(!Number.isSafeInteger(started))fail('CLOCK');
    life=createOperationLifetime({now,signal:active.signal,deadlineMs:started+c.maxRequestMs,schedule:timers.setTimeout,unschedule:timers.clearTimeout,errorFactory:()=>Object.assign(Error('TEMPORAL_PRODUCT_TOKEN_INTERRUPTED'),{code:'TEMPORAL_PRODUCT_TOKEN_INTERRUPTED'})});
    activeLife=life;
    const check=()=>{life.check();if(closed)fail('CLOSED');};
    await life.run(()=>queued(()=>files.acquire(check)));check();
    const reply=await life.run(signal=>read({schemaVersion:1,role:c.role,subject:c.subject,workloadPrincipal:c.workloadPrincipal,namespace:c.authorization.namespace,audience:c.authorization.audience,issuer:c.authorization.issuer,signal}));check();
    const token=await acceptedDelivery(c,reply,started,now());check();
    await life.run(()=>queued(()=>files.replace(token,check)));check();lease.publish({expiresAtMs:token.expiresAtMs});return lease.status();
   }catch(error){
    const refused=safe(error);if(life)lease.accountForLifetime(life.close());lease.lose(refused.code);
    await clearOwned();if(lease.status().failure==='TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN')fail('IO_UNKNOWN');throw refused;
   }finally{if(life)lease.accountForLifetime(life.close());signal?.removeEventListener('abort',abort);active=null;activeLife=null;refreshing=null;}
  })();return refreshing;
 }
 function close(){return closing??=(async()=>{
  closed=true;lease.close();if(activeLife)lease.accountForLifetime(activeLife.close());
  try{await clearOwned({release:true});return Object.freeze({closed:true,physicalStopProven:false});}finally{lease.releaseWatchers();}
 })();}
 return Object.freeze({refresh,start:refresh,close,status:lease.status,healthy:lease.healthy,watch:lease.watch});
}

// @ts-check
/** Exact SDK-child cgroup observer for a no-model readiness process. It is armed while the child is live and
 * paused before exec, then proves that child subtree is empty before the SDK namespace can gain Bash relay routes.
 * The network-local relay is a sibling cgroup and may remain live. This observation depends on the native launcher
 * keeping cgroupfs inaccessible to the SDK and descendants; only real host qualification proves that boundary. */
import {constants} from 'node:fs';
import {open,readFile,realpath,stat,statfs} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from '../binding.mjs';
import {CGROUP2_SUPER_MAGIC,parseCgroupEvents,parseProcCgroup} from '../process-observer.mjs';

const fail=()=>{throw Object.assign(new Error('HOST_SDK_QUIESCENCE_UNKNOWN'),{code:'HOST_SDK_QUIESCENCE_UNKNOWN'});};
const pidOk=value=>Number.isSafeInteger(value)&&value>1&&value<=2147483647;
const inode=value=>({dev:String(value.dev),ino:String(value.ino)});
export const SDK_QUIESCENT_SCHEMA='meri-d005-sdk-quiescent/1';
/** One trusted host-run launch gate shared by the readiness process and later conversation Query. `freeze` prevents
 * any SDK launch from the quiescence read until the network owner completes its atomic route extension. */
export function createSdkLaunchGate(){
 let state='idle';
 return Object.freeze({
  enter(){if(state!=='idle')fail();state='active';let released=false;
   return ()=>{if(released)return;released=true;if(state!=='active')fail();state='idle';};},
  freeze(){if(state!=='idle')fail();state='frozen';let released=false;
   return Object.freeze({assertFrozen(){if(state!=='frozen'||released)fail();},
    release(){if(released)return;released=true;if(state!=='frozen')fail();state='idle';}});},
  get state(){return state;},
 });
}
export function sdkChildCgroup({allocation,binding,hostIdentity}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
 const relative=`/meri/hosts/${a.hostId}-${a.generation}/${canonicalSha256(b)}/sdk`;
 return Object.freeze({path:`/sys/fs/cgroup${relative}`,relative,allocation:a,binding:b,hostIdentity:i});
}
export function createLinuxSdkChildPorts(){
 return Object.freeze({
  async openGroup(path){
   if(process.platform!=='linux'||typeof path!=='string'||!/^\/sys\/fs\/cgroup\/meri\/hosts\/[0-9a-f-]{36}-[1-9][0-9]*\/[0-9a-f]{64}\/sdk$/u.test(path))fail();
   let fd;
   try{
    if(await realpath(path)!==path||Number((await statfs(path)).type)!==CGROUP2_SUPER_MAGIC)fail();
    fd=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    const pinned=inode(await fd.stat());
    const check=async()=>{if(canonicalSha256(inode(await stat(path)))!==canonicalSha256(pinned))fail();};
    await check();
    return Object.freeze({identity:pinned,async readEvents(){await check();
     const events=await readFile(`/proc/self/fd/${fd.fd}/cgroup.events`,'utf8');await check();return events;},
     async close(){await fd.close();}});
   }catch{try{await fd?.close();}catch{}fail();}
  },
  async leaderCgroup(pid){
   if(!pidOk(pid))fail();
   let record;try{record=await readFile(`/proc/${pid}/cgroup`,'utf8');}
   catch(error){if(error?.code==='ENOENT')return null;fail();}
   return parseProcCgroup(record);
  },
  async bootId(){try{return (await readFile('/proc/sys/kernel/random/boot_id','utf8')).trim();}catch{fail();}},
 });
}
export function createSdkChildQuiescenceObserver({allocation,binding,hostIdentity,ports=createLinuxSdkChildPorts(),
 timeoutMs=25000,pollMs=100,closeTimeoutMs=5000,now=()=>performance.now(),pause=(ms,signal)=>sleep(ms,undefined,{signal})}={}){
 const scope=sdkChildCgroup({allocation,binding,hostIdentity});
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000||!Number.isSafeInteger(pollMs)||pollMs<1||pollMs>timeoutMs||
  !Number.isSafeInteger(closeTimeoutMs)||closeTimeoutMs<1||closeTimeoutMs>5000||
  typeof ports?.openGroup!=='function'||typeof ports?.leaderCgroup!=='function'||typeof ports?.bootId!=='function'||
  typeof now!=='function'||typeof pause!=='function')fail();
 let state='new',leaderPid,group,closing;const abort=new AbortController();
 const bounded=async(work,deadline,signal)=>{
  const left=Math.ceil(deadline-now());if(!Number.isFinite(left)||left<1||signal?.aborted||abort.signal.aborted||state==='closed')fail();
  const timeout=AbortSignal.timeout(left),combined=AbortSignal.any([abort.signal,timeout,...(signal?[signal]:[])]);
  let stop;const cancelled=new Promise((_,reject)=>{stop=()=>reject(Object.assign(Error('HOST_SDK_QUIESCENCE_UNKNOWN'),{code:'HOST_SDK_QUIESCENCE_UNKNOWN'}));combined.addEventListener('abort',stop,{once:true});});
  try{const value=await Promise.race([Promise.resolve().then(work),cancelled]);
   if(combined.aborted||state==='closed'||now()>=deadline)fail();return value;}
  finally{combined.removeEventListener('abort',stop);}
 };
 const close=()=>closing??=(async()=>{state='closed';abort.abort();const prior=group;group=undefined;
  if(prior){let timer;try{await Promise.race([Promise.resolve().then(()=>prior.close()),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('HOST_SDK_QUIESCENCE_UNKNOWN')),closeTimeoutMs);})]);}
   catch{fail();}finally{clearTimeout(timer);}}
 })();
 const unknown=async()=>{try{await close();}catch{}fail();};
 return Object.freeze({scope:Object.freeze({path:scope.path,relative:scope.relative}),
  async arm({sdkLeaderPid}){
   if(state!=='new'||!pidOk(sdkLeaderPid))fail();state='arming';leaderPid=sdkLeaderPid;
   const deadline=now()+Math.min(timeoutMs,5000);
   try{
    const pending=Promise.resolve().then(()=>ports.openGroup(scope.path));
    pending.then(candidate=>{if(state!=='arming'||abort.signal.aborted||now()>=deadline)
     Promise.resolve(candidate?.close?.()).catch(()=>{});}).catch(()=>{});
    group=await bounded(()=>pending,deadline);
    if(!group?.identity?.dev||!group.identity?.ino||typeof group.readEvents!=='function'||typeof group.close!=='function'||
     await bounded(()=>ports.bootId(),deadline)!==scope.hostIdentity.bootId||
     await bounded(()=>ports.leaderCgroup(leaderPid),deadline)!==scope.relative||
     parseCgroupEvents(await bounded(()=>group.readEvents(),deadline))!==1)fail();
    if(state!=='arming'||now()>=deadline)fail();
    state='armed';return Object.freeze({armed:true,cgroupRelative:scope.relative,leaderPid});
   }catch{return unknown();}
  },
  async waitQuiescent({signal}={}){
   if(state!=='armed'||signal?.aborted)return unknown();state='waiting';const deadline=now()+timeoutMs;
   try{
    for(;;){
     if(await bounded(()=>ports.bootId(),deadline,signal)!==scope.hostIdentity.bootId)fail();
     const populated=parseCgroupEvents(await bounded(()=>group.readEvents(),deadline,signal));
     if(populated===0){
      if(await bounded(()=>ports.leaderCgroup(leaderPid),deadline,signal)!==null)fail();
      if(parseCgroupEvents(await bounded(()=>group.readEvents(),deadline,signal))!==0)fail();
      if(state!=='waiting'||signal?.aborted||now()>=deadline)fail();
      await close();if(signal?.aborted||now()>=deadline)fail();
      return Object.freeze({quiescent:true,cgroupRelative:scope.relative,
       allocationSha256:canonicalSha256(scope.allocation),bindingSha256:canonicalSha256(scope.binding),leaderPid});
     }
     await bounded(()=>pause(Math.min(pollMs,Math.ceil(deadline-now())),signal),deadline,signal);
    }
   }catch{return unknown();}
  },close,
 });
}

/** Network owner callback after the readiness Query is closed. The caller must hold one gate's frozen token through
 * the *entire* route replacement, not only while this method executes. The observer has already verified the exact
 * SDK leader initially live in the child group; an empty group without that arm never produces a receipt. */
export function createSdkQuiescenceReader({observer,allocation,binding,networkProof,assertLaunchFrozen,now=Date.now}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 if(typeof observer?.waitQuiescent!=='function'||typeof assertLaunchFrozen!=='function'||typeof now!=='function'||
  networkProof?.kind!=='sdk'||networkProof?.allocationSha256!==canonicalSha256(a)||
  networkProof?.bindingSha256!==canonicalSha256(b)||!/^\d+$/u.test(networkProof.namespaceDev)||
  !/^\d+$/u.test(networkProof.namespaceIno))fail();
 let used=false;
 return async function readSdkQuiescent({allocation:requested,binding:run,networkProof:presented}={}){
  if(used)fail();used=true;assertLaunchFrozen();
  if(canonicalSha256(requested)!==canonicalSha256(a)||canonicalSha256(run)!==canonicalSha256(b)||
   presented?.namespaceDev!==networkProof.namespaceDev||presented?.namespaceIno!==networkProof.namespaceIno||
   presented?.allocationSha256!==networkProof.allocationSha256||presented?.bindingSha256!==networkProof.bindingSha256)fail();
  const result=await observer.waitQuiescent();assertLaunchFrozen();
  if(result.quiescent!==true||result.allocationSha256!==canonicalSha256(a)||result.bindingSha256!==canonicalSha256(b))fail();
  const observedAtMs=now();if(!Number.isSafeInteger(observedAtMs))fail();
  return Object.freeze({schema:SDK_QUIESCENT_SCHEMA,sdkChildEmpty:true,allocationSha256:canonicalSha256(a),
   bindingSha256:canonicalSha256(b),namespaceDev:networkProof.namespaceDev,namespaceIno:networkProof.namespaceIno,observedAtMs});
 };
}

// @ts-check
/** Source-only process-absence port for one D005 per-conversation host generation. A recursive cgroup v2
 * `populated=0` covers every SDK, browser and Bash descendant only if the trusted launcher puts ALL untrusted
 * entrypoints under this host cgroup before exec and prevents them from writing cgroupfs or migrating elsewhere.
 * `verifyConfinement` is required at arm and on every read; there is deliberately no permissive default. The
 * browser child and SDK child share this root, but their placement still requires a trusted native launcher.
 * Neither scripted tests nor this source qualify the launcher, kernel, host or physical teardown. */
import {constants} from 'node:fs';
import {open,readFile,realpath,stat,statfs} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';
import {posix} from 'node:path';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from './binding.mjs';
import {CGROUP2_SUPER_MAGIC,parseCgroupEvents,parseProcCgroup} from './process-observer.mjs';
import {HOST_PROCESS_ABSENCE_SCHEMA} from './teardown.mjs';

export const HOST_CGROUP_ROOT='/sys/fs/cgroup/meri/hosts';
export const HOST_CGROUP_CONFINEMENT_SCHEMA='meri-d005-cgroup-confinement/1';
const SCOPE='browser-bash-sdk-descendants';
const MAX_FRESH_MS=1000;
const GROUP_PATH=/^\/sys\/fs\/cgroup\/meri\/hosts\/[0-9a-f-]{36}-[1-9][0-9]*$/u;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const unknown=()=>fail('HOST_PROCESS_OBSERVATION_UNKNOWN');
const pidOk=pid=>Number.isSafeInteger(pid)&&pid>1&&pid<=2147483647;
const inode=stat=>Object.freeze({dev:String(stat.dev),ino:String(stat.ino)});

/** One host generation, containing every run beneath a child named by the entire RunBinding digest. */
export function hostWideCgroup({allocation,binding,hostIdentity}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
 const relative=`/meri/hosts/${a.hostId}-${a.generation}`;
 return Object.freeze({path:`/sys/fs/cgroup${relative}`,relative,
  sdkLeaderRelative:`${relative}/${canonicalSha256(b)}/sdk`,allocation:a,binding:b,hostIdentity:i});
}

/** Native read-only cgroup port. Its directory FD pins the actual cgroup inode; before and after each event read
 * the path must still resolve to that inode. An absent or recreated group is UNKNOWN, never successful cleanup. */
export function createLinuxHostCgroupPorts(){
 return Object.freeze({
  async openGroup(path){
   if(process.platform!=='linux'||typeof path!=='string'||!GROUP_PATH.test(path))unknown();
   let handle;
   try{
    if(await realpath(path)!==path||Number((await statfs(path)).type)!==CGROUP2_SUPER_MAGIC)unknown();
    handle=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    const pinned=inode(await handle.stat());
    const check=async()=>{if(canonicalSha256(inode(await stat(path)))!==canonicalSha256(pinned))unknown();};
    await check();
    return Object.freeze({identity:pinned,
     async readEvents(){await check();const events=await readFile(`/proc/self/fd/${handle.fd}/cgroup.events`,'utf8');await check();return events;},
     async close(){await handle.close();}});
   }catch{try{await handle?.close();}catch{}unknown();}
  },
  async readLeaderCgroup(pid){
   if(!pidOk(pid))unknown();
   let value;try{value=await readFile(`/proc/${pid}/cgroup`,'utf8');}
   catch(error){if(error?.code==='ENOENT')return null;unknown();}
   return parseProcCgroup(value);
  },
  async readBootId(){
   let bootId;try{bootId=(await readFile('/proc/sys/kernel/random/boot_id','utf8')).trim();}catch{unknown();}
   if(!UUID.test(bootId))unknown();return bootId;
  },
 });
}

/** Pure validation of the trusted launcher check, not an attestation generator. The launcher owns pre-exec cgroup
 * placement, mount/cgroupfs denial in every untrusted namespace, and the prohibition on alternate entrypoints. */
function confinementCurrent(value,{allocation,binding,hostIdentity,groupIdentity,relative,sdkLeaderPid,nowMs}){
 let r;try{r=own(data(value),['schema','allocationSha256','bindingSha256','hostIdentitySha256','groupIdentitySha256',
  'cgroupRelative','sdkLeaderPid','observedAtMs','preExecPlacement','allEntrypointsConfined','untrustedCgroupfsUnavailable','untrustedMigrationDenied']);}
 catch{unknown();}
 if(r.schema!==HOST_CGROUP_CONFINEMENT_SCHEMA||r.allocationSha256!==canonicalSha256(allocation)||
  r.bindingSha256!==canonicalSha256(binding)||r.hostIdentitySha256!==canonicalSha256(hostIdentity)||
  r.groupIdentitySha256!==canonicalSha256(groupIdentity)||r.cgroupRelative!==relative||r.sdkLeaderPid!==sdkLeaderPid||
  !Number.isSafeInteger(r.observedAtMs)||r.observedAtMs>nowMs||r.observedAtMs<nowMs-MAX_FRESH_MS||
  r.preExecPlacement!==true||r.allEntrypointsConfined!==true||r.untrustedCgroupfsUnavailable!==true||
  r.untrustedMigrationDenied!==true)unknown();
}

/** `arm` must run while the real SDK leader is live in its exact run child cgroup. `verifyConfinement` is a
 * trusted launcher port and must measure/reaffirm that untrusted processes cannot move cgroups throughout the
 * wait. The observer never accepts a bare `{exited:true}` or a user/model-provided confinement flag. */
export function createHostWideProcessObserver({allocation,binding,hostIdentity,profile,verifyConfinement,
 ports=createLinuxHostCgroupPorts(),now=Date.now,monotonic=()=>performance.now(),pause=(ms,signal)=>sleep(ms,undefined,{signal}),
 timeoutMs=25000,armTimeoutMs=5000,pollMs=100}={}){
 const scope=hostWideCgroup({allocation,binding,hostIdentity});
 if(typeof profile!=='string'||!posix.isAbsolute(profile)||posix.resolve(profile)!==profile||
  !profile.endsWith(`/${scope.binding.conversationId}/.browser/profile`)||typeof verifyConfinement!=='function'||
  typeof ports?.openGroup!=='function'||typeof ports?.readLeaderCgroup!=='function'||typeof ports?.readBootId!=='function'||
  typeof now!=='function'||typeof monotonic!=='function'||typeof pause!=='function'||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000||
  !Number.isSafeInteger(armTimeoutMs)||armTimeoutMs<1||armTimeoutMs>30000||
  !Number.isSafeInteger(pollMs)||pollMs<1||pollMs>timeoutMs)
  fail('HOST_PROCESS_CONFIGURATION');
 let state='new',group,sdkLeaderPid;
 const stopping=new AbortController();
 const lifetime=(ms,signal)=>createOperationLifetime({deadlineMs:Date.now()+ms,now:Date.now,signal,errorFactory:()=>Object.assign(new Error('HOST_PROCESS_OBSERVATION_UNKNOWN'),{code:'HOST_PROCESS_OBSERVATION_UNKNOWN'})});
 const closeHandle=async held=>{
  if(!held)return;
  const life=lifetime(Math.min(armTimeoutMs,5000));
  try{await life.run(()=>held.close());}finally{life.close();}
 };
 const closeGroup=async()=>{const held=group;group=undefined;await closeHandle(held);};
 const refuse=async()=>{if(state!=='closed')state='unknown';try{await closeGroup();}catch{}unknown();};
 const verify=async signal=>{
  if(!group||!pidOk(sdkLeaderPid)||signal?.aborted)unknown();
  const current=now();if(!Number.isSafeInteger(current)||await ports.readBootId()!==scope.hostIdentity.bootId)unknown();
  const check=await verifyConfinement({allocation:structuredClone(scope.allocation),binding:structuredClone(scope.binding),
   hostIdentity:structuredClone(scope.hostIdentity),cgroupRelative:scope.relative,groupIdentity:structuredClone(group.identity),sdkLeaderPid},{signal});
  const checkedAt=now();if(!Number.isSafeInteger(checkedAt))unknown();
  confinementCurrent(check,{...scope,groupIdentity:group.identity,relative:scope.relative,sdkLeaderPid,nowMs:checkedAt});
 };
 const populated=async()=>{if(!group||typeof group.readEvents!=='function')unknown();return parseCgroupEvents(await group.readEvents());};
 const exactRequest=request=>{
  let r;try{r=own(data(request),['allocation','binding','hostIdentity','profile','scope']);}catch{fail('HOST_PROCESS_BINDING_REFUSED');}
  if(canonicalSha256(r.allocation)!==canonicalSha256(scope.allocation)||
   canonicalSha256(r.binding)!==canonicalSha256(scope.binding)||
   canonicalSha256(r.hostIdentity)!==canonicalSha256(scope.hostIdentity)||r.profile!==profile||r.scope!==SCOPE)
   fail('HOST_PROCESS_BINDING_REFUSED');
 };
 return Object.freeze({
  scope:Object.freeze({path:scope.path,relative:scope.relative,sdkLeaderRelative:scope.sdkLeaderRelative}),
  async arm({sdkLeaderPid:pid}={}){
   if(state!=='new'||!pidOk(pid))fail('HOST_PROCESS_CONFIGURATION');
   state='arming';sdkLeaderPid=pid;
   let life,opened;
   try{
    life=lifetime(armTimeoutMs,stopping.signal);
    group=await life.run(async signal=>{
     const candidate=await ports.openGroup(scope.path,{signal});
     if(signal.aborted||stopping.signal.aborted||state!=='arming'){
      // A late open after timeout/close has no owner; release it without reviving the observer.
      try{await closeHandle(candidate);}catch{}unknown();
     }
     opened=candidate;return candidate;
    });
    if(!group?.identity?.dev||!group.identity?.ino||typeof group.readEvents!=='function'||typeof group.close!=='function')unknown();
    if(await life.run(()=>ports.readBootId())!==scope.hostIdentity.bootId||
       await life.run(()=>ports.readLeaderCgroup(pid))!==scope.sdkLeaderRelative||
       await life.run(()=>populated())!==1)unknown();
    await life.run(signal=>verify(signal));life.check();
    if(state!=='arming'||stopping.signal.aborted)unknown();
    state='armed';return Object.freeze({armed:true,scope:scope.relative,groupIdentity:group.identity});
   }catch{
    if(opened&&group!==opened)try{await closeHandle(opened);}catch{}
    return refuse();
   }finally{life?.close();}
  },
  async waitForExit(request,{signal}={}){
   exactRequest(request);try{nativeSignal(signal);}catch{fail('HOST_PROCESS_BINDING_REFUSED');}
   if(state!=='armed'||signal?.aborted)return refuse();
   state='waiting';const start=monotonic();if(!Number.isFinite(start))return refuse();let previous=start;
   let life;
   try{
    const combined=signal?AbortSignal.any([stopping.signal,signal]):stopping.signal;
    life=lifetime(timeoutMs,combined);
    for(;;){
     const tick=monotonic();if(signal?.aborted||!Number.isFinite(tick)||tick<previous||tick-start>=timeoutMs)return refuse();previous=tick;
     await life.run(inner=>verify(inner));
     if(await life.run(()=>populated())===0){
      // An alive SDK leader in another group means migration or PID reuse, not verified exit.
      if(await life.run(()=>ports.readLeaderCgroup(sdkLeaderPid))!==null)return refuse();
      await life.run(inner=>verify(inner));
      const observedAtMs=now();if(!Number.isSafeInteger(observedAtMs))return refuse();
      await life.run(()=>closeGroup());life.check();
      if(stopping.signal.aborted||state!=='waiting')return refuse();
      state='done';
      return Object.freeze({schema:HOST_PROCESS_ABSENCE_SCHEMA,allocationSha256:canonicalSha256(scope.allocation),
       bindingSha256:canonicalSha256(scope.binding),hostIdentitySha256:canonicalSha256(scope.hostIdentity),
       observedAtMs,scope:SCOPE,exited:true,remainingPids:Object.freeze([])});
     }
     await life.run(inner=>pause(Math.min(pollMs,Math.max(1,timeoutMs-(tick-start))),inner));
    }
   }catch{return refuse();}finally{life?.close();}
  },
  async close(){if(state==='closed')return;state='closed';stopping.abort();await closeGroup();},
 });
}

// @ts-check
/** D005 browser process-exit evidence from one pinned Linux cgroup v2 subtree.
 *
 * The trusted launcher must create this exact run cgroup, spawn the Playwright MCP leader INSIDE it before exec, and
 * keep cgroupfs unwritable/unmounted for the MCP, Chromium and renderers. Their forked descendants then remain in the
 * subtree. This observer verifies the leader's actual /proc membership and an initial populated=1 before it can
 * report populated=0. Without that launcher and mount confinement, cgroup emptiness is not complete process proof;
 * no caller assertion, PID-only wait or missing cgroup is accepted as exited. Native host qualification remains open.
 *
 * Import is inert. createLinuxCgroupPorts opens only the exact derived cgroup when arm() is called. The caller owns
 * the returned observer and should close() it on paths that never reach waitForExit(). */
import {constants} from 'node:fs';
import {open,readFile,realpath,stat,statfs} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';
import {posix} from 'node:path';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding} from './binding.mjs';

export const BROWSER_CGROUP_ROOT='/sys/fs/cgroup/meri/hosts';
export const CGROUP2_SUPER_MAGIC=0x63677270;
export const PROCESS_EXIT_WAIT_MS=25000;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const unknown=()=>fail('BROWSER_PROCESS_OBSERVATION_UNKNOWN');
const unknownError=()=>Object.assign(new Error('BROWSER_PROCESS_OBSERVATION_UNKNOWN'),{code:'BROWSER_PROCESS_OBSERVATION_UNKNOWN'});
const validPid=pid=>Number.isSafeInteger(pid)&&pid>1&&pid<=2147483647;
const sameIdentity=(a,b)=>a?.dev===b?.dev&&a?.ino===b?.ino;
const identity=s=>Object.freeze({dev:String(s.dev),ino:String(s.ino)});
/** Browser child under the host-wide generation and run cgroups. The host observer's recursive `populated=0`
 * includes this child, the sibling SDK/Bash child and every descendant if the launcher prevents migration. */
export function browserRunCgroup({allocation,binding}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 const runHash=canonicalSha256(b);
 const relative=`/meri/hosts/${a.hostId}-${a.generation}/${runHash}/browser`;
 return Object.freeze({path:`/sys/fs/cgroup${relative}`,relative});
}
/** Strictly decode the one field whose kernel semantics include every descendant cgroup. */
export function parseCgroupEvents(value){
 if(typeof value!=='string'||value.length>4096)unknown();
 const lines=value.trimEnd().split('\n');let populated;
 for(const line of lines){
  const match=/^([a-z_]+) ([0-9]+)$/u.exec(line);if(!match)unknown();
  if(match[1]==='populated'){
   if(populated!==undefined||!['0','1'].includes(match[2]))unknown();
   populated=Number(match[2]);
  }
 }
 if(populated===undefined)unknown();
 return populated;
}
/** Host-view v2 /proc record. A missing PID is distinct from an unreadable or malformed one. */
export function parseProcCgroup(value){
 if(typeof value!=='string'||value.length>4096)unknown();
 const lines=value.trimEnd().split('\n');
 if(lines.length!==1)unknown();
 const match=/^0::(\/[a-zA-Z0-9/_-]+)$/u.exec(lines[0]);if(!match)unknown();
 return match[1];
}

/** Production read-only Linux port. The directory FD pins the cgroup inode; each event read also checks that the
 * path still resolves to that inode, so deletion/recreation cannot turn an old empty group into a success. No
 * namespace, process, route, timer or cgroup is created or altered. */
export function createLinuxCgroupPorts(){
 return Object.freeze({
  async openGroup(path){
   if(process.platform!=='linux'||typeof path!=='string'||!/^\/sys\/fs\/cgroup\/meri\/hosts\/[0-9a-f-]{36}-[1-9][0-9]*\/[0-9a-f]{64}\/browser$/u.test(path))unknown();
   let handle;
   try{
    if(await realpath(path)!==path||Number((await statfs(path)).type)!==CGROUP2_SUPER_MAGIC)unknown();
    handle=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    const pinned=identity(await handle.stat());
    const check=async()=>{const current=identity(await stat(path));if(!sameIdentity(current,pinned))unknown();};
    await check();
    return Object.freeze({identity:pinned,
     async readEvents(){await check();const events=await readFile(`/proc/self/fd/${handle.fd}/cgroup.events`,'utf8');await check();return events;},
     async close(){await handle.close();}});
   }catch{try{await handle?.close();}catch{}unknown();}
  },
  async readLeaderCgroup(pid){
   if(!validPid(pid))unknown();
   let value;
   try{value=await readFile(`/proc/${pid}/cgroup`,'utf8');}
   catch(error){if(error?.code==='ENOENT')return null;unknown();}
   return parseProcCgroup(value);
  },
 });
}

/** @typedef {{identity:{dev:string,ino:string},readEvents:()=>Promise<string>,close:()=>Promise<void>}} GroupHandle */
/** @typedef {{openGroup:(path:string)=>Promise<GroupHandle>,readLeaderCgroup:(pid:number)=>Promise<string|null>}} ObserverPorts */
/** One browser run; its `waitForExit({binding,profile},{signal})` matches `browser/runtime.mjs`'s existing port. */
export function createBrowserProcessObserver({allocation,binding,profile,ports=createLinuxCgroupPorts(),now=()=>performance.now(),pause=(ms,signal)=>sleep(ms,undefined,{signal}),timeoutMs=PROCESS_EXIT_WAIT_MS,pollMs=100}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),scope=browserRunCgroup({allocation:a,binding:b});
 if(typeof profile!=='string'||!posix.isAbsolute(profile)||posix.resolve(profile)!==profile||!profile.endsWith(`/${b.conversationId}/.browser/profile`)||
    typeof ports?.openGroup!=='function'||typeof ports?.readLeaderCgroup!=='function'||typeof now!=='function'||typeof pause!=='function'||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000||!Number.isSafeInteger(pollMs)||pollMs<1||pollMs>timeoutMs)fail('BROWSER_PROCESS_CONFIGURATION');
 const bindingSha256=canonicalSha256(b);
 /** @type {'new'|'arming'|'armed'|'waiting'|'done'|'unknown'|'closed'} */let state='new';
 /** @type {GroupHandle|undefined} */let group;
 let leaderPid;
 /** Every native or injected await has a real monotonic deadline. A stalled /proc read, pause, or close can never
  * hold the observer promise open indefinitely. The underlying host may still be unresponsive and remains UNKNOWN. */
 const within=async (operation,deadline,signal,onAbandoned)=>{
  const pending=Promise.resolve().then(operation);
  let disposed=false;
  const dispose=value=>{
   if(disposed||!onAbandoned)return;disposed=true;
   try{Promise.resolve(onAbandoned(value)).catch(()=>{});}catch{}
  };
  const remaining=Math.ceil(deadline-performance.now());
  if(remaining<=0||signal?.aborted){pending.then(dispose,()=>{});unknown();}
  let timer,onAbort;
  const refused=new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(unknownError()),remaining);
   if(signal){onAbort=()=>reject(unknownError());signal.addEventListener('abort',onAbort,{once:true});}
  });
  try{
   const value=await Promise.race([pending,refused]);
   if(signal?.aborted||performance.now()>deadline){dispose(value);unknown();}
   return value;
  }
  catch(error){pending.then(dispose,()=>{});throw error;}
  finally{clearTimeout(timer);if(onAbort)signal.removeEventListener('abort',onAbort);}
 };
 const closeGroup=async(deadline=performance.now()+timeoutMs)=>{
  const previous=group;group=undefined;
  if(previous)await within(()=>previous.close(),deadline);
 };
 const refuse=async(deadline)=>{if(state!=='closed')state='unknown';try{await closeGroup(deadline);}catch{}unknown();};
 const readPopulated=async(deadline,signal)=>{
  if(!group||typeof group.readEvents!=='function')unknown();
  return parseCgroupEvents(await within(()=>group.readEvents(),deadline,signal));
 };
 return Object.freeze({
  scope,
  /** Called by the trusted launcher while its actual MCP leader is live in this exact group. A leader that already
   * exited before observation is UNKNOWN, not proof that every descendant exited. */
  async arm({leaderPid:pid}={}){
   if(state!=='new'||!validPid(pid))fail('BROWSER_PROCESS_CONFIGURATION');
   state='arming';const deadline=performance.now()+timeoutMs;
   try{
    const opened=await within(()=>ports.openGroup(scope.path),deadline,undefined,value=>value?.close?.());
    if(state!=='arming'){try{await within(()=>opened?.close?.(),performance.now()+timeoutMs);}catch{}unknown();}
    group=opened;
    if(!group||typeof group.close!=='function'||typeof group.readEvents!=='function'||!group.identity?.dev||!group.identity?.ino)unknown();
    if(await within(()=>ports.readLeaderCgroup(pid),deadline)!==scope.relative||state!=='arming'||await readPopulated(deadline)!==1||state!=='arming')unknown();
    leaderPid=pid;state='armed';
    return Object.freeze({armed:true,scope:scope.relative,identity:group.identity});
   }catch{return refuse(deadline);}
  },
  async waitForExit(request,{signal}={}){
   let candidate,input;try{input=own(request,['binding','profile']);validateShape('RunBinding',input.binding);candidate=canonicalSha256(input.binding);}catch{fail('BROWSER_PROCESS_BINDING_REFUSED');}
   if(candidate!==bindingSha256||input.profile!==profile)fail('BROWSER_PROCESS_BINDING_REFUSED');
   if(state!=='armed'||signal?.aborted)return refuse();
   state='waiting';const deadline=performance.now()+timeoutMs;
   const started=now();if(!Number.isFinite(started))return refuse(deadline);let last=started;
   try{
    for(;;){
     const current=now();if(signal?.aborted||!Number.isFinite(current)||current<last||current-started>=timeoutMs)return refuse();last=current;
     if(await readPopulated(deadline,signal)===0){
      // An alive leader in another cgroup would mean it escaped; PID reuse elsewhere is also UNKNOWN.
      if(await within(()=>ports.readLeaderCgroup(leaderPid),deadline,signal)!==null||state!=='waiting')return refuse(deadline);
      await closeGroup(deadline);
      if(state!=='waiting'||signal?.aborted)unknown();
      state='done';
      return Object.freeze({exited:true,scope:scope.relative,leaderPid});
     }
     if(state!=='waiting')return refuse(deadline);
     await within(()=>pause(Math.min(pollMs,Math.max(1,timeoutMs-(current-started))),signal),deadline,signal);
    }
   }catch{return refuse(deadline);}
  },
  async close(){if(state==='closed')return;state='closed';await closeGroup();},
 });
}

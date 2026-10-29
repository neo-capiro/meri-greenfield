/** Physical SDK-subtree control owned by the native launcher. A kernel receipt
 * grants no run, tool or viewer authority. Closing never implicitly resumes it. */
import {setTimeout as sleep} from 'node:timers/promises';
import {performance} from 'node:perf_hooks';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {sdkChildCgroup,createLinuxSdkChildPorts} from './sdk-quiescence.mjs';
const fail=()=>{throw Object.assign(Error('HOST_SDK_HOLD_UNKNOWN'),{code:'HOST_SDK_HOLD_UNKNOWN'});};
export function sdkFrozenState(text){
 if(typeof text!=='string'||text.length>4096)fail();let frozen,populated;
 for(const line of text.trimEnd().split('\n')){
  const match=/^([a-z_]+) ([0-9]+)$/u.exec(line);if(!match)fail();
  if(match[1]==='frozen'){if(frozen!==undefined||!['0','1'].includes(match[2]))fail();frozen=Number(match[2]);}
  if(match[1]==='populated'){if(populated!==undefined||!['0','1'].includes(match[2]))fail();populated=Number(match[2]);}
 }
 if(frozen===undefined||populated!==1)fail();return frozen===1;
}
export function createSdkChildHold({allocation,binding,hostIdentity,ports=createLinuxSdkChildPorts({writable:true}),
 timeoutMs=5000,pollMs=25,closeTimeoutMs=5000,now=()=>performance.now(),pause=(ms,signal)=>sleep(ms,undefined,{signal})}={}){
 const scope=sdkChildCgroup({allocation,binding,hostIdentity});
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||!Number.isSafeInteger(pollMs)||pollMs<1||pollMs>timeoutMs||
  !Number.isSafeInteger(closeTimeoutMs)||closeTimeoutMs<1||closeTimeoutMs>5000||
  ['openGroup','leaderCgroup','bootId'].some(k=>typeof ports?.[k]!=='function')||typeof now!=='function'||typeof pause!=='function')fail();
 let state='new',group,leaderPid,busy=false,closing;const abort=new AbortController();
 const close=()=>closing??=(async()=>{state='closed';abort.abort();const prior=group;group=undefined;
  if(prior){let timer;try{await Promise.race([Promise.resolve().then(()=>prior.close()),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('HOST_SDK_HOLD_UNKNOWN')),closeTimeoutMs);})]);}
   finally{clearTimeout(timer);}}
 })();
 async function operation(signal,work){
  nativeSignal(signal);if(busy||state==='closed'||signal?.aborted)fail();busy=true;
  const limit=AbortSignal.timeout(timeoutMs),combined=AbortSignal.any([abort.signal,limit,...(signal?[signal]:[])]);
  let cancel;const cancelled=new Promise((_,reject)=>{cancel=()=>reject(Error('HOST_SDK_HOLD_UNKNOWN'));combined.addEventListener('abort',cancel,{once:true});});
  try{return await Promise.race([Promise.resolve().then(()=>work(combined)),cancelled]);}
  catch{try{await close();}catch{}fail();}
  finally{combined.removeEventListener('abort',cancel);busy=false;}
 }
 async function current(signal){
  signal.throwIfAborted();
  if(await ports.bootId()!==scope.hostIdentity.bootId||await ports.leaderCgroup(leaderPid)!==scope.relative)fail();
  const frozen=sdkFrozenState(await group.readEvents());signal.throwIfAborted();return frozen;
 }
 async function change(frozen,signal){
  if(!['running','frozen'].includes(state))fail();
  return operation(signal,async active=>{
   const before=await current(active);
   if(before!==(state==='frozen'))fail();
   if(before!==frozen){active.throwIfAborted();await group.setFrozen(frozen);}
   const deadline=now()+timeoutMs;
   while(await current(active)!==frozen){if(now()>=deadline)fail();await pause(pollMs,active);}
   state=frozen?'frozen':'running';
   return Object.freeze({bindingSha256:canonicalSha256(scope.binding),cgroupRelative:scope.relative,
    groupIdentity:Object.freeze({...group.identity}),leaderPid,frozen});
  });
 }
 return Object.freeze({
  async arm({sdkLeaderPid,signal}={}){
   if(state!=='new'||!Number.isSafeInteger(sdkLeaderPid)||sdkLeaderPid<2||sdkLeaderPid>2147483647)fail();
   state='arming';leaderPid=sdkLeaderPid;
   return operation(signal,async active=>{
    const pending=Promise.resolve().then(()=>ports.openGroup(scope.path));
    pending.then(value=>{if(active.aborted||state==='closed')void Promise.resolve(value?.close()).catch(()=>{});}).catch(()=>{});
    group=await pending;
    if(!group?.identity?.dev||!group.identity?.ino||typeof group.readEvents!=='function'||typeof group.setFrozen!=='function'||typeof group.close!=='function'||await current(active))fail();
    state='running';return Object.freeze({armed:true});
   });
  },
  freeze:({signal}={})=>change(true,signal),
  thaw:({signal}={})=>change(false,signal),
  close,
 });
}

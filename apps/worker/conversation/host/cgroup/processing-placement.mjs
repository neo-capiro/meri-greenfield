// @ts-check
/** One finite processing lifetime: the root-owned finite leaf, the prepared-command launcher bound to it, and the
 * canonical bounded runner. Every fixed command runs through `run()` on this same leaf — there is no second path.
 *
 * The launcher (and therefore its configuration) is validated BEFORE the leaf is created, so a bad option cannot leave a
 * leaf behind. `close()` starts once: it rejects new runs, waits a bounded time for runs already owned, then releases
 * only the empty leaf and replays its settled result. An unproven release or unsettled run stays unknown.
 */
import {createFiniteCgroupLeaf,releaseFiniteCgroupLeaf,verifyProcessingHierarchy} from './finite-leaf.mjs';
import {createProcessingCommandLauncher,runProcessingCommand} from '../launcher/supervisor.mjs';

export const PROCESSING_PLACEMENT_SCHEMA='meri-d005-processing-placement/1';
const fault=code=>Object.assign(new Error(code),{code});

export async function createProcessingPlacement({allocation,binding,hostIdentity,authority:policy,limits,network,
 helperPath,home,browsersPath,uid,gid,signal,fs,identity,now,spawnNative,kill,readyMs=5000,settleMs=5000}={}){
 if(!policy||typeof policy.readCurrent!=='function')throw fault('HOST_CGROUP_AUTHORITY_REFUSED');
 let leaf=null,hierarchy=null;
 // 1) Validation first: the launcher constructor rejects a bad helper/home/network/authority before any mkdir.
 const launcher=createProcessingCommandLauncher({allocation,binding,hostIdentity,network,authority:policy,helperPath,
  home,browsersPath,uid,gid,signal,spawnNative,readyMs,now,
  onPrepared:async({leaderPid,kind})=>{
   if(kind!=='processing')throw fault('HOST_LAUNCH_CONFIGURATION');
   hierarchy=verifyProcessingHierarchy({leaf,pid:leaderPid,fs,now});
  }});
 // 2) Only now create (or adopt) the finite leaf.
 leaf=await createFiniteCgroupLeaf({allocation,binding,hostIdentity,authority:policy,limits,scope:'processing',
  fs,identity,now,signal});
 let closing=null,closed=false,runs=0;
 const active=new Set(),controllers=new Set();
 const run=async(command,args,{cwd,input=new Uint8Array(0),signal:callSignal,deadlineMs,maxOutput}={})=>{
  if(closed||closing!==null)throw fault('HOST_PROCESSING_CLOSED');
  runs+=1;
  // Each run owns a controller so close can SIGNAL active work to stop, not merely wait for it.
  const controller=new AbortController();
  controllers.add(controller);
  const life=callSignal===undefined?controller.signal:AbortSignal.any([controller.signal,callSignal]);
  const pending=runProcessingCommand({launcher,command,args,cwd,input,signal:life,deadlineMs,maxOutput,
   now,settleMs,...(kill===undefined?{}:{kill})});
  active.add(pending);
  try{return await pending;}finally{active.delete(pending);controllers.delete(controller);}
 };
 const close=()=>closing??=(async()=>{
  closed=true;
  // New runs are refused. Owned work is signalled to stop, then awaited within one bounded settlement window.
  for(const controller of controllers){try{controller.abort();}catch{}}
  let settled=true;
  if(active.size){settled=await new Promise(resolve=>{
    const timer=setTimeout(()=>resolve(false),Math.max(1,settleMs));
    Promise.allSettled([...active]).then(()=>{clearTimeout(timer);resolve(true);});
  });}
  if(!settled)return Object.freeze({closed:false,released:false,code:'HOST_PROCESSING_SETTLEMENT_UNKNOWN'});
  const released=releaseFiniteCgroupLeaf({leaf,fs});
  if(!released.released)return Object.freeze({closed:false,released:false,code:released.code});
  return Object.freeze({closed:true,released:true});
 })();
 return Object.freeze({schema:PROCESSING_PLACEMENT_SCHEMA,leaf,launcher,run,runs:()=>runs,hierarchy:()=>hierarchy,
  isClosed:()=>closed||closing!==null,close});
}

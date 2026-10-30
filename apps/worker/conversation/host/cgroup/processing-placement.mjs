// @ts-check
/** One finite processing lifetime: the root-owned finite leaf, the prepared-command launcher bound to it, and the
 * canonical bounded runner. There is no second processing launch path: every fixed command (qualification probe, scan,
 * extract) runs through `run()` on this same leaf with the same launcher, currentness, network and cleanup owners.
 *
 * Order is the contract: canonical allocation/binding/identity and trusted currentness are checked, the finite leaf is
 * created (or adopted) empty, one command is prepared, the C launcher attaches that exact child to the leaf and reports
 * READY, the ACTUAL leader PID is joined to the leaf between two membership observations, and only then is GO released
 * by the runner. `close()` is lazy, runs once, and replays its settled result; an unproven release stays unknown.
 */
import {createFiniteCgroupLeaf,releaseFiniteCgroupLeaf,verifyProcessingHierarchy} from './finite-leaf.mjs';
import {createProcessingCommandLauncher,runProcessingCommand} from '../launcher/supervisor.mjs';

export const PROCESSING_PLACEMENT_SCHEMA='meri-d005-processing-placement/1';

export async function createProcessingPlacement({allocation,binding,hostIdentity,authority:policy,limits,network,
 helperPath,home,browsersPath,uid,gid,signal,fs,identity,now,spawnNative,kill,readyMs=5000,settleMs=5000}={}){
 if(!policy||typeof policy.readCurrent!=='function'){throw Object.assign(Error('HOST_CGROUP_AUTHORITY_REFUSED'),{code:'HOST_CGROUP_AUTHORITY_REFUSED'});}
 const leaf=await createFiniteCgroupLeaf({allocation,binding,hostIdentity,authority:policy,limits,scope:'processing',fs,identity,now,signal});
 let hierarchy=null,runs=0;
 const launcher=createProcessingCommandLauncher({allocation,binding,hostIdentity,network,authority:policy,helperPath,
  home,browsersPath,uid,gid,signal,spawnNative,kill,readyMs,now,
  onPrepared:async({leaderPid,kind})=>{
   if(kind!=='processing')throw Object.assign(Error('HOST_LAUNCH_CONFIGURATION'),{code:'HOST_LAUNCH_CONFIGURATION'});
   hierarchy=verifyProcessingHierarchy({leaf,pid:leaderPid,fs,now});
  }});
 /** Run one fixed command on this leaf through the canonical runner. Never a second child path. */
 const run=(command,args,{cwd,input=new Uint8Array(0),signal:callSignal,deadlineMs,maxOutput}={})=>{
  runs+=1;
  return runProcessingCommand({launcher,command,args,cwd,input,signal:callSignal??signal,deadlineMs,maxOutput,now,
   settleMs,...(kill===undefined?{}:{kill})});
 };
 let closing=null;
 const close=()=>closing??=(async()=>{
  // Each run's group is settled by the runner before it returns or throws; this releases only the empty owned leaf.
  const released=releaseFiniteCgroupLeaf({leaf,fs});
  if(!released.released)return Object.freeze({closed:false,released:false,code:released.code});
  return Object.freeze({closed:true,released:true});
 })();
 return Object.freeze({schema:PROCESSING_PLACEMENT_SCHEMA,leaf,launcher,run,runs:()=>runs,hierarchy:()=>hierarchy,close});
}

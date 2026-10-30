// @ts-check
/** Finite processing placement: one trusted processing group = finite cgroup leaf + one confined direct child.
 *
 * Order is the contract: canonical allocation/binding/identity and trusted currentness are checked, the finite leaf is
 * created (or adopted) with empty membership, the C launcher attaches the real child to that exact leaf and reports
 * READY, the actual leadership PID is joined to the leaf between two membership observations, and only then is GO sent.
 * A failed placement never publishes a running group, always stops the owned child, and reports an unproven release as
 * `HOST_CGROUP_CLEANUP_UNKNOWN` rather than claiming cleanliness.
 */
import {createFiniteCgroupLeaf,releaseFiniteCgroupLeaf,verifyProcessingHierarchy} from './finite-leaf.mjs';
import {startConfinedProcessing} from '../launcher/supervisor.mjs';

export const PROCESSING_PLACEMENT_SCHEMA='meri-d005-processing-placement/1';

export async function createProcessingPlacement({allocation,binding,hostIdentity,authority,limits,policy,
 helperPath,networkProof,command,args,cwd,uid,gid,signal,fs,identity,now,spawnNative,readyMs=5000,stopMs=5000}={}){
 if(!policy||typeof policy.readCurrent!=='function'){throw Object.assign(Error('HOST_CGROUP_AUTHORITY_REFUSED'),{code:'HOST_CGROUP_AUTHORITY_REFUSED'});}
 const leaf=await createFiniteCgroupLeaf({allocation,binding,hostIdentity,authority:policy,limits,
  scope:'processing',fs,identity,now,signal});
 let hierarchy;
 const start=()=>startConfinedProcessing({allocation,binding,hostIdentity,helperPath,networkProof,command,args,cwd,
  uid,gid,signal,spawnNative,readyMs,stopMs,
  onPrepared:async({leaderPid,kind})=>{
   if(kind!=='processing')throw Object.assign(Error('HOST_LAUNCH_CONFIGURATION'),{code:'HOST_LAUNCH_CONFIGURATION'});
   hierarchy=verifyProcessingHierarchy({leaf,pid:leaderPid,fs,now});
  }});
 let child;
 try{child=await start();}
 catch(error){
  const released=releaseFiniteCgroupLeaf({leaf,fs});
  if(!released.released)throw Object.assign(Error('HOST_CGROUP_CLEANUP_UNKNOWN'),{code:'HOST_CGROUP_CLEANUP_UNKNOWN',cause:error,leaf});
  throw error;
 }
 // Cleanup starts on the FIRST close and its settled result is authoritative: concurrent and repeated calls share
 // that promise, so an UNKNOWN can never turn into success and nothing is cleaned while the group is still serving.
 let closing=null;
 const close=()=>closing??=(async()=>{
  let childUnknown=null;
  try{await child.close();}catch(error){childUnknown=error?.code??'HOST_LAUNCH_UNKNOWN';}
  const released=releaseFiniteCgroupLeaf({leaf,fs});
  if(childUnknown||!released.released)return Object.freeze({closed:false,released:released.released,
   code:childUnknown??released.code});
  return Object.freeze({closed:true,released:true});
 })();
 return Object.freeze({schema:PROCESSING_PLACEMENT_SCHEMA,pid:child.pid,leaf,hierarchy,close});
}

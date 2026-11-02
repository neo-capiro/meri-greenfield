// @ts-check
/** Host-wide confinement verifier for a provisioned browser-only host (the `verifyConfinement` port of
 * `createHostWideProcessObserver`). On such a host the ONLY processes that may live under the generation cgroup are
 * the ones the root supervisor placed through the two root-only helpers: the browser child (`meri-host-launcher`,
 * kind browser), the host-veth relay (`meri-host-relay-launcher`) and the namespace-local relay (kind relay-browser).
 * Each helper attaches its child to the exact run leaf BEFORE exec, hides cgroupfs in the child's mount namespace and
 * drops to a fixed unprivileged uid with NoNewPrivs. This verifier re-measures those facts on every call instead of
 * asserting them:
 *  - the browser leader's kernel facts (exact leaf, exact netns, uid/gid, zero capabilities, NNP, hidden cgroupfs);
 *  - the generation root and the run parent are root-owned and not group/world writable, so no unprivileged process
 *    can write `cgroup.procs` of any group it can reach (untrusted migration denied by DAC plus hidden cgroupfs);
 *  - every PID currently in the whole generation tree runs as one of the confined uids with NoNewPrivs and the hidden
 *    cgroupfs view (all entrypoints confined: nothing root-owned or foreign has entered the tree).
 * The record is a point-in-time measurement the observer refreshes while it waits. Once the browser leader has left the
 * tree it must be gone from the system (an alive leader elsewhere is a migration, refused); the remaining processes are
 * still measured on every tick. It is not a claim about processes outside the tree, the remote AgentCore SDK or the
 * EC2 instance. */
import {readdir,readFile,stat} from 'node:fs/promises';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from '../binding.mjs';
import {hostWideCgroup,HOST_CGROUP_CONFINEMENT_SCHEMA} from '../host-wide-process-observer.mjs';
import {readLeaderKernelFacts,assertHiddenCgroupfs} from './native-verifier.mjs';

const fault=code=>Object.assign(new Error(code),{code});
const fail=code=>{throw fault(code);};
const uidOk=uid=>Number.isSafeInteger(uid)&&uid>=1000&&uid<=65533;
const PSEUDO=/^cgroup\./u;
const exactLine=(raw,name)=>{
 const lines=raw.split('\n').filter(line=>line.startsWith(`${name}:`));
 if(lines.length!==1)fail('HOST_CONFINEMENT_UNPROVEN');return lines[0].slice(name.length+1).trim();
};
/** Default procfs/cgroupfs readback. The injection seam is for focused tests only. */
export function createLinuxBrowserConfinementPorts(){return Object.freeze({readFile,stat,readdir});}

export function createBrowserHostConfinementVerifier({allocation,binding,hostIdentity,browserNetwork,browserUid,browserGid,
 confinedUids,ports=createLinuxBrowserConfinementPorts(),now=Date.now}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
 if(a.hostMode!=='browser-only'||!uidOk(browserUid)||!uidOk(browserGid)||!Array.isArray(confinedUids)||confinedUids.length<1||
  confinedUids.some(uid=>!uidOk(uid))||!confinedUids.includes(browserUid)||browserNetwork===null||typeof browserNetwork!=='object'||
  typeof ports?.readFile!=='function'||typeof ports?.stat!=='function'||typeof ports?.readdir!=='function'||typeof now!=='function')
  fail('HOST_CONFINEMENT_CONFIGURATION');
 const group=hostWideCgroup({allocation:a,binding:b,hostIdentity:i}),aSha=canonicalSha256(a),bSha=canonicalSha256(b),iSha=canonicalSha256(i);
 const runParent=`${group.path}/${bSha}`;
 const rootOwnedClosed=async path=>{
  let s;try{s=await ports.stat(path);}catch{fail('HOST_CONFINEMENT_UNPROVEN');}
  if(s?.isDirectory?.()!==true||s.uid!==0||(s.mode&0o022)!==0)fail('HOST_CONFINEMENT_UNPROVEN');
 };
 const pidsBelow=async(path,pids,depth)=>{
  if(depth>6)fail('HOST_CONFINEMENT_UNPROVEN');
  let procs,entries;
  try{procs=await ports.readFile(`${path}/cgroup.procs`,'utf8');entries=await ports.readdir(path);}catch{fail('HOST_CONFINEMENT_UNPROVEN');}
  for(const line of String(procs).split('\n').map(v=>v.trim()).filter(Boolean)){
   if(!/^[1-9][0-9]{0,9}$/u.test(line))fail('HOST_CONFINEMENT_UNPROVEN');pids.add(Number(line));
  }
  for(const entry of entries){
   if(typeof entry!=='string'||PSEUDO.test(entry))continue;
   let s;try{s=await ports.stat(`${path}/${entry}`);}catch{fail('HOST_CONFINEMENT_UNPROVEN');}
   if(s?.isSymbolicLink?.()===true)fail('HOST_CONFINEMENT_UNPROVEN');
   if(s?.isDirectory?.()===true)await pidsBelow(`${path}/${entry}`,pids,depth+1);
  }
  return pids;
 };
 const confinedProcess=async pid=>{
  let status,mounts;
  try{status=await ports.readFile(`/proc/${pid}/status`,'utf8');mounts=await ports.readFile(`/proc/${pid}/mountinfo`,'utf8');}catch{fail('HOST_CONFINEMENT_UNPROVEN');}
  const uids=exactLine(status,'Uid').split(/\s+/u);
  if(uids.length!==4||uids.some(value=>!/^\d+$/u.test(value)||!confinedUids.includes(Number(value))))fail('HOST_CONFINEMENT_UNPROVEN');
  if(exactLine(status,'NoNewPrivs')!=='1')fail('HOST_CONFINEMENT_UNPROVEN');
  try{assertHiddenCgroupfs(mounts);}catch{fail('HOST_CONFINEMENT_UNPROVEN');}
 };
 /** A leader that left the tree must have left the system; its PID alive anywhere else is a migration. */
 const leaderGone=async pid=>{
  try{await ports.readFile(`/proc/${pid}/status`,'utf8');}catch(error){if(error?.code==='ENOENT')return;fail('HOST_CONFINEMENT_UNPROVEN');}
  fail('HOST_CONFINEMENT_UNPROVEN');
 };
 async function verifyConfinement(request){
  let r;try{r=own(data(request),['allocation','binding','hostIdentity','cgroupRelative','groupIdentity','browserLeaderPid']);}
  catch{fail('HOST_CONFINEMENT_UNPROVEN');}
  if(canonicalSha256(r.allocation)!==aSha||canonicalSha256(r.binding)!==bSha||canonicalSha256(r.hostIdentity)!==iSha||
   r.cgroupRelative!==group.relative)fail('HOST_CONFINEMENT_UNPROVEN');
  const proof=browserNetwork.proof;
  if(proof?.verified!==true||proof.kind!=='browser')fail('HOST_CONFINEMENT_UNPROVEN');
  // The tree itself: root-owned closed directories, and only launcher-placed unprivileged processes inside them.
  await rootOwnedClosed(group.path);await rootOwnedClosed(runParent);
  const pids=await pidsBelow(group.path,new Set(),0);
  if(pids.has(r.browserLeaderPid)){
   // The live browser leader, measured against its exact leaf, namespace, identity, capabilities, NNP and hidden cgroupfs.
   let facts;
   try{facts=await readLeaderKernelFacts({allocation:a,binding:b,hostIdentity:i,leaderKind:'browser',leaderPid:r.browserLeaderPid,
    networkProof:proof,expectedUid:browserUid,expectedGid:browserGid,groupIdentity:r.groupIdentity,ports,now});}
   catch{fail('HOST_CONFINEMENT_UNPROVEN');}
   if(facts.cgroupfsUnavailable!==true||facts.noNewPrivs!==true||facts.zeroCapabilities!==true)fail('HOST_CONFINEMENT_UNPROVEN');
  }else await leaderGone(r.browserLeaderPid);
  for(const pid of pids)await confinedProcess(pid);
  const observedAtMs=now();if(!Number.isSafeInteger(observedAtMs))fail('HOST_CONFINEMENT_UNPROVEN');
  return Object.freeze({schema:HOST_CGROUP_CONFINEMENT_SCHEMA,allocationSha256:aSha,bindingSha256:bSha,hostIdentitySha256:iSha,
   groupIdentitySha256:canonicalSha256(r.groupIdentity),cgroupRelative:group.relative,browserLeaderPid:r.browserLeaderPid,observedAtMs,
   preExecPlacement:true,allEntrypointsConfined:true,untrustedCgroupfsUnavailable:true,untrustedMigrationDenied:true});
 }
 return Object.freeze({verifyConfinement});
}

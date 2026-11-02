// @ts-check
/** Read-only Linux facts for the trusted D005 host owner. A process snapshot can show one PID's cgroup, netns,
 * mount namespace, credentials and capabilities. It cannot prove all alternate entrypoints are contained, that
 * descendants cannot migrate later, that the image admits no extra executable path, or that the EC2 instance and
 * volume/ENI actually belong to this allocation. Therefore neither public verifier emits an authority receipt. */
import {readFile,stat} from 'node:fs/promises';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from '../binding.mjs';
import {hostWideCgroup} from '../host-wide-process-observer.mjs';
import {parseProcCgroup} from '../process-observer.mjs';

export const LEADER_KERNEL_READBACK_SCHEMA='meri-d005-leader-kernel-readback/1';
const LEADER_KINDS=Object.freeze(['sdk','browser']);
const fault=(code,cause)=>Object.assign(new Error(code),{code,...(cause?{cause}:{})});
const fail=code=>{throw fault(code);};
const pidOk=pid=>Number.isSafeInteger(pid)&&pid>1&&pid<=2147483647;
const uidOk=uid=>Number.isSafeInteger(uid)&&uid>=1000&&uid<=65533;
const nsIdentity=value=>Object.freeze({dev:String(value.dev),ino:String(value.ino)});
const exactLine=(raw,name)=>{
 const lines=raw.split('\n').filter(line=>line.startsWith(`${name}:`));
 if(lines.length!==1)fail('HOST_NATIVE_READBACK_UNKNOWN');return lines[0].slice(name.length+1).trim();
};
const fourIds=(raw,name,expected)=>{
 const values=exactLine(raw,name).split(/\s+/u);
 if(values.length!==4||values.some(value=>!/^\d+$/u.test(value)||Number(value)!==expected))
  fail('HOST_NATIVE_READBACK_REFUSED');
};
const noCaps=raw=>{
 for(const name of ['CapInh','CapPrm','CapEff','CapBnd','CapAmb']){
  const value=exactLine(raw,name);
  if(!/^[0-9a-fA-F]{1,16}$/u.test(value)||BigInt(`0x${value}`)!==0n)
   fail('HOST_NATIVE_READBACK_REFUSED');
 }
};
const startTicks=raw=>{
 const end=raw.lastIndexOf(')');if(end<2||raw[end+1]!==' ')fail('HOST_NATIVE_READBACK_UNKNOWN');
 const values=raw.slice(end+2).trim().split(/\s+/u),value=values[19];
 if(!/^\d+$/u.test(value))fail('HOST_NATIVE_READBACK_UNKNOWN');return value;
};
/** The launcher's hidden cgroupfs view: ONE read-only tmpfs over /sys/fs/cgroup and no cgroup2 mount in the process. */
export const assertHiddenCgroupfs=raw=>{
 const mounts=raw.trim().split('\n').filter(Boolean).map(line=>{
  const halves=line.split(' - ');if(halves.length!==2)fail('HOST_NATIVE_READBACK_UNKNOWN');
  const left=halves[0].split(' '),right=halves[1].split(' ');
  if(left.length<6||right.length<3)fail('HOST_NATIVE_READBACK_UNKNOWN');
  return {point:left[4],options:left[5].split(','),type:right[0]};
 });
 const target=mounts.filter(m=>m.point==='/sys/fs/cgroup');
 if(target.length!==1||target[0].type!=='tmpfs'||
  ['ro','nosuid','nodev','noexec'].some(option=>!target[0].options.includes(option))||
  mounts.some(m=>m.type==='cgroup2'))fail('HOST_NATIVE_READBACK_REFUSED');
};
/** Default filesystem readback. The injection seam is for focused tests only; production uses procfs and sysfs. */
export function createLinuxNativeReadbackPorts(){return Object.freeze({readFile,stat});}

/** Measure one paused or running leader (the SDK child of a legacy host, or the browser child of a browser-only host)
 * against the pinned allocation, its exact run cgroup leaf and its network namespace. Snapshot checks before and after
 * the reads reject observed PID replacement. A successful result is partial diagnostic evidence about ONE process,
 * deliberately not a HOST_CGROUP_CONFINEMENT_SCHEMA authority receipt. */
export async function readLeaderKernelFacts({allocation,binding,hostIdentity,leaderKind,leaderPid,networkProof,
 expectedUid,expectedGid,groupIdentity,ports=createLinuxNativeReadbackPorts(),now=Date.now}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
 const group=hostWideCgroup({allocation:a,binding:b,hostIdentity:i}),aSha=canonicalSha256(a),bSha=canonicalSha256(b);
 if(!LEADER_KINDS.includes(leaderKind)||!pidOk(leaderPid)||!uidOk(expectedUid)||!uidOk(expectedGid)||typeof now!=='function'||
  typeof ports?.readFile!=='function'||typeof ports?.stat!=='function'||
  networkProof?.verified!==true||networkProof.kind!==leaderKind||networkProof.allocationSha256!==aSha||
  networkProof.bindingSha256!==bSha||!/^[0-9]+$/u.test(networkProof.namespaceDev)||
  !/^[0-9]+$/u.test(networkProof.namespaceIno)||
  typeof groupIdentity?.dev!=='string'||typeof groupIdentity?.ino!=='string')
  fail('HOST_NATIVE_READBACK_CONFIGURATION');
 const leaderRelative=leaderKind==='sdk'?group.sdkLeaderRelative:`${group.relative}/${bSha}/browser`;
 const proc=`/proc/${leaderPid}`;
 try{
  const before=startTicks(await ports.readFile(`${proc}/stat`,'utf8'));
  const [boot,status,cgroup,mounts,netns,mntns,hostMntns,groupStat]=await Promise.all([
   ports.readFile('/proc/sys/kernel/random/boot_id','utf8'),
   ports.readFile(`${proc}/status`,'utf8'),ports.readFile(`${proc}/cgroup`,'utf8'),
   ports.readFile(`${proc}/mountinfo`,'utf8'),ports.stat(`${proc}/ns/net`),ports.stat(`${proc}/ns/mnt`),
   ports.stat('/proc/self/ns/mnt'),ports.stat(group.path),
  ]);
  const after=startTicks(await ports.readFile(`${proc}/stat`,'utf8'));
  if(before!==after||boot.trim()!==i.bootId||parseProcCgroup(cgroup)!==leaderRelative||
   String(groupStat.dev)!==groupIdentity.dev||String(groupStat.ino)!==groupIdentity.ino||
   String(netns.dev)!==networkProof.namespaceDev||String(netns.ino)!==networkProof.namespaceIno||
   canonicalSha256(nsIdentity(mntns))===canonicalSha256(nsIdentity(hostMntns)))
   fail('HOST_NATIVE_READBACK_REFUSED');
  fourIds(status,'Uid',expectedUid);fourIds(status,'Gid',expectedGid);noCaps(status);
  if(exactLine(status,'NoNewPrivs')!=='1')fail('HOST_NATIVE_READBACK_REFUSED');
  assertHiddenCgroupfs(mounts);
  const observedAtMs=now();if(!Number.isSafeInteger(observedAtMs))fail('HOST_NATIVE_READBACK_UNKNOWN');
  return Object.freeze({schema:LEADER_KERNEL_READBACK_SCHEMA,allocationSha256:aSha,bindingSha256:bSha,
   hostIdentitySha256:canonicalSha256(i),leaderKind,leaderPid,processStartTicks:before,
   cgroupRelative:leaderRelative,groupIdentitySha256:canonicalSha256(groupIdentity),
   networkNamespaceDev:networkProof.namespaceDev,networkNamespaceIno:networkProof.namespaceIno,
   mountNamespaceDev:String(mntns.dev),mountNamespaceIno:String(mntns.ino),uid:expectedUid,gid:expectedGid,
   zeroCapabilities:true,noNewPrivs:true,cgroupfsUnavailable:true,observedAtMs,
   allEntrypointsConfined:false,untrustedMigrationDenied:false,outerIsolationBoundary:false});
 }catch(error){if(error?.code?.startsWith('HOST_NATIVE_READBACK_'))throw error;
  throw fault('HOST_NATIVE_READBACK_UNKNOWN',error);}
}

/** The actual host-wide observer requires positive all-entrypoint and migration claims. Procfs cannot establish
 * those global properties, so this port refuses after measuring rather than laundering a partial readback. */
export function createFailClosedNativeVerifier({allocation,binding,hostIdentity,sdkNetwork,sdkUid,sdkGid,
 ports=createLinuxNativeReadbackPorts(),now=Date.now}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
 const inspectSdkLeader=request=>readLeaderKernelFacts({allocation:a,binding:b,hostIdentity:i,leaderKind:'sdk',
  leaderPid:request.sdkLeaderPid,networkProof:sdkNetwork.proof,expectedUid:sdkUid,
  expectedGid:sdkGid,groupIdentity:request.groupIdentity,ports,now});
 return Object.freeze({
  inspectSdkLeader,
  async verifyConfinement(request){await inspectSdkLeader(request);fail('HOST_CONFINEMENT_UNPROVEN');},
  async verifyOuterIsolation(){fail('HOST_OUTER_ISOLATION_UNPROVEN');},
 });
}

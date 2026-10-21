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

export const NATIVE_SDK_READBACK_SCHEMA='meri-d005-sdk-kernel-readback/1';
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
const hiddenCgroupfs=raw=>{
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

/** Measure one paused or running SDK leader against the pinned allocation, cgroup and namespace. Snapshot checks
 * before and after the reads reject observed PID replacement. A successful result is partial diagnostic evidence,
 * deliberately not a HOST_CGROUP_CONFINEMENT_SCHEMA authority receipt. */
export async function readSdkLeaderKernelFacts({allocation,binding,hostIdentity,sdkLeaderPid,networkProof,
 expectedUid,expectedGid,groupIdentity,ports=createLinuxNativeReadbackPorts(),now=Date.now}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
 const group=hostWideCgroup({allocation:a,binding:b,hostIdentity:i}),aSha=canonicalSha256(a),bSha=canonicalSha256(b);
 if(!pidOk(sdkLeaderPid)||!uidOk(expectedUid)||!uidOk(expectedGid)||typeof now!=='function'||
  typeof ports?.readFile!=='function'||typeof ports?.stat!=='function'||
  networkProof?.verified!==true||networkProof.kind!=='sdk'||networkProof.allocationSha256!==aSha||
  networkProof.bindingSha256!==bSha||!/^[0-9]+$/u.test(networkProof.namespaceDev)||
  !/^[0-9]+$/u.test(networkProof.namespaceIno)||
  typeof groupIdentity?.dev!=='string'||typeof groupIdentity?.ino!=='string')
  fail('HOST_NATIVE_READBACK_CONFIGURATION');
 const proc=`/proc/${sdkLeaderPid}`;
 try{
  const before=startTicks(await ports.readFile(`${proc}/stat`,'utf8'));
  const [boot,status,cgroup,mounts,netns,mntns,hostMntns,groupStat]=await Promise.all([
   ports.readFile('/proc/sys/kernel/random/boot_id','utf8'),
   ports.readFile(`${proc}/status`,'utf8'),ports.readFile(`${proc}/cgroup`,'utf8'),
   ports.readFile(`${proc}/mountinfo`,'utf8'),ports.stat(`${proc}/ns/net`),ports.stat(`${proc}/ns/mnt`),
   ports.stat('/proc/self/ns/mnt'),ports.stat(group.path),
  ]);
  const after=startTicks(await ports.readFile(`${proc}/stat`,'utf8'));
  if(before!==after||boot.trim()!==i.bootId||parseProcCgroup(cgroup)!==group.sdkLeaderRelative||
   String(groupStat.dev)!==groupIdentity.dev||String(groupStat.ino)!==groupIdentity.ino||
   String(netns.dev)!==networkProof.namespaceDev||String(netns.ino)!==networkProof.namespaceIno||
   canonicalSha256(nsIdentity(mntns))===canonicalSha256(nsIdentity(hostMntns)))
   fail('HOST_NATIVE_READBACK_REFUSED');
  fourIds(status,'Uid',expectedUid);fourIds(status,'Gid',expectedGid);noCaps(status);
  if(exactLine(status,'NoNewPrivs')!=='1')fail('HOST_NATIVE_READBACK_REFUSED');
  hiddenCgroupfs(mounts);
  const observedAtMs=now();if(!Number.isSafeInteger(observedAtMs))fail('HOST_NATIVE_READBACK_UNKNOWN');
  return Object.freeze({schema:NATIVE_SDK_READBACK_SCHEMA,allocationSha256:aSha,bindingSha256:bSha,
   hostIdentitySha256:canonicalSha256(i),sdkLeaderPid,processStartTicks:before,
   cgroupRelative:group.sdkLeaderRelative,groupIdentitySha256:canonicalSha256(groupIdentity),
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
 const inspectSdkLeader=request=>readSdkLeaderKernelFacts({allocation:a,binding:b,hostIdentity:i,
  sdkLeaderPid:request.sdkLeaderPid,networkProof:sdkNetwork.proof,expectedUid:sdkUid,
  expectedGid:sdkGid,groupIdentity:request.groupIdentity,ports,now});
 return Object.freeze({
  inspectSdkLeader,
  async verifyConfinement(request){await inspectSdkLeader(request);fail('HOST_CONFINEMENT_UNPROVEN');},
  async verifyOuterIsolation(){fail('HOST_OUTER_ISOLATION_UNPROVEN');},
 });
}

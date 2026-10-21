import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {hostWideCgroup} from '../host-wide-process-observer.mjs';
import {createFailClosedNativeVerifier,NATIVE_SDK_READBACK_SCHEMA,readSdkLeaderKernelFacts} from './native-verifier.mjs';

const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,
 leaseDeadlineMs:Date.now()+60000};
const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',
 bootId:'00000001-0000-4000-8000-000000000000',conversationId:binding.conversationId,hostId:allocation.hostId};
const group=hostWideCgroup({allocation,binding,hostIdentity}),groupIdentity={dev:'41',ino:'42'};
const networkProof={verified:true,kind:'sdk',allocationSha256:canonicalSha256(allocation),
 bindingSha256:canonicalSha256(binding),namespaceDev:'13',namespaceIno:'17'};
const statLine=`1234 (node sdk) S ${Array.from({length:22},(_,i)=>i===19?'987654':'0').join(' ')}`;
const status=`Uid:\t24001\t24001\t24001\t24001\nGid:\t24001\t24001\t24001\t24001\n`+
 ['CapInh','CapPrm','CapEff','CapBnd','CapAmb'].map(name=>`${name}:\t0000000000000000\n`).join('')+
 'NoNewPrivs:\t1\n';
const mountinfo='1 0 0:1 / / rw - ext4 /dev/root rw\n'+
 '2 1 0:2 / /sys/fs/cgroup ro,nosuid,nodev,noexec - tmpfs tmpfs ro\n';
const paths={
 '/proc/1234/stat':statLine,'/proc/1234/status':status,
 '/proc/1234/cgroup':`0::${group.sdkLeaderRelative}\n`,
 '/proc/1234/mountinfo':mountinfo,
 '/proc/sys/kernel/random/boot_id':`${hostIdentity.bootId}\n`,
};
function ports({files={},netns={dev:13,ino:17}}={}){return {
 async readFile(path){if(!Object.hasOwn({...paths,...files},path))throw Error('missing path');
  return {...paths,...files}[path];},
 async stat(path){if(path==='/proc/1234/ns/net')return netns;
  if(path==='/proc/1234/ns/mnt')return {dev:19,ino:20};
  if(path==='/proc/self/ns/mnt')return {dev:19,ino:21};
  if(path===group.path)return {dev:41,ino:42};throw Error('missing stat');},
};}
const input=(over={})=>({allocation,binding,hostIdentity,sdkLeaderPid:1234,networkProof,
 expectedUid:24001,expectedGid:24001,groupIdentity,ports:ports(),now:Date.now,...over});
const code=value=>error=>error?.code===value;

test('kernel readback pins SDK PID start, cgroup, netns, UID, capabilities, NNP and hidden cgroupfs',async()=>{
 const facts=await readSdkLeaderKernelFacts(input());
 assert.equal(facts.schema,NATIVE_SDK_READBACK_SCHEMA);
 assert.equal(facts.cgroupRelative,group.sdkLeaderRelative);
 assert.equal(facts.networkNamespaceIno,'17');
 assert.equal(facts.zeroCapabilities,true);
 assert.equal(facts.allEntrypointsConfined,false);
});

test('a partial process snapshot never becomes a host-wide confinement or outer-isolation receipt',async()=>{
 const verifier=createFailClosedNativeVerifier({allocation,binding,hostIdentity,
  sdkNetwork:{proof:networkProof},sdkUid:24001,sdkGid:24001,ports:ports()});
 const check=verifier.verifyConfinement;
 await assert.rejects(check({sdkLeaderPid:1234,groupIdentity}),code('HOST_CONFINEMENT_UNPROVEN'));
 await assert.rejects(verifier.verifyOuterIsolation(),code('HOST_OUTER_ISOLATION_UNPROVEN'));
});

test('kernel readback refuses wrong cgroup, netns, capability, privilege and mount evidence',async()=>{
 const bad=[
  {files:{'/proc/1234/cgroup':'0::/wrong\n'}},
  {netns:{dev:13,ino:99}},
  {files:{'/proc/1234/status':status.replace('CapEff:\t0000000000000000','CapEff:\t0000000000000001')}},
  {files:{'/proc/1234/status':status.replace('NoNewPrivs:\t1','NoNewPrivs:\t0')}},
  {files:{'/proc/1234/mountinfo':mountinfo.replace('tmpfs tmpfs','cgroup2 cgroup2')}},
 ];
 for(const over of bad)await assert.rejects(readSdkLeaderKernelFacts(input({ports:ports(over)})),
  error=>['HOST_NATIVE_READBACK_REFUSED','HOST_NATIVE_READBACK_UNKNOWN'].includes(error?.code));
});

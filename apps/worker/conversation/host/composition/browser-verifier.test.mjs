import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {hostWideCgroup,HOST_CGROUP_CONFINEMENT_SCHEMA,createHostWideProcessObserver} from '../host-wide-process-observer.mjs';
import {createBrowserHostConfinementVerifier} from './browser-verifier.mjs';

const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,
 hostMode:'browser-only',hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:Date.now()+60000};
const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',bootId:'00000001-0000-4000-8000-000000000000',
 conversationId:binding.conversationId,hostId:allocation.hostId};
const group=hostWideCgroup({allocation,binding,hostIdentity}),bSha=canonicalSha256(binding),groupIdentity={dev:'41',ino:'42'};
const proof={verified:true,kind:'browser',allocationSha256:canonicalSha256(allocation),bindingSha256:bSha,namespaceDev:'13',namespaceIno:'17'};
const BROWSER=2002,HOST_RELAY=3001,LOCAL_RELAY=3002;
const statLine=pid=>`${pid} (chrome) S ${Array.from({length:22},(_,i)=>i===19?'987654':'0').join(' ')}`;
const status=uid=>`Uid:\t${uid}\t${uid}\t${uid}\t${uid}\nGid:\t${uid}\t${uid}\t${uid}\t${uid}\n`+
 ['CapInh','CapPrm','CapEff','CapBnd','CapAmb'].map(name=>`${name}:\t0000000000000000\n`).join('')+'NoNewPrivs:\t1\n';
const mountinfo='1 0 0:1 / / rw - ext4 /dev/root rw\n2 1 0:2 / /sys/fs/cgroup ro,nosuid,nodev,noexec - tmpfs tmpfs ro\n';
const leaf=`${group.path}/${bSha}/browser`,relayLeaf=`${group.path}/${bSha}/host-relay-browser`;
const enoent=()=>Object.assign(Error('ENOENT'),{code:'ENOENT'});
function tree(over={}){
 const dirs={[group.path]:{procs:'',entries:[bSha],mode:0o755,uid:0},[`${group.path}/${bSha}`]:{procs:'',entries:['browser','host-relay-browser'],mode:0o755,uid:0},
  [leaf]:{procs:'1234\n',entries:[],mode:0o755,uid:0},[relayLeaf]:{procs:'2345\n',entries:[],mode:0o755,uid:0}};
 const files={'/proc/1234/stat':statLine(1234),'/proc/1234/status':status(BROWSER),'/proc/1234/cgroup':`0::${leaf.slice('/sys/fs/cgroup'.length)}\n`,
  '/proc/1234/mountinfo':mountinfo,'/proc/2345/status':status(HOST_RELAY),'/proc/2345/mountinfo':mountinfo,'/proc/sys/kernel/random/boot_id':`${hostIdentity.bootId}\n`,...over.files};
 for(const [path,node] of Object.entries(over.dirs??{}))dirs[path]={...dirs[path],...node};
 for(const [path,value] of Object.entries(over.files??{}))if(value===undefined)delete files[path];
 return {
  async readFile(path){
   if(path.endsWith('/cgroup.procs')){const d=dirs[path.slice(0,-'/cgroup.procs'.length)];if(!d)throw enoent();return d.procs;}
   if(!Object.hasOwn(files,path))throw enoent();return files[path];
  },
  async stat(path){
   if(path==='/proc/1234/ns/net')return {dev:13,ino:17};if(path==='/proc/1234/ns/mnt')return {dev:19,ino:20};if(path==='/proc/self/ns/mnt')return {dev:19,ino:21};
   if(path===group.path)return {dev:41,ino:42,uid:0,mode:0o040000|dirs[path].mode,isDirectory:()=>true,isSymbolicLink:()=>false};
   const d=dirs[path];if(!d)throw Error('missing stat');
   return {dev:41,ino:43,uid:d.uid,mode:0o040000|d.mode,isDirectory:()=>true,isSymbolicLink:()=>false};
  },
  async readdir(path){const d=dirs[path];if(!d)throw Error('missing dir');return ['cgroup.procs','cgroup.events',...d.entries];},
 };
}
const verifier=(ports,over={})=>createBrowserHostConfinementVerifier({allocation,binding,hostIdentity,browserNetwork:{get proof(){return proof;}},
 browserUid:BROWSER,browserGid:BROWSER,confinedUids:[BROWSER,HOST_RELAY,LOCAL_RELAY],ports,now:Date.now,...over});
const request={allocation,binding,hostIdentity,cgroupRelative:group.relative,groupIdentity,browserLeaderPid:1234};

test('a measured browser leader, root-owned closed groups and only confined uids in the tree yield the confinement record',async()=>{
 const record=await verifier(tree()).verifyConfinement(request);
 assert.equal(record.schema,HOST_CGROUP_CONFINEMENT_SCHEMA);assert.equal(record.browserLeaderPid,1234);assert.equal(record.cgroupRelative,group.relative);
 assert.deepEqual([record.preExecPlacement,record.allEntrypointsConfined,record.untrustedCgroupfsUnavailable,record.untrustedMigrationDenied],[true,true,true,true]);
 assert.equal(record.groupIdentitySha256,canonicalSha256(groupIdentity));
});
test('the record is exactly what the real host-wide observer accepts for a browser-only allocation',async()=>{
 const seen=[];const verifierPorts=tree();
 const observer=createHostWideProcessObserver({allocation,binding,hostIdentity,profile:`/workspace/${binding.conversationId}/.browser/profile`,
  verifyConfinement:req=>{seen.push(req.browserLeaderPid);return verifier(verifierPorts).verifyConfinement(req);},
  ports:{async openGroup(){return {identity:groupIdentity,async readEvents(){return 'populated 1\n';},async close(){}};},
   async readLeaderCgroup(){return leaf.slice('/sys/fs/cgroup'.length);},async readBootId(){return hostIdentity.bootId;}},
  timeoutMs:1000,armTimeoutMs:500,pollMs:10});
 const armed=await observer.arm({browserLeaderPid:1234});
 assert.equal(armed.armed,true);assert.deepEqual(seen,[1234]);
 await observer.close();
});
test('after the browser leader has exited, the remaining tree is still measured; a leader alive outside the tree is a migration',async()=>{
 const gone=tree({dirs:{[leaf]:{procs:''}},files:{'/proc/1234/stat':undefined,'/proc/1234/status':undefined,'/proc/1234/cgroup':undefined,'/proc/1234/mountinfo':undefined}});
 const record=await verifier(gone).verifyConfinement(request);
 assert.equal(record.allEntrypointsConfined,true);assert.equal(record.browserLeaderPid,1234);
 const migrated=tree({dirs:{[leaf]:{procs:''}}});
 await assert.rejects(verifier(migrated).verifyConfinement(request),error=>error?.code==='HOST_CONFINEMENT_UNPROVEN');
 const relayEscaped=tree({dirs:{[leaf]:{procs:''}},files:{'/proc/1234/stat':undefined,'/proc/1234/status':undefined,'/proc/1234/cgroup':undefined,'/proc/1234/mountinfo':undefined,
  '/proc/2345/mountinfo':mountinfo.replace('tmpfs tmpfs','cgroup2 cgroup2')}});
 await assert.rejects(verifier(relayEscaped).verifyConfinement(request),error=>error?.code==='HOST_CONFINEMENT_UNPROVEN');
});
test('a root or foreign process in the tree, a writable group, a missing leader or a stale proof refuse',async()=>{
 const cases=[
  tree({files:{'/proc/2345/status':status(0)}}),
  tree({files:{'/proc/2345/status':status(5555)}}),
  tree({files:{'/proc/2345/status':status(HOST_RELAY).replace('NoNewPrivs:\t1','NoNewPrivs:\t0')}}),
  tree({dirs:{[`${group.path}/${bSha}`]:{mode:0o775}}}),
  tree({dirs:{[`${group.path}/${bSha}`]:{uid:2002}}}),
  tree({files:{'/proc/1234/cgroup':'0::/wrong\n'}}),
  tree({files:{'/proc/1234/mountinfo':mountinfo.replace('tmpfs tmpfs','cgroup2 cgroup2')}}),
 ];
 for(const ports of cases)await assert.rejects(verifier(ports).verifyConfinement(request),error=>error?.code==='HOST_CONFINEMENT_UNPROVEN');
 await assert.rejects(verifier(tree(),{browserNetwork:{get proof(){return undefined;}}}).verifyConfinement(request),error=>error?.code==='HOST_CONFINEMENT_UNPROVEN');
 await assert.rejects(verifier(tree(),{browserNetwork:{get proof(){return {...proof,kind:'sdk'};}}}).verifyConfinement(request),error=>error?.code==='HOST_CONFINEMENT_UNPROVEN');
 await assert.rejects(verifier(tree()).verifyConfinement({...request,cgroupRelative:`${group.relative}/x`}),error=>error?.code==='HOST_CONFINEMENT_UNPROVEN');
 await assert.rejects(verifier(tree()).verifyConfinement({...request,browserLeaderPid:2345}),error=>error?.code==='HOST_CONFINEMENT_UNPROVEN','the leader must be the browser child');
});
test('the verifier refuses a non-browser allocation, a browser uid outside the confined set and missing ports',()=>{
 const {hostMode,...legacy}=allocation;
 assert.throws(()=>verifier(tree(),{allocation:legacy}),error=>error?.code==='HOST_CONFINEMENT_CONFIGURATION');
 assert.throws(()=>verifier(tree(),{confinedUids:[HOST_RELAY]}),error=>error?.code==='HOST_CONFINEMENT_CONFIGURATION');
 assert.throws(()=>verifier({readFile(){},stat(){}}),error=>error?.code==='HOST_CONFINEMENT_CONFIGURATION');
});

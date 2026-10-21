/** Trusted native launch port for the separate host-veth relay. The helper remains root-only until it has pinned
 * the original host netns and cgroup, then drops privileges before it binds any listener. */
import {spawn} from 'node:child_process';
import {openSync,closeSync,fstatSync,statfsSync,readFileSync,writeSync,constants as fsConstants} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {posix} from 'node:path';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from '../binding.mjs';
import {HOST_RELAY_READY_SCHEMA} from './host-relay-entry.mjs';

const ENTRY=fileURLToPath(new URL('./host-relay-entry.mjs',import.meta.url));
const fail=code=>{throw Object.assign(new Error(code),{code});};
const absolute=p=>typeof p==='string'&&p.length<4096&&posix.isAbsolute(p)&&posix.resolve(p)===p&&!p.includes('\0');
const uid=n=>Number.isSafeInteger(n)&&n>=1000&&n<=65533;
const decimal=s=>typeof s==='string'&&/^(0|[1-9][0-9]*)$/u.test(s);
const bounded=(task,ms)=>{let timer;return Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{
 timer=setTimeout(()=>reject(Object.assign(Error('HOST_NETWORK_HOST_RELAY_TIMEOUT'),{code:'HOST_NETWORK_HOST_RELAY_TIMEOUT'})),ms);
 })]).finally(()=>clearTimeout(timer));};
const CGROUP2_MAGIC=0x63677270;
function openHostRelayGroup(path){
 let fd;try{fd=openSync(`/sys/fs/cgroup${path}`,fsConstants.O_RDONLY|fsConstants.O_DIRECTORY|fsConstants.O_NOFOLLOW);
  const info=fstatSync(fd);
  if(!info.isDirectory()||info.uid!==0||Number(statfsSync(`/proc/self/fd/${fd}`).type)!==CGROUP2_MAGIC)fail('HOST_NETWORK_HOST_RELAY_CGROUP_UNKNOWN');
  const pinned=Object.freeze({dev:String(info.dev),ino:String(info.ino)});
  const check=()=>{const now=fstatSync(fd);if(String(now.dev)!==pinned.dev||String(now.ino)!==pinned.ino)fail('HOST_NETWORK_HOST_RELAY_CGROUP_UNKNOWN');};
  return Object.freeze({identity:pinned,
   kill(){check();let control;try{control=openSync(`/proc/self/fd/${fd}/cgroup.kill`,fsConstants.O_WRONLY|fsConstants.O_NOFOLLOW);
    if(writeSync(control,'1')!==1)fail('HOST_NETWORK_HOST_RELAY_CGROUP_UNKNOWN');}
    finally{if(control!==undefined)closeSync(control);}return Object.freeze({killed:true});},
   readEvents(){check();return readFileSync(`/proc/self/fd/${fd}/cgroup.events`,'utf8');},
   close(){closeSync(fd);return Object.freeze({closed:true});}});
 }catch{if(fd!==undefined)closeSync(fd);fail('HOST_NETWORK_HOST_RELAY_CGROUP_UNKNOWN');}
}
const emptyEvents=value=>typeof value==='string'&&/^populated 0$/mu.test(value);
function line(stream,max){return new Promise((resolve,reject)=>{
 let value='';const done=(error,result)=>{stream.off('data',data);stream.off('end',ended);stream.off('error',failed);error?reject(error):resolve(result);};
 const failed=()=>done(Error('HOST_NETWORK_HOST_RELAY_UNKNOWN'));
 const ended=()=>done(Error('HOST_NETWORK_HOST_RELAY_UNKNOWN'));
 const data=chunk=>{value+=chunk.toString('utf8');if(value.length>max)return failed();
  const index=value.indexOf('\n');if(index!==-1){if(index!==value.length-1)return failed();done(null,value.slice(0,index));}};
 stream.on('data',data);stream.once('end',ended);stream.once('error',failed);
 });}
async function stop(child,ms){
 if(child.exitCode!==null||child.signalCode!==null)return Object.freeze({closed:true});
 const exited=new Promise(resolve=>child.once('exit',()=>resolve(true)));
 try{child.kill('SIGKILL');}catch{} // cgroup.kill is the authoritative cut; wait for observed exit.
 try{await bounded(()=>exited,ms);}catch{fail('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN');}
 return Object.freeze({closed:true});
}

/** `forbiddenUids` must include SDK/browser and both namespace-local relay UIDs; a proxy UID must also be distinct
 * before future public mode. The returned function is the required `startHostRelayProcess` confinement port. */
export function createNativeHostRelayPort({allocation,binding,hostIdentity,helperPath,nodePath,uid:relayUid,gid:relayGid,
 forbiddenUids,forbiddenGids,authorize,signal,spawnNative=spawn,openGroup=openHostRelayGroup,readyMs=5000,stopMs=3000}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);assertD005HostIdentity(hostIdentity,b,a);
 if(!absolute(helperPath)||!absolute(nodePath)||!uid(relayUid)||!uid(relayGid)||
  !Array.isArray(forbiddenUids)||forbiddenUids.length<4||forbiddenUids.some(n=>!uid(n))||forbiddenUids.includes(relayUid)||
  !Array.isArray(forbiddenGids)||forbiddenGids.length<4||forbiddenGids.some(n=>!uid(n))||forbiddenGids.includes(relayGid)||
  typeof authorize!=='function'||typeof spawnNative!=='function'||typeof openGroup!=='function'||signal!==undefined&&!(signal instanceof AbortSignal)||
  !Number.isSafeInteger(readyMs)||readyMs<100||readyMs>10000||!Number.isSafeInteger(stopMs)||stopMs<100||stopMs>10000)
  fail('HOST_NETWORK_HOST_RELAY_CONFIGURATION');
 return async({plan,hostNamespace})=>{
  if(!['sdk','browser'].includes(plan?.kind)||plan.allocationSha256!==canonicalSha256(a)||plan.bindingSha256!==canonicalSha256(b)||
   plan.hostRelayCgroupPath!==`/meri/hosts/${a.hostId}-${a.generation}/${canonicalSha256(b)}/host-relay-${plan.kind}`||
   !decimal(hostNamespace?.namespaceDev)||!decimal(hostNamespace?.namespaceIno))fail('HOST_NETWORK_HOST_RELAY_CONFIGURATION');
  const config={kind:plan.kind,hostAddress:plan.hostAddress,routes:plan.routes.map(r=>({name:r.name,targetAddress:r.targetAddress,targetPort:r.targetPort}))};
  const encoded=Buffer.from(JSON.stringify(config)).toString('base64url');if(encoded.length>4096)fail('HOST_NETWORK_HOST_RELAY_CONFIGURATION');
  if(signal?.aborted)fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
  await bounded(()=>authorize({allocation:a,binding:b,signal}),readyMs);
  const args=['run',a.hostId,String(a.generation),canonicalSha256(b),plan.kind,hostNamespace.namespaceDev,
   hostNamespace.namespaceIno,String(relayUid),String(relayGid),nodePath,ENTRY,'/',encoded];
  const child=spawnNative(helperPath,args,{cwd:'/',env:{},stdio:['ignore','pipe','pipe','pipe','pipe'],windowsHide:true});
  if(!Number.isSafeInteger(child?.pid)||child.pid<2||!child.stdout||!child.stdio?.[3]||!child.stdio?.[4])
   fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
  let revoked=false,revocationUnknown=false,closing,group;
  const revoke=()=>{if(revocationUnknown)fail('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN');
   if(revoked)return Object.freeze({revoked:true});
   try{if(group?.kill()?.killed!==true)fail('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN');
    if(child.exitCode===null&&child.signalCode===null)try{child.kill('SIGKILL');}catch{}}
   catch{revocationUnknown=true;fail('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN');}
   revoked=true;
   return Object.freeze({revoked:true});};
  const close=()=>closing??=(async()=>{let bad=false;try{revoke();}catch{bad=true;try{child.kill('SIGKILL');}catch{}}
   try{await stop(child,stopMs);}catch{bad=true;}
   if(group){try{const until=Date.now()+stopMs;
    while(!emptyEvents(group.readEvents())){
     if(Date.now()>=until)fail('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN');
     await new Promise(resolve=>setTimeout(resolve,20));
    }}
    catch{bad=true;}try{group.close();}catch{bad=true;}}
   if(bad||revocationUnknown)fail('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN');return Object.freeze({closed:true});})();
  try{
   if(await bounded(()=>line(child.stdio[3],16),readyMs)!=='R')fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
   // The native child has attached to the exact run cgroup before it sends R. Pin the group before GO so an
   // authorization or script startup failure can still kill every descendant, not merely the leader PID.
   group=openGroup(plan.hostRelayCgroupPath);
   if(!group?.identity?.dev||!group?.identity?.ino||typeof group.kill!=='function'||typeof group.readEvents!=='function'||typeof group.close!=='function'||
    emptyEvents(group.readEvents()))fail('HOST_NETWORK_HOST_RELAY_CGROUP_UNKNOWN');
   await bounded(()=>authorize({allocation:a,binding:b,signal}),readyMs);
   if(signal?.aborted)fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');child.stdio[4].end('G');
   const raw=await bounded(()=>line(child.stdout,2048),readyMs);let ready;
   try{ready=JSON.parse(raw);}catch{fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');}
   if(ready?.schema!==HOST_RELAY_READY_SCHEMA||ready.pid!==child.pid||ready.kind!==plan.kind||
    ready.hostAddress!==plan.hostAddress||!Array.isArray(ready.routes)||ready.routes.length!==plan.routes.length||
    ready.routes.some((r,i)=>r?.name!==plan.routes[i].name||!Number.isSafeInteger(r.port)||r.port<1024||r.port>65535)||
    new Set(ready.routes.map(r=>r.port)).size!==ready.routes.length||revoked||child.exitCode!==null||child.signalCode!==null)
    fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
   return Object.freeze({pid:child.pid,uid:relayUid,gid:relayGid,cgroupPath:plan.hostRelayCgroupPath,
    hostNamespaceDev:hostNamespace.namespaceDev,hostNamespaceIno:hostNamespace.namespaceIno,
    routes:Object.freeze(ready.routes.map(r=>Object.freeze({name:r.name,port:r.port}))),
    verify(){if(revoked||child.exitCode!==null||child.signalCode!==null||emptyEvents(group.readEvents()))fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');return {verified:true};},
    revoke,close});
  }catch(error){try{await close();}catch{fail('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN');}throw error;}
 };
}

/** Guest generation/run cgroup hierarchy owned by the native processing host.
 *
 *  Derived ONLY from protected validated configuration:
 *    /sys/fs/cgroup/meri/hosts/{hostId}-{generation}                      (generation root, protected receipt)
 *    /sys/fs/cgroup/meri/hosts/{hostId}-{generation}/{sha256(binding)}    (current execution run parent)
 *
 *  Real cgroup v2 semantics: controllers are distributed TOP-DOWN through cgroup.subtree_control, interface files are
 *  pseudo-files that remain in readdir, and a cgroup with no child cgroups and no live processes can be removed with rmdir.
 *  Only directories THIS invocation created are owned and removable; borrowed parents are validated and never rewritten. */
import {lstatSync,mkdirSync,readdirSync,rmdirSync,readFileSync,writeFileSync,realpathSync,statfsSync} from 'node:fs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertNativeProcessingAllocation,assertHostRunBinding,HOST_ALLOCATION_SCHEMA} from
 '../../worker/conversation/host/binding.mjs';

export const CGROUP_ROOT='/sys/fs/cgroup';
export const HIERARCHY_BASE=`${CGROUP_ROOT}/meri/hosts`;
export const REQUIRED_CONTROLLERS=Object.freeze(['cpu','memory','pids']);
const CGROUP2_MAGIC=0x63677270;
const fault=(code,extra)=>{throw Object.assign(new Error(code),{code,...extra});};
const PSEUDO=/^cgroup\./u;

export const realHierarchyPort=Object.freeze({
 identity:()=>({uid:globalThis.process?.getuid?.()??0,euid:globalThis.process?.geteuid?.()??0}),
 statfs:path=>statfsSync(path),
 realpath:path=>realpathSync(path),
 lstat:path=>lstatSync(path),
 mkdir:path=>mkdirSync(path),
 readdir:path=>readdirSync(path),
 rmdir:path=>rmdirSync(path),
 readFile:path=>readFileSync(path,'utf8'),
 writeFile:(path,data)=>writeFileSync(path,data),
 readBootId:()=>readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),
});

export const generationRoot=config=>`${HIERARCHY_BASE}/${config.allocation.hostId}-${config.allocation.generation}`;
export const runParent=(config,binding)=>`${generationRoot(config)}/${canonicalSha256(binding)}`;

const names=value=>String(value??'').trim().split(/\s+/u).filter(Boolean);
/** Kernel subtree_control READ contains plain controller names only; '+' is invalid STATE, never something to strip. */
const delegated=value=>{
 const tokens=names(value);
 if(tokens.some(token=>/^[+-]/u.test(token))||tokens.length===0)return false;
 return REQUIRED_CONTROLLERS.every(name=>tokens.includes(name));
};
const present=value=>{
 const tokens=names(value);
 if(tokens.some(token=>/^[+-]/u.test(token)))fault('HOST_HIERARCHY_READBACK_UNKNOWN');
 return REQUIRED_CONTROLLERS.every(name=>tokens.includes(name));
};
const read=async(port,path)=>{try{return String(port.readFile(path));}
 catch(error){if(error?.code==='ENOENT')return null;fault('HOST_HIERARCHY_READBACK_UNKNOWN');}};
const exists=async(port,path)=>{try{port.lstat(path);return true;}
 catch(error){if(error?.code==='ENOENT')return false;fault('HOST_HIERARCHY_READBACK_UNKNOWN');}};
const hasLiveProcesses=async(port,path)=>names(await read(port,`${path}/cgroup.procs`)).length>0;
const childDirectories=async(port,path)=>{
 const entries=port.readdir(path);
 const directories=[];
 for(const entry of entries){
  if(PSEUDO.test(entry))continue;
  let stat;
  try{stat=port.lstat(`${path}/${entry}`);}
  catch(error){if(error?.code==='ENOENT')continue;fault('HOST_HIERARCHY_READBACK_UNKNOWN');}
  if(stat.isSymbolicLink?.()===true)fault('HOST_HIERARCHY_PATH_REFUSED');
  if(stat.isDirectory?.()===true)directories.push(entry);
 }
 return directories;
};

const canonicalAllocation=config=>{
 const a=config?.allocation;
 if(a===null||typeof a!=='object'||typeof config?.image?.digest!=='string')fault('HOST_HIERARCHY_CONFIGURATION');
 return assertNativeProcessingAllocation({schema:HOST_ALLOCATION_SCHEMA,tenantId:a.tenantId,
  conversationId:a.conversationId,generation:a.generation,hostId:a.hostId,imageDigest:config.image.digest,
  leaseDeadlineMs:a.leaseDeadlineMs,hostMode:a.hostMode});
};
const canonicalBinding=(allocation,binding)=>{
 if(binding===null||typeof binding!=='object')fault('HOST_HIERARCHY_CONFIGURATION');
 return assertHostRunBinding(allocation,binding);
};

const mountState=async port=>{
 let mountinfo;
 try{mountinfo=String(port.readFile('/proc/self/mountinfo'));}
 catch{return 'unreadable';}
 const rows=mountinfo.split('\n').map(entry=>entry.split(' ')).filter(fields=>fields.length>4);
 const cgroup2=rows.filter(fields=>{const separator=fields.indexOf('-');
  return separator>0&&fields[separator+1]==='cgroup2';});
 if(cgroup2.some(fields=>fields[4]===CGROUP_ROOT))return 'ok';
 return cgroup2.length>0?'foreign':'unreadable';    // a wrong cgroup2 mount vs no cgroup2 on this platform
};
const assertMount=async port=>{
 if(typeof port.statfs!=='function'||typeof port.realpath!=='function'||typeof port.identity!=='function')
  fault('HOST_HIERARCHY_CONFIGURATION');
 const state=await mountState(port);
 if(state==='foreign')fault('HOST_HIERARCHY_MOUNT_REFUSED');
 if(state==='ok'){
  const statfs=port.statfs(CGROUP_ROOT);
  if(typeof statfs?.type!=='number'||statfs.type!==CGROUP2_MAGIC)fault('HOST_HIERARCHY_MOUNT_REFUSED');
  let canonical;try{canonical=port.realpath(CGROUP_ROOT);}catch{fault('HOST_HIERARCHY_MOUNT_REFUSED');}
  if(canonical!==CGROUP_ROOT)fault('HOST_HIERARCHY_MOUNT_REFUSED');
  const rootStat=port.lstat(CGROUP_ROOT);
  if(rootStat.isSymbolicLink?.()===true||rootStat.isDirectory?.()!==true||
   (typeof rootStat.uid==='number'&&rootStat.uid!==0))fault('HOST_HIERARCHY_OWNERSHIP_REFUSED');
 }
 return state==='ok';
};
const assertIdentity=port=>{
 const identity=port.identity?.();
 if(typeof identity?.euid==='number'&&identity.euid!==0)fault('HOST_HIERARCHY_OWNERSHIP_REFUSED');
};
const withinDescendant=(relative,prefix)=>relative===prefix||relative.startsWith(`${prefix}/`);
const assertSupervisorOutside=async(port,pid,root)=>{
 if(!Number.isSafeInteger(pid)||pid<=0)return;
 const content=await read(port,`/proc/${pid}/cgroup`);
 if(content===null)fault('HOST_HIERARCHY_SUPERVISOR_UNKNOWN');   // cannot prove outside membership
 const relative=root.slice(CGROUP_ROOT.length);
 for(const line of content.split('\n')){
  const match=/^[0-9]+::(.*)$/u.exec(line.trim());
  if(match!==null&&withinDescendant(match[1],relative))fault('HOST_HIERARCHY_SUPERVISOR_INSIDE');
 }
};
const readBoot=async(port,config,readBootId)=>{
 const fn=readBootId??port.readBootId;
 if(typeof fn!=='function')fault('HOST_HIERARCHY_CONFIGURATION');
 const boot=String(await fn()).trim();
 // The physical boot comes from the validated local identity; the canonical public allocation has no such field.
 const expected=config.hostIdentity?.bootId??config.allocation.bootId;
 if(boot!==expected)fault('HOST_HIERARCHY_BOOT_REFUSED');
};

/** Unwind ONLY paths this invocation created, deepest first, exactly when empty, requiring exact ENOENT readback. */
async function unwindOwned(owned,port,error){
 const removed=[],unknown=[];
 for(const entry of [...owned].reverse()){
  const path=typeof entry==='string'?entry:entry.path;
  try{
   // Physical custody is only proven by a PINNED identity. Without dev/ino (e.g. a readback failed after mkdir) we may NOT
   // remove anything: a replacement inode could now live at this path.
   if(entry===null||typeof entry!=='object'||entry.dev===undefined||entry.ino===undefined){unknown.push(path);continue;}
   const current=port.lstat(path);
   if(current.dev!==entry.dev||current.ino!==entry.ino){unknown.push(path);continue;} // replacement inode: never remove
   if(await hasLiveProcesses(port,path)){unknown.push(path);continue;}
   if((await childDirectories(port,path)).length!==0){unknown.push(path);continue;}
   port.rmdir(path);
  }catch{unknown.push(path);continue;}
  try{port.lstat(path);unknown.push(path);}                       // a delete ACK alone is not absence
  catch(readback){if(readback?.code==='ENOENT')removed.push(path);else unknown.push(path);}
 }
 error.partialCleanup=unknown.length>0?'unknown':(removed.length>0?'removed':'not-created');
 throw error;
}

const requireBorrowedDelegation=async(port,path)=>{
 if(!present(await read(port,`${path}/cgroup.controllers`)))fault('HOST_HIERARCHY_CONTROLLER_REFUSED');
 if(!delegated(await read(port,`${path}/cgroup.subtree_control`)))fault('HOST_HIERARCHY_DELEGATION_REFUSED');
};
const createDelegated=async(port,path,owned,guard)=>{
 guard?.();
 let created=false;
 try{port.mkdir(path);created=true;}
 catch(error){if(error?.code!=='EEXIST')fault('HOST_HIERARCHY_CREATE_FAILED');}
 if(created)owned.push({path});                                   // ownership recorded IMMEDIATELY after mkdir
 const stat=await (async()=>{let value;try{value=port.lstat(path);}catch{fault('HOST_HIERARCHY_READBACK_UNKNOWN');}return value;})();
 if(created)Object.assign(owned[owned.length-1],{dev:stat.dev,ino:stat.ino});  // pin identity for later removal
 if(stat.isSymbolicLink?.()===true||stat.isDirectory?.()!==true)fault('HOST_HIERARCHY_PATH_REFUSED');
 if(typeof stat.uid==='number'&&stat.uid!==0)fault('HOST_HIERARCHY_OWNERSHIP_REFUSED');
 if(!created){await requireBorrowedDelegation(port,path);return false;}
 if(!present(await read(port,`${path}/cgroup.controllers`)))fault('HOST_HIERARCHY_CONTROLLER_REFUSED');
 guard?.();
 if(!delegated(await read(port,`${path}/cgroup.subtree_control`))){
  guard?.();
  try{port.writeFile(`${path}/cgroup.subtree_control`,REQUIRED_CONTROLLERS.map(name=>`+${name}`).join(' '));}
  catch{fault('HOST_HIERARCHY_DELEGATION_FAILED');}
  if(!delegated(await read(port,`${path}/cgroup.subtree_control`)))fault('HOST_HIERARCHY_READBACK_UNKNOWN');
 }
 return true;
};

/** Validate/prepare the generation root BEFORE the producer pins it. */
export async function prepareHostHierarchy({config,port=realHierarchyPort,supervisorPid,readBootId,signal,now=Date.now}={}){
 if(typeof port?.lstat!=='function'||typeof port?.mkdir!=='function'||typeof port?.readdir!=='function'||
  typeof port?.rmdir!=='function'||typeof port?.readFile!=='function'||typeof port?.writeFile!=='function')
  fault('HOST_HIERARCHY_CONFIGURATION');
 if(signal?.aborted===true)fault('HOST_HIERARCHY_CANCELLED');
 const allocation=canonicalAllocation(config);
 canonicalBinding(allocation,config.binding);
 const root=generationRoot(config);
 const mounted=await assertMount(port);
 assertIdentity(port);
 await readBoot(port,config,readBootId??port.readBootId);          // protected boot BEFORE any effect
 await assertSupervisorOutside(port,supervisorPid??globalThis.process?.pid,root);
 const existing=await exists(port,root);
 // Expired authority may use an EXACT existing target for cleanup, but may never create new processing work.
 if(allocation.leaseDeadlineMs<=now()&&existing!==true)fault('HOST_HIERARCHY_ALLOCATION_EXPIRED');
 if(mounted!==true)
  return Object.freeze({path:root,owned:Object.freeze([]),borrowedParent:false,unavailable:true,
   inventory:Object.freeze({created:Object.freeze([]),borrowed:Object.freeze([])})});
 const owned=[];
 try{
  const chain=[`${CGROUP_ROOT}/meri`,HIERARCHY_BASE,root];
  let parent=CGROUP_ROOT;
  for(const path of chain){
   if(signal?.aborted===true)fault('HOST_HIERARCHY_CANCELLED');
   if(await exists(port,path)===false){
    // The PARENT must be delegating before the child is created (top-down distribution).
    if(delegated(await read(port,`${parent}/cgroup.subtree_control`))!==true)
     fault('HOST_HIERARCHY_DELEGATION_REFUSED');
    if(signal?.aborted===true)fault('HOST_HIERARCHY_CANCELLED');
    await createDelegated(port,path,owned,()=>{if(signal?.aborted===true)fault('HOST_HIERARCHY_CANCELLED');});
   }else{
    const stat=port.lstat(path);
    if(stat.isSymbolicLink?.()===true||stat.isDirectory?.()!==true)fault('HOST_HIERARCHY_PATH_REFUSED');
    if(typeof stat.uid==='number'&&stat.uid!==0)fault('HOST_HIERARCHY_OWNERSHIP_REFUSED');
    await requireBorrowedDelegation(port,path);
   }
   parent=path;
  }
  if(await hasLiveProcesses(port,root))fault('HOST_HIERARCHY_OCCUPIED');
 }catch(error){
  if(String(error?.code??'').startsWith('HOST_HIERARCHY_')!==true)throw error;
  if(owned.length===0){error.partialCleanup='not-created';throw error;}
  await unwindOwned(owned,port,error);
 }
 return Object.freeze({path:root,owned:Object.freeze([...owned]),borrowedParent:owned.length===0,
  inventory:Object.freeze({created:Object.freeze([...owned]),
   borrowed:Object.freeze(owned.length===0?[CGROUP_ROOT,`${CGROUP_ROOT}/meri`,HIERARCHY_BASE,root]:[])}),
  unavailable:false});
}

/** Prepare/validate the CURRENT execution run parent (fresh binding), AFTER currentness authorised privileged writes. */
export async function prepareRunParent({config,binding,port=realHierarchyPort,signal,now=Date.now,deadlineMs}={}){
 if(typeof port?.lstat!=='function'||typeof port?.mkdir!=='function'||typeof port?.readdir!=='function')
  fault('HOST_HIERARCHY_CONFIGURATION');
 if(signal?.aborted===true)fault('HOST_HIERARCHY_CANCELLED');
 const allocation=canonicalAllocation(config);
 const canonical=canonicalBinding(allocation,binding);
 const host=generationRoot(config);
 const expired=()=>Number.isSafeInteger(deadlineMs)&&now()>=deadlineMs;
 const check=()=>{if(signal?.aborted===true)fault('HOST_HIERARCHY_CANCELLED');if(expired())fault('HOST_HIERARCHY_DEADLINE');};
 check();
 if(await exists(port,host)!==true)fault('HOST_HIERARCHY_PARENT_MISSING');
 check();
 await requireBorrowedDelegation(port,host);
 check();
 const path=runParent(config,canonical);
 const owned=[];
 try{
  if(allocation.leaseDeadlineMs<=now()&&await exists(port,path)!==true)fault('HOST_HIERARCHY_ALLOCATION_EXPIRED');
  check();
  if(await exists(port,path)===false){check();await createDelegated(port,path,owned,check);}
  else{
   const stat=port.lstat(path);
   if(stat.isSymbolicLink?.()===true||stat.isDirectory?.()!==true)fault('HOST_HIERARCHY_PATH_REFUSED');
   if(typeof stat.uid==='number'&&stat.uid!==0)fault('HOST_HIERARCHY_OWNERSHIP_REFUSED');
   await requireBorrowedDelegation(port,path);
  }
  check();
  if(await hasLiveProcesses(port,path))fault('HOST_HIERARCHY_OCCUPIED');
 }catch(error){
  if(String(error?.code??'').startsWith('HOST_HIERARCHY_')!==true)throw error;
  if(owned.length===0){error.partialCleanup='not-created';throw error;}
  await unwindOwned(owned,port,error);
 }
 return Object.freeze({path,owned:Object.freeze([...owned]),created:owned.length>0,hostPath:host});
}

/** Remove only directories THIS invocation created, deepest first, requiring exact ENOENT readback. */
export async function releaseOwnedHierarchy({record,port=realHierarchyPort}={}){
 const removed=[],unknown=[];
 for(const entry of [...(record?.owned??[])].reverse()){
  const path=typeof entry==='string'?entry:entry.path;
  try{
   if(entry===null||typeof entry!=='object'||entry.dev===undefined||entry.ino===undefined){unknown.push(path);continue;}
   const current=port.lstat(path);
   if(current.dev!==entry.dev||current.ino!==entry.ino){unknown.push(path);continue;}
   if(await hasLiveProcesses(port,path)){unknown.push(path);continue;}
   if((await childDirectories(port,path)).length!==0){unknown.push(path);continue;}
   port.rmdir(path);
  }catch{unknown.push(path);continue;}
  try{port.lstat(path);unknown.push(path);}
  catch(readback){if(readback?.code==='ENOENT')removed.push(path);else unknown.push(path);}
 }
 return Object.freeze({removed:Object.freeze(removed),unknown:Object.freeze(unknown)});
}

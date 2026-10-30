// @ts-check
/** Root-owned FINITE cgroup-v2 leaf for one trusted processing group (SAME235 correction 09).
 *
 * Canonical contract only: host allocation/RunBinding/host identity, digest and currentness come from the existing
 * production validators (`host/binding.mjs`, `packages/contracts/validate.mjs`) and `canonicalSha256` — this module does
 * not re-implement or approximate them. Kernel read/write semantics: `cgroup.subtree_control` READS controller names
 * (`cpu memory pids`); only writes use `+name`/`-name`. All authorization and occupancy checks complete before any limit
 * write, and an existing non-empty or differently limited leaf is never mutated.
 *
 * It is the writer the C launcher's `processing` kind and the accepted 549 observation path consume; it starts no child
 * and claims no absence. `fs`/`identity` are synthetic-test seams, never production inputs.
 */
import * as realFs from 'node:fs';
import {posix} from 'node:path';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity,assertBrowserHostCurrent} from '../binding.mjs';

export const FINITE_CGROUP_SCHEMA='meri-d005-finite-cgroup/1';
export const HIERARCHY_SCHEMA='meri-d005-processing-hierarchy/1';
export const CGROUP_ROOT='/sys/fs/cgroup';
export const REQUIRED_CONTROLLERS=Object.freeze(['cpu','memory','pids']);
export const LIMIT_BOUNDS=Object.freeze({
 cpuQuotaUs:Object.freeze({min:1000,max:4000000}),
 periodUs:Object.freeze({min:1000,max:1000000}),
 memoryBytes:Object.freeze({min:16*1024*1024,max:64*1024*1024*1024}),
 pidsMax:Object.freeze({min:1,max:4096}),
});
export const PROCESSING_SCOPE=/^[a-z][a-z0-9-]{0,31}$/u;
const HEX64=/^[0-9a-f]{64}$/u;

const fail=code=>{throw Object.assign(new Error(code),{code});};
const integer=(value,{min,max})=>Number.isSafeInteger(value)&&value>=min&&value<=max;

/** Reject unlimited/zero/malformed limits; a finite bound is four exact integers. */
export function assertFiniteLimits(limits){
 const l=limits??{};
 if(!integer(l.cpuQuotaUs,LIMIT_BOUNDS.cpuQuotaUs)||
  !integer(l.periodUs??100000,LIMIT_BOUNDS.periodUs)||
  !integer(l.memoryBytes,LIMIT_BOUNDS.memoryBytes)||
  !integer(l.pidsMax,LIMIT_BOUNDS.pidsMax))fail('HOST_CGROUP_LIMIT_REFUSED');
 return Object.freeze({cpuQuotaUs:l.cpuQuotaUs,periodUs:l.periodUs??100000,memoryBytes:l.memoryBytes,pidsMax:l.pidsMax});
}

const read=(fs,path)=>{try{return fs.readFileSync(path,'utf8');}catch{return null;}};
const write=(fs,path,value)=>{fs.writeFileSync(path,value);};
const tokens=text=>typeof text==='string'?text.trim().split(/\s+/u).filter(Boolean):null;

/** Kernel READ form of cgroup.subtree_control: plain controller names, no +/- prefixes. */
export function parseSubtreeControlRead(text){
 if(typeof text!=='string')return null;
 const list=text.trim()===''?[]:tokens(text);
 if(!list||new Set(list).size!==list.length)return null;
 if(list.some(name=>!/^[a-z]+$/u.test(name)))return null; // '+'/'-' belong to the write interface only
 return list;
}

function assertAuthority(authority){
 const a=authority??{};
 if(!HEX64.test(a.policySha256??'')||typeof a.readCurrent!=='function'||
  !Number.isSafeInteger(a.maxFreshMs)||a.maxFreshMs<1||a.maxFreshMs>30000)fail('HOST_CGROUP_AUTHORITY_REFUSED');
 return a;
}

/**
 * Create or adopt the finite leaf for `scope` after full canonical authorization. Nothing is written unless this
 * process creates a brand-new, empty leaf.
 */
export async function createFiniteCgroupLeaf({allocation,binding,hostIdentity,authority,limits,scope='processing',
 fs=realFs,identity=()=>({uid:process.getuid?.(),euid:process.geteuid?.()}),now=Date.now,signal}={}){
 const finite=assertFiniteLimits(limits);
 if(!PROCESSING_SCOPE.test(scope))fail('HOST_CGROUP_CONFIGURATION');
 const id=identity();
 if(id?.uid!==0||id?.euid!==0)fail('HOST_CGROUP_CONFIGURATION');
 let a,b,i;
 try{
  a=assertHostAllocation(allocation);
  b=assertHostRunBinding(a,binding);          // canonical tenant/conversation/scope join
  i=assertD005HostIdentity(hostIdentity,b,a);
 }catch{fail('HOST_CGROUP_BINDING_REFUSED');}
 // Fixed processing runs on the conversation host; a browser-only allocation is not processing authority.
 // Canonical allocations allow only an absent hostMode or 'browser-only'; browser-only is never processing authority.
 if(a.hostMode==='browser-only')fail('HOST_CGROUP_PLACEMENT_REFUSED');
 const at=now();
 if(!Number.isSafeInteger(at)||!Number.isSafeInteger(a.leaseDeadlineMs)||at>=a.leaseDeadlineMs)fail('HOST_CGROUP_EXPIRED');
 // Trusted currentness precedes every effect.
 const auth=assertAuthority(authority);
 let current;
 try{
  current=await auth.readCurrent({allocation:structuredClone(a),binding:structuredClone(b),policySha256:auth.policySha256,signal});
  assertBrowserHostCurrent({allocation:a,binding:b,policySha256:auth.policySha256,current,nowMs:now(),
   maxFreshMs:auth.maxFreshMs});
 }catch{fail('HOST_CGROUP_CURRENTNESS_REFUSED');}
 if(signal?.aborted)fail('HOST_CGROUP_CURRENTNESS_REFUSED');

 const digest=canonicalSha256(b);
 const relative=`/meri/hosts/${a.hostId}-${a.generation}/${digest}/${scope}`;
 const absolute=CGROUP_ROOT+relative;
 const parent=posix.dirname(absolute);
 const controllers=tokens(read(fs,`${parent}/cgroup.controllers`));
 if(!controllers||!REQUIRED_CONTROLLERS.every(name=>controllers.includes(name)))fail('HOST_CGROUP_DELEGATION_REFUSED');
 // READ interface: controller names. A '+'/'-' prefixed read is not a kernel value and is refused, never "fixed".
 const subtree=parseSubtreeControlRead(read(fs,`${parent}/cgroup.subtree_control`));
 if(!subtree||!REQUIRED_CONTROLLERS.every(name=>subtree.includes(name)))fail('HOST_CGROUP_DELEGATION_REFUSED');

 const expected=Object.freeze({cpuMax:`${finite.cpuQuotaUs} ${finite.periodUs}`,memoryMax:String(finite.memoryBytes),pidsMax:String(finite.pidsMax)});
 const readLimits=()=>Object.freeze({cpuMax:read(fs,`${absolute}/cpu.max`)?.trim()??null,
  memoryMax:read(fs,`${absolute}/memory.max`)?.trim()??null,pidsMax:read(fs,`${absolute}/pids.max`)?.trim()??null});
 const sameLimits=observed=>observed.cpuMax===expected.cpuMax&&observed.memoryMax===expected.memoryMax&&observed.pidsMax===expected.pidsMax;

 let created=false;
 try{fs.mkdirSync(absolute);created=true;}
 catch(error){
  if(error?.code!=='EEXIST')fail('HOST_CGROUP_CONFIGURATION');
 }
 if(!created){
  // Occupied or foreign groups are never mutated: check membership and limits first, then refuse or adopt.
  const members=read(fs,`${absolute}/cgroup.procs`);
  if(members===null)fail('HOST_CGROUP_OCCUPIED');
  if(members.trim()!=='')fail('HOST_CGROUP_OCCUPIED');
  if(!sameLimits(readLimits()))fail('HOST_CGROUP_FOREIGN');
 }else{
  write(fs,`${absolute}/cpu.max`,expected.cpuMax);
  write(fs,`${absolute}/memory.max`,expected.memoryMax);
  write(fs,`${absolute}/pids.max`,expected.pidsMax);
  const members=read(fs,`${absolute}/cgroup.procs`);
  if(members===null||members.trim()!=='')fail('HOST_CGROUP_READBACK_REFUSED');
  if(!sameLimits(readLimits()))fail('HOST_CGROUP_READBACK_REFUSED');
 }
 const observedAtMs=now();
 if(!Number.isSafeInteger(observedAtMs))fail('HOST_CGROUP_READBACK_REFUSED');
 return Object.freeze({schema:FINITE_CGROUP_SCHEMA,created,adopted:!created,relativePath:relative,absolutePath:absolute,
  allocationSha256:canonicalSha256(a),bindingSha256:digest,hostIdentitySha256:canonicalSha256(i),
  policySha256:auth.policySha256,limits:expected,controllers:Object.freeze(controllers),
  subtreeControl:Object.freeze(subtree),observedAtMs});
}

/** Parse /proc/<pid>/cgroup; only a single unified `0::<path>` line with no control characters is accepted. */
export function parseUnifiedCgroup(text){
 if(typeof text!=='string'||text.includes('\r')||text.includes('\0'))return null;
 const lines=text.split('\n').filter(Boolean);
 if(lines.length!==1||!lines[0].startsWith('0::'))return null;
 const path=lines[0].slice(3);
 if(!path.startsWith('/')||path.split('/').some(part=>part==='.'||part==='..'))return null;
 return path;
}

/**
 * Join the ACTUAL processing PID to the finite leaf with membership bracketing around the limit readback.
 * A foreign cgroup, a changed membership, a malformed/v1 proc line or unreadable limits refuses truthfully.
 */
export function verifyProcessingHierarchy({leaf,pid,fs=realFs,now=Date.now}={}){
 if(!leaf||leaf.schema!==FINITE_CGROUP_SCHEMA||typeof leaf.absolutePath!=='string')fail('HOST_CGROUP_CONFIGURATION');
 if(!Number.isSafeInteger(pid)||pid<2)fail('HOST_CGROUP_MEMBERSHIP_REFUSED');
 let reads=0;
 const membership=()=>{reads+=1;return parseUnifiedCgroup(read(fs,`/proc/${pid}/cgroup`));};
 const before=membership();
 if(before!==leaf.relativePath)fail('HOST_CGROUP_MEMBERSHIP_REFUSED');
 const observed=Object.freeze({cpuMax:read(fs,`${leaf.absolutePath}/cpu.max`)?.trim(),
  memoryMax:read(fs,`${leaf.absolutePath}/memory.max`)?.trim(),pidsMax:read(fs,`${leaf.absolutePath}/pids.max`)?.trim()});
 if(observed.cpuMax!==leaf.limits.cpuMax||observed.memoryMax!==leaf.limits.memoryMax||observed.pidsMax!==leaf.limits.pidsMax)
  fail('HOST_CGROUP_READBACK_REFUSED');
 const after=membership();
 if(after!==before)fail('HOST_CGROUP_MEMBERSHIP_REFUSED');
 const observedAtMs=now();
 if(!Number.isSafeInteger(observedAtMs))fail('HOST_CGROUP_MEMBERSHIP_REFUSED');
 return Object.freeze({schema:HIERARCHY_SCHEMA,pid,relativePath:leaf.relativePath,limits:observed,
  membershipReads:reads,stable:true,observedAtMs});
}

/** Remove only an empty, exactly-owned leaf; anything else is reported as unknown, never "cleaned". */
export function releaseFiniteCgroupLeaf({leaf,fs=realFs}={}){
 if(!leaf||leaf.schema!==FINITE_CGROUP_SCHEMA)return Object.freeze({released:false,code:'HOST_CGROUP_CONFIGURATION'});
 const members=read(fs,`${leaf.absolutePath}/cgroup.procs`);
 if(members===null)return Object.freeze({released:false,code:'HOST_CGROUP_READBACK_REFUSED'});
 if(members.trim()!=='')return Object.freeze({released:false,code:'HOST_CGROUP_OCCUPIED'});
 try{fs.rmdirSync(leaf.absolutePath);}catch{return Object.freeze({released:false,code:'HOST_CGROUP_CLEANUP_UNKNOWN'});}
 return Object.freeze({released:true,relativePath:leaf.relativePath});
}

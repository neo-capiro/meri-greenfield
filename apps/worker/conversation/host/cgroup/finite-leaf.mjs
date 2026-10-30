// @ts-check
/** Root-owned FINITE cgroup-v2 leaf bootstrap for one host execution group (SAME235 native placement 08).
 *
 * Why this owner exists: the accepted 549 qualifier can only *observe* the processing child's cgroup. On the current
 * runtime placement that child inherits the caller's (container) cgroup, whose cpu.max/memory.max/pids.max are `max`
 * (native18 max/max/max). No source owner writes finite limits into the leaf the C launchers attach to, so observation
 * alone cannot produce a bounded measurement. This module is that missing writer: it delegates the required controllers
 * from the parent, creates the exact per-binding/leaf hierarchy the existing launchers and observers already expect,
 * writes finite cpu/memory/pids limits, and returns a readback receipt. It refuses when the mount is not a delegable
 * cgroup2 hierarchy (the AgentCore container case) instead of pretending a bound exists.
 *
 * It is placement PREPARATION only: no child is started here, no absence is claimed, and `close`/unlink of the leaf is
 * the canonical teardown owner's job. `fs`/`identity` are synthetic-test seams, not production inputs.
 */
import * as realFs from 'node:fs';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';

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

const fail=code=>{throw Object.assign(new Error(code),{code});};
const HEX64=/^[0-9a-f]{64}$/u,UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/u;
/** Deterministic sha256 over the exact fields this owner binds (no canonicalizer dependency in an isolated checkout). */
export function bindingDigest(binding){
 const field=key=>typeof binding?.[key]==='string'?binding[key]:null;
 const projection={tenantId:field('tenantId'),actorId:field('actorId'),conversationId:field('conversationId'),
  runId:field('runId'),attemptId:field('attemptId'),workerId:field('workerId'),writerFence:binding?.writerFence};
 if(!['tenantId','actorId','conversationId','runId','attemptId','workerId'].every(key=>UUID.test(projection[key]??''))||
  !Number.isSafeInteger(projection.writerFence)||projection.writerFence<1)fail('HOST_CGROUP_CONFIGURATION');
 return createHash('sha256').update(JSON.stringify(projection)).digest('hex');
}
function assertAllocation(allocation){
 const a=allocation??{};
 if(a.schema!=='meri-conversation-host-allocation/1'||!UUID.test(a.tenantId??'')||!UUID.test(a.conversationId??'')||
  !Number.isSafeInteger(a.generation)||a.generation<1||!UUID.test(a.hostId??'')||
  !['browser-only','conversation'].includes(a.hostMode??'conversation')||
  !/^sha256:[0-9a-f]{64}$/u.test(a.imageDigest??'')||!Number.isSafeInteger(a.leaseDeadlineMs))fail('HOST_CGROUP_CONFIGURATION');
 return Object.freeze({...a});
}
const allocationDigest=allocation=>createHash('sha256').update(JSON.stringify({...allocation})).digest('hex');
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

function controllersOf(text){
 if(typeof text!=='string')return null;
 const list=text.trim().split(/\s+/u).filter(Boolean);
 if(!list.length||new Set(list).size!==list.length||list.some(name=>!/^[a-z]+$/u.test(name)))return null;
 return list;
}

function subtreeOf(text){
 if(typeof text!=='string')return null;
 const list=text.trim().split(/\s+/u).filter(Boolean);
 if(list.some(token=>!/^[+-][a-z]+$/u.test(token)))return null;
 return list;
}

/**
 * Create/complete the finite leaf for `scope` and return its readback receipt.
 * Layout matches the existing C launchers/observers: /meri/hosts/<hostId>-<generation>/<bindingSha256>/<scope>.
 */
export function createFiniteCgroupLeaf({allocation,binding,limits,scope='processing',
 fs=realFs,identity=()=>({uid:process.getuid?.(),euid:process.geteuid?.()}),now=Date.now}={}){
 const a=assertAllocation(allocation),b=binding,sha=bindingDigest(b),finite=assertFiniteLimits(limits);
 if(!PROCESSING_SCOPE.test(scope))fail('HOST_CGROUP_CONFIGURATION');
 const id=identity();
 if(id?.uid!==0||id?.euid!==0)fail('HOST_CGROUP_CONFIGURATION');
 if(HEX64.test(sha)===false)fail('HOST_CGROUP_CONFIGURATION');
 const relative=`/meri/hosts/${a.hostId}-${a.generation}/${sha}/${scope}`;
 const absolute=CGROUP_ROOT+relative;
 const parent=posix.dirname(absolute);
 // cgroup2 delegation: the parent must expose every required controller and have delegated it to children.
 const controllers=controllersOf(read(fs,`${parent}/cgroup.controllers`));
 if(!controllers||!REQUIRED_CONTROLLERS.every(name=>controllers.includes(name)))fail('HOST_CGROUP_DELEGATION_REFUSED');
 const subtree=subtreeOf(read(fs,`${parent}/cgroup.subtree_control`));
 if(!subtree||!REQUIRED_CONTROLLERS.every(name=>subtree.includes(`+${name}`)))fail('HOST_CGROUP_DELEGATION_REFUSED');
 let created=false;
 try{fs.mkdirSync(absolute);created=true;}catch(error){if(error?.code!=='EEXIST')fail('HOST_CGROUP_CONFIGURATION');}
 write(fs,`${absolute}/cpu.max`,`${finite.cpuQuotaUs} ${finite.periodUs}`);
 write(fs,`${absolute}/memory.max`,String(finite.memoryBytes));
 write(fs,`${absolute}/pids.max`,String(finite.pidsMax));
 // Read back only finite values; `max`, empty or a different value is a refusal, never a silent bound.
 const cpu=read(fs,`${absolute}/cpu.max`);const memory=read(fs,`${absolute}/memory.max`);const pids=read(fs,`${absolute}/pids.max`);
 const cpuParts=typeof cpu==='string'?cpu.trim().split(' '):[];
 if(cpuParts.length!==2||Number(cpuParts[0])!==finite.cpuQuotaUs||Number(cpuParts[1])!==finite.periodUs)fail('HOST_CGROUP_READBACK_REFUSED');
 if(memory?.trim()!==String(finite.memoryBytes))fail('HOST_CGROUP_READBACK_REFUSED');
 if(pids?.trim()!==String(finite.pidsMax))fail('HOST_CGROUP_READBACK_REFUSED');
 const members=read(fs,`${absolute}/cgroup.procs`);
 if(members===null||members.trim()!=='')fail('HOST_CGROUP_READBACK_REFUSED');
 const observedAtMs=now();
 if(!Number.isSafeInteger(observedAtMs))fail('HOST_CGROUP_READBACK_REFUSED');
 return Object.freeze({schema:FINITE_CGROUP_SCHEMA,created,relativePath:relative,absolutePath:absolute,
  bindingSha256:sha,allocationSha256:allocationDigest(a),
  limits:Object.freeze({cpuMax:`${finite.cpuQuotaUs} ${finite.periodUs}`,memoryMax:String(finite.memoryBytes),pidsMax:String(finite.pidsMax)}),
  controllers:Object.freeze(controllers),subtreeControl:Object.freeze(subtree),observedAtMs});
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
 * Join the ACTUAL processing PID (not the diagnostic/commands-side PID) to the finite leaf, with membership bracketing.
 * A PID in another cgroup, a changed membership across the readback, or an unreadable /proc entry refuses.
 */
export function verifyProcessingHierarchy({leaf,pid,fs=realFs,now=Date.now}={}){
 if(!leaf||leaf.schema!==FINITE_CGROUP_SCHEMA||typeof leaf.relativePath!=='string')fail('HOST_CGROUP_CONFIGURATION');
 if(!Number.isSafeInteger(pid)||pid<2)fail('HOST_CGROUP_MEMBERSHIP_REFUSED');
 const readMembership=()=>parseUnifiedCgroup(read(fs,`/proc/${pid}/cgroup`));
 const before=readMembership();
 if(before!==leaf.relativePath)fail('HOST_CGROUP_MEMBERSHIP_REFUSED');
 // Read the leaf's finite limits between the two membership observations.
 const cpu=read(fs,`${leaf.absolutePath}/cpu.max`)?.trim(),memory=read(fs,`${leaf.absolutePath}/memory.max`)?.trim(),
  pids=read(fs,`${leaf.absolutePath}/pids.max`)?.trim();
 if(cpu!==leaf.limits.cpuMax||memory!==leaf.limits.memoryMax||pids!==leaf.limits.pidsMax)fail('HOST_CGROUP_READBACK_REFUSED');
 const after=readMembership();
 if(after!==before)fail('HOST_CGROUP_MEMBERSHIP_REFUSED');
 const observedAtMs=now();
 if(!Number.isSafeInteger(observedAtMs))fail('HOST_CGROUP_MEMBERSHIP_REFUSED');
 return Object.freeze({schema:HIERARCHY_SCHEMA,pid,relativePath:leaf.relativePath,
  limits:Object.freeze({cpuMax:cpu,memoryMax:memory,pidsMax:pids}),stable:true,observedAtMs});
}

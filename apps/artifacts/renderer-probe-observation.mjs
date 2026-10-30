/** Pure cgroup v2 observation mapping shared by the fixed child probe and the host-side upload qualifier.
 * No filesystem, process or policy side effects; every caller supplies the read function.
 * The parser deliberately preserves the existing fail-closed distinctions: missing/malformed values are never a bound,
 * `max` is present-but-unlimited, literal zero is the strictest failing value, and CPU compares quota/period ratios.
 */
export const CGROUP_MOUNT='/sys/fs/cgroup';
export const CGROUP_FILES=Object.freeze({memoryMax:Object.freeze(['memory.max']),pidsMax:Object.freeze(['pids.max']),cpuMax:Object.freeze(['cpu.max'])});
export const CGROUP_DIR_MARKERS=Object.freeze(['cgroup.controllers','memory.max','pids.max','cpu.max']);
export const CGROUP_V1_FILES=Object.freeze({memoryMax:Object.freeze(['memory.max','memory/memory.limit_in_bytes']),
 pidsMax:Object.freeze(['pids.max','pids/pids.max']),cpuMax:Object.freeze(['cpu.max','cpu/cpu.cfs_quota_us'])});
const UNLIMITED=2n**62n;
const MAX_SAFE=BigInt(Number.MAX_SAFE_INTEGER);

function cgroupSegments(cgroupPath){
 if(typeof cgroupPath!=='string'||!cgroupPath.startsWith('/'))return null;
 const parts=cgroupPath.split('/').filter(Boolean);
 if(parts.some(part=>part==='.'||part==='..'))return null;
 return parts;
}
export function cgroupLevels(cgroupPath,mount){
 const parts=cgroupSegments(cgroupPath);
 if(parts===null||typeof mount!=='string'||!mount.startsWith('/'))return null;
 const levels=[mount];
 for(const part of parts)levels.push(levels[levels.length-1]+'/'+part);
 return levels;
}
/** Map a cgroup-namespace-relative membership path onto the selected cgroup2 mount root. A subtree-rooted mount at
 * `mountRoot` exposes that cgroup as `/`; membership must be at or below it. An outside-root, unrelated or malformed
 * pair returns null rather than reading a branch the process does not belong to. */
export function cgroupRelativePath(cgroupPath,mountRoot){
 const membership=cgroupSegments(cgroupPath),root=cgroupSegments(mountRoot);
 if(membership===null||root===null)return null;
 if(root.length===0)return '/'+membership.join('/');
 if(root.length>membership.length)return null;
 for(let i=0;i<root.length;i++)if(membership[i]!==root[i])return null;
 return '/'+membership.slice(root.length).join('/');
}
/** The unified-hierarchy path of this process. Only the `0::<path>` line is a cgroup v2 path; a v1-only layout has no
 * single path and is deliberately unresolved. Traversal components are refused rather than normalised. */
export function parseCgroupPath(text){
 if(typeof text!=='string')return null;
 for(const raw of text.split('\n')){
  // Linux /proc writes LF records; a raw CR is a path byte, not a CRLF terminator. Reject it before any
  // normalization so a CR-bearing cgroup path cannot alias the finite sibling without the CR.
  if(raw.includes('\r'))return null;
  const match=/^0::(.*)$/u.exec(raw);
  if(match===null)continue;
  const path=match[1];
  if(!path.startsWith('/'))return null;
  const parts=path.split('/').filter(Boolean);
  if(parts.some(part=>part==='.'||part==='..'))return null;
  return '/'+parts.join('/');
 }
 return null;
}
/** Decode only the mountinfo octal escapes defined for path fields (space, tab, newline, backslash). Any other
 * backslash sequence is unsupported and fails closed rather than being treated as a literal path. */
function unescapeMountField(value){
 if(typeof value!=='string')return null;
 let out='';
 for(let i=0;i<value.length;i++){
  if(value[i]!=='\\'){out+=value[i];continue;}
  const code=value.slice(i+1,i+4);
  if(code==='040'){out+=' ';i+=3;}
  else if(code==='011'){out+='\t';i+=3;}
  else if(code==='012'){out+='\n';i+=3;}
  else if(code==='134'){out+='\\';i+=3;}
  else return null;
 }
 return out;
}
/** The selected cgroup2 mount record. mountinfo is `<id> <parent> <major:minor> <root> <mountpoint> <opts> ...
 * - <fstype> <source> <superopts>`; the root field is the cgroup path the mount exposes at its mountpoint. The last
 * row for /sys/fs/cgroup is the visible mount, and it must be cgroup2. */
export function parseCgroupMount(text){
 if(typeof text!=='string')return null;
 let selected=null;
 for(const raw of text.split('\n')){
  const row=raw.trim();
  const fields=row.split(' ');
  if(fields.length<7)continue;
  const separator=fields.indexOf('-',6);
  if(separator<0||fields.length<separator+4)continue;
  const mountpoint=unescapeMountField(fields[4]);
  if(mountpoint!==CGROUP_MOUNT)continue;
  const root=unescapeMountField(fields[3]);
  if(root===null)return null;
  selected={id:fields[0],parent:fields[1],majorMinor:fields[2],root,mountpoint,fstype:fields[separator+1]};
 }
 if(selected===null||selected.fstype!=='cgroup2')return null;
 return Object.freeze(selected);
}
export function parseCgroupMountRoot(text){
 const mount=parseCgroupMount(text);
 return mount===null?null:mount.root;
}
function readFirst(read,dir,names){
 for(const name of names){const value=read(dir+'/'+name);if(typeof value==='string')return value;}
 return null;
}
/** Parse one v2 controller record. Only `max` is unlimited for memory/pids; `-1` is a v1 sentinel and is invalid in the
 * selected v2 hierarchy. CPU requires exactly two valid fields: `max|<quota> <period>` with a real kernel period range.
 * Missing, malformed, invalid-period and out-of-range values are `missing`, never a bound. */
export function boundState(value,{controller}={}){
 if(typeof value!=='string')return {kind:'missing'};
 const text=value.trim();
 if(text==='')return {kind:'missing'};
 if(controller==='cpu'){
  const fields=text.split(/\s+/u);
  if(fields.length!==2)return {kind:'missing'};
  const [quotaText,periodText]=fields;
  if(!/^[0-9]{1,20}$/u.test(periodText))return {kind:'missing'};
  const period=BigInt(periodText);
  if(period<1000n||period>1000000n)return {kind:'missing'};
  if(quotaText==='max')return {kind:'max',value:text,period};
  if(!/^[0-9]{1,20}$/u.test(quotaText))return {kind:'missing'};
  const quota=BigInt(quotaText);
  if(quota>=UNLIMITED)return {kind:'missing'};
  if(quota===0n)return {kind:'zero',value:text,period};
  return {kind:'finite',value:text,quota,period};
 }
 if(text==='max')return {kind:'max',value:text};
 if(!/^[0-9]{1,20}$/u.test(text))return {kind:'missing'};
 const n=BigInt(text);
 if(n===0n)return {kind:'zero',value:text};
 if(n>=UNLIMITED)return {kind:'missing'};
 return {kind:'finite',value:text,n};
}
/** True when candidate's quota/period is strictly tighter than current's, without floating-point loss. */
function tighterCpu(candidate,current){
 const candidateQuota=candidate.kind==='zero'?0n:candidate.quota;
 const currentQuota=current.kind==='zero'?0n:current.quota;
 return candidateQuota*current.period<currentQuota*candidate.period;
}
/** Pure: the effective bound visible below the selected cgroup2 mount root. Membership is mapped relative to
 * `mountRoot` first (a subtree-rooted mount exposes that cgroup as `/`), so an unrelated branch cannot contribute. The
 * effective limit is hierarchical: a finite ancestor bounds a `max` leaf; a literal zero is the strictest failing value;
 * malformed or missing values are never a bound. `read(path)` is the only filesystem port. */
export function resolveEffectiveCgroup({cgroupPath='/',mountRoot='/',mount=CGROUP_MOUNT,read}={}){
 if(typeof read!=='function')return null;
 const relative=cgroupRelativePath(cgroupPath,mountRoot);
 if(relative===null)return null;
 const levels=cgroupLevels(relative,mount);
 if(levels===null)return null;
 const leaf=levels[levels.length-1];
 if(!CGROUP_DIR_MARKERS.some(name=>typeof read(leaf+'/'+name)==='string'))return null;
 const pickScalar=name=>{
  let best=null,unlimited=false,zero=null;
  for(const dir of levels){
   const state=boundState(readFirst(read,dir,[name]));
   if(state.kind==='zero')zero=state.value;
   else if(state.kind==='finite'&&(best===null||state.n<best.n))best=state;
   else if(state.kind==='max')unlimited=true;
  }
  if(zero!==null)return zero;
  if(best!==null)return best.value;
  return unlimited?'max':null;
 };
 const pickCpu=()=>{
  let best=null,unlimited=null,zero=null;
  for(const dir of levels){
   const state=boundState(readFirst(read,dir,['cpu.max']),{controller:'cpu'});
   if(state.kind==='zero'){
    if(zero===null||tighterCpu(state,zero))zero=state;
   } else if(state.kind==='finite'){
    if(best===null||tighterCpu(state,best))best=state;
   } else if(state.kind==='max'&&unlimited===null)unlimited=state;
  }
  if(zero!==null)return zero.value;
  if(best!==null)return best.value;
  return unlimited===null?null:unlimited.value;
 };
 return Object.freeze({levels:levels.length,mountRootIsRoot:mountRoot==='/',
  memoryMax:pickScalar('memory.max'),pidsMax:pickScalar('pids.max'),cpuMax:pickCpu()});
}
/** Combine the child's own cgroup view with the host's effective hierarchy for the same inherited cgroup. Only a
 * present-but-unlimited child value (`max`) can be filled by a finite host ancestor; a missing/malformed child value is
 * never rescued and a zero child value stays strictest. CPU compares quota/period ratios and returns the original valid
 * two-field record of the tighter contributor. */
/** Exact `/proc/self/limits` value state. `unlimited` is max; a decimal value stays finite only when it is exactly
 * representable as a safe integer. A 20-digit value that cannot be represented is `unsupported`, never a rounded
 * Number. No raw table or arbitrary label is returned. */
export function limitState(value){
 if(typeof value!=='string')return {kind:'malformed'};
 const text=value.trim();
 if(text==='unlimited')return {kind:'max'};
 if(!/^[0-9]{1,20}$/u.test(text))return {kind:'malformed'};
 const n=BigInt(text);
 if(n>MAX_SAFE)return {kind:'unsupported',digits:text.length};
 return {kind:'finite',value:Number(n)};
}
/** Pure parser for the three fixed `/proc/self/limits` rows. Missing row or malformed soft/hard pair is null. */
export function parseProcLimits(text){
 if(typeof text!=='string')return null;
 const wanted={MaxFileSize:'Max file size',MaxOpenFiles:'Max open files',MaxProcesses:'Max processes'};
 const result={};
 for(const [key,label] of Object.entries(wanted)){
  const row=text.split('\n').find(l=>l.startsWith(label));
  if(row===undefined){result[key]=null;continue;}
  const fields=row.slice(label.length).trim().split(/\s+/u);
  result[key]=fields.length<2?null:{soft:limitState(fields[0]),hard:limitState(fields[1])};
 }
 return result;
}
/** Bounded stdin consumption. Reads at most `maxBytes` plus one chunk and stops; it never buffers an unbounded stream.
 * Returns empty for zero bytes, over-cap when the cap is exceeded, read-error for a read failure and ok with exact
 * text otherwise. The read port is injected so inert fixtures never touch real stdin. */
export function readBoundedInput({readSync,fd=0,maxBytes=65536,chunkSize=4096}={}){
 if(typeof readSync!=='function')return {state:'read-error'};
 const buffer=Buffer.allocUnsafe(chunkSize),chunks=[];let bytes=0;
 try{
  for(;;){
   const read=readSync(fd,buffer,0,chunkSize,null);
   if(read===0)break;
   bytes+=read;
   if(bytes>maxBytes)return {state:'over-cap',bytes};
   chunks.push(Buffer.from(buffer.subarray(0,read)));
  }
 }catch{return {state:'read-error',bytes};}
 if(bytes===0)return {state:'empty',bytes:0};
 return {state:'ok',bytes,text:Buffer.concat(chunks).toString('utf8')};
}
/** Pure visible cgroup view with the established v1/fixed-path fallback. A resolved cgroup2 mapping supplies the
 * ancestor-aware values and the changed-identity refusal. When cgroup2 cannot be mapped, the prior fixed controller
 * files are returned so the shared renderer's v1 observation path still works; no hidden ancestor is inferred. */
/** A well-formed stable v1 membership has at least one `id:controller-list:/path` record, no unified `0::` line,
 * no raw CR anywhere and no empty controller list. Absence of a valid-looking unified line alone is not v1 proof. */
function v1Membership(text){
 if(typeof text!=='string'||text.length===0||text.includes('\r'))return false;
 const lines=text.split('\n').filter(line=>line.length>0);
 if(lines.length===0)return false;
 return lines.every(line=>/^[0-9]+:[^:\r\n]+:\/[^\r\n]*$/u.test(line));
}
export function observeProbeCgroup({read}={}){
 const unknown=source=>Object.freeze({memoryMax:null,pidsMax:null,cpuMax:null,levels:0,mountRootIsRoot:false,
  membershipResolved:false,identityChanged:false,source});
 if(typeof read!=='function')return unknown('none');
 const self=read('/proc/self/cgroup'),mountinfo=read('/proc/self/mountinfo');
 const path=parseCgroupPath(self),mount=parseCgroupMount(mountinfo);
 const key=(p,m)=>p===null||m===null?null:[p,m.id,m.majorMinor,m.root,m.fstype].join('\0');
 const before=key(path,mount);
 const values=path===null||mount===null?null:resolveEffectiveCgroup({cgroupPath:path,mountRoot:mount.root,mount:CGROUP_MOUNT,read});
 const afterSelf=read('/proc/self/cgroup'),afterPath=parseCgroupPath(afterSelf),afterMount=parseCgroupMount(read('/proc/self/mountinfo'));
 const changed=self!==afterSelf||before!==key(afterPath,afterMount);
 if(changed)return Object.freeze({...unknown('identity-changed'),identityChanged:true});
 // A unified record exists only when a non-CR `0::` line is present. Rejected/raw-CR, unreadable, empty, malformed
 // and ambiguous membership cannot be reinterpreted as stable v1; only a positively valid v1 record may fall back.
 const unifiedLines=typeof self==='string'?self.split('\n').filter(line=>line.startsWith('0::')).length:0;
 const unified=unifiedLines>0;
 if(unified&&(unifiedLines!==1||path===null||mount===null||values===null))return unknown('mapping-failed');
 if(values!==null)return Object.freeze({memoryMax:values.memoryMax,pidsMax:values.pidsMax,cpuMax:values.cpuMax,
  levels:values.levels,mountRootIsRoot:values.mountRootIsRoot===true,membershipResolved:true,identityChanged:false,source:'cgroup2'});
 if(!v1Membership(self)||!v1Membership(afterSelf))return unknown('unknown');
 // Genuine stable v1: a positively valid v1 membership recorded twice. The fixed-path fallback is valid only here.
 const first=names=>{for(const name of names){const v=read(CGROUP_MOUNT+'/'+name);if(typeof v==='string')return v.trim();}return null;};
 return Object.freeze({memoryMax:first(CGROUP_V1_FILES.memoryMax),pidsMax:first(CGROUP_V1_FILES.pidsMax),cpuMax:first(CGROUP_V1_FILES.cpuMax),
  levels:0,mountRootIsRoot:false,membershipResolved:false,identityChanged:false,source:'v1-fallback'});
}
export function combineCgroupBounds(probe,host){
 const p=probe!==null&&typeof probe==='object'?probe:{};
 const h=host!==null&&typeof host==='object'?host:{};
 const pickScalar=key=>{
  const probeState=boundState(p[key]);
  if(probeState.kind==='missing')return null;
  if(probeState.kind==='zero')return p[key];
  const hostState=boundState(h[key]);
  if(probeState.kind==='finite'){
   if(hostState.kind==='zero')return h[key];
   if(hostState.kind==='finite'&&hostState.n<probeState.n)return h[key];
   return p[key];
  }
  if(hostState.kind==='finite'||hostState.kind==='zero')return h[key];
  return p[key];
 };
 const pickCpu=()=>{
  const probeState=boundState(p.cpuMax,{controller:'cpu'});
  if(probeState.kind==='missing')return null;
  if(probeState.kind==='zero')return p.cpuMax;
  const hostState=boundState(h.cpuMax,{controller:'cpu'});
  if(probeState.kind==='max'){
   if(hostState.kind==='finite'||hostState.kind==='zero')return h.cpuMax;
   return p.cpuMax;
  }
  if(hostState.kind==='zero'||(hostState.kind==='finite'&&tighterCpu(hostState,probeState)))return h.cpuMax;
  return p.cpuMax;
 };
 return Object.freeze({memoryMax:pickScalar('memoryMax'),pidsMax:pickScalar('pidsMax'),cpuMax:pickCpu()});
}

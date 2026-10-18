// @ts-check
/** Read the paused native browser child, not a caller-supplied claim about workspace access. */
import {readFile,readlink,lstat,readdir} from 'node:fs/promises';
import {posix} from 'node:path';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from '../binding.mjs';
import {browserPaths} from '../../browser/workspace.mjs';

export const BROWSER_WORKSPACE_READBACK_SCHEMA='meri-d005-browser-workspace-readback/1';
const fault=()=>Object.assign(new Error('HOST_BROWSER_WORKSPACE_UNPROVEN'),{code:'HOST_BROWSER_WORKSPACE_UNPROVEN'});
const check=condition=>{if(!condition)throw fault();};
const integer=value=>Number.isSafeInteger(value)&&value>=1000&&value<=65533;
const mode=(entry,bits)=>entry.isDirectory()&&!entry.isSymbolicLink()&&(entry.mode&0o7777)===bits;
const sameInode=(left,right)=>left.dev===right.dev&&left.ino===right.ino;
const expectedPaths=(cwd,paths)=>{const expected=browserPaths(cwd);return Object.keys(expected).every(key=>paths?.[key]===expected[key]);};

function startTicks(raw,pid){
 const close=raw.lastIndexOf(') ');check(raw.startsWith(`${pid} (`)&&close>0);
 const fields=raw.slice(close+2).trim().split(/\s+/u);
 const value=fields[19];check(/^[1-9][0-9]*$/u.test(value));return value;
}
function processStatus(raw,uid,gid){
 const lines=new Map(raw.split('\n').filter(Boolean).map(line=>{const colon=line.indexOf(':');return [line.slice(0,colon),line.slice(colon+1).trim()];}));
 for(const [field,id] of [['Uid',uid],['Gid',gid]])check(lines.get(field)?.split(/\s+/u).length===4&&
  lines.get(field).split(/\s+/u).every(value=>value===String(id)));
 check(lines.get('Groups')===''&&['CapInh','CapPrm','CapEff','CapBnd','CapAmb'].every(name=>
  /^0+$/u.test(lines.get(name)??''))&&lines.get('NoNewPrivs')==='1');
}
function unescapeMount(value){
 return value.replace(/\\([0-7]{3})/gu,(_,octal)=>String.fromCharCode(parseInt(octal,8)));
}
function mountEntries(raw){
 return raw.split('\n').filter(Boolean).map(line=>{
  const separator=line.indexOf(' - ');check(separator>0);
  const before=line.slice(0,separator).split(' '),after=line.slice(separator+3).split(' ');
  check(before.length>=6&&after.length>=3&&/^[1-9][0-9]*$/u.test(before[0]));
  return Object.freeze({id:before[0],root:unescapeMount(before[3]),target:unescapeMount(before[4]),
   options:before[5].split(','),optional:before.slice(6),type:after[0],source:after[1]});
 });
}
function exactMount(entries,target){const matching=entries.filter(entry=>entry.target===target);check(matching.length===1);return matching[0];}
function privateMount(entry){
 check(['rw','nosuid','nodev','noexec'].every(option=>entry.options.includes(option))&&
  !entry.optional.some(value=>/^(shared|master|propagate_from):/u.test(value)));
}
async function ancestorSearchable(cwd,uid,fs){
 for(let path=posix.dirname(cwd);path!=='/';path=posix.dirname(path)){
  const entry=await fs.lstat(path);
  check(entry.isDirectory()&&!entry.isSymbolicLink()&&entry.uid===0&&(entry.mode&0o022)===0&&
   (entry.mode&0o001)===1&&entry.uid!==uid);
 }
}

/** Read-only verifier. Invoke with the real native browser leader PID in `onBrowserPrepared`, before GO. */
export async function readBrowserWorkspaceIsolation({allocation,binding,hostIdentity,cwd,paths,
 browserUid,browserGid,sdkUid,sdkGid,leaderPid,now=Date.now,
 fs={readFile,readlink,lstat,readdir}}={}){
 try{
  const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
  check(typeof cwd==='string'&&posix.isAbsolute(cwd)&&posix.resolve(cwd)===cwd&&
   cwd.endsWith(`/${b.conversationId}`)&&expectedPaths(cwd,paths)&&
   [browserUid,browserGid,sdkUid,sdkGid].every(integer)&&browserUid!==sdkUid&&browserGid!==sdkGid&&
   Number.isSafeInteger(leaderPid)&&leaderPid>=2&&typeof now==='function');
  const proc=`/proc/${leaderPid}`,bindingSha256=canonicalSha256(b);
  const first=startTicks(await fs.readFile(`${proc}/stat`,'utf8'),leaderPid);
  const [status,cgroup,mountinfo,childNamespace,hostNamespace,original,source]=await Promise.all([
   fs.readFile(`${proc}/status`,'utf8'),fs.readFile(`${proc}/cgroup`,'utf8'),
   fs.readFile(`${proc}/mountinfo`,'utf8'),fs.readlink(`${proc}/ns/mnt`),fs.readlink('/proc/self/ns/mnt'),
   fs.lstat(cwd),fs.lstat(paths.root)]);
  processStatus(status,browserUid,browserGid);
  check(cgroup===`0::/meri/hosts/${a.hostId}-${a.generation}/${bindingSha256}/browser\n`&&
   /^mnt:\[[1-9][0-9]*\]$/u.test(childNamespace)&&childNamespace!==hostNamespace);
  check(original.uid===0&&original.gid===sdkGid&&mode(original,0o1770)&&
   source.uid===browserUid&&source.gid===browserGid&&mode(source,0o700));
  await ancestorSearchable(cwd,browserUid,fs);
  const entries=mountEntries(mountinfo),overlay=exactMount(entries,cwd),state=exactMount(entries,paths.root);
  privateMount(overlay);privateMount(state);
  check(overlay.type==='tmpfs'&&overlay.source==='tmpfs'&&overlay.root==='/'&&overlay.id!==state.id&&
   !entries.some(entry=>entry.target.startsWith(`${cwd}/`)&&entry.target!==paths.root));
  const childRoot=`${proc}/root`,mounted=await fs.lstat(`${childRoot}${cwd}`),mountedState=await fs.lstat(`${childRoot}${paths.root}`);
  check(mounted.uid===browserUid&&mounted.gid===browserGid&&mode(mounted,0o700)&&
   !sameInode(mounted,original)&&mountedState.uid===browserUid&&mountedState.gid===browserGid&&
   mode(mountedState,0o700)&&sameInode(mountedState,source));
  const names=await fs.readdir(`${childRoot}${cwd}`);check(names.length===1&&names[0]==='.browser');
  for(const path of [paths.profile,paths.output,paths.home]){
   const child=await fs.lstat(`${childRoot}${path}`);
   check(child.uid===browserUid&&child.gid===browserGid&&mode(child,0o700));
  }
  check(startTicks(await fs.readFile(`${proc}/stat`,'utf8'),leaderPid)===first);
  return Object.freeze({schema:BROWSER_WORKSPACE_READBACK_SCHEMA,
   allocationSha256:canonicalSha256(a),bindingSha256,hostIdentitySha256:canonicalSha256(i),
   cwd,profile:paths.profile,output:paths.output,home:paths.home,browserUid,browserGid,sdkUid,sdkGid,
   leaderPid,browserStartTicks:first,browserMountNamespace:childNamespace,
   overlayMountId:overlay.id,stateMountId:state.id,originalCwdInode:String(original.ino),
   stateInode:String(source.ino),observedAtMs:now()});
 }catch{throw fault();}
}

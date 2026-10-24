/** Private native filesystem values. SDK task contents stay opaque, separate from transcripts. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {validateShape,assertWorkspacePaths,canonicalSha256 as hash} from '../validate.mjs';
export const NATIVE_TASK_LIST_ID='meri';
export const NATIVE_FILE_LIMITS=Object.freeze({files:256,fileBytes:8388608,totalBytes:33554432,requestBytes:50331648});
const refuse=()=>{throw Error('NATIVE_FILES_REFUSED');},same=(a,b)=>hash(a)===hash(b);
export const nativeFileSha256=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Correlation header only; the existing execution credential authenticates its exact run before body reads. */
export function nativeFileBindingHeader(binding){validateShape('RunBinding',binding);const value=Buffer.from(JSON.stringify(binding)).toString('base64url');if(value.length>2048)refuse();return value;}
export function assertNativeFileBindingHeader(value){if(typeof value!=='string'||value.length<1||value.length>2048||!/^[A-Za-z0-9_-]+$/u.test(value))refuse();let b;try{const raw=Buffer.from(value,'base64url');if(raw.toString('base64url')!==value)refuse();b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{refuse();}validateShape('RunBinding',b);if(nativeFileBindingHeader(b)!==value)refuse();return b;}
// .lock is the SDK's ordinary empty lock anchor, not the transient .lock.lock directory.
const taskPath=path=>/^(?:[1-9][0-9]{0,15}\.json|\.highwatermark|\.lock)$/u.test(path);
function inertRows(rows){if(types.isProxy(rows)||!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||rows.length>NATIVE_FILE_LIMITS.files)refuse();const descriptors=Object.getOwnPropertyDescriptors(rows),keys=Reflect.ownKeys(descriptors);if(keys.length!==rows.length+1||keys.some(k=>typeof k!=='string'||k!=='length'&&(!/^(0|[1-9][0-9]*)$/u.test(k)||Number(k)>=rows.length||!descriptors[k].enumerable)||!Object.hasOwn(descriptors[k],'value')))refuse();return Array.from({length:rows.length},(_,i)=>descriptors[String(i)].value);}
function paths(rows,tasks){const names=new Set();for(const row of rows){const p=row.path;
 if(typeof p!=='string'||p.length<1||p.length>4096||p.normalize('NFC')!==p||/[\\\x00-\x1f\x7f:]/u.test(p)||p.split('/').some(v=>!v||v==='.'||v==='..'||v.length>128)||names.has(p.toLowerCase())||tasks&&!taskPath(p))refuse();names.add(p.toLowerCase());}
 for(const p of names){const parts=p.split('/');for(let i=1;i<parts.length;i++)if(names.has(parts.slice(0,i).join('/')))refuse();}}
/** Validate one bounded upload before its first object write. No caller object reference is accepted. */
export function assertNativeFileUpload(value){const v=own(value,['files','taskFiles']);
 const workspace=inertRows(v.files),tasks=inertRows(v.taskFiles);if(workspace.length+tasks.length>NATIVE_FILE_LIMITS.files)refuse();let total=0;
 const copy=(rows,tasks)=>{const result=rows.map(raw=>{const r=own(raw,['path','executable','bytes','sha256','base64']);
  if(typeof r.executable!=='boolean'||tasks&&r.executable||!Number.isSafeInteger(r.bytes)||r.bytes<0||r.bytes>NATIVE_FILE_LIMITS.fileBytes||(total+=r.bytes)>NATIVE_FILE_LIMITS.totalBytes||typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(r.sha256)||typeof r.base64!=='string'||r.base64.length!==Math.ceil(r.bytes/3)*4)refuse();
  const bytes=Buffer.from(r.base64,'base64');if(bytes.length!==r.bytes||bytes.toString('base64')!==r.base64||nativeFileSha256(bytes)!==r.sha256)refuse();return {...r};});paths(result,tasks);return result;};
 return {files:copy(workspace,false),taskFiles:copy(tasks,true)};
}
/** File-route JSON has its own finite 32 MiB byte owner; ordinary tool JSON ceilings stay unchanged. */
export function assertNativeFileRequest(operation,value){const restore=operation==='runner/files/restore',complete=operation==='runner/checkpoint/complete';if(!restore&&!complete&&operation!=='runner/checkpoint/capture')refuse();const v=own(value,['binding',...(restore?[]:['sessionId','files','taskFiles',...(complete?[]:['controlId'])])],complete?['typedResult']:[]),binding=data(v.binding);validateShape('RunBinding',binding);if(restore)return {binding};
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(s);if(!uuid(v.sessionId)||!complete&&!uuid(v.controlId))refuse();return {binding,sessionId:v.sessionId,...(complete?{}:{controlId:v.controlId}),...assertNativeFileUpload({files:v.files,taskFiles:v.taskFiles}),...(v.typedResult===undefined?{}:{typedResult:data(v.typedResult)})};}
export function assertNativeFileRestore(value,binding){const v=own(value,['binding','files','upload']);validateShape('RunBinding',v.binding);if(!same(v.binding,binding)||(v.files===null)!==(v.upload===null))refuse();if(v.files===null)return {binding:data(v.binding),files:null,upload:null};return {binding:data(v.binding),files:assertNativeFileState(v.files),upload:assertNativeFileUpload(v.upload)};}
/** Existing canonical manifest for cwd; native task entries share its immutable binding and scope. */
export function assertNativeFileState(value,{binding,scopes}={}){const v=data(own(value,['workspace','tasks']));assertWorkspacePaths(v.workspace);
 if(!Array.isArray(v.tasks)||v.workspace.entries.length+v.tasks.length>NATIVE_FILE_LIMITS.files||binding!==undefined&&!same(v.workspace.binding,binding)||scopes!==undefined&&!same(v.workspace.scopes,scopes))refuse();
 let bytes=0;for(const [rows,tasks] of [[v.workspace.entries,false],[v.tasks,true]]){paths(rows,tasks);for(const entry of rows){validateShape('WorkspaceEntry',entry);
  if(entry.kind!=='file'||tasks&&entry.executable||entry.object.versionId==='null'||entry.object.versionId==='pending'||!same(entry.object.scopes,v.workspace.scopes)||entry.object.bytes>NATIVE_FILE_LIMITS.fileBytes||(bytes+=entry.object.bytes)>NATIVE_FILE_LIMITS.totalBytes)refuse();}}
 return v;
}

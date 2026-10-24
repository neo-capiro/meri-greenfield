/** Capture/restore only the real cwd and one native SDK task list; never its credentials or transcripts. */
import {mkdir,lstat,readdir,realpath} from 'node:fs/promises';
import {join,isAbsolute,resolve,relative} from 'node:path';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {NATIVE_TASK_LIST_ID,assertNativeFileUpload,assertNativeFileState,nativeFileSha256} from '../../../packages/contracts/runtime-0.2/files.mjs';
import {createWorkspaceCapture} from './workspace-capture.mjs';
import {restoreWorkspaceBytes,verifyWorkspaceBytes} from './workspace-restore.mjs';
const fail=()=>{throw Error('NATIVE_FILES_REFUSED');};
export function nativeTaskDirectory(sdkConfigDirectory){if(typeof sdkConfigDirectory!=='string'||!isAbsolute(sdkConfigDirectory)||resolve(sdkConfigDirectory)!==sdkConfigDirectory)fail();return join(sdkConfigDirectory,'tasks',NATIVE_TASK_LIST_ID);}
async function directory(path){const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink()||await realpath(path)!==path||process.getuid&&s.uid!==process.getuid())fail();return s;}
/** Called after the already-owned private SDK config directory was created, before query. */
export async function prepareNativeTaskDirectory(sdkConfigDirectory){await directory(sdkConfigDirectory);const target=nativeTaskDirectory(sdkConfigDirectory);
 for(const p of [join(sdkConfigDirectory,'tasks'),target]){try{await mkdir(p,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}await directory(p);}return target;}
export function createNativeFiles(configuration){const c=own(configuration,['workspace','sdkConfigDirectory','expiresAtMs'],['now']),now=c.now??Date.now,tasks=nativeTaskDirectory(c.sdkConfigDirectory);
 if(typeof c.workspace!=='string'||!isAbsolute(c.workspace)||resolve(c.workspace)!==c.workspace||!Number.isSafeInteger(c.expiresAtMs)||typeof now!=='function')fail();
 const pathInside=(a,b)=>{const p=relative(a,b);return p===''||!p.startsWith('..')&&!isAbsolute(p);};if(pathInside(c.workspace,c.sdkConfigDirectory)||pathInside(c.sdkConfigDirectory,c.workspace))fail();
 const files=createWorkspaceCapture({workspace:c.workspace,expiresAtMs:c.expiresAtMs,now}),taskFiles=createWorkspaceCapture({workspace:tasks,expiresAtMs:c.expiresAtMs,now});
 function check(signal){nativeSignal(signal);if(signal?.aborted||now()>=c.expiresAtMs)fail();}
 return Object.freeze({capture({signal}={}){check(signal);const result=assertNativeFileUpload({files:files.capture({signal}),taskFiles:taskFiles.capture({signal})});check(signal);return result;},
  async restore({state,files:rawFiles,taskFiles:rawTasks,signal}){check(signal);const saved=assertNativeFileState(state);
   // The caller fetched exact immutable objects from the authenticated source mapping. Verify every byte before changing either tree.
   const verify=(entries,raw)=>{if(!Array.isArray(raw)||raw.length!==entries.length)fail();return raw.map((b,i)=>{if(!Buffer.isBuffer(b)||b.length!==entries[i].object.bytes||nativeFileSha256(b)!==entries[i].object.sha256)fail();return Buffer.from(b);});};
   const workspaceBytes=verify(saved.workspace.entries,rawFiles),taskBytes=verify(saved.tasks,rawTasks);await directory(c.workspace);await directory(tasks);check(signal);
   const apply=async(path,manifest,bytes)=>{check(signal);if((await readdir(path)).length)verifyWorkspaceBytes({workspace:path,manifest,check:()=>check(signal)});else restoreWorkspaceBytes({workspace:path,manifest,files:bytes,check:()=>check(signal)});};
   await apply(c.workspace,saved.workspace,workspaceBytes);
   // This local view reuses the path/byte restorer; it is not a second persisted workspace or checkpoint.
   await apply(tasks,{...saved.workspace,entries:saved.tasks},taskBytes);check(signal);
  }});
}

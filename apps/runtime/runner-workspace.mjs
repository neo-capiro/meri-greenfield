/** Trusted poststart owns creation of the one conversation workspace. The image
 * seeds the private /workspace volume; no network/configuration value selects
 * another parent. After startup its lifetime belongs to the task-local volume,
 * which is destroyed with the task, including any later runtime-created data. */
import * as nativeFs from 'node:fs/promises';
import {constants} from 'node:fs';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {remoteOriginal} from './native-authority/remote-task-boundary.mjs';

const root='/workspace';
const fault=code=>Object.assign(Error(code),{code});
const refuse=()=>{throw fault('RUNNER_WORKSPACE_REFUSED');};
const identity=st=>Object.freeze({dev:st.dev,ino:st.ino,uid:st.uid,gid:st.gid});
const same=(a,b)=>['dev','ino','uid','gid'].every(key=>a[key]===b[key]);

/** The filesystem/identity seams are for inert tests, never runner config.
 * Existing targets refuse: a new task cannot adopt another task's workspace.
 * Rollback removes only the empty directory this invocation just created. */
export async function initializeRunnerWorkspace({configuration,original,signal,deadlineMs=original?.expiresAtMs,now=Date.now},dependencies={}){
 const d=own(dependencies,[],['fs','runtimeIdentity']),fs=d.fs??nativeFs,
  runtime=d.runtimeIdentity??{platform:process.platform,uid:process.getuid?.(),gid:process.getgid?.()};
 let parent,child,created=false,owned,parentId,path,stopAt;
 const privateDirectory=st=>st.isDirectory()&&!st.isSymbolicLink()&&st.uid===runtime.uid&&st.gid===runtime.gid&&(st.mode&0o7777)===0o700;
 const check=()=>{if(signal?.aborted||stopAt!==undefined&&now()>=stopAt)refuse();};
 async function directory(target,expected){const st=await fs.lstat(target);if(!privateDirectory(st)||await fs.realpath(target)!==target||expected&&!same(st,expected))refuse();return identity(st);}
 async function parentCheck(){await directory(root,parentId);const held=await parent.stat();if(!privateDirectory(held)||!same(held,parentId))refuse();}
 try{
  nativeSignal(signal);const bound=remoteOriginal(original);
  if(typeof now!=='function'||!Number.isSafeInteger(deadlineMs))refuse();stopAt=Math.min(deadlineMs,bound.expiresAtMs);check();
  if(runtime.platform!=='linux'||!Number.isSafeInteger(runtime.uid)||runtime.uid<=0||!Number.isSafeInteger(runtime.gid)||runtime.gid<0||
     hash(configuration.binding)!==bound.executionKey||hash(configuration.versions)!==hash(bound.versions))refuse();
  path=`${root}/${bound.binding.conversationId}`;if(configuration.workspace!==path)refuse();
  parentId=await directory(root);check();
  parent=await fs.open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  await parentCheck();check();
  await fs.mkdir(path,{mode:0o700});created=true;
  // Record the newly created inode before cancellation checks so rollback can
  // prove which empty directory belongs to this initialization.
  owned=await directory(path);check();
  child=await fs.open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  const held=await child.stat();if(!privateDirectory(held)||!same(held,owned))refuse();
  await parentCheck();await directory(path,owned);check();
  return Object.freeze({path,...owned});
 }catch(error){
  if(created){try{
   if(!owned)throw fault('RUNNER_WORKSPACE_CLEANUP_UNKNOWN');
   await parentCheck();await directory(path,owned);
   // Nonrecursive rmdir refuses populated/replaced targets; never remove
   // workspace contents or repair permissions/ownership to force cleanup.
   await fs.rmdir(path);
  }catch{throw fault('RUNNER_WORKSPACE_CLEANUP_UNKNOWN');}}
  if(error?.code==='RUNNER_WORKSPACE_CLEANUP_UNKNOWN')throw error;
  throw fault('RUNNER_WORKSPACE_REFUSED');
 }finally{try{await child?.close();}finally{await parent?.close();}}
}

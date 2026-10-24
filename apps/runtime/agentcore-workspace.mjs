/** Conversation-local filesystem lifetime; durable SDK transcripts stay with control. */
import {lstat,realpath,mkdir,rmdir} from 'node:fs/promises';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {assertExecutionIdentity} from '../control/conversations/execution-boundary.mjs';
import {agentcoreFault} from './agentcore-contract.mjs';

export function createAgentCoreWorkspace(){
 let pin=null,owned=null;
 async function directory(path,expected){
  const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid()||s.gid!==process.getgid()||(s.mode&0o7777)!==0o700||await realpath(path)!==path||expected&&(s.dev!==expected.dev||s.ino!==expected.ino))throw agentcoreFault('RUNNER_WORKSPACE_REFUSED');return {dev:s.dev,ino:s.ino};
 }
 return Object.freeze({async prepare(value){
  const e=assertExecutionIdentity(value),identity=hash({tenantId:e.binding.tenantId,actorId:e.binding.actorId,conversationId:e.binding.conversationId,runtimeSessionId:e.runtimeSessionId});
  if(process.platform!=='linux'||process.getuid?.()!==1000||process.getgid?.()!==1000||pin!==null&&pin!==identity)throw agentcoreFault('RUNNER_WORKSPACE_REFUSED');
  await directory('/workspace');await directory('/run/meri');
  const workspace='/workspace/'+e.binding.conversationId,parent='/run/meri/'+e.binding.conversationId;
  if(!owned){const created=[];try{await mkdir(workspace,{mode:0o700});const w=await directory(workspace);created.push([workspace,w]);await mkdir(parent,{mode:0o700});const p=await directory(parent);created.push([parent,p]);owned={workspace:w,parent:p};pin=identity;}catch(error){for(const [path,identity] of created.reverse())try{await directory(path,identity);await rmdir(path);}catch{throw agentcoreFault('RUNNER_WORKSPACE_CLEANUP_UNKNOWN');}throw error;}}
  await directory(workspace,owned.workspace);await directory(parent,owned.parent);
  return {workspace,sdk:{configParentDirectory:parent,secureStorageDirectory:parent+'/secure'}};
 }});
}

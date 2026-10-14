/** One task-resident physical workspace; canonical journal remains the durable owner. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,assertWorkspacePaths,validateShape} from '../../../packages/contracts/validate.mjs';
import {copySessionJson} from '../../worker/qualification/checkpoint/session-store-data.mjs';
import {restoreWorkspaceBytes,verifyWorkspaceBytes} from './workspace-restore.mjs';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),fault=()=>{throw Error('SUPERVISOR_WORKSPACE_REFUSED');};
export function createSupervisorWorkspace(configuration){
 const c=own(configuration,['binding','workspace','expiresAtMs'],['now']),binding=data(c.binding),now=c.now??Date.now;validateShape('RunBinding',binding);
 if(typeof c.workspace!=='string'||!c.workspace.startsWith('/')||typeof now!=='function'||!Number.isSafeInteger(c.expiresAtMs))fault();
 let state='pristine',saved;
 const check=()=>{if(now()>=c.expiresAtMs)fault();};
 function request(value,withFiles){
  const raw=own(value,['binding','restoreKey','workspaceSha256','manifest',...(withFiles?['files']:[])]),{files,...metadata}=raw,v=data(metadata);check();
  if(hash(v.binding)!==hash(binding)||!/^[a-f0-9]{64}$/u.test(v.restoreKey)||!/^[a-f0-9]{64}$/u.test(v.workspaceSha256))fault();assertWorkspacePaths(v.manifest);
  if(hash(v.manifest)!==v.workspaceSha256||v.manifest.binding.tenantId!==binding.tenantId||v.manifest.binding.actorId!==binding.actorId||v.manifest.entries.length>256||v.manifest.entries.some(e=>e.object.bytes>8*1024*1024)||v.manifest.entries.reduce((n,e)=>n+e.object.bytes,0)>32*1024*1024)fault();
  return {...v,...(withFiles?{files:copySessionJson(files,48*1024*1024)}:{})};
 }
 function receipt(v){check();return data({binding,restoreKey:v.restoreKey,workspaceSha256:v.workspaceSha256,checkedAtMs:now(),expiresAtMs:c.expiresAtMs});}
 function restore(value){
  const v=request(value,true);if(state!=='pristine'||!Array.isArray(v.files)||v.files.length!==v.manifest.entries.length)fault();
  const files=v.files.map((raw,i)=>{const row=own(raw,['bytes','sha256','base64']),ref=v.manifest.entries[i].object;
   if(row.bytes!==ref.bytes||row.sha256!==ref.sha256||typeof row.base64!=='string'||row.base64.length!==Math.ceil(ref.bytes/3)*4)fault();const bytes=Buffer.from(row.base64,'base64');if(bytes.length!==ref.bytes||sha(bytes)!==ref.sha256||bytes.toString('base64')!==row.base64)fault();return bytes;});
  // One-use physical guard is ephemeral; it never acknowledges canonical SQL
  // ownership or converts an uncertain parent claim into a dispatch retry.
  state='restoring';try{restoreWorkspaceBytes({workspace:c.workspace,manifest:v.manifest,files,check});saved={restoreKey:v.restoreKey,workspaceSha256:v.workspaceSha256};state='restored';return receipt(v);}catch(error){state='failed';throw error;}
 }
 function verify(value){const v=request(value,false);if(state!=='restored'||saved.restoreKey!==v.restoreKey||saved.workspaceSha256!==v.workspaceSha256)fault();verifyWorkspaceBytes({workspace:c.workspace,manifest:v.manifest,check});return receipt(v);}
 return Object.freeze({restore,verify});
}

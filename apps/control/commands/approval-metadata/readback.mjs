/** Core-only native command approval facts. Core decides access; this owner returns
 * existing immutable metadata and the actual run, never a new approval. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertNativeConversationScope} from '../../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {immutablePayload,readKey} from './binding.mjs';

export const MAX_APPROVAL_METADATA_READBACK_BYTES=131072;
const fault=()=>Object.assign(Error('APPROVAL_METADATA_READ_UNAVAILABLE'),{code:'APPROVAL_METADATA_READ_UNAVAILABLE'});
const same=(a,b)=>hash(a)===hash(b);
export function createApprovalMetadataReadback(configuration){
 const c=own(configuration,['metadata','store','retention'],['now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 const readMetadata=storageMethod(c.metadata,'read'),readRun=storageMethod(c.store,'readOptional'),servable=storageMethod(c.retention,'assertServable');
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw fault();
 return Object.freeze({async read(raw){
  const v=own(raw,['schemaVersion','proposalId','binding'],['signal']);nativeSignal(v.signal);validateShape('RunBinding',v.binding);
  if(v.schemaVersion!==1)throw fault();const binding=data(v.binding),key=readKey({tenantId:binding.tenantId,actorId:binding.actorId,proposalId:v.proposalId});
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:now()+maxRequestMs,errorFactory:fault});
  const subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId};
  try{
   await life.run(()=>servable(subject));life.check();
   const metadata=immutablePayload(await life.run(()=>readMetadata(key,life.check))),record=metadata.record;
   if(!['document.draft','task.create','task.update','artifact.file'].includes(record.action)||record.proposalId!==v.proposalId||!same(record.binding,binding))throw fault();
   const saved=await life.run(()=>readRun(binding,{after:0,limit:1},life.check));let custody;
   if(saved!==null){
    const run=data(saved.run);validateShape('Run',run);
    const states=['queued','starting','running','paused','waiting-for-approval','completed',...(['task.create','task.update','artifact.file'].includes(record.action)?['failed']:[])];
    if(!same(run.binding,binding)||!same(run.scopes,record.scopes)||!states.includes(run.state))throw fault();
    custody={run};
   }else{
    if(!['task.create','task.update'].includes(record.action))throw fault();
    const readRetained=storageMethod(c.store.initialBindings,'readRetained');
    const initial=data(own(await life.run(()=>readRetained({binding},life.check)),['record','recordSha256','generation','latestGeneration','started'])),r=initial.record;
    const scopes=[{tenantId:binding.tenantId,kind:r.selectedClientId===null?'private-user':'client',resourceId:r.selectedClientId===null?binding.actorId:r.selectedClientId,policyRevision:r.policyRevision}];
    if(!same(r.binding,binding)||hash(r)!==initial.recordSha256||!same(scopes,record.scopes))throw fault();
    assertNativeConversationScope({binding,scopes:record.scopes,selectedClientId:r.selectedClientId});
    // Expiry and generation changes do not erase immutable outcome provenance.
    // Core authorizes effects through the original decision and current access.
    custody={preparation:{kind:'initial-binding',...initial}};
   }
   await life.run(()=>servable(subject));life.check();
   const result=data({schemaVersion:1,commandSha256:metadata.commandSha256,metadata,...custody});
   if(Buffer.byteLength(JSON.stringify(result))>MAX_APPROVAL_METADATA_READBACK_BYTES)throw fault();return result;
  }finally{life.close();}
 }});
}

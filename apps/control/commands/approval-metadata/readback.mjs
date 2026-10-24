/** Core-only document approval facts. Core decides access; this owner returns
 * existing immutable metadata and the actual run, never a new approval. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {immutablePayload,readKey} from './binding.mjs';

export const MAX_APPROVAL_METADATA_READBACK_BYTES=131072;
const fault=()=>Object.assign(Error('APPROVAL_METADATA_READ_UNAVAILABLE'),{code:'APPROVAL_METADATA_READ_UNAVAILABLE'});
const same=(a,b)=>hash(a)===hash(b);
export function createApprovalMetadataReadback(configuration){
 const c=own(configuration,['metadata','store','retention'],['now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 const readMetadata=storageMethod(c.metadata,'read'),readRun=storageMethod(c.store,'read'),servable=storageMethod(c.retention,'assertServable');
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw fault();
 return Object.freeze({async read(raw){
  const v=own(raw,['schemaVersion','proposalId','binding'],['signal']);nativeSignal(v.signal);validateShape('RunBinding',v.binding);
  if(v.schemaVersion!==1)throw fault();const binding=data(v.binding),key=readKey({tenantId:binding.tenantId,actorId:binding.actorId,proposalId:v.proposalId});
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:now()+maxRequestMs,errorFactory:fault});
  const subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId};
  try{
   await life.run(()=>servable(subject));life.check();
   const metadata=immutablePayload(await life.run(()=>readMetadata(key,life.check))),record=metadata.record;
   if(record.action!=='document.draft'||record.proposalId!==v.proposalId||!same(record.binding,binding))throw fault();
   const saved=await life.run(()=>readRun(binding,{after:0,limit:1},life.check)),run=data(saved.run);validateShape('Run',run);
   if(!same(run.binding,binding)||!same(run.scopes,record.scopes)||!['queued','starting','running','paused','waiting-for-approval','completed'].includes(run.state))throw fault();
   await life.run(()=>servable(subject));life.check();
   const result=data({schemaVersion:1,commandSha256:metadata.commandSha256,metadata,run});
   if(Buffer.byteLength(JSON.stringify(result))>MAX_APPROVAL_METADATA_READBACK_BYTES)throw fault();return result;
  }finally{life.close();}
 }});
}

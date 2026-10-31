/** One retained upload -> one immutable original, using the existing intent
 * journal and artifact publisher. An uncertain attempt never dispatches twice. */
import {officeOriginalSource,officeOriginalRequestSha256} from '../../packages/contracts/office-edit.mjs';
import {inspectOfficeEdit} from './edit-sessions/inspect-office.mjs';
import {createArtifactService} from './service.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createOfficeOriginalPublisher({options:c,context,journal,storage,id}){
 const v=c.validators;
 async function execute(value,byteValue,signal,recoveryOnly){
  if(c.officeOriginalWrites!==true||c.selectedInvocationId!==undefined||context.analysisAdmission)fail('OFFICE_IMPORT_UNAVAILABLE');
  const request=officeOriginalSource(value),binding=context.binding,requestSha256=officeOriginalRequestSha256(v,request,context);
  if(!Buffer.isBuffer(byteValue))fail('OFFICE_IMPORT_SOURCE');
  const bytes=Buffer.from(byteValue),inspection=inspectOfficeEdit(bytes,request.format);
  if(bytes.length>context.maxBytes||bytes.length!==request.original.bytes||inspection.sha256!==request.original.sha256)fail('OFFICE_IMPORT_SOURCE');
  const invocationId='sdk:'+v.hash({kind:'office-original',tenantId:binding.tenantId,actorId:binding.actorId,
   conversationId:binding.conversationId,uploadId:request.original.uploadId});
  const invocation={invocationId,versionId:id(invocationId,'version'),requestSha256};
  const record={operation:{id:request.operation,version:'0.2.0'},argumentsSha256:requestSha256},key={binding,deliveryId:invocationId,record,signal};
  const service=createArtifactService({...c,ids:()=>({artifactId:id(invocationId,'artifact'),versionId:invocation.versionId,objectId:id(invocationId,'object')})});
  const check=()=>{if(signal?.aborted)fail('ARTIFACT_CANCELLED');if(!Number.isSafeInteger(c.now())||c.now()>=context.deadlineMs)fail('ARTIFACT_DEADLINE');};
  const read=()=>storage.read({key:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId:invocationId},signal});
  async function replay(prior){
   if(!prior||v.hash(prior.record.operation)!==v.hash(record.operation)||!['PENDING','UNKNOWN','PREPARED'].includes(prior.state))fail('ARTIFACT_REPLAY_EVIDENCE');
   const evidence={...invocation,requestSha256:prior.record.argumentsSha256};
   const result=await service.recoverOfficeOriginal(request,context,{signal,evidence}),retained=prior.outcome?.result;
   if(retained&&(v.hash(retained.version)!==v.hash(result.version)||v.hash(retained.inspection)!==v.hash(result.inspection)||
    retained.execution?.invocationId!==invocationId||retained.execution?.requestSha256!==evidence.requestSha256))fail('ARTIFACT_REPLAY_EVIDENCE');
   check();return result;
  }
  check();const prior=await read();check();if(prior)return replay(prior);
  // Recovery cannot prove that a caller which lost its HTTP response never
  // entered the journal. Only a new, explicitly dispatched import may claim.
  if(recoveryOnly)fail('OFFICE_IMPORT_UNRESOLVED');
  let claim;try{claim=await journal.begin(key);}
  catch(error){if(!['UNKNOWN','CONFLICT','UNAVAILABLE'].includes(error.code))throw error;const prior=await read();if(prior)return replay(prior);throw error;}
  check();if(claim.replayed)return replay(await read());
  let result;
  try{result=await service.importOfficeOriginal(request,bytes,context,{signal,invocation});check();}
  catch(cause){try{await journal.settle({...key,state:'UNKNOWN',outcome:null});}catch{}throw cause;}
  try{await journal.settle({...key,state:'PREPARED',outcome:{result,release:{binding,scopes:context.scopes,expiresAtMs:context.deadlineMs}}});check();}
  catch(cause){throw Object.assign(Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,versionId:invocation.versionId,versionCommitted:true});}
  return result;
 }
 return Object.freeze({executeOfficeOriginal:(request,bytes,signal)=>execute(request,bytes,signal,false),
  recoverOfficeOriginal:(request,bytes,signal)=>execute(request,bytes,signal,true)});
}

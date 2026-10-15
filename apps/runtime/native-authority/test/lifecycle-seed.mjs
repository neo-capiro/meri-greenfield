/** Real-PostgreSQL seeding of continuation targets through the canonical lifecycle journal (pause, checkpoint, resume or fork control). Test-only. */
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const check=()=>{};
const status=state=>({eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}});
const event=(type,data)=>({contractVersion:'0.1.0',eventId:randomUUID(),createdAt:new Date().toISOString(),type,data});
export /** Drives a queued source run to running, then pauses and checkpoints it through the lifecycle journal. Returns the pause facts
 * (proof and checkpoint) that any number of later continuation controls over the same paused source can pin. */
async function pauseSource(store,source,saved,checkpoint){
 const scopes=saved.run.scopes,selectedClientId=scopes[0].resourceId,journal=store.lifecycle,sourceRequest=saved.request,contextSha256=hash({window:sourceRequest.window,skill:sourceRequest.skill,scopes});
 await store.append(source,status('starting'),check);await store.append(source,status('running'),check);
 const pauseId=randomUUID(),command={controlId:pauseId,action:'pause',binding:source,contextSha256};
 const begun=await journal.begin({binding:source,scopes,selectedClientId,input:{controlId:pauseId,intent:'pause'},command,approval:null},check);
 await journal.change({binding:source,scopes,selectedClientId,controlId:pauseId,from:'PENDING',to:'DISPATCHING'},check);
 checkpoint.lastEventSequence=begun.captureSequence;const checkpointSha256=hash(checkpoint),proof={checkpoint,checkpointSha256,sourceRequestSha256:hash(sourceRequest),contextSha256,resumeSessionAt:null,readReceiptId:randomUUID()};
 await journal.checkpoint({binding:source,scopes,selectedClientId,controlId:pauseId,proof,events:[event('checkpoint.verified',{checkpointId:checkpoint.checkpointId}),event('run.status',{state:'paused',reasonCode:'CONTROL_CHECKPOINTED'})]},check);
 return {pauseId,proof,checkpoint,checkpointSha256,scopes,selectedClientId,sourceRequest,contextSha256};
}
export /** Creates one continuation target from a paused source: a resume control (same conversation, next fence; retires the source and
 * closes its sequence range) or a fork control (new conversation, fence 1, fresh target session; the source stays paused). The target
 * run and its continuation are inserted by the journal under its own locks. A generic accept of a second same-conversation run is
 * refused by design (NEXT_RUN_NOT_RESERVED) and is not used here. */
async function continueFrom(store,source,saved,paused,{mode,target,expiresAtMs}){
 const {proof,checkpoint,checkpointSha256,scopes,selectedClientId,sourceRequest,contextSha256}=paused,journal=store.lifecycle;
 const controlId=randomUUID(),input={controlId,intent:mode,checkpointId:checkpoint.checkpointId,checkpointSha256};
 await journal.begin({binding:source,scopes,selectedClientId,input,command:null,approval:null},check);
 await journal.change({binding:source,scopes,selectedClientId,controlId,from:'PENDING',to:'DISPATCHING'},check);
 const targetSessionId=mode==='fork'?randomUUID():null,admission={binding:target,scopes,selectedClientId,admissionReceiptId:randomUUID(),targetSessionId,expiresAtMs},retirement=mode==='resume'?{binding:source,retirementReceiptId:randomUUID(),expiresAtMs}:null;
 const continuation={mode,controlId,checkpoint,checkpointSha256,sourceRequestSha256:hash(sourceRequest),contextSha256,resumeSessionAt:null,targetSessionId},request={...sourceRequest,requestId:randomUUID()},createdAt=new Date().toISOString();
 const run={...saved.run,binding:target,state:'queued',createdAt},conversation={conversationId:target.conversationId,owner:{tenantId:target.tenantId,actorId:target.actorId},scopes,createdAt,policyRevision:run.policyRevision};
 await journal.continuation({binding:source,scopes,selectedClientId,controlId,admission,retirement,proof,conversation,run,request,continuation,event:{...event('run.status',{state:'queued',reasonCode:null}),binding:target,scopes,sequence:1}},check);
 return {continuation,request,sourceRequest,controlId};
}
export /** Pause once and continue once: the single-target convenience over pauseSource and continueFrom. */
async function seedContinuation(store,source,saved,{mode,checkpoint,target,expiresAtMs}){
 const paused=await pauseSource(store,source,saved,checkpoint);return continueFrom(store,source,saved,paused,{mode,target,expiresAtMs});
}

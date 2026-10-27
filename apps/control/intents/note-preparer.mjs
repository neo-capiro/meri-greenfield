/** Prepare only over Core's existing note ledger; the intent journal owns delivery idempotency. A saved note is
 *  a static PASS, so this owner returns the recorded outcome instead of an approval: the destination owner
 *  (Core's canonical meeting/client/General writer) has already applied or refused the effect, and this side
 *  only ever reports what that owner recorded. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {savedNoteValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {intentFault} from './faults.mjs';
/** The closed caller request, as Core's own `noteRequestSchema` accepts it: the body is required and the five
 *  nullable fields are ordinary when absent, so a plain body note is the normal case. No conversation, model,
 *  source, memory or project field is ever accepted, and an unknown key is a definite refusal. */
function readArguments(input){
 try{return validators.request(input);}catch{throw intentFault('INVALID_ARGUMENTS','none');}
}
export function createNoteIntentPreparer({binding,scopes,selectedClientId,client,currentRights,policyRevision,now,deadlineMs}){
 return Object.freeze({binding,owner:'note',operation:Object.freeze({id:'save_note',version:'0.2.0'}),async prepare(raw){
  const {arguments:input,deliveryId,signal}=own(raw,['arguments','deliveryId'],['signal']);
  const request=readArguments(input);
  // A note that names a client is only ever written for the caller's own current client selection. A note that
  // names a meeting carries no client here: the canonical meeting owner resolves the meeting's client and asserts
  // ownership, the current visible roster and the selected client before anything is written.
  if(request.clientId!==undefined&&(selectedClientId===null||request.clientId!==selectedClientId))throw intentFault('ACCESS_DENIED','none');
  const check=async()=>{const rights=await currentRights({signal,policyRevision});if(hash(rights.scopes)!==hash(scopes)||rights.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');};
  await check();
  const core=await client.prepare({binding,selectedClientId,request,signal,deadlineMs});
  // Current authority again, before anything recorded is released.
  await check();
  const {status,policyOutcome,receipt,errorCode,errorMessage,request:view,proposalId,createdAt,expiresAt}=core;
  const recorded={operation:'save_note',binding,scopes,bodyHash:view.bodyHash,bodyLength:view.bodyLength,proposalId,policyOutcome,createdAt,expiresAt,recordedAt:new Date(now()).toISOString()};
  const code=typeof errorCode==='string'&&errorCode?errorCode:null,message=typeof errorMessage==='string'&&errorMessage?errorMessage:null;
  const none={destination:null,noteId:null,meetingNoteId:null,documentId:null,location:null,indexingStatus:null,readiness:null,reused:null,generatedAt:null};
  let envelope;
  if(status==='succeeded'){
   // A saved note is PASS. Any other policy outcome with an applied effect is not a receipt we may present.
   if(policyOutcome!=='PASS')throw intentFault('REFUSED','unknown');
   envelope={...recorded,status:'saved',...none,
    destination:receipt.destination,noteId:receipt.noteId,meetingNoteId:receipt.meetingNoteId??null,documentId:receipt.documentId??null,
    location:receipt.location??null,indexingStatus:receipt.indexingStatus??null,readiness:receipt.readiness??null,
    reused:typeof receipt.reused==='boolean'?receipt.reused:null,generatedAt:receipt.generatedAt??null};
  }else if(status==='blocked'){
   if(policyOutcome!=='BLOCK')throw intentFault('REFUSED','unknown');
   envelope={...recorded,status:'blocked',...none,errorCode:code??'note_blocked',...(message===null?{}:{errorMessage:message})};
  }else if(status==='proposed'&&policyOutcome==='WARN'){
   // A genuine policy WARN: the note was not applied, and this is never presented as an approval or a save.
   envelope={...recorded,status:'withheld',...none,errorCode:code??'note_withheld_policy',...(message===null?{}:{errorMessage:message})};
  }else if(status==='outcome_unknown'||status==='failed_retryable'||status==='executing'){
   // A meeting note is two writes, so an unanswered save may already have written: never resent, never called saved.
   envelope={...recorded,status:'unknown',...none,errorCode:code??(status==='outcome_unknown'?'note_unknown':status==='executing'?'note_in_progress':'note_failed'),...(message===null?{}:{errorMessage:message})};
  }else if(status==='failed_terminal'||status==='dismissed'||status==='expired'){
   envelope={...recorded,status:'failed',...none,errorCode:code??'note_not_saved',...(message===null?{}:{errorMessage:message})};
  }else{
   // A proposal that was opened instead of executed: an effect may still follow, so it is never called saved.
   envelope={...recorded,status:'unknown',...none,errorCode:code??'note_decision_pending',...(message===null?{}:{errorMessage:message})};
  }
  return data(envelope);
 }});
}

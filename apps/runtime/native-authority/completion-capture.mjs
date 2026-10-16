/** Completion owns a durable one-shot capture identity, never a lifecycle command. */
import {randomUUID} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertCaptureReceipt} from '../../worker/conversation/continuation/native-receipts.mjs';
import {remoteOriginal} from './remote-task-boundary.mjs';
import {checkpointIdentity,publishCapturedCheckpoint} from './checkpoint-publication.mjs';
import {verifyCheckpointReadback} from './checkpoint-readback.mjs';
import {assertTypedResult,typedCheckpointObject,issuedObjectiveSelection,objectiveCompletionId} from '../../../packages/runtime/objective-generation-custody.mjs';
const fault=()=>Error('NATIVE_COMPLETION_CAPTURE_UNKNOWN'),same=(a,b)=>hash(a)===hash(b);
export function createNativeCompletionCapture(configuration){
 const c=own(configuration,['store','objects','authority','taskCapability','original','taskCapture'],['enabled','now','maxRequestMs','preparedFacts']),original=remoteOriginal(c.original),now=c.now??Date.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000;
 const journal=Object.fromEntries(['begin','read','publish','unknown'].map(k=>[k,storageMethod(c.store.completions,k)])),readRun=storageMethod(c.store,'read'),capture=storageMethod(c.taskCapture,'capture'),verify=storageMethod(c.authority,'verify'),objects={get:storageMethod(c.objects,'get'),put:storageMethod(c.objects,'put')};
 if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||typeof c.taskCapability!=='string'||!/^\S{1,8192}$/u.test(c.taskCapability))throw fault();
 const readFacts=c.preparedFacts===undefined?null:storageMethod(c.preparedFacts,'read');
 const completionId=objectiveCompletionId(original.binding),checkpointId=checkpointIdentity({binding:original.binding,completionId,kind:'checkpoint'});
 async function captureCompletion(value){
  const v=own(value,['binding','request','versions','scopes','sessionId','contextSha256'],['signal','typedResult']),{signal,...rest}=v,input=data(rest);nativeSignal(signal);validateShape('RunBinding',input.binding);
  if(!enabled||!same(input.binding,original.binding)||!same(input.versions,original.versions)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(input.sessionId)||signal?.aborted||now()>=original.expiresAtMs)throw fault();
  const typed=input.typedResult===undefined?undefined:assertTypedResult(input.typedResult,{binding:original.binding,sourceRequestSha256:hash(input.request),sessionId:input.sessionId});
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(now()+maxRequestMs,original.expiresAtMs),errorFactory:fault});let pins,policyRevision,identity,proof,typedSelection,captureExpiresAtMs=original.expiresAtMs;
  async function selected(){
   if(!readFacts){if(typed)throw fault();return;}
   const entry=data(await life.run(signal=>readFacts({binding:original.binding,signal})));life.check();
   if(entry.objectiveGeneration===undefined&&entry.objectiveStrategy===undefined){if(typed)throw fault();return;}
   if(!typed||!same(entry.original,original))throw fault();const selection=issuedObjectiveSelection(entry,{binding:original.binding,acceptedRequest:input.request});
   const expiresAtMs=Math.min(original.expiresAtMs,entry.issuance.expiresAtMs,entry.objectiveGeneration.sourceAdmission.effectExpiresAtMs,selection.strategy.request.originalExpiresAtMs);captureExpiresAtMs=Math.min(captureExpiresAtMs,expiresAtMs);
   if(selection.sourceAdmissionSha256!==typed.sourceAdmissionSha256||selection.strategy.requestSha256!==typed.typedRequestSha256||!same(selection.strategy.executionSelection,{provider:typed.execution.provider,model:typed.execution.model})||typed.resultRef!==completionId||typed.execution.receiptRef!==completionId||typed.observation.completedAtMs>=expiresAtMs||typedSelection&&!same(typedSelection,selection))throw fault();life.limitDeadline(expiresAtMs);life.check();typedSelection??=selection;
  }
  async function fresh(){const started=now(),inputSha256=hash({binding:original.binding}),a=assertWorkerAuthorization(await life.run(signal=>verify({capability:c.taskCapability,binding:original.binding,operation:'load',inputSha256,signal})),{binding:original.binding,operation:'load',inputSha256,started,now});
   if(a.expiresAtMs<original.expiresAtMs||!same(a.scopes,input.scopes)||policyRevision!==undefined&&a.policyRevision!==policyRevision)throw fault();policyRevision??=a.policyRevision;life.limitDeadline(a.expiresAtMs);const next={binding:original.binding,scopes:a.scopes,selectedClientId:a.selectedClientId};if(pins&&!same(pins,next))throw fault();pins??=next;return a;}
  async function current(){await fresh();const saved=await life.run(()=>readRun(original.binding,{},life.check));if(!same(saved.run.binding,input.binding)||!same(saved.run.versions,input.versions)||!same(saved.run.scopes,input.scopes)||!same(saved.request,input.request)||hash({window:input.request.window,skill:input.request.skill,scopes:input.scopes})!==input.contextSha256)throw fault();
   const savedIdentity=await life.run(()=>journal.read(pins,life.check));if(!savedIdentity||savedIdentity.completionId!==completionId||savedIdentity.checkpointId!==checkpointId||savedIdentity.contextSha256!==input.contextSha256||!same(savedIdentity.sourceRequest,input.request)||!same(savedIdentity.typedResult??null,typed??null)||identity&&savedIdentity.captureSequence!==identity.captureSequence)throw fault();await selected();return savedIdentity;}
  async function result(p){if(p.state!=='PUBLISHED'||!p.proof||p.proof.checkpoint.sessionId!==input.sessionId||!same(p.typedResult??null,typed??null))throw fault();await selected();if(!same(p.typedSelection??null,typedSelection??null))throw fault();if(typed)typedCheckpointObject(p.proof,typed);await verifyCheckpointReadback({proof:p.proof,binding:original.binding,versions:original.versions,objects,life,revalidate:fresh});await fresh();const cp=p.proof.checkpoint,r={checkpoint:cp,checkpointSha256:p.proof.checkpointSha256,sourceRequestSha256:p.proof.sourceRequestSha256,contextSha256:p.proof.contextSha256,sessionId:cp.sessionId,resumeSessionAt:p.proof.resumeSessionAt,verificationId:randomUUID(),workspaceReadbackSha256:cp.workspaceSha256,opaqueSessionReadbackSha256:cp.opaqueSession.sha256,checkedAtMs:now(),expiresAtMs:captureExpiresAtMs};assertCaptureReceipt(r,{...input,started:r.checkedAtMs,now});return r;}
  try{
   await fresh();const saved=await life.run(()=>readRun(original.binding,{},life.check));if(!same(saved.request,input.request)||!same(saved.run.versions,input.versions)||!same(saved.run.scopes,input.scopes)||saved.run.policyRevision!==policyRevision)throw fault();
   await selected();identity=await life.run(()=>journal.begin({...pins,completionId,checkpointId,...(typed===undefined?{}:{typedResult:typed,typedSelection})},life.check));
   if(identity.state==='PUBLISHED')return await result(identity);
   if(identity.capture!==true||identity.contextSha256!==input.contextSha256)throw fault();
   await current();
   const inherited=await life.run(()=>c.store.lifecycle.execution(pins,life.check)),next=c.store.nextRuns?.execution?await life.run(()=>c.store.nextRuns.execution(pins,life.check)):null;
   if(inherited&&next)throw fault();const parent=next?.nextTurn?.checkpoint??inherited?.continuation?.checkpoint??null;
   const expectedSession=next?parent.sessionId:inherited?inherited.continuation.mode==='fork'?inherited.continuation.targetSessionId:parent.sessionId:null;
   if(expectedSession!==null&&input.sessionId!==expectedSession)throw fault();
   // controlId is the existing physical capture correlation field. No controls row exists.
   const captured=await life.run(signal=>capture({binding:original.binding,controlId:completionId,sessionId:input.sessionId,signal}));
   proof=await publishCapturedCheckpoint({captured,original,input:{...input,controlId:completionId},captureSequence:identity.captureSequence,checkpointId,parentCheckpointId:parent?.checkpointId??null,objects,life,fresh,revalidate:current,now});
   if(typed)typedCheckpointObject(proof,typed);
   const createdAt=new Date(now()).toISOString(),events=[{contractVersion:'0.1.0',eventId:identity.verifiedEventId,createdAt,type:'checkpoint.verified',data:{checkpointId}},{contractVersion:'0.1.0',eventId:identity.completedEventId,createdAt,type:'run.status',data:{state:'completed',reasonCode:null}}];
   const published=await life.run(()=>journal.publish({...pins,completionId,proof,events},life.check));return await result(published);
  }catch(error){
   // A lost publication ACK can be reconciled by immutable identity. Never recapture.
   if(pins&&!life.signal.aborted){try{const saved=await life.run(()=>journal.read(pins,life.check));if(saved?.state==='PUBLISHED'&&(!proof||same(saved.proof,proof)))return await result(saved);}catch{}}
   if(pins){const cleanup=createOperationLifetime({now,deadlineMs:now()+maxRequestMs,errorFactory:fault});try{await cleanup.run(()=>journal.unknown({...pins,completionId},cleanup.check));}catch{}finally{cleanup.close();}}
   throw error;
  }finally{life.close();}
 }
 return Object.freeze({captureCompletion});
}

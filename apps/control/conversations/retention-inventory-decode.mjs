/** Pure validation of one conversation owner's retained-row snapshot. The caller
 * supplies complete pages from one read-only repeatable-read transaction. This
 * decoder grants no retention or purge authority. */
import {assertRun,bounded,data,fail,hash,own,same,uuid,validateShape} from './boundary.mjs';
import {assertContinuationEnvelope,assertLifecycleCommand,assertLifecycleReceipt,assertWorkerControl} from '../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {assertProposalIntegrity,assertWorkspacePaths} from '../../../packages/contracts/validate.mjs';
import {assertTypedResult,assertTypedSelection,MAX_OBJECTIVE_SELECTION_BYTES} from '../../../packages/runtime/objective-generation-custody.mjs';
import {validateCompletionProof} from './completion-journal.mjs';
import {assertNextRunReservation} from './next-run-reservation.mjs';

const corrupt=()=>fail('STORE_CORRUPT');
const requireFact=value=>{if(!value)corrupt();};
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const number=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0)corrupt();return n;};
const rows=value=>{if(!Array.isArray(value)||value.length>4096)corrupt();return value;};
const inSubject=(row,subject)=>requireFact(row?.tenant_id===subject.tenantId&&row.conversation_id===subject.subjectId);
const sourceContext=run=>hash({window:run.row.request.window,skill:run.row.request.skill,scopes:run.projection.scopes});
const sameRow=(row,value,sha)=>requireFact(value!==null&&value!==undefined&&digest(row[sha])&&hash(value)===row[sha]);
const refKey=object=>`${object.objectId}@${object.versionId}`;

function decodeSubject(subject,conversation){
 const s=own(subject,['tenantId','kind','subjectId','ownerActorId']);
 if(typeof s.tenantId!=='string'||!s.tenantId||s.tenantId.length>256||
    typeof s.ownerActorId!=='string'||!s.ownerActorId||s.ownerActorId.length>256||
    s.kind!=='conversation')corrupt();
 uuid(s.subjectId);inSubject(conversation,s);sameRow(conversation,conversation.projection,'projection_sha256');
 const p=conversation.projection;validateShape('Conversation',p);
 requireFact(conversation.owner_actor_id===s.ownerActorId&&p.conversationId===s.subjectId&&
  p.owner.tenantId===s.tenantId&&p.owner.actorId===s.ownerActorId);
 return {subject:s,projection:p,conversation:{conversationId:s.subjectId,projectionSha256:conversation.projection_sha256}};
}

function decodeRun(row,owner){
 inSubject(row,owner.subject);sameRow(row,row.projection,'projection_sha256');sameRow(row,row.request,'request_sha256');
 const p=assertRun(row.projection),b=p.binding;
 requireFact(row.run_id===b.runId&&row.request_id===row.request.requestId&&
  b.tenantId===owner.subject.tenantId&&b.conversationId===owner.subject.subjectId&&
  b.actorId===owner.subject.ownerActorId&&same(p.scopes,owner.projection.scopes)&&
  p.policyRevision===owner.projection.policyRevision);
 uuid(row.request_id);bounded(row.request);
 const lastSequence=number(row.last_sequence),sequenceBase=number(row.sequence_base);
 requireFact(lastSequence>=1&&lastSequence+sequenceBase<=Number.MAX_SAFE_INTEGER);
 const sequenceEnd=row.sequence_end==null?null:number(row.sequence_end);
 if(sequenceEnd!==null)requireFact(sequenceEnd===sequenceBase+lastSequence);
 let continuation=null;
 if(row.continuation==null)requireFact(row.continuation_sha256==null);
 else{
  sameRow(row,row.continuation,'continuation_sha256');
  const saved=own(row.continuation,['continuation','sourceRequest']);
  continuation=assertContinuationEnvelope(saved.continuation);
  const source=continuation.checkpoint.binding;
  requireFact(source.tenantId===b.tenantId&&source.actorId===b.actorId&&source.runId!==b.runId&&
   same(continuation.checkpoint.scopes,p.scopes)&&same(continuation.checkpoint.versions,p.versions)&&
   hash(saved.sourceRequest)===continuation.sourceRequestSha256&&
   hash({window:saved.sourceRequest.window,skill:saved.sourceRequest.skill,scopes:p.scopes})===continuation.contextSha256&&
   same({...saved.sourceRequest,requestId:row.request.requestId},row.request));
  checkpointShape(continuation.checkpoint,{binding:source,scopes:p.scopes,versions:p.versions});
  if(continuation.mode==='resume')requireFact(source.conversationId===b.conversationId&&source.writerFence+1===b.writerFence);
  else requireFact(source.conversationId!==b.conversationId&&b.writerFence===1);
 }
 return {row,projection:p,continuation,public:{runId:b.runId,projectionSha256:row.projection_sha256,
  requestSha256:row.request_sha256,lastSequence,sequenceBase,sequenceEnd,continuation}};
}

function checkpointShape(cp,{binding,scopes,versions}){
 validateShape('Checkpoint',cp);assertWorkspacePaths(cp.workspace);
 requireFact(same(cp.binding,binding)&&same(cp.workspace.binding,binding)&&
  same(cp.scopes,scopes)&&same(cp.workspace.scopes,scopes)&&
  same(cp.opaqueSession.scopes,scopes)&&same(cp.versions,versions)&&
  hash(cp.workspace)===cp.workspaceSha256&&
  cp.workspace.entries.every(entry=>entry.object.scopes.every(scope=>scopes.some(parent=>same(parent,scope)))));
 return cp;
}

function checkpoint(proof,{binding,scopes,versions,sourceRequestSha256,contextSha256,maxSequence,exactSequence=false}){
 own(proof,['checkpoint','checkpointSha256','sourceRequestSha256','contextSha256','resumeSessionAt','readReceiptId']);
 uuid(proof.readReceiptId);if(proof.resumeSessionAt!==null)uuid(proof.resumeSessionAt);
 const cp=checkpointShape(proof.checkpoint,{binding,scopes,versions});
 requireFact(digest(proof.checkpointSha256)&&hash(cp)===proof.checkpointSha256&&
  proof.sourceRequestSha256===sourceRequestSha256&&
  proof.contextSha256===contextSha256&&
  (exactSequence?cp.lastEventSequence===maxSequence:cp.lastEventSequence<=maxSequence)&&
  cp.lastEventSequence>=0);
 return cp;
}

function decodeControl(row,owner,byRun){
 inSubject(row,owner.subject);sameRow(row,row.projection,'projection_sha256');
 const p=row.projection,b=p.sourceBinding,r=byRun.get(row.run_id),seq=number(row.control_sequence);
 requireFact(r&&seq>=1&&same(b,r.projection.binding)&&row.control_id===p.input?.controlId&&
  p.sourceSelectedClientId&&p.scopes?.some(s=>s.kind==='client'&&s.resourceId===p.sourceSelectedClientId)&&
  same(p.scopes,r.projection.scopes)&&same(p.versions,r.projection.versions)&&
  same(p.sourceRequest,r.row.request)&&p.sourceRequestSha256===r.row.request_sha256&&
  p.contextSha256===sourceContext(r)&&hash(p.input)===p.inputSha256&&
  Number.isSafeInteger(p.captureSequence)&&p.captureSequence>=1&&p.captureSequence<=r.public.lastSequence);
 uuid(p.sourceSelectedClientId);assertLifecycleCommand(p.input);
 requireFact(['PENDING','DISPATCHING','APPLIED','UNKNOWN'].includes(p.state));
 if(p.approval){assertProposalIntegrity(p.approval);requireFact(p.input.intent==='approval.wait'&&
  p.approval.proposalId===p.input.proposalId&&same(p.approval.command.binding,b)&&same(p.approval.command.scopes,p.scopes));}
 else requireFact(p.input.intent!=='approval.wait');
 if(p.command){assertWorkerControl(p.command);requireFact(hash(p.command)===p.commandSha256&&
  p.command.controlId===p.input.controlId&&same(p.command.binding,b)&&
  p.command.contextSha256===p.contextSha256&&
  p.command.action===(p.input.intent==='approval.wait'?'waitForApproval':p.input.intent)&&
  (p.input.intent!=='steer'||p.command.prompt===p.input.text));}
 else requireFact(p.commandSha256===null);
 if(p.proof){const cp=checkpoint(p.proof,{binding:b,scopes:p.scopes,versions:p.versions,
  sourceRequestSha256:p.sourceRequestSha256,contextSha256:p.contextSha256,maxSequence:p.captureSequence});
  requireFact(p.checkpointId===cp.checkpointId);}
 else requireFact(p.checkpointId===null);
 assertLifecycleReceipt({controlId:p.input.controlId,intent:p.input.intent,sourceBinding:b,inputSha256:p.inputSha256,
  state:p.state,checkpointId:p.checkpointId,targetBinding:p.target?.binding??null,
  admissionReceiptId:p.target?.admissionReceiptId??null,retirementReceiptId:p.retirement?.retirementReceiptId??null,replayed:false});
 if(p.target)requireFact(p.target.selectedClientId===p.sourceSelectedClientId&&
  same(p.target.scopes,p.scopes)&&p.target.binding.tenantId===b.tenantId&&p.target.binding.actorId===b.actorId);
 if(p.retirement)requireFact(same(p.retirement.binding,b));
 return {row,projection:p,public:{controlId:row.control_id,runId:row.run_id,
  controlSequence:seq,projectionSha256:row.projection_sha256}};
}

function decodeCompletion(row,owner,byRun){
 inSubject(row,owner.subject);sameRow(row,row.identity,'identity_sha256');
 const p=row.identity,r=byRun.get(row.run_id);
 requireFact(r&&same(p.binding,r.projection.binding)&&row.completion_id===p.completionId&&
  row.checkpoint_id===p.checkpointId&&p.selectedClientId&&
  p.scopes?.some(s=>s.kind==='client'&&s.resourceId===p.selectedClientId)&&
  same(p.scopes,r.projection.scopes)&&same(p.versions,r.projection.versions)&&
  same(p.sourceRequest,r.row.request)&&p.sourceRequestSha256===r.row.request_sha256&&
  p.contextSha256===sourceContext(r)&&Number.isSafeInteger(p.captureSequence)&&
  p.captureSequence>=1&&p.captureSequence<=r.public.lastSequence);
 for(const id of ['completionId','checkpointId','verifiedEventId','completedEventId','selectedClientId'])uuid(p[id]);
 requireFact(Object.hasOwn(p,'typedResult')===Object.hasOwn(p,'typedSelection'));
 if(Object.hasOwn(p,'typedResult')){
  const result=assertTypedResult(bounded(p.typedResult),{binding:p.binding,sourceRequestSha256:r.row.request_sha256});
  assertTypedSelection(bounded(p.typedSelection,MAX_OBJECTIVE_SELECTION_BYTES),result,{binding:p.binding,acceptedRequest:r.row.request});
 }
 requireFact(['CAPTURING','UNKNOWN','PUBLISHED'].includes(row.state));
 let cp=null;
 if(row.state==='PUBLISHED'){
  sameRow(row,row.proof,'proof_sha256');validateCompletionProof(row.proof,p);
  cp=row.proof.checkpoint;
 }else requireFact(row.proof==null&&row.proof_sha256==null);
 return {row,identity:p,public:{checkpointId:row.checkpoint_id,runId:row.run_id,state:row.state,checkpoint:cp}};
}

function decodeNextRun(row,owner,byRun,byCompletion){
 inSubject(row,owner.subject);sameRow(row,row.reservation,'reservation_sha256');
 const p=assertNextRunReservation(row.reservation),source=byRun.get(row.source_run_id),target=byRun.get(row.target_run_id);
 requireFact(source&&same(p.source,source.projection.binding)&&row.source_run_id===p.source.runId&&
  row.target_run_id===p.target.runId&&p.target.actorId===owner.subject.ownerActorId&&
  same(p.scopes,source.projection.scopes)&&
  p.policyRevision===source.projection.policyRevision&&['RESERVED','ACCEPTED'].includes(row.state));
 if(row.state==='ACCEPTED')requireFact(target&&same(p.target,target.projection.binding)&&
  same(p.scopes,target.projection.scopes)&&same(p.versions,target.projection.versions)&&
  p.policyRevision===target.projection.policyRevision&&
  source.public.sequenceEnd===target.public.sequenceBase);
 else requireFact(!target&&source.public.sequenceEnd===null);
 const continued=row.state==='ACCEPTED'&&target.continuation?.mode==='resume'&&
  same(target.continuation.checkpoint.binding,source.projection.binding)&&
  ['paused','waiting-for-approval'].includes(source.projection.state);
 requireFact(['completed','failed','cancelled'].includes(source.projection.state)||continued);
 if(source.projection.state==='completed')requireFact(p.facts.checkpoint!==null);
 if(continued)requireFact(p.facts.checkpoint===null);
 // The conversation's latest published checkpoint as of the source: a completed source's own, else the last completed turn's.
 if(p.facts.checkpoint!==null){const cp=byCompletion.get(p.facts.checkpoint.checkpointId),fence=run=>byRun.get(run)?.projection.binding.writerFence;
  requireFact(cp&&cp.row.state==='PUBLISHED'&&cp.row.proof_sha256===p.facts.checkpoint.proofSha256&&
   (source.projection.state==='completed'?cp.row.run_id===row.source_run_id:fence(cp.row.run_id)<p.source.writerFence)&&
   ![...byCompletion.values()].some(o=>o.row.state==='PUBLISHED'&&fence(o.row.run_id)>fence(cp.row.run_id)&&fence(o.row.run_id)<=p.source.writerFence));}
 return {row,reservation:p,public:{sourceRunId:row.source_run_id,targetRunId:row.target_run_id,
  state:row.state,reservationSha256:row.reservation_sha256}};
}

/** All arrays contain raw owner rows, not caller-selected payloads. Validated
 * memory continuation identities came from the same transaction's journal scan. */
export function decodeConversationInventoryRows({subject,conversation,runs,events,controls,checkpoints,completionCheckpoints,nextRuns,memoryContinuations,memoryContextRows}){
 try{
  const owner=decodeSubject(subject,conversation),byRun=new Map(),runRows=[];
  for(const row of rows(runs)){const item=decodeRun(row,owner);if(byRun.has(row.run_id))corrupt();byRun.set(row.run_id,item);runRows.push(item);}
  runRows.sort((a,b)=>a.projection.binding.writerFence-b.projection.binding.writerFence);
  requireFact(runRows.length>0);
  for(let i=0;i<runRows.length;i++){
   const run=runRows[i],prior=runRows[i-1];
   requireFact(run.projection.binding.writerFence===i+1&&
    (i===0?run.public.sequenceBase===0:
     prior.public.sequenceEnd===run.public.sequenceBase));
   if(run.continuation?.mode==='resume'){
    const source=byRun.get(run.continuation.checkpoint.binding.runId);
    requireFact(source&&same(source.projection.binding,run.continuation.checkpoint.binding)&&
     source.projection.binding.writerFence<run.projection.binding.writerFence);
   }
  }
  const eventRows=[],artifactVersionRefs=[],eventCounts=new Map(),eventByRunSequence=new Map();
  const orderedEvents=rows(events).slice().sort((a,b)=>
   String(a.run_id).localeCompare(String(b.run_id))||Number(a.sequence)-Number(b.sequence));
  for(const row of orderedEvents){
   inSubject(row,owner.subject);sameRow(row,row.event,'event_sha256');validateShape('UIEvent',row.event);
   const run=byRun.get(row.run_id),sequence=number(row.sequence);
   requireFact(run&&sequence>=1&&same(row.event.binding,run.projection.binding)&&
    same(row.event.scopes,run.projection.scopes)&&row.event.eventId===row.event_id&&
    row.event.sequence===sequence&&sequence===(eventCounts.get(row.run_id)??0)+1);
   eventCounts.set(row.run_id,sequence);
   eventByRunSequence.set(`${row.run_id}:${sequence}`,row.event);
   eventRows.push({runId:row.run_id,sequence,eventId:row.event_id,eventSha256:row.event_sha256});
   if(row.event.type==='artifact.available')artifactVersionRefs.push({runId:row.run_id,sequence,
    eventId:row.event_id,artifactId:row.event.data.artifactId,versionId:row.event.data.versionId});
  }
  for(const run of runRows)requireFact((eventCounts.get(run.row.run_id)??0)===run.public.lastSequence);
  const byControl=new Map(),controlRows=[],controlSequences=new Set();
  for(const row of rows(controls)){const item=decodeControl(row,owner,byRun);
   const key=`${row.run_id}:${item.public.controlSequence}`;
   if(byControl.has(row.control_id)||controlSequences.has(key))corrupt();
   controlSequences.add(key);byControl.set(row.control_id,item);controlRows.push(item);}
  for(const run of runRows){
   if(run.row.hold_control_id!=null)requireFact(byControl.get(run.row.hold_control_id)?.row.run_id===run.row.run_id);
  }
  const checkpointRows=[],byCheckpoint=new Map();
  for(const row of rows(checkpoints)){
   inSubject(row,owner.subject);sameRow(row,row.proof,'proof_sha256');
   const run=byRun.get(row.run_id),control=byControl.get(row.control_id),proof=row.proof;
   requireFact(run&&control&&control.row.run_id===row.run_id&&
    ['pause','approval.wait'].includes(control.projection.input.intent)&&
    control.projection.state==='APPLIED'&&same(control.projection.proof,proof)&&
    control.projection.checkpointId===row.checkpoint_id&&
    proof.checkpoint.checkpointId===row.checkpoint_id&&
    proof.checkpoint.lastEventSequence===control.projection.captureSequence);
   checkpoint(proof,{binding:run.projection.binding,scopes:run.projection.scopes,
    versions:run.projection.versions,sourceRequestSha256:run.row.request_sha256,
    contextSha256:sourceContext(run),maxSequence:control.projection.captureSequence,exactSequence:true});
   if(byCheckpoint.has(row.checkpoint_id))corrupt();byCheckpoint.set(row.checkpoint_id,row);
   checkpointRows.push({checkpointId:row.checkpoint_id,runId:row.run_id,
    controlId:row.control_id,checkpoint:proof.checkpoint});
  }
  for(const control of controlRows)if(['pause','approval.wait'].includes(control.projection.input.intent)&&control.projection.proof){
   requireFact(byCheckpoint.get(control.projection.checkpointId)?.control_id===control.row.control_id);
  }
  for(const control of controlRows){
   const p=control.projection;
   if(p.target?.binding.conversationId===owner.subject.subjectId){
    const target=byRun.get(p.target.binding.runId);
    requireFact(target&&same(target.projection.binding,p.target.binding));
   }
   if(['resume','fork'].includes(p.input.intent)&&p.proof){
    const source=byCheckpoint.get(p.checkpointId);
    requireFact(source&&source.run_id===control.row.run_id&&
     p.input.checkpointId===p.checkpointId&&
     p.input.checkpointSha256===p.proof.checkpointSha256&&
     same({...source.proof,readReceiptId:p.proof.readReceiptId},p.proof));
   }
  }
  for(const run of runRows)if(run.continuation?.mode==='resume'){
   const envelope=run.continuation,source=byRun.get(envelope.checkpoint.binding.runId),
    stored=byCheckpoint.get(envelope.checkpoint.checkpointId),control=byControl.get(envelope.controlId);
   requireFact(source&&stored&&control&&stored.run_id===source.row.run_id&&
    same(stored.proof.checkpoint,envelope.checkpoint)&&
    stored.proof.checkpointSha256===envelope.checkpointSha256&&
    same(run.row.continuation.sourceRequest,source.row.request)&&
    control.row.run_id===source.row.run_id&&control.projection.input.intent==='resume'&&
    same(control.projection.proof?.checkpoint,envelope.checkpoint)&&
    same(control.projection.target?.binding,run.projection.binding));
  }
  const byCompletion=new Map(),completionRows=[],completionRuns=new Set();
  for(const row of rows(completionCheckpoints)){const item=decodeCompletion(row,owner,byRun);
   if(byCompletion.has(row.checkpoint_id)||completionRuns.has(row.run_id))corrupt();
   completionRuns.add(row.run_id);byCompletion.set(row.checkpoint_id,item);
   completionRows.push(item);}
  for(const item of completionRows){
   const p=item.identity,runId=item.row.run_id;
   requireFact(byRun.get(runId)?.row.hold_completion_id===p.completionId);
   if(item.row.state==='PUBLISHED'){
    const verified=eventByRunSequence.get(`${runId}:${p.captureSequence+1}`),
     completed=eventByRunSequence.get(`${runId}:${p.captureSequence+2}`);
    requireFact(verified?.eventId===p.verifiedEventId&&verified?.type==='checkpoint.verified'&&
     same(verified.data,{checkpointId:p.checkpointId})&&
     completed?.eventId===p.completedEventId&&completed?.type==='run.status'&&
     same(completed.data,{state:'completed',reasonCode:null}));
   }
  }
  const nextRunRows=[];
  const sourceTargets=new Set(),targetSources=new Set();
  for(const row of rows(nextRuns)){
   if(sourceTargets.has(row.source_run_id)||targetSources.has(row.target_run_id))corrupt();
   sourceTargets.add(row.source_run_id);targetSources.add(row.target_run_id);
   nextRunRows.push(decodeNextRun(row,owner,byRun,byCompletion));
  }
  // Migration 0009 backfilled preexisting run ranges without manufacturing
  // next_runs rows. Validate every retained mapping, including resume aliases,
  // without fabricating a missing historical reservation.
  const continuationRows=[],continuationKeys=new Set();
  for(const value of rows(memoryContinuations)){
   const record=own(value,['runId','keySha256']),key=`${record.runId}:${record.keySha256}`;
   uuid(record.runId);requireFact(digest(record.keySha256)&&byRun.has(record.runId)&&!continuationKeys.has(key));
   continuationKeys.add(key);continuationRows.push(record);
  }
  const checkedContexts=new Set();
  for(const row of rows(memoryContextRows)){
   inSubject(row,owner.subject);sameRow(row,row.record,'record_sha256');
   const key=row.record.key,run=byRun.get(row.run_id),identity=`${row.run_id}:${row.key_sha256}`;
   requireFact(run&&continuationKeys.has(identity)&&!checkedContexts.has(identity)&&
    hash(key)===row.key_sha256&&same(key.binding,run.projection.binding)&&
    key.policyRevision===run.projection.policyRevision&&
    key.subject?.tenantId===owner.subject.tenantId&&
    key.subject?.actorId===owner.subject.ownerActorId&&
    key.subject?.policyRevision===run.projection.policyRevision&&
    same(key.subject?.scopes,run.projection.scopes)&&run.projection.scopes.length===1&&
    run.projection.scopes[0].kind==='client'&&
    key.subject?.entityIds?.length===1&&
    key.subject.entityIds[0]===run.projection.scopes[0].resourceId);
   checkedContexts.add(identity);
  }
  requireFact(checkedContexts.size===continuationKeys.size);
  const objects=new Map();
  const collect=cp=>{if(!cp)return;for(const object of [cp.opaqueSession,...cp.workspace.entries.map(e=>e.object)]){
   validateShape('ObjectReference',object);
   const key=refKey(object),held=objects.get(key);
   if(held&&held.sha256!==object.sha256)corrupt();
   objects.set(key,{objectId:object.objectId,versionId:object.versionId,sha256:object.sha256});
  }};
  for(const run of runRows)collect(run.continuation?.checkpoint);
  for(const row of checkpointRows)collect(row.checkpoint);
  for(const row of completionRows)collect(row.public.checkpoint);
  const objectVersions=[...objects.values()].sort((a,b)=>refKey(a).localeCompare(refKey(b)));
  const snapshot={subject:owner.subject,conversation:owner.conversation,runs:runRows.map(r=>r.public),
   eventRows,artifactVersionRefs,controls:controlRows.map(r=>r.public),checkpoints:checkpointRows,
   completionCheckpoints:completionRows.map(r=>r.public),nextRuns:nextRunRows.map(r=>r.public),
   memoryContinuations:continuationRows,objectVersions};
  return data({...snapshot,inventorySha256:hash(snapshot)});
 }catch(error){if(error?.code==='STORE_CORRUPT')throw error;corrupt();}
}

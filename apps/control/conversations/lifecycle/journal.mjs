/** Durable controls share the existing conversation transaction/run owner. */
import {bounded,hash,same,fail,validateShape,own,uuid} from '../boundary.mjs';
import {assertLifecycleCommand,assertWorkerControl,assertContinuationEnvelope,assertLifecycleReceipt,assertForkBootstrapReceipt} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {assertWorkspacePaths,assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {closeSequenceRange} from '../sequence-ranges.mjs';
import {recordContinuationReservation} from '../next-run-journal.mjs';
import {readTransitionAuthority,requireTransitionAuthority} from './authority.mjs';
import {createLifecycleReceiptReader} from './receipt-readback.mjs';
import {continuesSession} from '../../../../packages/contracts/session-continuity.mjs';
import {assertNativeSessionCapture,assertNativeConversationScope} from '../../../../packages/contracts/runtime-0.2/session.mjs';
import {nativeSessionForRun,assertNativeSessionCapturable,assertNativeSessionSettled,nativeSessionTranscripts} from '../sdk-session-lineage.mjs';
import {assertNativeFileState} from '../../../../packages/contracts/runtime-0.2/files.mjs';
import {readNativeCompletionCapture} from '../completion-journal.mjs';
/** The single worker failure a control hold admits (see failUncheckpointedHold); run.status reasonCode is free-form in the frozen UIEvent contract. */
export const HOLD_CHECKPOINT_FAILED='HOLD_CHECKPOINT_FAILED';
const selectRun=async(c,b)=>{const r=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows[0];return r;};
export function createLifecycleJournal({tx,rowRun,cancelAppend,transitionAuthority,assertConversationActive,modelAdmission,now=Date.now,onPublished}){
 const validateProof=(proof,p)=>{if(proof.kind==='native-session'){assertNativeSessionCapture(proof);if(!same(proof.sdkSession.binding,p.sourceBinding)||!same(proof.scopes,p.scopes)||!same(proof.versions,p.versions)||proof.sourceRequestSha256!==p.sourceRequestSha256||proof.contextSha256!==p.contextSha256||proof.lastEventSequence>p.captureSequence)fail('STORE_CORRUPT');return;}
  own(proof,['checkpoint','checkpointSha256','sourceRequestSha256','contextSha256','resumeSessionAt','readReceiptId']);uuid(proof.readReceiptId);if(proof.resumeSessionAt!==null)uuid(proof.resumeSessionAt);validateShape('Checkpoint',proof.checkpoint);assertWorkspacePaths(proof.checkpoint.workspace);const cp=proof.checkpoint;if(hash(cp)!==proof.checkpointSha256||!same(cp.binding,p.sourceBinding)||!same(cp.workspace.binding,p.sourceBinding)||!same(cp.scopes,p.scopes)||!same(cp.workspace.scopes,p.scopes)||!same(cp.opaqueSession.scopes,p.scopes)||!same(cp.versions,p.versions)||hash(cp.workspace)!==cp.workspaceSha256||proof.sourceRequestSha256!==p.sourceRequestSha256||proof.contextSha256!==p.contextSha256||cp.lastEventSequence>p.captureSequence||cp.workspace.entries.some(e=>e.object.scopes.some(s=>!p.scopes.some(parent=>same(parent,s)))))fail('STORE_CORRUPT');};
 const decode=row=>{if(!row||hash(row.projection)!==row.projection_sha256)fail('STORE_CORRUPT');const p=row.projection,b=p.sourceBinding,seq=Number(row.control_sequence);validateShape('RunBinding',b);assertNativeConversationScope({binding:b,scopes:p.scopes,selectedClientId:p.sourceSelectedClientId});assertLifecycleCommand(p.input);
  if(row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId||row.control_id!==p.input.controlId||!Number.isSafeInteger(seq)||seq<1||hash(p.sourceRequest)!==p.sourceRequestSha256||hash({window:p.sourceRequest.window,skill:p.sourceRequest.skill,scopes:p.scopes})!==p.contextSha256||hash(p.input)!==p.inputSha256||!['PENDING','DISPATCHING','APPLIED','UNKNOWN'].includes(p.state))fail('STORE_CORRUPT');
  if(p.approval){assertProposalIntegrity(p.approval);if(p.input.intent!=='approval.wait'||p.approval.proposalId!==p.input.proposalId||!same(p.approval.command.binding,b)||!same(p.approval.command.scopes,p.scopes))fail('STORE_CORRUPT');}else if(p.input.intent==='approval.wait')fail('STORE_CORRUPT');
  if(p.proof){validateProof(p.proof,p);if(p.checkpointId!==(p.proof.kind==='native-session'?p.proof.checkpointId:p.proof.checkpoint.checkpointId))fail('STORE_CORRUPT');}else if(p.checkpointId!==null)fail('STORE_CORRUPT');
  if(p.fileCapture!==undefined){own(p.fileCapture,['requestSha256','sessionId','files']);uuid(p.fileCapture.sessionId);if(!/^[a-f0-9]{64}$/u.test(p.fileCapture.requestSha256)||!['pause','approval.wait'].includes(p.input.intent))fail('STORE_CORRUPT');if(p.fileCapture.files!==null)assertNativeFileState(p.fileCapture.files,{binding:b,scopes:p.scopes});if(p.proof?.kind==='native-session'&&!same(p.proof.files,p.fileCapture.files))fail('STORE_CORRUPT');}
  if(p.command){assertWorkerControl(p.command);if(hash(p.command)!==p.commandSha256||p.command.controlId!==p.input.controlId||!same(p.command.binding,b)||p.command.contextSha256!==p.contextSha256||p.approval&&(p.command.proposalId!==p.approval.proposalId||p.command.proposalSha256!==hash(p.approval)))fail('STORE_CORRUPT');}else if(p.commandSha256!==null)fail('STORE_CORRUPT');assertLifecycleReceipt({controlId:p.input.controlId,intent:p.input.intent,sourceBinding:b,inputSha256:p.inputSha256,state:p.state,checkpointId:p.checkpointId,targetBinding:p.target?.binding??null,admissionReceiptId:p.target?.admissionReceiptId??null,retirementReceiptId:p.retirement?.retirementReceiptId??null,replayed:false});if(p.target&&(p.target.selectedClientId!==p.sourceSelectedClientId||!same(p.target.scopes,p.scopes)||p.target.binding.tenantId!==b.tenantId||p.target.binding.actorId!==b.actorId)||p.retirement&&!same(p.retirement.binding,b))fail('STORE_CORRUPT');return {...p,controlSequence:seq};};
 const lookup=async(c,b,id)=>{const rows=(await c.query('SELECT * FROM meri_conversations.controls WHERE tenant_id=$1 AND control_id=$2 FOR UPDATE',[b.tenantId,id])).rows;return rows.length?decode(rows[0]):null;};
 const save=async(c,b,p)=>{await c.query('UPDATE meri_conversations.controls SET projection=$3,projection_sha256=$4 WHERE tenant_id=$1 AND control_id=$2',[b.tenantId,p.input.controlId,p,hash(p)]);};
 const pins=(p,r,b,scopes,selectedClientId)=>{if(p.sourceSelectedClientId!==selectedClientId||!same(p.sourceBinding,b)||!same(p.scopes,scopes)||p.sourceRequestSha256!==r.request_sha256||!same(p.sourceRequest,r.request)||!same(p.versions,r.projection.versions)||!Number.isSafeInteger(p.captureSequence)||p.captureSequence<1||p.captureSequence>Number(r.last_sequence))fail('STORE_CORRUPT');if(p.command&&(p.command.action!==(p.input.intent==='approval.wait'?'waitForApproval':p.input.intent)||p.input.intent==='steer'&&p.command.prompt!==p.input.text))fail('STORE_CORRUPT');};
 async function verifyRun(c,b,scopes){const r=rowRun(await selectRun(c,b));if(!same(r.projection.binding,b))fail('STALE_WRITER');if(!same(r.projection.scopes,scopes))fail('SCOPE_REFUSED');return r;}
 async function begin({binding:b,scopes,selectedClientId,input,command,approval=null},check){return tx(b,check,async c=>{
  const r=await verifyRun(c,b,scopes),old=await lookup(c,b,input.controlId);check();
  if(old){pins(old,r,b,scopes,selectedClientId);if(!same(old.input,input))fail('LIFECYCLE_REPLAY_REFUSED');return {...old,replayed:true};}
  if(r.sequence_end!=null)fail('RUN_RANGE_CLOSED');if(r.hold_completion_id)fail('RUN_HELD');
  if(['resume','fork'].includes(input.intent)){if(input.intent==='resume'&&!['paused','waiting-for-approval'].includes(r.projection.state))fail('LIFECYCLE_STATE_REFUSED');}
  else if(r.projection.state!=='running'||r.hold_control_id)fail('LIFECYCLE_STATE_REFUSED');
  const p={input,inputSha256:hash(input),sourceBinding:b,scopes,sourceSelectedClientId:selectedClientId,sourceRequest:r.request,sourceRequestSha256:r.request_sha256,contextSha256:hash({window:r.request.window,skill:r.request.skill,scopes}),versions:r.projection.versions,captureSequence:Number(r.last_sequence),command,commandSha256:command?hash(command):null,approval,state:'PENDING',checkpointId:null,proof:null,target:null,retirement:null,replayed:false};
  const rows=(await c.query('INSERT INTO meri_conversations.controls(tenant_id,control_id,conversation_id,run_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[b.tenantId,input.controlId,b.conversationId,b.runId,p,hash(p)])).rows;check();
  if(['pause','approval.wait'].includes(input.intent))await c.query('UPDATE meri_conversations.runs SET hold_control_id=$4 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[b.tenantId,b.conversationId,b.runId,input.controlId]);return {...decode(rows[0]),replayed:false};
 });}
 async function change({binding:b,scopes,selectedClientId,controlId,from,to,patch={}},check){return tx(b,check,async c=>{const r=await verifyRun(c,b,scopes);const p=await lookup(c,b,controlId);check();if(!p)fail('LIFECYCLE_REFUSED');pins(p,r,b,scopes,selectedClientId);if(p.state!==from)return p;const next={...p,...patch,state:to};delete next.controlSequence;await save(c,b,next);return {...next,controlSequence:p.controlSequence};});}
 async function controls({binding:b,scopes,selectedClientId,after=0},check){if(!Number.isSafeInteger(after)||after<0)fail('INVALID_CURSOR');return tx(b,check,async c=>{const r=await verifyRun(c,b,scopes);const rows=(await c.query('SELECT * FROM meri_conversations.controls WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND control_sequence>$4 ORDER BY control_sequence LIMIT 100',[b.tenantId,b.conversationId,b.runId,after])).rows;check();return rows.map(row=>{const p=decode(row);pins(p,r,b,scopes,selectedClientId);return p;});});}
 async function get({binding:b,scopes,selectedClientId,controlId},check){return tx(b,check,async c=>{const r=await verifyRun(c,b,scopes),p=await lookup(c,b,controlId);check();if(!p)fail('LIFECYCLE_REFUSED');pins(p,r,b,scopes,selectedClientId);return p;});}
 async function claim({binding:b,scopes,selectedClientId,controlId,commandSha256},check){return tx(b,check,async c=>{const r=await verifyRun(c,b,scopes);const p=await lookup(c,b,controlId);check();if(!p||p.commandSha256!==commandSha256||!p.command)fail('LIFECYCLE_ACK_REFUSED');pins(p,r,b,scopes,selectedClientId);if(r.sequence_end!=null||r.projection.state!=='running'||r.hold_control_id&&r.hold_control_id!==controlId)fail('LIFECYCLE_STATE_REFUSED');if(p.state!=='PENDING')return {claimed:false,projection:p};const next={...p,state:'DISPATCHING'};delete next.controlSequence;await save(c,b,next);return {claimed:true,projection:{...next,controlSequence:p.controlSequence}};});}
 /** Record the one file-upload attempt before any object write. An uncertain attempt never grants another upload. */
 async function beginFileCapture({binding:b,scopes,selectedClientId,controlId,sessionId,requestSha256},check){uuid(sessionId);if(!/^[a-f0-9]{64}$/u.test(requestSha256))fail('CHECKPOINT_REFUSED');return tx(b,check,async c=>{
  const r=await verifyRun(c,b,scopes),p=await lookup(c,b,controlId);check();if(!p||!['pause','approval.wait'].includes(p.input.intent)||r.hold_control_id!==controlId)fail('CHECKPOINT_REFUSED');pins(p,r,b,scopes,selectedClientId);
  if(p.fileCapture){if(p.fileCapture.sessionId!==sessionId||p.fileCapture.requestSha256!==requestSha256)fail('CHECKPOINT_REFUSED');return {...p.fileCapture,capture:false};}
  if(r.sequence_end!=null||r.projection.state!=='running'||p.state!=='DISPATCHING')fail('CHECKPOINT_REFUSED');const lineage=await nativeSessionForRun(c,r,check);if(!lineage||lineage.reference.key.sessionId!==sessionId)fail('CHECKPOINT_REFUSED');await assertNativeSessionCapturable(c,lineage,check,now);
  const fileCapture={requestSha256,sessionId,files:null},next={...p,fileCapture};delete next.controlSequence;await save(c,b,next);check();return {...fileCapture,capture:true};
 });}
 async function recordFiles({binding:b,scopes,selectedClientId,controlId,sessionId,requestSha256,files},check){files=assertNativeFileState(files,{binding:b,scopes});return tx(b,check,async c=>{
  const r=await verifyRun(c,b,scopes),p=await lookup(c,b,controlId);check();if(!p||!p.fileCapture||p.fileCapture.requestSha256!==requestSha256||p.fileCapture.sessionId!==sessionId||r.hold_control_id!==controlId)fail('CHECKPOINT_REFUSED');pins(p,r,b,scopes,selectedClientId);
  if(p.fileCapture.files){if(!same(p.fileCapture.files,files))fail('CHECKPOINT_REFUSED');return p.fileCapture;}
  if(r.sequence_end!=null||r.projection.state!=='running'||p.state!=='DISPATCHING')fail('CHECKPOINT_REFUSED');const lineage=await nativeSessionForRun(c,r,check);if(!lineage||lineage.reference.key.sessionId!==sessionId)fail('CHECKPOINT_REFUSED');await assertNativeSessionCapturable(c,lineage,check,now);
  const next={...p,fileCapture:{...p.fileCapture,files}};delete next.controlSequence;await save(c,b,next);check();return next.fileCapture;
 });}
 /** Capture only the canonical SessionStore row. The worker supplies its observed
  * SDK session ID after close/drain/flush, never a reference or transcript. */
 async function captureSession({binding:b,scopes,selectedClientId,controlId,sessionId,events},check){uuid(sessionId);return tx(b,check,async c=>{
  const r=await verifyRun(c,b,scopes),p=await lookup(c,b,controlId);check();
  if(!p||!['pause','approval.wait'].includes(p.input.intent)||r.hold_control_id!==controlId)fail('LIFECYCLE_STATE_REFUSED');pins(p,r,b,scopes,selectedClientId);
  const lineage=await nativeSessionForRun(c,r,check);if(!lineage||lineage.reference.key.sessionId!==sessionId||lineage.row.owner.selectedClientId!==selectedClientId)fail('CHECKPOINT_REFUSED');
  if(!p.fileCapture?.files||p.fileCapture.sessionId!==sessionId)fail('CHECKPOINT_FILES_REQUIRED');
  const files=assertNativeFileState(p.fileCapture.files,{binding:b,scopes}),proof=assertNativeSessionCapture({kind:'native-session',sdkSession:lineage.reference,files,checkpointId:b.runId,checkpointSha256:hash({sdkSession:lineage.reference,files}),versions:p.versions,scopes,sourceRequestSha256:p.sourceRequestSha256,contextSha256:p.contextSha256,lastEventSequence:p.captureSequence});
  if(p.proof){if(!same(p.proof,proof)||p.state!=='APPLIED'||r.projection.state!==(p.input.intent==='pause'?'paused':'waiting-for-approval'))fail('CHECKPOINT_REFUSED');return p;}
  if(r.sequence_end!=null||r.projection.state!=='running'||!['DISPATCHING','UNKNOWN'].includes(p.state))fail('CHECKPOINT_REFUSED');
  await assertNativeSessionCapturable(c,lineage,check,now);
  // Validate complete opaque-stream counts/hashes before committing the public capture.
  await nativeSessionTranscripts(c,lineage,check);
  if(!Array.isArray(events)||events.length!==2||events[0].type!=='checkpoint.verified'||events[1].type!=='run.status')fail('CHECKPOINT_REFUSED');
  let sequence=Number(r.last_sequence);const state=p.input.intent==='pause'?'paused':'waiting-for-approval';
  for(const raw of events){const e={...raw,binding:b,scopes,sequence:++sequence,data:raw.type==='checkpoint.verified'?{checkpointId:b.runId}:{state,reasonCode:'CONTROL_CHECKPOINTED'}};validateShape('UIEvent',e);
   await c.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[b.tenantId,b.conversationId,b.runId,e.sequence,e.eventId,e,hash(e)]);check();}
  const projection={...r.projection,state};await c.query('UPDATE meri_conversations.runs SET projection=$4,projection_sha256=$5,last_sequence=$6 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[b.tenantId,b.conversationId,b.runId,projection,hash(projection),sequence]);
  const next={...p,state:'APPLIED',proof,checkpointId:b.runId};delete next.controlSequence;await save(c,b,next);check();return {...next,controlSequence:p.controlSequence};
 });}
 /** Read-only native inspection. Settlement, exact current transcript reference
  * and the durable hold are all required before this can authorize a successor. */
 async function nativeCheckpointOwner(c,b,r,scopes,selectedClientId,check){
  if(!['paused','waiting-for-approval','completed'].includes(r.projection.state))fail('CHECKPOINT_REFUSED');
  const lineage=await nativeSessionForRun(c,r,check);if(!lineage||lineage.row.owner.selectedClientId!==selectedClientId)fail('CHECKPOINT_REFUSED');
  await assertNativeSessionSettled(c,lineage,check);let proof,control=null;
  if(r.projection.state==='completed')proof=await readNativeCompletionCapture(c,lineage,check)??assertNativeSessionCapture({kind:'native-session',sdkSession:lineage.reference,checkpointId:b.runId,checkpointSha256:hash(lineage.reference),versions:r.projection.versions,scopes,sourceRequestSha256:r.request_sha256,contextSha256:hash({window:r.request.window,skill:r.request.skill,scopes}),lastEventSequence:Number(r.last_sequence)});
  else {if(!r.hold_control_id)fail('CHECKPOINT_REFUSED');control=await lookup(c,b,r.hold_control_id);check();
   if(!control||control.state!=='APPLIED'||control.proof?.kind!=='native-session'||control.input.intent!==(r.projection.state==='paused'?'pause':'approval.wait'))fail('CHECKPOINT_REFUSED');
   pins(control,r,b,scopes,selectedClientId);proof=assertNativeSessionCapture(control.proof);if(!same(proof.sdkSession,lineage.reference))fail('CHECKPOINT_REFUSED');}
  return {proof,control,lineage};
 }
 async function readSessionCapture({binding:b,scopes,selectedClientId,checkpointId},check){if(checkpointId!==b.runId)fail('CHECKPOINT_REFUSED');return tx(b,check,async c=>{
  const r=await verifyRun(c,b,scopes),{proof,control}=await nativeCheckpointOwner(c,b,r,scopes,selectedClientId,check);return {proof,approval:control?.approval??null};
 });}
 /** A public file is an actual committed workspace entry. Task JSON is private,
  * and a stored upload alone is never a publication or a settled SDK capture. */
 async function readArtifactFile(value,check){const {binding:b,scopes,selectedClientId,versionId}=own(value,['binding','scopes','selectedClientId','versionId']);
  assertNativeConversationScope({binding:b,scopes,selectedClientId});uuid(versionId);
  const entryFrom=proof=>{if(!proof.files)return null;const files=assertNativeFileState(proof.files,{binding:proof.sdkSession.binding,scopes});
   const matches=files.workspace.entries.filter(e=>e.object.objectId===versionId);if(matches.length>1)fail('STORE_CORRUPT');if(!matches.length)return null;
   const w=files.workspace;return {kind:'native-file',binding:w.binding,scopes:w.scopes,manifestId:w.manifestId,createdAt:w.createdAt,entry:matches[0]};};
  const found=await tx(b,check,async c=>{await verifyRun(c,b,scopes);check();
   const rows=(await c.query(`SELECT run_id FROM meri_conversations.completion_checkpoints
    WHERE tenant_id=$1 AND conversation_id=$2 AND state='PUBLISHED' AND proof->>'kind'='native-session'
     AND proof#>'{files,workspace,entries}' @> $3::jsonb
    UNION SELECT run_id FROM meri_conversations.controls
    WHERE tenant_id=$1 AND conversation_id=$2 AND projection->>'state'='APPLIED' AND projection#>>'{proof,kind}'='native-session'
     AND projection#>'{proof,files,workspace,entries}' @> $3::jsonb LIMIT 2`,[b.tenantId,b.conversationId,JSON.stringify([{object:{objectId:versionId}}])])).rows;check();
   if(rows.length>1)fail('STORE_CORRUPT');if(!rows.length)return null;uuid(rows[0].run_id);
   const source=rowRun(await selectRun(c,{...b,runId:rows[0].run_id})),sourceBinding=source.projection.binding;
   if(sourceBinding.tenantId!==b.tenantId||sourceBinding.actorId!==b.actorId||sourceBinding.conversationId!==b.conversationId||sourceBinding.writerFence>b.writerFence||!same(source.projection.scopes,scopes))fail('SCOPE_REFUSED');
   const {proof}=await nativeCheckpointOwner(c,sourceBinding,source,scopes,selectedClientId,check),result=entryFrom(proof);if(!result)fail('STORE_CORRUPT');return result;
  });
  if(found)return found;
  // A fork can expose only the exact files in its committed native continuation,
  // before the target's first capture. The canonical mapping owns both locks.
  return withSource({binding:b,scopes,selectedClientId},check,async(c,saved,source)=>{
   const target=await verifyRun(c,b,scopes),envelope=saved.continuation;
   if(envelope.kind!=='native-session'||!['queued','starting','running','completed','failed'].includes(target.projection.state))fail('CHECKPOINT_REFUSED');
   const p=await lookup(c,source,envelope.controlId);if(!p||!['DISPATCHING','APPLIED'].includes(p.state))fail('CHECKPOINT_REFUSED');
   const r=await verifyRun(c,source,scopes),{proof}=await nativeCheckpointOwner(c,source,r,scopes,selectedClientId,check);
   if(source.tenantId!==b.tenantId||source.actorId!==b.actorId||!same(proof.sdkSession,envelope.sdkSession)||!same(proof.files??null,envelope.files??null))fail('CHECKPOINT_REFUSED');
   check();return entryFrom(proof);
  });
 }
 /** Reused inside the store's locked publication transaction; never starts a nested transaction.
  * A worker that cannot checkpoint the hold it was fenced by records an explicit failure instead of
  * leaving the run running-and-held: only an unapplied pause/approval.wait hold on this exact running
  * run qualifies, and its control becomes the UNKNOWN barrier (never re-dispatched or re-claimed). */
 async function failUncheckpointedHold(c,b,r,check){const p=await lookup(c,b,r.hold_control_id);check();
  if(!p||!same(p.sourceBinding,b)||!['pause','approval.wait'].includes(p.input.intent)||!['PENDING','DISPATCHING','UNKNOWN'].includes(p.state)||p.proof||p.checkpointId!==null||r.projection.state!=='running')fail('RUN_HELD');
  if(p.state!=='UNKNOWN'){const next={...p,state:'UNKNOWN'};delete next.controlSequence;await save(c,b,next);}}
 const continuationSource=envelope=>envelope.kind==='native-session'?envelope.sdkSession.binding:envelope.checkpoint.binding;
 const savedContinuation=r=>{if(hash(r.continuation)!==r.continuation_sha256)fail('STORE_CORRUPT');const saved=own(r.continuation,['continuation','sourceRequest']);return {saved,envelope:assertContinuationEnvelope(saved.continuation)};};
 /** The single canonical source-custody and source->target predicate: the decoded source proof must equal the stored envelope
  * exactly (sdkSession/files/versions/scopes, or the historical checkpoint), the source request/context identities must be exact,
  * the target binding/targetSessionId/versions must be the admitted ones, and only the source->target relationship uses
  * continuesSession. Shared by the locked execution read and history's read-only join so neither re-implements it. */
 const verifyContinuation=(p,b,r,envelope,saved)=>{
  if(!p||!p.target||!same(p.target.binding,b)||p.input.intent!==envelope.mode||!same(p.sourceRequest,saved.sourceRequest)||!same({...p.sourceRequest,requestId:r.request.requestId},r.request)||
   !(envelope.kind==='native-session'?p.proof?.kind==='native-session'&&same(p.proof.sdkSession,envelope.sdkSession)&&same(p.proof.files??null,envelope.files??null)&&same(p.proof.versions,envelope.versions)&&same(p.proof.scopes,envelope.scopes):same(p.proof?.checkpoint,envelope.checkpoint))||
   p.sourceRequestSha256!==envelope.sourceRequestSha256||p.contextSha256!==envelope.contextSha256||envelope.kind!=='native-session'&&p.proof?.resumeSessionAt!==envelope.resumeSessionAt||
   p.target.targetSessionId!==envelope.targetSessionId||!same(p.target.versions??p.versions,r.projection.versions)||!continuesSession(p.versions,r.projection.versions)||!same(p.scopes,r.projection.scopes))fail('STORE_CORRUPT');
  return p;};
 async function readExecution(c,b,scopes,selectedClientId,check){const r=await verifyRun(c,b,scopes);check();if(!r.continuation)return null;const {saved,envelope}=savedContinuation(r),p=await lookup(c,continuationSource(envelope),envelope.controlId);check();
  if(!p||p.sourceSelectedClientId!==selectedClientId||p.target?.selectedClientId!==selectedClientId)fail('STORE_CORRUPT');verifyContinuation(p,b,r,envelope,saved);return r.continuation;}
 /** Read-only canonical continuation custody for a run row the caller's own transaction already holds: the same decoder and
  * predicate as readExecution, but the source control is read without FOR UPDATE and neither a transaction nor a source-run read
  * is started, so a reader holding only the target conversation's lock can never invert cross-conversation lock order. Returns the
  * verified envelope, or null for a row with no stored continuation. */
 async function readContinuation(c,r,check){if(r.continuation===null||r.continuation===undefined)return null;let saved,envelope;const b=r.projection.binding;
  try{({saved,envelope}=savedContinuation(r));}catch{fail('STORE_CORRUPT');}
  // Only synchronous stored-data validation is corruption; query failures and caller cancellation retain their own semantics.
  const rows=(await c.query('SELECT * FROM meri_conversations.controls WHERE tenant_id=$1 AND control_id=$2',[continuationSource(envelope).tenantId,envelope.controlId])).rows;check();
  try{if(rows.length>1)fail('STORE_CORRUPT');verifyContinuation(rows.length?decode(rows[0]):null,b,r,envelope,saved);return envelope;}catch{fail('STORE_CORRUPT');}}
 async function withSource(value,check,body,{transcripts=false}={}){
  const {binding:b,scopes,selectedClientId}=value;
  const discovered=await tx(b,check,async c=>{const r=await verifyRun(c,b,scopes);if(!r.continuation)return null;
   if(hash(r.continuation)!==r.continuation_sha256)fail('STORE_CORRUPT');const envelope=assertContinuationEnvelope(r.continuation.continuation);
   return envelope.kind==='native-session'?envelope.sdkSession.binding:envelope.checkpoint.binding;});
  if(discovered===null)return null;
  const ordered=[b,discovered].sort((a,z)=>`${a.tenantId}:${a.conversationId}`<`${z.tenantId}:${z.conversationId}`?-1:`${a.tenantId}:${a.conversationId}`>`${z.tenantId}:${z.conversationId}`?1:0);
  return tx(ordered[0],check,async c=>{
   if(ordered[0].conversationId!==ordered[1].conversationId){await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${ordered[1].tenantId}:${ordered[1].conversationId}`]);check();}
   const saved=await readExecution(c,b,scopes,selectedClientId,check),envelope=saved?.continuation;
   if(!envelope||!same(envelope.kind==='native-session'?envelope.sdkSession.binding:envelope.checkpoint.binding,discovered))fail('STORE_CORRUPT');
   return body(c,saved,discovered);
  },{sessionSnapshot:transcripts});
 }
 const execution=(value,check)=>withSource(value,check,(_c,saved)=>saved);
 /** Only the stored transition may nominate a source session for a successor.
  * Discovery and external Core calls confer no authority to create this mapping. */
 async function continuationOrigin(value,check){
  own(value,['binding','scopes','selectedClientId']);assertNativeConversationScope(value);
  const {binding:b,scopes,selectedClientId}=value;
  return withSource(value,check,async(c,saved,source)=>{
   const envelope=saved.continuation;if(envelope.kind!=='native-session')fail('LIFECYCLE_TRANSITION_REFUSED');
   const target=await verifyRun(c,b,scopes),r=await verifyRun(c,source,scopes),p=await lookup(c,source,envelope.controlId);check();
   if(!p||!['DISPATCHING','APPLIED'].includes(p.state)||!['queued','starting','running','completed','failed'].includes(target.projection.state)||target.sequence_end!=null||p.target.expiresAtMs<=now())fail('LIFECYCLE_TRANSITION_REFUSED');
   pins(p,r,source,scopes,selectedClientId);
   if(!same(p.target.binding,b)||!same(p.proof.sdkSession,envelope.sdkSession)||b.tenantId!==source.tenantId||b.actorId!==source.actorId||b.runId===source.runId||b.attemptId===source.attemptId||b.workerId===source.workerId)fail('LIFECYCLE_TRANSITION_REFUSED');
   const lineage=await nativeSessionForRun(c,r,check);if(!lineage||!same(lineage.reference,envelope.sdkSession))fail('LIFECYCLE_TRANSITION_REFUSED');await assertNativeSessionSettled(c,lineage,check);
   let bootstrap=null;
   if(envelope.mode==='resume'){
    const end=Number(r.sequence_base)+Number(r.last_sequence);
    if(b.conversationId!==source.conversationId||b.writerFence!==source.writerFence+1||p.target.targetSessionId!==null||p.target.bootstrap!==undefined||!p.retirement||!same(p.retirement.binding,source)||!['paused','waiting-for-approval'].includes(r.projection.state)||r.sequence_end==null||Number(r.sequence_end)!==end||Number(target.sequence_base)!==end)fail('LIFECYCLE_TRANSITION_REFUSED');
   }else {
    if(b.conversationId===source.conversationId||b.writerFence!==1||Number(target.sequence_base)!==0||p.retirement!==null)fail('LIFECYCLE_TRANSITION_REFUSED');
    bootstrap=assertForkBootstrapReceipt(p.target.bootstrap,{controlId:envelope.controlId,sourceBinding:source,targetBinding:b,selectedClientId});
   }
   check();return {controlId:envelope.controlId,mode:envelope.mode,sourceBinding:source,bootstrap};
  });
 }
 async function sessionSnapshot(value,check,{files=false}={}){const {binding:b,scopes,selectedClientId}=value;return withSource(value,check,async(c,saved,source)=>{
  const target=await verifyRun(c,b,scopes);if(!['queued','starting','running','completed','failed'].includes(target.projection.state))fail('STALE_WRITER');
  const envelope=saved.continuation;if(envelope.kind!=='native-session')fail('CHECKPOINT_REFUSED');
  const r=await verifyRun(c,source,scopes);if(!continuesSession(r.projection.versions,target.projection.versions))fail('CHECKPOINT_REFUSED');
  const {proof,lineage}=await nativeCheckpointOwner(c,source,r,scopes,selectedClientId,check);
  if(!same(proof.sdkSession,envelope.sdkSession)||!same(proof.files??null,envelope.files??null)||proof.sourceRequestSha256!==envelope.sourceRequestSha256||proof.contextSha256!==envelope.contextSha256)fail('CHECKPOINT_REFUSED');
  return files?{binding:b,sdkSession:lineage.reference,files:proof.files??null}:{binding:b,key:lineage.reference.key,sdkSession:lineage.reference,transcripts:await nativeSessionTranscripts(c,lineage,check)};
 },{transcripts:true});}
 const readReceipt=createLifecycleReceiptReader({tx,verifyRun,lookup,pins,readExecution});
 async function continuation({binding:b,scopes,selectedClientId,controlId,admission,retirement,proof,conversation,run,request,continuation,event,signal,deadlineMs=now()+3000},check){
  // The native admission receipt nominates a target; it does not replace current product authority. Verify the still-current source
  // before closing its range or persisting a target. Missing/denied owners cannot leave an undispatched successor behind.
  const current=await readTransitionAuthority({owner:transitionAuthority,expected:{binding:b,scopes,selectedClientId,policyRevision:run.policyRevision},signal,deadlineMs,now,check});
  const guarded=()=>{check();if(signal?.aborted||now()>=Math.min(deadlineMs,current.expiresAtMs))fail('LIFECYCLE_TRANSITION_REFUSED');};
  const locks=[b,admission.binding].sort((a,z)=>`${a.tenantId}:${a.conversationId}`<`${z.tenantId}:${z.conversationId}`?-1:`${a.tenantId}:${a.conversationId}`>`${z.tenantId}:${z.conversationId}`?1:0);
  return tx(locks[0],guarded,async c=>{if(locks[0].conversationId!==locks[1].conversationId){await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${locks[1].tenantId}:${locks[1].conversationId}`]);guarded();}const r=await verifyRun(c,b,scopes);const p=await lookup(c,b,controlId);guarded();if(!p)fail('LIFECYCLE_REFUSED');pins(p,r,b,scopes,selectedClientId);validateProof(proof,p);assertContinuationEnvelope(continuation);assertLifecycleReceipt({controlId:p.input.controlId,intent:p.input.intent,sourceBinding:b,inputSha256:p.inputSha256,state:'APPLIED',checkpointId:proof.checkpointId,targetBinding:admission.binding,admissionReceiptId:admission.admissionReceiptId,retirementReceiptId:retirement?.retirementReceiptId??null,replayed:false});if(!same({...p.sourceRequest,requestId:request.requestId},request)||!same(run.binding,admission.binding)||!same(run.scopes,p.scopes)||!same(run.versions,admission.versions??p.versions)||!continuesSession(p.versions,run.versions)||continuation.kind!=='native-session'||!same(continuation.sdkSession,proof.sdkSession)||!same(continuation.files??null,proof.files??null)||!same(continuation.versions,proof.versions)||!same(continuation.scopes,proof.scopes)||continuation.sourceRequestSha256!==p.sourceRequestSha256||continuation.contextSha256!==p.contextSha256||continuation.controlId!==controlId||continuation.mode!==p.input.intent)fail('STORE_CORRUPT');if(p.target){if(!same(p.target,admission)||!same(p.retirement,retirement)||!same(p.proof,proof))fail('LIFECYCLE_REPLAY_REFUSED');return p;}if(p.state!=='DISPATCHING')fail('LIFECYCLE_STATE_REFUSED');
  if(assertConversationActive){await assertConversationActive({binding:b,scopes,selectedClientId},guarded);guarded();}
  const retained=await nativeCheckpointOwner(c,b,r,scopes,selectedClientId,check);
  if(p.input.checkpointId!==b.runId||retained.proof.checkpointSha256!==p.input.checkpointSha256||!same(retained.proof,proof))fail('CHECKPOINT_REFUSED');
  if(p.input.intent==='resume'&&(!retained.control||r.hold_control_id!==retained.control.input.controlId||!['paused','waiting-for-approval'].includes(r.projection.state)))fail('LIFECYCLE_STATE_REFUSED');
  const t=admission.binding;if(p.input.intent==='fork')assertForkBootstrapReceipt(admission.bootstrap,{controlId,sourceBinding:b,targetBinding:t,selectedClientId});else if(admission.bootstrap!==undefined)fail('TARGET_BINDING_REFUSED');if(typeof modelAdmission!=='function')fail('MODEL_SETTINGS_UNAVAILABLE');await modelAdmission(c,t,check);
  const old=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[t.tenantId,t.conversationId])).rows[0];check();
  if(old){if(p.input.intent==='fork'||hash(old.projection)!==old.projection_sha256||old.owner_actor_id!==t.actorId||!same({...old.projection,createdAt:conversation.createdAt},conversation))fail('TARGET_BINDING_REFUSED');}
  else await c.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[t.tenantId,t.conversationId,t.actorId,conversation,hash(conversation)]);
  const sequenceBase=p.input.intent==='resume'?await closeSequenceRange(c,b,rowRun,check):0;
  // The prepared-run registry serves a non-initial run only through an ACCEPTED next-run mapping: a resume successor gets it here,
  // in this same locked transaction, over the source's settled SDK invocation. A fork successor is a writer-fence-1 run of its
  // new conversation, served by its initial-run admission. No warm host is represented as a physically retired task.
  if(p.input.intent==='resume')await recordContinuationReservation(c,{source:b,target:t,scopes:run.scopes,versions:run.versions,policyRevision:run.policyRevision,reservedAt:run.createdAt},check);
  await c.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,continuation,continuation_sha256,sequence_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11)',[t.tenantId,t.conversationId,t.runId,run,hash(run),request.requestId,request,hash(request),{continuation,sourceRequest:p.sourceRequest},hash({continuation,sourceRequest:p.sourceRequest}),sequenceBase]);
  await c.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[t.tenantId,t.conversationId,t.runId,1,event.eventId,event,hash(event)]);
  const next={...p,target:admission,retirement,proof,checkpointId:proof.checkpointId};delete next.controlSequence;await save(c,b,next);return {...next,controlSequence:p.controlSequence};});}
 /** Discovery grants nothing. Fresh target authority runs outside SQL locks so
  * another canonical owner cannot deadlock on a nested conversation transaction. */
 async function transitionFacts(value,callerCheck=()=>{},apply=false){
  const {signal,...raw}=own(value,['sourceBinding','controlId','deadlineMs'],['signal']),v={...bounded(raw),...(signal?{signal}:{})},b=v.sourceBinding;nativeSignal(signal);validateShape('RunBinding',b);uuid(v.controlId);
  if(typeof transitionAuthority?.readCurrent!=='function'||typeof now!=='function'||!Number.isSafeInteger(v.deadlineMs))fail('LIFECYCLE_TRANSITION_REFUSED');
  const check=()=>{callerCheck();if(v.signal?.aborted||!Number.isSafeInteger(now())||now()>=v.deadlineMs)fail('LIFECYCLE_TRANSITION_REFUSED');};check();
  const discovered=await tx(b,check,async c=>{const source=rowRun(await selectRun(c,b)),p=await lookup(c,b,v.controlId);check();if(!same(source.projection.binding,b)||!p||!same(p.sourceBinding,b)||!p.target||!['resume','fork'].includes(p.input.intent)||!['DISPATCHING','APPLIED'].includes(p.state))fail('LIFECYCLE_TRANSITION_REFUSED');return {binding:p.target.binding,scopes:p.scopes,selectedClientId:p.sourceSelectedClientId,policyRevision:source.projection.policyRevision};});
  const current=await readTransitionAuthority({owner:transitionAuthority,expected:discovered,committedContinuation:{sourceBinding:b,controlId:v.controlId},deadlineMs:v.deadlineMs,signal:v.signal,now,check});
  const locks=[b,discovered.binding].sort((a,z)=>`${a.tenantId}:${a.conversationId}`<`${z.tenantId}:${z.conversationId}`?-1:`${a.tenantId}:${a.conversationId}`>`${z.tenantId}:${z.conversationId}`?1:0),first=locks[0],second=locks[1];
  return tx(first,check,async c=>{
   if(first.tenantId!==second.tenantId||first.conversationId!==second.conversationId){await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${second.tenantId}:${second.conversationId}`]);check();}
   const source=await verifyRun(c,b,discovered.scopes),p=await lookup(c,b,v.controlId);check();
   if(!p||!['resume','fork'].includes(p.input.intent)||!['DISPATCHING','APPLIED'].includes(p.state)||!p.target||!p.proof)fail('LIFECYCLE_TRANSITION_REFUSED');
   pins(p,source,b,discovered.scopes,discovered.selectedClientId);const t=p.target.binding;
   if(!same(t,discovered.binding)||!same(current.binding,t)||!same(p.target.scopes,p.scopes)||p.target.selectedClientId!==p.sourceSelectedClientId)fail('LIFECYCLE_TRANSITION_REFUSED');
   own(p.target,['binding','scopes','selectedClientId','admissionReceiptId','targetSessionId','expiresAtMs'],['versions','bootstrap']);if(p.target.versions!==undefined)validateShape('RuntimeVersions',p.target.versions);validateShape('RunBinding',t);uuid(p.target.admissionReceiptId);
   if(t.tenantId!==b.tenantId||t.actorId!==b.actorId||t.runId===b.runId||t.attemptId===b.attemptId||t.workerId===b.workerId||p.input.intent==='resume'&&(t.conversationId!==b.conversationId||t.writerFence!==b.writerFence+1||p.target.targetSessionId!==null)||p.input.intent==='fork'&&(t.conversationId===b.conversationId||t.writerFence!==1))fail('LIFECYCLE_TRANSITION_REFUSED');
   if(p.input.intent==='fork'){assertForkBootstrapReceipt(p.target.bootstrap,{controlId:v.controlId,sourceBinding:b,targetBinding:t,selectedClientId:p.sourceSelectedClientId});uuid(p.target.targetSessionId);if(p.target.targetSessionId===p.proof.sdkSession.key.sessionId)fail('LIFECYCLE_TRANSITION_REFUSED');}
   const target=await verifyRun(c,t,p.scopes);check();
   // A successor can finish while its Temporal start acknowledgement is in flight. Its completed/failed run still has the exact
   // committed lineage checked below, and the source must receive its continuation signal. Cancellation remains a stop fence.
   if(target.projection.state==='cancelled'||!same(target.projection.versions,p.target.versions??p.versions)||!continuesSession(p.versions,target.projection.versions)||target.projection.policyRevision!==source.projection.policyRevision||current.policyRevision!==target.projection.policyRevision)fail('LIFECYCLE_TRANSITION_REFUSED');
   const latest=async binding=>{const runs=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[binding.tenantId,binding.conversationId])).rows.map(rowRun).sort((a,z)=>a.projection.binding.writerFence-z.projection.binding.writerFence);check();if(!runs.length||!same(runs.at(-1).projection.binding,binding)||runs.some((r,i)=>i&&r.projection.binding.writerFence===runs[i-1].projection.binding.writerFence))fail('LIFECYCLE_TRANSITION_REFUSED');};
   await latest(t);if(p.input.intent==='fork')await latest(b);
   for(const binding of new Map([b,t].map(binding=>[binding.conversationId,binding])).values()){
    const conversation=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[binding.tenantId,binding.conversationId])).rows[0];check();if(!conversation||hash(conversation.projection)!==conversation.projection_sha256||conversation.owner_actor_id!==binding.actorId||conversation.projection.conversationId!==binding.conversationId||!same(conversation.projection.owner,{tenantId:binding.tenantId,actorId:binding.actorId})||!same(conversation.projection.scopes,p.scopes)||conversation.projection.policyRevision!==current.policyRevision)fail('LIFECYCLE_TRANSITION_REFUSED');
   }
   validateProof(p.proof,p);if(p.input.checkpointId!==p.checkpointId||p.input.checkpointSha256!==p.proof.checkpointSha256||!target.continuation||hash(target.continuation)!==target.continuation_sha256)fail('LIFECYCLE_TRANSITION_REFUSED');
   own(target.continuation,['continuation','sourceRequest']);const envelope=assertContinuationEnvelope(target.continuation.continuation);
   if(envelope.controlId!==v.controlId||envelope.mode!==p.input.intent||envelope.kind!=='native-session'||!same(envelope.sdkSession,p.proof.sdkSession)||!same(envelope.files??null,p.proof.files??null)||!same(envelope.versions,p.proof.versions)||!same(envelope.scopes,p.proof.scopes)||envelope.sourceRequestSha256!==p.sourceRequestSha256||envelope.contextSha256!==p.contextSha256||envelope.targetSessionId!==p.target.targetSessionId||!same(target.continuation.sourceRequest,p.sourceRequest)||!same({...p.sourceRequest,requestId:target.request.requestId},target.request))fail('LIFECYCLE_TRANSITION_REFUSED');
   let retirementReceiptId=null,retirementExpiresAtMs=null;
   if(p.input.intent==='resume'){if(!p.retirement)fail('LIFECYCLE_TRANSITION_REFUSED');own(p.retirement,['binding','retirementReceiptId','expiresAtMs']);uuid(p.retirement.retirementReceiptId);if(!same(p.retirement.binding,b)||source.sequence_end==null||!['paused','waiting-for-approval'].includes(source.projection.state))fail('LIFECYCLE_TRANSITION_REFUSED');const end=Number(source.sequence_base)+Number(source.last_sequence);if(!Number.isSafeInteger(end)||Number(source.sequence_end)!==end||Number(target.sequence_base)!==end)fail('LIFECYCLE_TRANSITION_REFUSED');retirementReceiptId=p.retirement.retirementReceiptId;retirementExpiresAtMs=p.retirement.expiresAtMs;}
   else if(p.retirement!==null||Number(target.sequence_base)!==0)fail('LIFECYCLE_TRANSITION_REFUSED');
   const deadlines=[p.target.expiresAtMs,current.expiresAtMs,v.deadlineMs,...(retirementExpiresAtMs===null?[]:[retirementExpiresAtMs])];if(deadlines.some(d=>!Number.isSafeInteger(d)||d<=now()))fail('LIFECYCLE_TRANSITION_REFUSED');check();
   if(apply){if(p.state==='APPLIED')return p;if(p.state!=='DISPATCHING')fail('LIFECYCLE_TRANSITION_REFUSED');const next={...p,state:'APPLIED'};delete next.controlSequence;await save(c,b,next);check();return {...next,controlSequence:p.controlSequence};}
   return {controlId:v.controlId,intent:p.input.intent,state:p.state,inputSha256:p.inputSha256,sourceBinding:b,targetBinding:t,scopes:p.scopes,selectedClientId:p.sourceSelectedClientId,policyRevision:current.policyRevision,admissionReceiptId:p.target.admissionReceiptId,retirementReceiptId,checkpointId:p.checkpointId,checkpointSha256:p.proof.checkpointSha256,sourceRequestSha256:p.sourceRequestSha256,contextSha256:p.contextSha256,targetSessionId:p.target.targetSessionId,resumeSessionAt:null,admissionExpiresAtMs:p.target.expiresAtMs,retirementExpiresAtMs,targetExpiresAtMs:current.expiresAtMs,checkedAtMs:now(),expiresAtMs:Math.min(...deadlines)};
  });
 }
 const readTransition=(value,check)=>transitionFacts(value,check),finishTransition=(value,check)=>transitionFacts(value,check,true);
 /** Cleanup-only readback of this request's terminal fence. An absent event may coincide with another terminal writer, but does
  * not prove that this request's cancelled event committed. The caller supplies binding/scopes verified before disconnection. */
 async function readStopFence(value,check){const {binding:b,scopes,eventId}=own(value,['binding','scopes','eventId']);validateShape('RunBinding',b);uuid(eventId);
  let committed;const result=await tx(b,check,async c=>{
   const r=await verifyRun(c,b,scopes);check();
   const rows=(await c.query('SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND event_id=$4',[b.tenantId,b.conversationId,b.runId,eventId])).rows;check();
   if(rows.length>1)fail('STORE_CORRUPT');const row=rows[0];
   if(row){const e=row.event;validateShape('UIEvent',e);
    if(row.event_id!==eventId||e.eventId!==eventId||hash(e)!==row.event_sha256||Number(row.sequence)!==Number(r.last_sequence)||e.sequence!==Number(row.sequence)||!same(e.binding,b)||!same(e.scopes,scopes)||e.type!=='run.status'||e.data.state!=='cancelled'||e.data.reasonCode!=='USER_CANCELLED'||r.projection.state!=='cancelled')fail('STORE_CORRUPT');committed=e;
   }
   return {state:r.projection.state,cancelCommitted:!!row};
  });try{if(committed&&onPublished)Promise.resolve(onPublished(committed)).catch(()=>{});}catch{}return result;}
 return Object.freeze({begin,change,get,controls,claim,beginFileCapture,recordFiles,captureSession,readArtifactFile,readSessionCapture,readContinuation,execution,sessionSnapshot,fileSnapshot:(v,check)=>sessionSnapshot(v,check,{files:true}),continuationOrigin,continuation,readTransition,finishTransition,readReceipt,readStopFence,requireTransitionAuthority:()=>requireTransitionAuthority(transitionAuthority),failUncheckpointedHold,cancel:cancelAppend});
}

import {nativeMemoryCandidateFromProposal,assertNativeMemoryOutcome} from '../commands-0.2/native-memory-result.mjs';
/** Correlation of an intent response with the request (and, for decide, the proposal) the caller captured, and internal consistency of what the
 * server retained. Nothing here approves, executes or authorizes anything; every check only refuses a response that does not describe what was asked.
 * Rules mirror the canonical owners: approval.mjs (decision/lifetime reads), validate.mjs assertProposalIntegrity, and commands-0.2
 * execution-intent.mjs `outcome` plus task-create-validation.mjs, and the selected-document artifact publication owner. */
import canonicalize from 'canonicalize';
import {createMailSendValidators} from '../commands-0.2/mail-send-validation.mjs';
import {ARTIFACT_MIME_TYPES,assertNativeArtifactEvidenceBinding} from '../artifacts-0.2/artifact-formats.mjs';
import {validators} from './generated-validator.mjs';
import {intentsMetadata} from './generated-protocol.mjs';
import {fail} from './boundary.mjs';
import {assertRoutineProposal} from './routines.mjs';
const same=(a,b)=>canonicalize(a)===canonicalize(b);
const sha=async value=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalize(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const conflict=()=>fail('INTENTS_CORRELATION');
const mail=createMailSendValidators({snapshotOperationData:value=>value,canonicalSha256:canonicalize,validateShape(name,value){if(!validators['Intents'+name]?.(value))conflict();}});
/** Proposal and decision times are read as approval.mjs reads them: any date-time the schema admits (ending Z) that Date.parse accepts. */
const parsed=value=>{const at=typeof value==='string'?Date.parse(value):NaN;if(!Number.isSafeInteger(at))conflict();return at;};
/** Receipts and task results use the canonical execution boundary's exact spelling (commands-0.2/execution-boundary.mjs instant). */
const exact=value=>{const at=Date.parse(value);if(!Number.isSafeInteger(at)||new Date(at).toISOString()!==value)conflict();return at;};
const STABLE=['tenantId','actorId','conversationId','runId'];
/** The retained proposal must describe itself: its hash is the canonical hash of its command, it belongs to the requested conversation and tenant. */
async function proposal(value,conversationId){
 if(value.kind==='legislative_document_action'){
  const {commandSha256,...bound}=value,selected=value.context.selectedClientId,[s]=value.scopes;
  if(await sha(bound)!==commandSha256||value.binding.conversationId!==conversationId||value.context.conversationId!==conversationId||parsed(value.expiresAt)<=parsed(value.createdAt)||s.tenantId!==value.binding.tenantId||s.kind!==(selected===null?'private-user':'client')||s.resourceId!==(selected??value.binding.actorId)||selected!==null&&value.request.clientId!==selected)conflict();
  legislativeDocumentRequest(value.operation,value.request);return;
 }
 if(value.kind==='client_record_action'){
  const {commandSha256,...bound}=value,selected=value.context.selectedClientId,[s]=value.scopes;
  if(value.operation!==value.request.operation||await sha(bound)!==commandSha256||value.binding.conversationId!==conversationId||value.context.conversationId!==conversationId||parsed(value.expiresAt)<=parsed(value.createdAt)||s.tenantId!==value.binding.tenantId||s.kind!==(selected===null?'private-user':'client')||s.resourceId!==(selected??value.binding.actorId)||value.operation==='update_client_profile'&&selected!==null&&value.request.input.clientId!==selected)conflict();return;
 }
 if(value.kind==='legiwatch_action'){
  const {commandSha256,...bound}=value,s=value.scopes[0],selected=value.context.selectedClientId;
  if(value.operation!==(Object.hasOwn(value.request,'previewHash')?'save_legiwatch_relevance':'apply_legiwatch_suggestion')||Object.hasOwn(value.request,'previewHash')&&(!value.request.explanation.trim()||value.request.end-value.request.start!==value.request.quote.length||value.request.quote.length>2000||new Set(value.request.fields).size!==value.request.fields.length)||await sha(bound)!==commandSha256||value.binding.conversationId!==conversationId||value.context.conversationId!==conversationId||parsed(value.expiresAt)<=parsed(value.createdAt)||s.tenantId!==value.binding.tenantId||s.kind!==(selected===null?'private-user':'client')||s.resourceId!==(selected??value.binding.actorId)||selected!==null&&value.request.clientId!==selected)conflict();return;
 }
 if(value.kind==='bizdev_action'){
  // The saved brief edit is bound to the persisted prospect conversation the run owns: a prospect linked to a client runs under that client's scope, an
  // unlinked prospect under the actor's private scope. A null client is never widened to a general scope.
  const {commandSha256,...bound}=value,s=value.scopes[0],linked=value.context.linkedClientId;
  if(await sha(bound)!==commandSha256||value.binding.conversationId!==conversationId||value.context.conversationId!==conversationId||value.request.conversationId!==conversationId||parsed(value.expiresAt)<=parsed(value.createdAt)||s.tenantId!==value.binding.tenantId||s.kind!==(linked===null?'private-user':'client')||s.resourceId!==(linked??value.binding.actorId))conflict();return;
 }
 if(value.kind==='watch_action'){
  const {commandSha256,...bound}=value,s=value.scopes[0],selected=value.context.selectedClientId;
  if(await sha(bound)!==commandSha256||value.binding.conversationId!==conversationId||value.context.conversationId!==conversationId||parsed(value.expiresAt)<=parsed(value.createdAt)||s.tenantId!==value.binding.tenantId||s.kind!==(selected===null?'private-user':'client')||s.resourceId!==(selected??value.binding.actorId)||selected!==null&&value.request.clientId!==selected)conflict();return;
 }
 if(value.kind==='research_action'){
  const {commandSha256,...bound}=value,[s]=value.scopes;
  if(await sha(bound)!==commandSha256||value.binding.conversationId!==conversationId||value.request.conversationId!==conversationId||s.tenantId!==value.binding.tenantId||parsed(value.expiresAt)<=parsed(value.createdAt)||
   value.operation==='save_research_portfolio_output_to_client'&&s.kind==='client'&&value.request.clientId!==s.resourceId)conflict();
  return;
 }
 if(value.kind==='research_share'){
  const {commandSha256,...bound}=value,publishing=value.operation==='publish_research_portfolio_share_link';
  if(await sha(bound)!==commandSha256||value.binding.conversationId!==conversationId||value.request.conversationId!==conversationId||
   value.scopes.some(scope=>scope.tenantId!==value.binding.tenantId)||parsed(value.expiresAt)<=parsed(value.createdAt)||
   publishing!==Object.hasOwn(value.request,'previewHash')||publishing!==Object.hasOwn(value.preview,'portfolioId')||value.preview.label!==(publishing?'Publish client share link':'Revoke client share link')||
   publishing&&value.scopes[0].kind==='client'&&value.request.clientId!==value.scopes[0].resourceId)conflict();
  return;
 }
 if(value.kind==='browser_action'){
  // Bounded reviewed display only: the proposal carries the tool, page origin, window, approver, scopes and
  // the policy/input digests; C/A/S/I stay distinct and no raw browser input is published.
  if(value.operation.id!=='browser_action'||value.operation.version!=='0.2.0')conflict();
  if(value.binding.conversationId!==conversationId||value.scopes.some(scope=>scope.tenantId!==value.binding.tenantId)||
   value.requiredApprover.tenantId!==value.binding.tenantId||value.expiresAtMs<=value.requestedAtMs)conflict();
  exact(value.createdAt);return;
 }
 const command=value.command;
 if(await sha(command)!==value.commandSha256||value.requiredApprover.tenantId!==command.binding.tenantId||command.binding.conversationId!==conversationId||
  command.scopes.some(scope=>scope.tenantId!==command.binding.tenantId)||parsed(value.expiresAt)<=parsed(value.createdAt))conflict();
 if(command.action==='task.create'&&(!validators.IntentsTaskCreateArguments(command.arguments)||command.attachments.length!==0||command.arguments.title.trim()!==command.arguments.title))conflict();
 if(command.action==='task.update'){
  if(!validators.IntentsTaskUpdateArguments(command.arguments)||command.attachments.length!==0||command.arguments.taskId.toLowerCase()!==command.arguments.taskId)conflict();
  const patch=command.arguments.patch;
  if(patch.title!==undefined&&patch.title.trim()!==patch.title)conflict();
  if(patch.dueDate!==undefined&&exact(patch.dueDate)%86400000!==0)conflict();
 }
 if(command.action==='memory.propose'){
  const a=command.arguments,scopes=command.scopes,selected=scopes.length===1&&scopes[0].kind==='client'?scopes[0].resourceId:null;
  if(scopes.length!==1||value.requiredApprover.actorId!==command.binding.actorId||selected===null&&(scopes[0].kind!=='private-user'||scopes[0].resourceId!==command.binding.actorId)||
   !validators.IntentsMemoryProposeArguments(a)||a.content.trim()!==a.content||a.content.length>4000||
   a.key!==null&&(a.key.trim()!==a.key||a.key.length>120)||a.ttlDays!==null&&!Number.isSafeInteger(a.ttlDays)||
   a.clientId!==(a.scope==='client'?selected:null)||a.scope==='client'&&selected===null||command.attachments.length!==0)conflict();
 }
 if(command.action==='mail.send'){try{mail.assertMailSendCommand(command,{binding:command.binding});exact(value.createdAt);exact(value.expiresAt);if(value.requiredApprover.actorId!==command.binding.actorId)conflict();}catch{conflict();}}
 if(command.action==='document.draft') {
  exact(value.createdAt);exact(value.expiresAt);
  if(command.arguments.title.trim()!==command.arguments.title||command.arguments.title.length>200||
   command.arguments.baseVersionId!==null&&command.arguments.baseVersionId.toLowerCase()!==command.arguments.baseVersionId)conflict();
 }
 if(command.action==='artifact.file'){
  const scopes=command.scopes,objects=command.attachments,args=command.arguments;
  if(!validators.IntentsArtifactFileArguments(args)||args.conversationId!==command.binding.conversationId||
   scopes.length!==1||scopes[0].kind!=='client'||scopes[0].resourceId!==args.clientId||args.clientId.toLowerCase()!==args.clientId||
   objects.length<1||objects.length>10||new Set(objects.map(o=>o.objectId.toLowerCase())).size!==objects.length||objects.some(o=>!same(o.scopes,scopes)))conflict();
 }
}
function decision(value,retained){
 parsed(value.decidedAt);parsed(value.expiresAt);
 if(value.proposalId!==retained.proposalId||value.commandSha256!==retained.commandSha256)conflict();
}
/** The public document result preserves the actual output binding. Backend publication owns its projected request hash and delivery derivation. */
function documentOutcome(value,command) {
 const {version,inspection,execution}=value;
 if(!version||!inspection||execution?.kind!=='native-document'||version.contractVersion!=='0.2.0')conflict();
 if(['tenantId','actorId','conversationId'].some(key=>version.binding[key]!==command.binding[key])||!same(version.scopes,command.scopes)||
  !same(version.object.scopes,version.scopes)||version.parentVersionId!==command.arguments.baseVersionId||version.object.bytes>16*1024*1024||
  inspection.format!=='docx'||version.mimeType!==ARTIFACT_MIME_TYPES.docx||!version.filename.endsWith('.docx')||
  inspection.sha256!==version.object.sha256||inspection.bytes!==version.object.bytes)conflict();
 try{assertNativeArtifactEvidenceBinding(version.binding,version.evidence);}catch{conflict();}
 const scopes=new Set(version.scopes.map(canonicalize));
 if(version.evidence.some(item=>item.scopes.some(scope=>!scopes.has(canonicalize(scope)))))conflict();
 exact(version.createdAt);
}
/** A completed outcome must belong to the retained command's actual task or document owner. */
async function outcome(value,retained,decisionValue){
 const command=retained.command,receipt=value.receipt,result=value.result;
 if(command.action==='document.draft')return documentOutcome(value,command);
 if(value.execution?.kind==='native-memory'){
  try{return assertNativeMemoryOutcome(value,retained,{candidateSha256:await sha(nativeMemoryCandidateFromProposal(retained)),
   decisionSha256:decisionValue?await sha(decisionValue):undefined,decision:decisionValue,same});}catch{conflict();}
 }
 if(value.execution?.kind==='native-mail'){
  const e=value.execution;if(command.action!=='mail.send'||e.proposalId!==retained.proposalId||e.commandSha256!==retained.commandSha256||e.idempotencyKey!==command.idempotencyKey||!same(e.binding,command.binding)||decisionValue&&e.approvalDecisionSha256!==await sha(decisionValue))conflict();
  try{mail.assertMailSendResult(result,command,retained.proposalId);}catch{conflict();}return;
 }
 if(value.execution?.kind==='native-task'||value.execution?.kind==='native-artifact-file'){
  const e=value.execution;
  if(e.proposalId!==retained.proposalId||e.commandSha256!==retained.commandSha256||e.idempotencyKey!==command.idempotencyKey||!same(e.binding,command.binding)||
   decisionValue&&e.approvalDecisionSha256!==await sha(decisionValue))conflict();
  const completed=exact(e.completedAt);
  if(completed<parsed(retained.createdAt)||decisionValue&&completed<parsed(decisionValue.decidedAt))conflict();
  if(e.kind==='native-artifact-file'){
   if(command.action!=='artifact.file'||result.commandSha256!==retained.commandSha256||result.files.length!==command.attachments.length)conflict();
   const seen=new Set(),persisted=['documentId','location','indexingStatus','reused'];
   for(const file of result.files){
    const key=canonicalize(file.object),count=persisted.filter(key=>Object.hasOwn(file,key)).length;
    if(seen.has(key)||!command.attachments.some(o=>same(o,file.object))||count!==0&&count!==persisted.length)conflict();seen.add(key);
    if(file.fileName===null&&(file.status!=='failed'||count!==0)||file.status!=='failed'&&count!==persisted.length)conflict();
    if(file.status==='saved'){if(file.indexingStatus==='not_indexed')conflict();}
    else if(!Object.hasOwn(file,'reason')||count&&file.indexingStatus!=='not_indexed')conflict();
   }
   return;
  }
  if(command.action==='task.create'){
   exact(result.createdAt);
   if(result.status!=='todo'||['title','clientId','dueDate'].some(key=>result[key]!==command.arguments[key]))conflict();
  }else if(command.action==='task.update'){
   exact(result.updatedAt);if(result.dueDate!==null&&exact(result.dueDate)%86400000!==0)conflict();
   if(result.id.toLowerCase()!==command.arguments.taskId||Object.entries(command.arguments.patch).some(([key,value])=>result[key]!==value))conflict();
  }else conflict();
  return;
 }
 if(command.action!=='task.create'||!receipt||!result)conflict();
 exact(receipt.completedAt);exact(result.createdAt);
 if(receipt.commandId!==command.commandId||receipt.commandSha256!==retained.commandSha256||receipt.idempotencyKey!==command.idempotencyKey||!same(receipt.scopes,command.scopes))conflict();
 // Attempt, worker and fence may change across resumption; the stable binding may not.
 if(STABLE.some(key=>receipt.binding[key]!==command.binding[key]))conflict();
 if(['title','clientId','dueDate'].some(key=>result[key]!==command.arguments[key]))conflict();
 if(receipt.outcome!=='succeeded'||receipt.sourceTransactionId!==null)conflict();
}
/** `phase` is derived server-side from execution evidence first, then the current decision, then expiry (approval.mjs item()). */
function phase(item){
 const {decision:d,execution,phase:p}=item;
 if(execution!==null&&typeof execution==='object'){if(p!==execution.state)conflict();return;}
 if(d!==null&&typeof d==='object'){if(p!==d.decision)conflict();return;}
 if(!(d===null?['awaiting_approval','expired']:['expired','unknown_decision']).includes(p))conflict();
}
/** Browser correlation of the canonical owner's closed selection and durable effect; no authority is granted here. */
function legislativeDocumentRequest(operation,request){
 const briefing=operation==='prepare_legiwatch_briefing';
 if(briefing!==Object.hasOwn(request,'template')||request.citations.some(c=>c.end<=c.start))conflict();
 if(briefing&&!Number.isFinite(Date.parse(request.cutoff)))conflict();
}
function legislativeDocumentResult(value,retained){
 if(value.operation!==retained.operation||value.proposalId!==retained.proposalId||!same(value.request,retained.request)||!same(value.context,retained.context)||value.createdAt!==retained.createdAt||value.expiresAt!==retained.expiresAt)conflict();
 const r=value.receipt;
 if(value.status==='succeeded'){
  if(r===null||value.effect!==r.state||!same(r.request,retained.request))conflict();
  if(r.state==='complete'){
   if(typeof r.documentId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/u.test(r.documentId)||r.location!=='/workspace/draft/'+r.documentId)conflict();
  }else if(r.documentId!==null||r.location!==null)conflict();
 }else if(r!==null||(value.effect!==null&&value.effect!=='unknown')||value.status==='outcome_unknown'&&value.effect!=='unknown')conflict();
}
async function clientRecordResult(value,retained){
 if(value.proposalId!==retained.proposalId||!same(value.request,retained.request)||!same(value.context,retained.context)||value.createdAt!==retained.createdAt||value.expiresAt!==retained.expiresAt||(value.status==='succeeded')!==(value.receipt!==null))conflict();
 if(value.receipt===null)return;const r=value.receipt,input=retained.request.input;if(!same(r.request,retained.request))conflict();
 if(retained.operation==='create_client'){if(r.outcome!=='created'||r.client.name!==input.name||input.ldaClientId!==undefined&&r.ldaMatch?.ldaClientId!==input.ldaClientId)conflict();return;}
 const names=['name','website','description','productDescription','primaryContactName','primaryContactEmail','primaryContactPhone','sectorTag','uei','cageCode','issueCodes','naicsCodes','pscCodes'].filter(k=>Object.hasOwn(input,k));
 if(r.clientId!==input.clientId||!same([...r.fieldsWritten].sort(),names.sort()))conflict();
 const changed=r.fieldsWritten.length+r.facilitiesCreated.length+r.capabilitiesCreated.length+r.peopleCreated.length+r.peopleUpdated.length>0;
 if(r.outcome!==(r.rowErrors.length?(changed?'partially_updated':'not_updated'):(changed?'updated':'unchanged')))conflict();
}
async function legiwatchResult(value,retained){
 if(value.proposalId!==retained.proposalId||!same(value.request,retained.request)||!same(value.context,retained.context)||value.createdAt!==retained.createdAt||value.expiresAt!==retained.expiresAt||(value.status==='succeeded')!==(value.receipt!==null))conflict();
 if(value.receipt!==null&&retained.operation==='save_legiwatch_relevance'){const r=value.receipt;if(!same(r.request,retained.request)||r.outcome!=='suggested'||r.payload.origin!=='semantic'||r.payload.state!=='pending'||r.payload.binding!==await sha([retained.request.previewHash,retained.request.requestKey]))conflict();return;}
 if(value.receipt!==null){const r=value.receipt,p=r.payload;if(!same(r.request,retained.request)||p.suggestionId!==retained.request.suggestionId||p.action!==retained.request.action||p.version!==retained.request.expectedVersion+1)conflict();}
}
function bizdevResult(value,retained){
 if(value.proposalId!==retained.proposalId||!same(value.request,retained.request)||!same(value.context,retained.context)||value.createdAt!==retained.createdAt||value.expiresAt!==retained.expiresAt||(value.status==='succeeded')!==(value.receipt!==null))conflict();
 // Only a confirmed saved version is a receipt: the expected version's immediate successor, with the brief's current version equal to it. A refused or
 // ambiguous outcome carries no receipt and is never relabelled as saved.
 if(value.receipt!==null){const r=value.receipt,v=r.version;if(!same(r.request,retained.request)||r.tool!=='save_business_development_brief'||r.status!=='saved'||v.versionNumber!==retained.request.expectedVersionNumber+1||r.brief.currentVersionNumber!==v.versionNumber)conflict();}
}
function watchResult(value,retained){
 if(value.proposalId!==retained.proposalId||!same(value.request,retained.request)||!same(value.context,retained.context)||value.createdAt!==retained.createdAt||value.expiresAt!==retained.expiresAt||(value.status==='succeeded')!==(value.receipt!==null))conflict();
 // The receipt must name this exact owner, verb and target; a substituted target is never a released result.
 if(value.receipt!==null){const r=value.receipt;if(!same(r.request,retained.request)||r.owner!==retained.request.family||r.operation!==retained.request.operation||r.targetKey!==retained.request.targetKey)conflict();}
}
function savedNote(value,conversationId){
 if(value.operation.id!=='save_note'||value.operation.version!=='0.2.0')conflict();
 if(!Object.hasOwn(value,'result'))return;
 const r=value.result,s=r.scopes[0],b=r.binding;
 if(b.conversationId!==conversationId||s.tenantId!==b.tenantId||!(s.kind==='client'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(s.resourceId)||s.kind==='private-user'&&s.resourceId===b.actorId))conflict();
 if(parsed(r.expiresAt)<=parsed(r.createdAt))conflict();parsed(r.recordedAt);
 const absent=keys=>keys.every(key=>r[key]===null||r[key]===undefined);
 if(r.status==='saved'){
  if(r.policyOutcome!=='PASS'||!r.noteId||!r.destination||!r.readiness||!absent(['errorCode']))conflict();
  if(r.destination==='meeting'){if(!r.meetingNoteId||r.readiness!=='ready'||!absent(['documentId','location','indexingStatus','reused']))conflict();}
  else if(r.destination==='client_document'){if(!r.documentId||!r.location||typeof r.reused!=='boolean'||!absent(['meetingNoteId']))conflict();}
  else if(r.readiness!=='ready'||!absent(['meetingNoteId','documentId','location','indexingStatus','reused']))conflict();
 }else{
  if(!absent(['destination','noteId','meetingNoteId','documentId','location','indexingStatus','readiness','reused']))conflict();
  if(r.status==='withheld'&&r.policyOutcome!=='WARN'||r.status==='blocked'&&r.policyOutcome!=='BLOCK'||['unknown','failed'].includes(r.status)&&!r.errorCode)conflict();
 }
}
async function item(value,conversationId){
 // The journal's createdAt is a bare millisecond-spelling pattern in the schema (no calendar check) and the journal writes toISOString(): read it exactly, so
 // an impossible day such as 2026-02-30 can not roll into March.
 exact(value.createdAt);
 if(value.kind==='browser_action'){
  if(!Object.hasOwn(value,'proposal'))return;
  // The item names the PREPARATION operation; the proposal names the browser action it authorizes.
  if(value.operation.id!=='browser_approval_preparation'||value.proposal.operation.id!=='browser_action'||
   value.operation.version!=='0.2.0'||value.proposal.operation.version!=='0.2.0')conflict();
  await proposal(value.proposal,conversationId);
  const d=value.decision;
  if(d!==null&&typeof d==='object'){
   if(d.proposalId!==value.proposal.proposalId||d.subjectSha256!==value.proposal.subjectSha256||
    !same(d.approver,value.proposal.requiredApprover)||parsed(d.decidedAt)<parsed(value.proposal.createdAt))conflict();
  }
  // A decision is a RECORDED human choice, never an execution: the phase must agree with it.
  if(value.phase==='approved'&&!(typeof d==='object'&&d.decision==='approved'))conflict();
  if(value.phase==='rejected'&&!(typeof d==='object'&&d.decision==='rejected'))conflict();
  if(value.execution!==null&&typeof value.execution==='object'&&value.execution.state!=='completed')conflict();
  return;
 }
 if(value.kind==='saved_note'){savedNote(value,conversationId);return;}
 if(value.kind==='legiwatch_action'){if(!Object.hasOwn(value,'proposal'))return;if(value.operation.id!==value.proposal.operation)conflict();await proposal(value.proposal,conversationId);if(value.result!=='unavailable')await legiwatchResult(value.result,value.proposal);return;}
 if(value.kind==='legislative_document_action'){if(!Object.hasOwn(value,'proposal'))return;if(value.operation.id!==value.proposal.operation)conflict();await proposal(value.proposal,conversationId);if(value.result!=='unavailable')legislativeDocumentResult(value.result,value.proposal);return;}
 if(value.kind==='client_record_action'){if(!Object.hasOwn(value,'proposal'))return;if(value.operation.id!==value.proposal.operation)conflict();await proposal(value.proposal,conversationId);if(value.result!=='unavailable')await clientRecordResult(value.result,value.proposal);return;}
 if(value.kind==='bizdev_action'){if(!Object.hasOwn(value,'proposal'))return;if(value.operation.id!==value.proposal.operation)conflict();await proposal(value.proposal,conversationId);if(value.result!=='unavailable')bizdevResult(value.result,value.proposal);return;}
 if(value.kind==='watch_action'){if(!Object.hasOwn(value,'proposal'))return;if(value.operation.id!==value.proposal.operation)conflict();await proposal(value.proposal,conversationId);if(value.result!=='unavailable')watchResult(value.result,value.proposal);return;}
 if(value.kind==='research_action'){
  if(!Object.hasOwn(value,'proposal'))return;
  if(value.operation.id!==value.proposal.operation)conflict();await proposal(value.proposal,conversationId);
  if(value.result!=='unavailable'&&value.result.resultSummary!==undefined&&value.result.proposalStatus!=='succeeded')conflict();return;
 }
 if(value.kind==='research_share'){
  if(!Object.hasOwn(value,'proposal'))return;
  if(value.operation.id!==value.proposal.operation)conflict();await proposal(value.proposal,conversationId);return;
 }
 if(value.kind==='schedule_proposal'){
  if(!Object.hasOwn(value,'proposal'))return;
  if(value.binding.conversationId!==conversationId||value.proposal.projection.owner.tenantId!==value.binding.tenantId||value.proposal.projection.owner.actorId!==value.binding.actorId||
   value.proposal.projection.scopes.some(scope=>scope.tenantId!==value.binding.tenantId))conflict();
  assertRoutineProposal(value.proposal,value.operation.id,value.request);return;
 }
 if(value.kind==='memory_review'){
  if(value.operation.id!=='save_memory')conflict();
  if(!Object.hasOwn(value,'review'))return;
  const {binding,scopes}=value.review,scope=scopes[0];
  if(binding.conversationId!==conversationId||scope.tenantId!==binding.tenantId||
   !(scope.kind==='client'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(scope.resourceId)||scope.kind==='private-user'&&scope.resourceId===binding.actorId))conflict();
  return;
 }
 if(!Object.hasOwn(value,'proposal'))return;
 await proposal(value.proposal,conversationId);
 if(value.decision!==null&&typeof value.decision==='object')decision(value.decision,value.proposal);
 if(value.execution!==null&&typeof value.execution==='object'&&value.execution.state==='completed')await outcome(value.execution.outcome,value.proposal,value.decision&&typeof value.decision==='object'?value.decision:undefined);
 phase(value);
}
export async function list(value,request){
 const limit=request.limit??20;
 if(value.conversationId!==request.conversationId||value.intents.length>limit)conflict();
 const ids=value.intents.map(entry=>entry.deliveryId);
 if(new Set(ids).size!==ids.length)conflict();
 // The journal returns a full page plus a cursor naming its last entry, or no cursor.
 if(value.next!==null&&(value.intents.length!==limit||value.next!==ids.at(-1)))conflict();
 for(const entry of value.intents)await item(entry,request.conversationId);
 return value;
}
/** `retained` is the proposal this caller admitted from an earlier list answer. Rejected and indeterminate replies carry no conversation, command or
 * binding of their own, so the retained proposal is what binds them to the request's conversation and approver. */
export async function decide(value,request,retained){
 await proposal(retained,request.conversationId);
 if(retained.kind==='browser_action'){
  // A recorded approval means AWAITING EXECUTION; a rejection is final for this proposal. Neither answer
  // carries an execution result, and the decision must belong to this exact proposal and approver.
  if(request.subjectSha256!==retained.subjectSha256)conflict();
  if(value.status!==(request.decision==='rejected'?'browser_rejected':'browser_decision_recorded')||
   value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();
  const d=value.decision;
  if(d.proposalId!==retained.proposalId||d.subjectSha256!==retained.subjectSha256||d.decision!==request.decision||
   !same(d.approver,retained.requiredApprover)||parsed(d.decidedAt)<parsed(retained.createdAt))conflict();
  return value;
 }
 if(retained.kind==='legiwatch_action'){
  if(value.status!=='legiwatch_decided'||retained.proposalId!==request.proposalId||retained.commandSha256!==request.commandSha256||value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();await legiwatchResult(value.result,retained);return value;
 }
 if(retained.kind==='legislative_document_action'){
  if(value.status!=='legislative_document_decided'||retained.proposalId!==request.proposalId||retained.commandSha256!==request.commandSha256||value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();legislativeDocumentResult(value.result,retained);return value;
 }
 if(retained.kind==='client_record_action'){
  if(value.status!=='client_record_decided'||retained.proposalId!==request.proposalId||retained.commandSha256!==request.commandSha256||value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();await clientRecordResult(value.result,retained);return value;
 }
 if(retained.kind==='bizdev_action'){
  if(value.status!=='bizdev_decided'||retained.proposalId!==request.proposalId||retained.commandSha256!==request.commandSha256||value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();bizdevResult(value.result,retained);return value;
 }
 if(retained.kind==='watch_action'){
  if(value.status!=='watch_decided'||retained.proposalId!==request.proposalId||retained.commandSha256!==request.commandSha256||value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();watchResult(value.result,retained);return value;
 }
 if(retained.kind==='research_action'){
  if(value.status!=='research_action_decided'||retained.proposalId!==request.proposalId||retained.commandSha256!==request.commandSha256||value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();
  if(value.resultSummary!==undefined&&(request.decision!=='approved'||value.proposalStatus!=='succeeded'))conflict();
  return value;
 }
 if(retained.kind==='research_share'){
  if(value.status!=='research_share_decided'||retained.proposalId!==request.proposalId||retained.commandSha256!==request.commandSha256||value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();
  if(value.oneTimeResult!==undefined&&(request.decision!=='approved'||value.proposalStatus!=='succeeded'||retained.operation!=='publish_research_portfolio_share_link'))conflict();
  return value;
 }
 // The handler refuses a proposal it cannot approve before any decision is recorded, so any 200 implies an approvable action.
 if(retained.proposalId!==request.proposalId||retained.commandSha256!==request.commandSha256||!intentsMetadata.approvableActions.includes(retained.command.action))conflict();
 if(value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();
 const d=value.decision;decision(d,retained);
 // admitDecision: the owner's decision is for this choice, by the proposal's required approver, not before the proposal existed.
 if(d.decision!==request.decision||!same(d.approver,retained.requiredApprover)||parsed(d.decidedAt)<parsed(retained.createdAt))conflict();
 if((value.status==='rejected')!==(request.decision==='rejected'))conflict();
 if(value.status==='executed')await outcome(value.outcome,retained,d);
 return value;
}

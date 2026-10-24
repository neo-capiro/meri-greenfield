/** Correlation of an intent response with the request (and, for decide, the proposal) the caller captured, and internal consistency of what the
 * server retained. Nothing here approves, executes or authorizes anything; every check only refuses a response that does not describe what was asked.
 * Rules mirror the canonical owners: approval.mjs (decision/lifetime reads), validate.mjs assertProposalIntegrity, and commands-0.2
 * execution-intent.mjs `outcome` plus task-create-validation.mjs, and the selected-document artifact publication owner. */
import canonicalize from 'canonicalize';
import {ARTIFACT_MIME_TYPES,assertNativeArtifactEvidenceBinding} from '../artifacts-0.2/artifact-formats.mjs';
import {validators} from './generated-validator.mjs';
import {intentsMetadata} from './generated-protocol.mjs';
import {fail} from './boundary.mjs';
const same=(a,b)=>canonicalize(a)===canonicalize(b);
const sha=async value=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalize(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const conflict=()=>fail('INTENTS_CORRELATION');
/** Proposal and decision times are read as approval.mjs reads them: any date-time the schema admits (ending Z) that Date.parse accepts. */
const parsed=value=>{const at=typeof value==='string'?Date.parse(value):NaN;if(!Number.isSafeInteger(at))conflict();return at;};
/** Receipts and task results use the canonical execution boundary's exact spelling (commands-0.2/execution-boundary.mjs instant). */
const exact=value=>{const at=Date.parse(value);if(!Number.isSafeInteger(at)||new Date(at).toISOString()!==value)conflict();return at;};
const STABLE=['tenantId','actorId','conversationId','runId'];
/** The retained proposal must describe itself: its hash is the canonical hash of its command, it belongs to the requested conversation and tenant. */
async function proposal(value,conversationId){
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
 if(command.action==='document.draft') {
  exact(value.createdAt);exact(value.expiresAt);
  if(command.arguments.title.trim()!==command.arguments.title||command.arguments.title.length>200||
   command.arguments.baseVersionId!==null&&command.arguments.baseVersionId.toLowerCase()!==command.arguments.baseVersionId)conflict();
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
 if(value.execution?.kind==='native-task'){
  const e=value.execution;
  if(e.proposalId!==retained.proposalId||e.commandSha256!==retained.commandSha256||e.idempotencyKey!==command.idempotencyKey||!same(e.binding,command.binding)||
   decisionValue&&e.approvalDecisionSha256!==await sha(decisionValue))conflict();
  const completed=exact(e.completedAt);
  if(completed<parsed(retained.createdAt)||decisionValue&&completed<parsed(decisionValue.decidedAt))conflict();
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
async function item(value,conversationId){
 // The journal's createdAt is a bare millisecond-spelling pattern in the schema (no calendar check) and the journal writes toISOString(): read it exactly, so
 // an impossible day such as 2026-02-30 can not roll into March.
 exact(value.createdAt);
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

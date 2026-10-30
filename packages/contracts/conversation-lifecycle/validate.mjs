/** Private additive lifecycle boundary. Existing public0.1.3 is unchanged. */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {assertLifecycleShape} from './shape.mjs';
import {data,own} from '../commands-0.2/execution-boundary.mjs';
import {assertNativeFileState} from '../runtime-0.2/files.mjs';
import {assertNativeSessionReference} from '../runtime-0.2/session.mjs';
const fail=()=>{throw Object.assign(new Error('LIFECYCLE_INPUT_REFUSED'),{code:'LIFECYCLE_INPUT_REFUSED'});};
const uuid=value=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value))fail();};
const digest=value=>{if(typeof value!=='string'||!/^[a-f0-9]{64}$/u.test(value))fail();};
function snapshot(raw){const value=data(raw);if(Buffer.byteLength(JSON.stringify(value))>131072)fail();return value;}
function text(value){if(typeof value!=='string'||!value.trim()||value.length>100000||!value.isWellFormed()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))fail();}
// One answered question: an option label or the user's own text, or the selected labels of a multi-select question.
// Keys are the asked question texts; the worker re-checks them against the questions it actually sent.
const MAX_QUESTIONS=4;
function answerValue(value){
 if(typeof value==='string'){if(!value.trim()||value.length>10000||!value.isWellFormed())fail();return;}
 if(!Array.isArray(value)||!value.length||value.length>MAX_QUESTIONS||new Set(value).size!==value.length)fail();
 for(const label of value)if(typeof label!=='string'||!label.trim()||label.length>10000||!label.isWellFormed())fail();
}
function answers(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 const entries=Object.entries(value);
 if(!entries.length||entries.length>MAX_QUESTIONS)fail();
 for(const [question,answer] of entries){if(!question.trim()||question.length>1000||!question.isWellFormed())fail();answerValue(answer);}
 return value;
}
/** The worker command action one control intent becomes. The stored control pins its intent to this action, so the
 * mapping lives here once instead of in every reader. */
export const workerActionForIntent=intent=>intent==='approval.wait'?'waitForApproval':intent==='answer'?'answerQuestion':intent==='takeover.end'?'resume':intent;
export function assertLifecycleCommand(raw){
 const v=assertLifecycleShape('ConversationLifecycleControlRequest',snapshot(raw));uuid(v.controlId);
 if(v.intent==='steer'){own(v,['controlId','intent','text']);text(v.text);}
 else if(['pause','takeover.begin'].includes(v.intent))own(v,['controlId','intent']);
 else if(v.intent==='approval.wait'){own(v,['controlId','intent','proposalId']);uuid(v.proposalId);}
 else if(v.intent==='answer'){own(v,['controlId','intent','questionId','answers']);uuid(v.questionId);answers(v.answers);}
 else if(['resume','fork','takeover.end'].includes(v.intent)){own(v,['controlId','intent','checkpointId','checkpointSha256']);uuid(v.checkpointId);digest(v.checkpointSha256);}
 else fail();return v;
}
/** The existing Core bootstrap receipt, persisted only for a native fork. It is
 * binding evidence, not authority; admission still reads current Core access. */
export function assertForkBootstrapReceipt(raw,{controlId,sourceBinding,targetBinding,selectedClientId}){
 const v=snapshot(raw);own(v,['schemaVersion','requestId','conversationId','tenantId','actorId','clientId'],v.schemaVersion===2?['scopeKind']:[]);
 uuid(v.requestId);uuid(v.conversationId);
 if(v.schemaVersion===1){uuid(v.clientId);if(selectedClientId===null)fail();}
 else if(v.schemaVersion===2){if(v.scopeKind!==(selectedClientId===null?'general':'client'))fail();if(v.clientId!==null)uuid(v.clientId);}
 else fail();
 if(v.requestId!==controlId||v.conversationId!==targetBinding.conversationId||v.conversationId===sourceBinding.conversationId||v.tenantId!==sourceBinding.tenantId||v.actorId!==sourceBinding.actorId||v.clientId!==selectedClientId||targetBinding.tenantId!==sourceBinding.tenantId||targetBinding.actorId!==sourceBinding.actorId)fail();
 return v;
}
export function assertLifecycleReceipt(raw){
 const v=assertLifecycleShape('ConversationLifecycleControlReceipt',snapshot(raw));own(v,['controlId','intent','sourceBinding','inputSha256','state','checkpointId','targetBinding','admissionReceiptId','retirementReceiptId','replayed']);uuid(v.controlId);validateShape('RunBinding',v.sourceBinding);digest(v.inputSha256);
 if(!['steer','pause','approval.wait','answer','resume','fork','takeover.begin','takeover.end'].includes(v.intent)||!['PENDING','DISPATCHING','APPLIED','UNKNOWN'].includes(v.state)||typeof v.replayed!=='boolean')fail();
 for(const k of ['checkpointId','admissionReceiptId','retirementReceiptId'])if(v[k]!==null)uuid(v[k]);
 if(v.targetBinding!==null){validateShape('RunBinding',v.targetBinding);if(!['resume','fork','takeover.end'].includes(v.intent)||v.targetBinding.tenantId!==v.sourceBinding.tenantId||v.targetBinding.actorId!==v.sourceBinding.actorId||v.targetBinding.runId===v.sourceBinding.runId||v.targetBinding.attemptId===v.sourceBinding.attemptId||v.targetBinding.workerId===v.sourceBinding.workerId)fail();if(['resume','takeover.end'].includes(v.intent)&&(v.targetBinding.conversationId!==v.sourceBinding.conversationId||v.targetBinding.writerFence<=v.sourceBinding.writerFence)||v.intent==='fork'&&v.targetBinding.conversationId===v.sourceBinding.conversationId)fail();}
 if(['resume','fork','takeover.end'].includes(v.intent)&&v.state==='APPLIED'&&(v.targetBinding===null||v.checkpointId===null||v.admissionReceiptId===null||['resume','takeover.end'].includes(v.intent)&&v.retirementReceiptId===null))fail();
 return v;
}
export function assertWorkerControl(raw){
 const v=snapshot(raw);own(v,['controlId','action','binding','contextSha256'],['prompt','proposalId','proposalSha256','commandSha256','controlSequence','questionId','answers']);uuid(v.controlId);validateShape('RunBinding',v.binding);digest(v.contextSha256);
 if(v.action==='steer'){text(v.prompt);if(v.proposalId!==undefined||v.proposalSha256!==undefined||v.questionId!==undefined||v.answers!==undefined)fail();}
 else if(['pause','takeover.begin'].includes(v.action)){if(v.prompt!==undefined||v.proposalId!==undefined||v.proposalSha256!==undefined||v.questionId!==undefined||v.answers!==undefined)fail();}
 else if(v.action==='waitForApproval'){if(v.prompt!==undefined||v.questionId!==undefined||v.answers!==undefined)fail();uuid(v.proposalId);digest(v.proposalSha256);}
 // A clarifying answer is delivered while the SDK callback is suspended; it is not a pause and carries no prompt.
 else if(v.action==='answerQuestion'){if(v.prompt!==undefined||v.proposalId!==undefined||v.proposalSha256!==undefined)fail();uuid(v.questionId);answers(v.answers);}
 else fail();
 if(v.commandSha256!==undefined)digest(v.commandSha256);if(v.controlSequence!==undefined&&(!Number.isSafeInteger(v.controlSequence)||v.controlSequence<1))fail();return v;
}
export function assertContinuationEnvelope(raw){
 const v=snapshot(raw);
 if(v.kind==='native-session'){
  own(v,['kind','mode','controlId','sdkSession','versions','scopes','sourceRequestSha256','contextSha256','targetSessionId'],['files']);
  if(v.files!==undefined)assertNativeFileState(v.files,{binding:v.sdkSession.binding,scopes:v.scopes});
  if(!['resume','fork'].includes(v.mode))fail();uuid(v.controlId);assertNativeSessionReference(v.sdkSession);validateShape('RuntimeVersions',v.versions);
  if(!Array.isArray(v.scopes)||!v.scopes.length||v.scopes.length>100||new Set(v.scopes.map(canonicalSha256)).size!==v.scopes.length)fail();
  for(const scope of v.scopes){validateShape('Scope',scope);if(scope.tenantId!==v.sdkSession.binding.tenantId)fail();}
  digest(v.sourceRequestSha256);digest(v.contextSha256);
  if(v.mode==='resume'){if(v.targetSessionId!==null)fail();}else {uuid(v.targetSessionId);if(v.targetSessionId===v.sdkSession.key.sessionId)fail();}
  return v;
 }
 own(v,['mode','controlId','checkpoint','checkpointSha256','sourceRequestSha256','contextSha256','resumeSessionAt','targetSessionId']);if(!['resume','fork'].includes(v.mode))fail();uuid(v.controlId);validateShape('Checkpoint',v.checkpoint);digest(v.checkpointSha256);digest(v.sourceRequestSha256);digest(v.contextSha256);
 if(canonicalSha256(v.checkpoint)!==v.checkpointSha256)fail();for(const k of ['resumeSessionAt','targetSessionId'])if(v[k]!==null)uuid(v[k]);if(v.mode==='resume'&&v.targetSessionId!==null)fail();return v;
}

export const assertCheckpointInspectionRequest=raw=>assertLifecycleShape('ConversationCheckpointInspectionRequest',snapshot(raw));
export const assertCheckpointInspectionReceipt=raw=>assertLifecycleShape('ConversationCheckpointInspectionReceipt',snapshot(raw));

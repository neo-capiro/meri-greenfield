/** Private additive lifecycle boundary. Existing public0.1.3 is unchanged. */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {data,own} from '../commands-0.2/execution-boundary.mjs';
const fail=()=>{throw Object.assign(new Error('LIFECYCLE_INPUT_REFUSED'),{code:'LIFECYCLE_INPUT_REFUSED'});};
const uuid=value=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value))fail();};
const digest=value=>{if(typeof value!=='string'||!/^[a-f0-9]{64}$/u.test(value))fail();};
function snapshot(raw){const value=data(raw);if(Buffer.byteLength(JSON.stringify(value))>131072)fail();return value;}
function text(value){if(typeof value!=='string'||!value.trim()||value.length>100000||!value.isWellFormed()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))fail();}
export function assertLifecycleCommand(raw){
 const v=snapshot(raw);uuid(v.controlId);
 if(v.intent==='steer'){own(v,['controlId','intent','text']);text(v.text);}
 else if(v.intent==='pause')own(v,['controlId','intent']);
 else if(v.intent==='approval.wait'){own(v,['controlId','intent','proposalId']);uuid(v.proposalId);}
 else if(['resume','fork'].includes(v.intent)){own(v,['controlId','intent','checkpointId','checkpointSha256']);uuid(v.checkpointId);digest(v.checkpointSha256);}
 else fail();return v;
}
export function assertLifecycleReceipt(raw){
 const v=snapshot(raw);own(v,['controlId','intent','sourceBinding','inputSha256','state','checkpointId','targetBinding','admissionReceiptId','retirementReceiptId','replayed']);uuid(v.controlId);validateShape('RunBinding',v.sourceBinding);digest(v.inputSha256);
 if(!['steer','pause','approval.wait','resume','fork'].includes(v.intent)||!['PENDING','DISPATCHING','APPLIED','UNKNOWN'].includes(v.state)||typeof v.replayed!=='boolean')fail();
 for(const k of ['checkpointId','admissionReceiptId','retirementReceiptId'])if(v[k]!==null)uuid(v[k]);
 if(v.targetBinding!==null){validateShape('RunBinding',v.targetBinding);if(!['resume','fork'].includes(v.intent)||v.targetBinding.tenantId!==v.sourceBinding.tenantId||v.targetBinding.actorId!==v.sourceBinding.actorId||v.targetBinding.runId===v.sourceBinding.runId||v.targetBinding.attemptId===v.sourceBinding.attemptId||v.targetBinding.workerId===v.sourceBinding.workerId)fail();if(v.intent==='resume'&&(v.targetBinding.conversationId!==v.sourceBinding.conversationId||v.targetBinding.writerFence<=v.sourceBinding.writerFence)||v.intent==='fork'&&v.targetBinding.conversationId===v.sourceBinding.conversationId)fail();}
 if(['resume','fork'].includes(v.intent)&&v.state==='APPLIED'&&(v.targetBinding===null||v.checkpointId===null||v.admissionReceiptId===null||v.intent==='resume'&&v.retirementReceiptId===null))fail();
 return v;
}
export function assertWorkerControl(raw){
 const v=snapshot(raw);own(v,['controlId','action','binding','contextSha256'],['prompt','proposalId','proposalSha256','commandSha256','controlSequence']);uuid(v.controlId);validateShape('RunBinding',v.binding);digest(v.contextSha256);
 if(v.action==='steer'){text(v.prompt);if(v.proposalId!==undefined||v.proposalSha256!==undefined)fail();}
 else if(v.action==='pause'){if(v.prompt!==undefined||v.proposalId!==undefined||v.proposalSha256!==undefined)fail();}
 else if(v.action==='waitForApproval'){if(v.prompt!==undefined)fail();uuid(v.proposalId);digest(v.proposalSha256);}
 else fail();
 if(v.commandSha256!==undefined)digest(v.commandSha256);if(v.controlSequence!==undefined&&(!Number.isSafeInteger(v.controlSequence)||v.controlSequence<1))fail();return v;
}
export function assertContinuationEnvelope(raw){
 const v=snapshot(raw);own(v,['mode','controlId','checkpoint','checkpointSha256','sourceRequestSha256','contextSha256','resumeSessionAt','targetSessionId']);if(!['resume','fork'].includes(v.mode))fail();uuid(v.controlId);validateShape('Checkpoint',v.checkpoint);digest(v.checkpointSha256);digest(v.sourceRequestSha256);digest(v.contextSha256);
 if(canonicalSha256(v.checkpoint)!==v.checkpointSha256)fail();for(const k of ['resumeSessionAt','targetSessionId'])if(v[k]!==null)uuid(v[k]);if(v.mode==='resume'&&v.targetSessionId!==null)fail();return v;
}

// @ts-check
/** Private durable rules for a child (SDK subagent) assignment on the existing run owner.
 *
 * A child assignment is persisted through the run row's own transaction BEFORE the SDK Agent call is admitted, and the
 * child result receipt is persisted BEFORE the hook acknowledges the child to the parent. Both receipts are append-only,
 * keyed by the SDK's own tool-use identity, and pinned to the run's objective revision plus the last applied steer
 * control at write time, so a stale goal revision or a revoked authority can never publish a child result.
 *
 * This module owns the rules only: `journal.mjs` owns the transaction, `service.mjs` the authenticated operation,
 * `worker-owner.mjs` the trusted worker port, and `migrations/0030_child_assignments.sql` the SQL-side append guard.
 * The receipts carry no child content: the SDK result is bound by digest, and content custody stays with the SDK session
 * and conversation workspace owners. */
import {createHash} from 'node:crypto';
import {hash,fail,own,validateShape} from '../boundary.mjs';
export const CHILD_ASSIGNMENT_LIMIT=64;
export const CHILD_RESULT_MAX_BYTES=1048576;
export const CHILD_DISPATCH_OPERATION='child-dispatch',CHILD_SETTLE_OPERATION='child-settle';
const IDENTIFIER=/^[a-zA-Z0-9][a-zA-Z0-9_:\-./]{0,199}$/u,DIGEST=/^[a-f0-9]{64}$/u,OUTCOMES=Object.freeze(['completed','failed']);
/** RFC 9562 version 8 layout over a domain-separated SHA-256 (the run-start/occurrence construction, distinct domain). */
export function childAssignmentId(binding,toolUseId){
 const h=createHash('sha256').update(`meri.conversation.child-assignment.v1\0${hash(binding)}\0${toolUseId}`).digest('hex');
 const variant=((Number.parseInt(h[16],16)&3)|8).toString(16);
 return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-${variant}${h.slice(17,20)}-${h.slice(20,32)}`;
}
/** The private request body of the two worker-facing child operations, validated like every other run-owner operation. */
export function assertChildOperationRequest(operation,value){
 const body=own(value,['binding','input']);validateShape('RunBinding',body.binding);
 return {binding:body.binding,input:operation===CHILD_DISPATCH_OPERATION?assertChildDispatchRequest(body.input):assertChildSettleRequest(body.input)};
}
/** The hook's assignment request: the SDK tool-use identity, the admitted role, the delegated input digest and the exact
 * narrowing that was admitted. Malformed input is refused, never repaired. */
export function assertChildDispatchRequest(value){
 const i=own(value,['toolUseId','role','inputSha256','narrowing']),n=own(i.narrowing,['tools','maxTurns','disallowedTools']);
 if(!IDENTIFIER.test(i.toolUseId)||!IDENTIFIER.test(i.role)||!DIGEST.test(i.inputSha256)
  ||!Array.isArray(n.tools)||n.tools.length>64||!n.tools.every(tool=>IDENTIFIER.test(tool))
  ||!Array.isArray(n.disallowedTools)||n.disallowedTools.length>64||!n.disallowedTools.every(tool=>IDENTIFIER.test(tool))
  ||!Number.isSafeInteger(n.maxTurns)||n.maxTurns<1||n.maxTurns>128)fail('CHILD_ASSIGNMENT_REFUSED');
 return {toolUseId:i.toolUseId,role:i.role,inputSha256:i.inputSha256,narrowing:{tools:[...n.tools],maxTurns:n.maxTurns,disallowedTools:[...n.disallowedTools]}};
}
/** The hook's result request: the SDK result bound by digest and size, plus the SDK's own session/agent identity.
 * The canonical wire form carries the hook's flat sessionId/agentId; the normalized form carries the persisted
 * custody object. Both are accepted here so the service operation and the durable run owner share exactly one request
 * shape, and the normalizer is idempotent over its own output. A caller supplying both forms at once is refused. */
export function assertChildSettleRequest(value){
 const i=own(value,['toolUseId','outcome','resultSha256','resultBytes'],['sessionId','agentId','custody']);
 if(i.custody!==undefined&&(i.sessionId!==undefined||i.agentId!==undefined))fail('CHILD_RESULT_REFUSED');
 const custody=i.custody===undefined?{sessionId:i.sessionId??null,agentId:i.agentId??null}:own(i.custody,['sessionId','agentId']);
 if(!IDENTIFIER.test(i.toolUseId)||!OUTCOMES.includes(i.outcome)||!DIGEST.test(i.resultSha256)
  ||!Number.isSafeInteger(i.resultBytes)||i.resultBytes<0||i.resultBytes>CHILD_RESULT_MAX_BYTES
  ||custody.sessionId!==null&&!IDENTIFIER.test(custody.sessionId)||custody.agentId!==null&&!IDENTIFIER.test(custody.agentId))fail('CHILD_RESULT_REFUSED');
 return {toolUseId:i.toolUseId,outcome:i.outcome,resultSha256:i.resultSha256,resultBytes:i.resultBytes,custody:{sessionId:custody.sessionId,agentId:custody.agentId}};
}
/** The persisted goal revision of one child receipt: the run's own request revision and the last applied steer control. */
function assertRevision(value){
 const r=own(value,['requestSha256','steer']);
 if(!DIGEST.test(r.requestSha256)||r.steer!==null&&(typeof r.steer!=='object'||!r.steer))fail('STORE_CORRUPT');
 if(r.steer===null)return {requestSha256:r.requestSha256,steer:null};
 const s=own(r.steer,['controlId','inputSha256','controlSequence']);
 if(!IDENTIFIER.test(s.controlId)||!DIGEST.test(s.inputSha256)||!Number.isSafeInteger(s.controlSequence)||s.controlSequence<1)fail('STORE_CORRUPT');
 return {requestSha256:r.requestSha256,steer:{controlId:s.controlId,inputSha256:s.inputSha256,controlSequence:s.controlSequence}};
}
const SHAPES=Object.freeze({
 assignment:['kind','assignmentId','toolUseId','role','inputSha256','narrowing','revision','dispatchedAtMs'],
 result:['kind','assignmentId','toolUseId','outcome','resultSha256','resultBytes','custody','revision','settledAtMs']});
/** One persisted receipt, decoded strictly: an unknown key, a missing field or a malformed identity is store corruption. */
export function assertChildReceipt(value){
 const kind=value&&typeof value==='object'&&!Array.isArray(value)?value.kind:undefined,shape=SHAPES[/** @type {'assignment'|'result'} */(kind)];
 if(!shape)fail('STORE_CORRUPT');
 let i;try{i=own(value,shape);}catch{fail('STORE_CORRUPT');}
 const assignmentId=assertRevision(i.revision),base=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(i.assignmentId);
 if(!base||!IDENTIFIER.test(i.toolUseId)||!Number.isSafeInteger(i[kind==='assignment'?'dispatchedAtMs':'settledAtMs']))fail('STORE_CORRUPT');
 if(kind==='assignment'){
  const n=own(i.narrowing,['tools','maxTurns','disallowedTools']);
  if(!IDENTIFIER.test(i.role)||!DIGEST.test(i.inputSha256)||!Array.isArray(n.tools)||n.tools.length>64||!n.tools.every(tool=>IDENTIFIER.test(tool))
   ||!Array.isArray(n.disallowedTools)||!n.disallowedTools.every(tool=>IDENTIFIER.test(tool))||!Number.isSafeInteger(n.maxTurns)||n.maxTurns<1)fail('STORE_CORRUPT');
  return Object.freeze({...i,revision:assignmentId,narrowing:Object.freeze({tools:Object.freeze([...n.tools]),maxTurns:n.maxTurns,disallowedTools:Object.freeze([...n.disallowedTools])})});
 }
 const custody=own(i.custody,['sessionId','agentId']);
 if(!OUTCOMES.includes(i.outcome)||!DIGEST.test(i.resultSha256)||!Number.isSafeInteger(i.resultBytes)||i.resultBytes<0||i.resultBytes>CHILD_RESULT_MAX_BYTES
  ||custody.sessionId!==null&&!IDENTIFIER.test(custody.sessionId)||custody.agentId!==null&&!IDENTIFIER.test(custody.agentId))fail('STORE_CORRUPT');
 return Object.freeze({...i,revision:assignmentId,custody:Object.freeze({sessionId:custody.sessionId,agentId:custody.agentId})});
}
/** The run row's persisted child assignments: absent means none, and any digest mismatch, duplicate tool-use id, orphan
 * result or malformed receipt is store corruption rather than a repaired record. */
export function readChildAssignments(row){
 const value=row?.child_assignments,digest=row?.child_assignments_sha256;
 if(value===null||value===undefined){if(digest!==null&&digest!==undefined)fail('STORE_CORRUPT');return Object.freeze([]);}
 if(!Array.isArray(value)||!value.length||value.length>CHILD_ASSIGNMENT_LIMIT||typeof digest!=='string'||!DIGEST.test(digest)||hash(value)!==digest)fail('STORE_CORRUPT');
 const assignments=new Map(),seen=new Set(),record=[];
 for(const raw of value){
  const receipt=assertChildReceipt(raw),marker=`${receipt.kind}:${receipt.toolUseId}`;
  if(seen.has(marker))fail('STORE_CORRUPT');seen.add(marker);
  if(receipt.kind==='assignment')assignments.set(receipt.toolUseId,receipt.assignmentId);
  else if(assignments.get(receipt.toolUseId)!==receipt.assignmentId)fail('STORE_CORRUPT');
  record.push(receipt);
 }
 return Object.freeze(record);
}
/** The two port answers are closed shapes: the worker sees identity, revision and custody, never a second child. */
export const childAssignmentView=receipt=>Object.freeze({assignmentId:receipt.assignmentId,toolUseId:receipt.toolUseId,role:receipt.role,revision:receipt.revision,dispatchedAtMs:receipt.dispatchedAtMs});
export const childResultView=receipt=>Object.freeze({assignmentId:receipt.assignmentId,toolUseId:receipt.toolUseId,outcome:receipt.outcome,resultSha256:receipt.resultSha256,resultBytes:receipt.resultBytes,custody:receipt.custody,revision:receipt.revision,settledAtMs:receipt.settledAtMs});

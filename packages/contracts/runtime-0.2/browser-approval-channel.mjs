/** Closed wire for Core's browser-approval routes (Core04 contract, unchanged).
 *
 * One permissive discriminant only: a fresh `meri-browser-approval-receipt/1` returned by consume.
 * Every other Core answer is `meri-browser-approval-status/1`, which is non-permissive by schema and is
 * how a repeat/restart/lost-ACK consume and every status/result answer must be read.
 */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {own,data} from '../commands-0.2/execution-boundary.mjs';

export const BROWSER_APPROVAL_RECEIPT_SCHEMA='meri-browser-approval-receipt/1';
export const BROWSER_APPROVAL_STATUS_SCHEMA='meri-browser-approval-status/1';
export const CORE_BROWSER_APPROVAL_ROUTES=Object.freeze({
 record:'/api/clio/approvals/native/browser/record',
 consume:'/api/clio/approvals/native/browser/consume',
 status:'/api/clio/approvals/native/browser/status',
 result:'/api/clio/approvals/native/browser/result'});
const HEX=/^[0-9a-f]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const fail=code=>{throw Object.assign(Error(code),{code});};
const deny=()=>fail('BROWSER_APPROVAL_REFUSED');
const hex=value=>{if(typeof value!=='string'||!HEX.test(value))deny();return value;};
const id=value=>{if(typeof value!=='string'||!UUID.test(value))deny();return value;};
const bindingOf=value=>{try{validateShape('RunBinding',data(value));}catch{deny();}return data(value);};

/** Exactly the Core04 request bodies; no field the contract does not name is ever sent. */
export function recordBody({proposalId,subjectSha256,decision,approver,binding}){
 if(!['approved','rejected'].includes(decision))deny();
 const a=data(own(approver,['tenantId','actorId'])),b=bindingOf(binding);
 if(a.tenantId!==b.tenantId||a.actorId!==b.actorId)deny();
 return Object.freeze({proposalId:id(proposalId),subjectSha256:hex(subjectSha256),decision,approver:a,binding:b});
}
export function decideBody({proposalId,subjectSha256,binding}){
 return Object.freeze({proposalId:id(proposalId),subjectSha256:hex(subjectSha256),binding:bindingOf(binding)});
}
export function resultBody({proposalId,subjectSha256,binding,outcome,result}){
 if(!['ok','error'].includes(outcome))deny();
 if(!result||typeof result!=='object'||Array.isArray(result))deny();
 return Object.freeze({proposalId:id(proposalId),subjectSha256:hex(subjectSha256),binding:bindingOf(binding),
  outcome,result:data(result)});
}

/** A fresh CLAIMED insert: the ONLY permissive answer. */
export function assertBrowserApprovalReceipt(raw){
 const r=own(raw,['schema','subjectSha256','proposalId','toolUseId','decision','consumption']);
 if(r.schema!==BROWSER_APPROVAL_RECEIPT_SCHEMA)deny();
 const c=own(r.consumption,['consumed','consumptionId','consumedAtMs']);
 if(c.consumed!==true||!UUID.test(c.consumptionId)||!Number.isSafeInteger(c.consumedAtMs))deny();
 return Object.freeze({schema:BROWSER_APPROVAL_RECEIPT_SCHEMA,subjectSha256:hex(r.subjectSha256),
  proposalId:id(r.proposalId),toolUseId:r.toolUseId,decision:r.decision,consumption:Object.freeze({...c})});
}
/** Every non-permissive Core answer. `permissive` must be false; a receipt-shaped body is never a status. */
export function assertBrowserApprovalStatus(raw){
 const r=own(raw,['schema','proposalId','subjectSha256','toolUseId','permissive','unknown','consumption'],
  ['decision','revoked']);
 if(r.schema!==BROWSER_APPROVAL_STATUS_SCHEMA||r.permissive!==false)deny();
 if(typeof r.unknown!=='boolean')deny();
 // Core returns consumption:null for a valid status BEFORE any consumption; otherwise the exact
 // state/time/result record. Either is non-permissive.
 const c=r.consumption===null?null:data(r.consumption);
 if(c!==null&&(typeof c!=='object'||Array.isArray(c)))deny();
 return Object.freeze({...r,proposalId:id(r.proposalId),subjectSha256:hex(r.subjectSha256),consumption:c});
}
/** True only for an exact current permission: fresh receipt/1 for THIS proposal and subject. */
export function browserApprovalPermitted(receipt,{proposalId,subjectSha256}){
 try{const r=assertBrowserApprovalReceipt(receipt);
  return r.proposalId===proposalId&&r.subjectSha256===subjectSha256;}catch{return false;}
}
export const subjectDigest=subject=>canonicalSha256(data(subject));

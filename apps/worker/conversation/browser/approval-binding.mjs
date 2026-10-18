/** Binding of a browser consequential-action approval to the canonical approval owner. This module decides nothing on
 * its own: it states exactly what an approval must authorize and correlates the owner's answer with it.
 *
 * - The approval SUBJECT is everything one approval authorizes: the full run binding (tenant, actor, conversation,
 *   run, attempt, worker, writer fence), the MCP server and tool, the tool-use id, the canonical SHA-256 of the exact
 *   input that will run, the origin of the page it acts on and the digest of the effective browser policy. Its
 *   canonical digest, `subjectSha256`, takes the place of `commandSha256` in the canonical `ApprovalDecision`
 *   (packages/contracts meri.schema.json), so the owner's existing proposal/decision semantics apply unchanged.
 * - The canonical owner, behind `approvals.decide(request,{signal})`, authenticates the approver, records the
 *   proposal, presents it, checks current (unrevoked, unexpired) authority and consumes the decision once, then
 *   returns a receipt. Durable one-time consumption, revocation and approver authentication are the owner's; the
 *   owner does not yet have a browser subject or a consume operation (proposal in the lane report).
 * - `receiptRefusal` accepts only an `approved` canonical decision for this exact subject digest, proposal and
 *   tool-use, by an approver of the same tenant, decided after the request and still unexpired, with a consumption
 *   record. The local replay ledger lets one proposal, consumption or tool-use authorize at most one execution in
 *   this run; it is defence in depth, not the durable guarantee. */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
export const APPROVAL_REQUEST_SCHEMA='meri-browser-approval-request/3';
export const APPROVAL_SUBJECT_SCHEMA='meri-browser-action/1';
export const APPROVAL_RECEIPT_SCHEMA='meri-browser-approval-receipt/1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const MAX_LEDGER=1024;
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
/** @param {{binding:object,server:string,action:string,toolUseId:string,input:object,pageOrigin:string,policySha256:string}} facts */
export function approvalSubject({binding,server,action,toolUseId,input,pageOrigin,policySha256}){
 return Object.freeze({schema:APPROVAL_SUBJECT_SCHEMA,binding:structuredClone(binding),server,tool:action,toolUseId,inputSha256:canonicalSha256(input),pageOrigin,policySha256});
}
/** The request sent to the owner: the subject, its digest, a display copy of the input and the request window. */
export function approvalRequest({subject,input,requestedAtMs,expiresAtMs}){
 return {schema:APPROVAL_REQUEST_SCHEMA,subject:structuredClone(subject),subjectSha256:canonicalSha256(subject),input:structuredClone(input),requestedAtMs,expiresAtMs};
}
/** null when `receipt` authorizes exactly `request` at time `at`, otherwise the stable refusal code. `schema` and
 * `prefix` let another consequential-action subject (Bash, `capabilities/bash-approval.mjs`) reuse the same canonical
 * decision checks with its own receipt schema and refusal codes; the browser defaults are unchanged. */
export function receiptRefusal(receipt,request,at,{schema=APPROVAL_RECEIPT_SCHEMA,prefix='BROWSER'}={}){
 const code=reason=>`${prefix}_APPROVAL_${reason}`;
 if(!record(receipt)||receipt.schema!==schema||!record(receipt.decision))return code('DENIED');
 const d=receipt.decision;try{validateShape('ApprovalDecision',d);}catch{return code('DENIED');}
 if(d.decision!=='approved')return code('DENIED');
 const {subject,subjectSha256}=request;
 if(receipt.subjectSha256!==subjectSha256||d.commandSha256!==subjectSha256||receipt.proposalId!==d.proposalId||receipt.toolUseId!==subject.toolUseId||d.approver.tenantId!==subject.binding.tenantId)return code('MISMATCH');
 const decidedAtMs=Date.parse(d.decidedAt);
 if(decidedAtMs<request.requestedAtMs||decidedAtMs>at||Date.parse(d.expiresAt)<=at||request.expiresAtMs<at)return code('EXPIRED');
 const c=receipt.consumption;
 if(!record(c)||c.consumed!==true||typeof c.consumptionId!=='string'||!UUID.test(c.consumptionId)||!Number.isSafeInteger(c.consumedAtMs)||c.consumedAtMs<decidedAtMs||c.consumedAtMs>at)return code('UNCONSUMED');
 return null;
}
/** Run-local ledger: `claim(receipt)` is true once per proposal, consumption and tool-use id, false on any reuse. */
export function createReplayLedger(){
 const seen=new Set();
 return Object.freeze({claim(receipt){
  const keys=[`proposal:${receipt.proposalId.toLowerCase()}`,`consumption:${receipt.consumption.consumptionId}`,`tool:${receipt.toolUseId}`];
  if(keys.some(k=>seen.has(k))||seen.size+keys.length>MAX_LEDGER*3)return false;
  for(const k of keys)seen.add(k);return true;
 }});
}

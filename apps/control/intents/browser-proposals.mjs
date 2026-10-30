/** Derivation of the public browser-action proposal from an EXISTING retained preparation.
 *
 * The journal entry's outcome is the immutable preparation record the metadata owner acknowledged (see
 * browser-preparation-journal.mjs). Nothing here invents authority: the binding, scopes, approver, window and
 * digests are read from that record and re-validated. Only bounded, already-reviewed display context is
 * exposed — the tool name, the page origin/host, and the input/policy digests. Raw tool arguments, page
 * content, credentials and private browser state are never published.
 */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {BROWSER_ACTION,BROWSER_ACTION_OPERATION}
 from '../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';

const fail=(code,outcome)=>{throw Object.assign(Error(code),{code,...(outcome?{outcome}:{})});};
export const BROWSER_PREPARATION_OPERATION='browser_approval_preparation';
const RECORD_KEYS=['operation','action','binding','request','inputSha256','commandId','idempotencyKey','proposalId',
 'scopes','createdAt','expiresAt','requiredApprover','checkedAtMs','resolved'];

export const isBrowserPreparation=entry=>entry?.record?.operation?.id===BROWSER_PREPARATION_OPERATION;

export function browserDisposition(entry){
 if(!entry||entry.state!=='PREPARED')fail('INTENT_NOT_PREPARED','NOT_DISPATCHED');
 const result=entry.outcome?.result;
 if(!result||typeof result!=='object'||!result.record||!result.recordSha256||
  typeof result.proposalId!=='string'||typeof result.subjectSha256!=='string')fail('INTENT_NOT_PREPARABLE','NOT_DISPATCHED');
 return result;
}

/** One bounded display row. `origin` is parsed, so a malformed origin is a refusal, not a passthrough. */
function display(record){
 const s=data(record.request.subject);
 let origin;
 try{origin=new URL(s.pageOrigin).origin;}catch{fail('INTENT_NOT_PREPARABLE','NOT_DISPATCHED');}
 if(origin!==s.pageOrigin)fail('INTENT_NOT_PREPARABLE','NOT_DISPATCHED');
 return Object.freeze({tool:s.tool,pageOrigin:origin,server:s.server,inputSha256:s.inputSha256,
  policySha256:s.policySha256});
}

/** The public proposal for this preparation. Refuses anything that is not exactly this closed record. */
export function browserProposalFromEntry(entry){
 const result=browserDisposition(entry);
 let record;
 try{
  record=own(data(result.record),RECORD_KEYS);
  validateShape('RunBinding',data(record.binding));
 }catch(error){if(error?.code)throw error;fail('INTENT_JOURNAL_UNAVAILABLE');}
 if(record.action!==BROWSER_ACTION||
  canonicalSha256(data(record.operation))!==canonicalSha256(data(BROWSER_ACTION_OPERATION)))fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');
 if(canonicalSha256(record)!==result.recordSha256)fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');
 if(record.proposalId!==result.proposalId||record.request.subjectSha256!==result.subjectSha256)fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');
 return Object.freeze({kind:'browser_action',proposalId:record.proposalId,subjectSha256:record.request.subjectSha256,
  operation:Object.freeze({id:BROWSER_ACTION_OPERATION.id,version:BROWSER_ACTION_OPERATION.version}),
  binding:Object.freeze(data(record.binding)),display:display(record),
  requiredApprover:Object.freeze(data(record.requiredApprover)),
  scopes:Object.freeze(record.scopes.map(scope=>Object.freeze(data(scope)))),
  requestedAtMs:record.request.requestedAtMs,expiresAtMs:record.request.expiresAtMs,createdAt:record.createdAt});
}

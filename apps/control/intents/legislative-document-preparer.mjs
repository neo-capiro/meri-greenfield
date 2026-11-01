/** Prepare only over Core's existing action ledger; the intent journal owns delivery idempotency.
 * `prepare_legiwatch_briefing` is a write: Intel creates an editable private draft. Nothing is published,
 * sent or scheduled and no second approval/effect ledger exists. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {legislativeDocumentValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
export function createLegislativeDocumentPreparer({operation,binding,scopes,selectedClientId,client,currentRights,policyRevision,now,deadlineMs}){
 if(!validators.isAction(operation))throw intentFault('INVALID_ARGUMENTS');
 return Object.freeze({binding,owner:'legislative-document',operation:{id:operation,version:'0.2.0'},async prepare(raw){
  const {arguments:input,deliveryId,signal}=own(raw,['arguments','deliveryId'],['signal']);
  let request;try{request=validators.normalizeInput(operation,input);}catch{throw intentFault('INVALID_ARGUMENTS','none');}
  if(selectedClientId!==null&&(request.clientId??null)!==selectedClientId)throw intentFault('ACCESS_DENIED','none');
  // Before the owner call a refusal left nothing behind (FAILED, replayable); after it a draft may exist (UNKNOWN).
  const check=async effect=>{const rights=await currentRights({signal,policyRevision});if(hash(rights.scopes)!==hash(scopes)||rights.expiresAtMs<=now())throw intentFault('ACCESS_DENIED',effect);};
  await check('none');
  // Deterministic per delivery: a retry of the same delivery reuses this key instead of creating a second draft.
  const exact={...request,requestKey:'meri-legislative-document-'+hash({operation,binding,deliveryId})};
  const result=await client.prepare({binding,selectedClientId,operation,request:exact,signal,deadlineMs});
  await check('unknown');
  const {version,status,receipt,effect,...prepared}=result;
  const bound={kind:'legislative_document_action',binding,scopes,...prepared},proposal={...bound,commandSha256:hash(bound)};
  validators.assertProposal(proposal);
  if(status!=='proposed'||receipt!==null||effect!==null||Date.parse(proposal.expiresAt)<=now())throw intentFault('REFUSED','unknown');
  return data({status:'approval_required',proposal});
 }});
}

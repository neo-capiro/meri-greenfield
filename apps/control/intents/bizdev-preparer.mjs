/** Prepare only over Core's existing action ledger; the intent journal owns delivery idempotency. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {bizdevValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
export function createBizdevPreparer({binding,scopes,client,currentRights,policyRevision,now,deadlineMs}){
 return Object.freeze({binding,owner:'bizdev',operation:{id:'save_business_development_brief',version:'0.2.0'},async prepare(raw){
  const {arguments:input,deliveryId,signal}=own(raw,['arguments','deliveryId'],['signal']),request=validators.normalizeInput(input);
  // The edit may only name the prospect conversation this run is bound to; Core
  // re-resolves the persisted prospect scope itself and never trusts this check.
  if(request.conversationId!==binding.conversationId)throw intentFault('ACCESS_DENIED');
  const check=async()=>{const rights=await currentRights({signal,policyRevision});if(hash(rights.scopes)!==hash(scopes)||rights.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');};
  await check();
  const result=await client.prepare({binding,request:{...request,requestKey:'meri-bizdev-brief-'+hash({binding,deliveryId})},signal,deadlineMs});
  await check();
  const {version,status,receipt,...prepared}=result;
  const bound={kind:'bizdev_action',binding,scopes,operation:'save_business_development_brief',...prepared},proposal={...bound,commandSha256:hash(bound)};
  validators.assertProposal(proposal);if(status!=='proposed'||Date.parse(proposal.expiresAt)<=now())throw intentFault('REFUSED','unknown');
  return data({status:'approval_required',proposal});
 }});
}

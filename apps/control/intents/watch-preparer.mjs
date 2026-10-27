/** Prepare only over Core's existing action ledger; the intent journal owns delivery idempotency. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {watchValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
export function createWatchPreparer({binding,scopes,selectedClientId,client,currentRights,policyRevision,now,deadlineMs}){
 return Object.freeze({binding,owner:'watch',operation:{id:'watch_action',version:'0.2.0'},async prepare(raw){
  const {arguments:input,deliveryId,signal}=own(raw,['arguments','deliveryId'],['signal']),request=validators.normalizeInput(input);
  if(selectedClientId!==null&&request.clientId!==selectedClientId)throw intentFault('ACCESS_DENIED');
  const check=async()=>{const rights=await currentRights({signal,policyRevision});if(hash(rights.scopes)!==hash(scopes)||rights.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');};
  await check();
  // The model never supplies requestKey or authority: Core's canonical proposal
  // claim is derived here from this delivery, and re-checked after the owner call.
  const result=await client.prepare({binding,selectedClientId,request:{...request,requestKey:'meri-watch-'+hash({binding,deliveryId})},signal,deadlineMs});
  await check();
  const {version,status,receipt,...prepared}=result;
  const bound={kind:'watch_action',binding,scopes,operation:'watch_action',...prepared},proposal={...bound,commandSha256:hash(bound)};
  validators.assertProposal(proposal);if(status!=='proposed'||Date.parse(proposal.expiresAt)<=now())throw intentFault('REFUSED','unknown');
  return data({status:'approval_required',proposal});
 }});
}

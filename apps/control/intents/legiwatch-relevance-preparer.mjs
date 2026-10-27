/** Prepare a pending suggestion through the same canonical LegiWatch approval and current authority. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {legiwatchValidators,relevanceValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
export function createRelevancePreparer({binding,scopes,selectedClientId,client,currentRights,policyRevision,now,deadlineMs}){
 return Object.freeze({binding,owner:'legiwatch',operation:{id:'save_legiwatch_relevance',version:'0.2.0'},async prepare(raw){
  const {arguments:input,deliveryId,signal}=own(raw,['arguments','deliveryId'],['signal']),request=relevanceValidators.saveInput(input);
  if(selectedClientId!==null&&request.clientId!==selectedClientId)throw intentFault('ACCESS_DENIED');
  const check=async()=>{const rights=await currentRights({signal,policyRevision});if(hash(rights.scopes)!==hash(scopes)||rights.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');};
  await check();
  const result=await client.prepare({binding,selectedClientId,request:{...request,requestKey:'meri-relevance-'+hash({binding,deliveryId})},signal,deadlineMs});
  await check();
  const {version,status,receipt,...prepared}=result;
  const bound={kind:'legiwatch_action',binding,scopes,operation:'save_legiwatch_relevance',...prepared},proposal={...bound,commandSha256:hash(bound)};
  legiwatchValidators.assertProposal(proposal);if(status!=='proposed'||Date.parse(proposal.expiresAt)<=now())throw intentFault('REFUSED','unknown');
  return data({status:'approval_required',proposal});
 }});
}

/** MO-05 governed Research Portfolio actions: Core prepares the immutable action proposal; Meri's existing intent journal owns
 * only delivery custody and derives the one idempotent operation key from that delivery. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {researchActionValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {RESEARCH_ACTION_INTENTS} from '../../../packages/contracts/retrieval-0.2/research-portfolio-action-validation.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
export function createResearchActionPreparers({binding,scopes,selectedClientId,client,now,deadlineMs,currentRights,policyRevision}){
 return RESEARCH_ACTION_INTENTS.map(id=>Object.freeze({binding,owner:'research-action',operation:{id,version:'0.2.0'},async prepare(raw){
  const {arguments:request,deliveryId,signal}=own(raw,['arguments','deliveryId'],['signal']);
  // Refusals before the owner call leave no effect: the delivery settles FAILED with the exact code instead of UNKNOWN.
  let input;try{input=validators.normalizeInput(id,request,{binding});}catch{throw intentFault('INVALID_ARGUMENTS','none');}
  if(id==='save_research_portfolio_output_to_client'&&selectedClientId!==null&&input.clientId!==selectedClientId)throw intentFault('ACCESS_DENIED','none');
  const check=async effect=>{const r=await currentRights({signal,policyRevision});if(hash(r.scopes)!==hash(scopes)||r.expiresAtMs<=now())throw intentFault('ACCESS_DENIED',effect);};
  await check('none');
  const result=await client.prepare({binding,selectedClientId,operation:id,request:input,operationKey:'meri-rp-'+hash({binding,deliveryId}),signal,deadlineMs});
  await check();
  const bound={kind:'research_action',binding,scopes,operation:id,...result},proposal={...bound,commandSha256:hash(bound)};
  validators.assertProposal(proposal);if(Date.parse(proposal.expiresAt)<=now())throw intentFault('REFUSED');return data({status:'approval_required',proposal});
 }}));
}

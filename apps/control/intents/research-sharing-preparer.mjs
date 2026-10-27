/** Core prepares the immutable action; Meri's existing intent journal owns only delivery custody. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {researchShareValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {RESEARCH_SHARE_INTENTS} from '../../../packages/contracts/retrieval-0.2/research-portfolio-sharing-validation.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
export function createResearchSharingPreparers({binding,scopes,selectedClientId,client,now,deadlineMs,currentRights,policyRevision}){
 return RESEARCH_SHARE_INTENTS.map(id=>Object.freeze({binding,owner:'research-sharing',operation:{id,version:'0.2.0'},async prepare(raw){
  const {arguments:request,deliveryId,signal}=own(raw,['arguments','deliveryId'],['signal']);
  validators.normalizeInput(id,request,{binding});
  const check=async()=>{const r=await currentRights({signal,policyRevision});if(hash(r.scopes)!==hash(scopes)||r.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');};
  await check();
  const result=await client.prepare({binding,selectedClientId,operation:id,request,operationKey:'meri-share-'+hash({binding,deliveryId}),signal,deadlineMs});
  await check();
  const bound={kind:'research_share',binding,scopes,operation:id,...result},proposal={...bound,commandSha256:hash(bound)};
  validators.assertProposal(proposal);if(Date.parse(proposal.expiresAt)<=now())throw intentFault('REFUSED');return data({status:'approval_required',proposal});
 }}));
}

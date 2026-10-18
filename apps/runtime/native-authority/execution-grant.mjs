/** Dot item 5: the budget grant identity of one verified execution capability, bound through the EXISTING grant owner of the
 * run's allocation (`createPostgresBudgetExecution(...).bindTrustedGrant`, product namespace). Inert; no SQL here.
 *
 * Facts (`parseToolGrantFacts` shape, immutable per grant id):
 *   grantId              = capabilityId (= jti)
 *   binding              = the executor RunBinding the token carries, which must equal the admitted run's binding exactly
 *   qualificationBinding = {runId, attempt (numeric), workerArn (actual ECS task ARN), fence, policyRevision} copied from the run's
 *                          admitted grant set on the SAME allocation; the token's UUID attempt/worker ids never substitute for it
 *   capabilitySha256     = SHA-256 of the exact compact token bytes
 *   allocationSha256     = SHA-256 of the admitted allocation
 * `bindExecutionGrant` calls `bindTrustedGrant`, which requires an already ACTIVE `grants` row with these facts; it neither
 * creates nor activates one. The run's task/model grants are never reused: a capability whose id or digest collides with one
 * is refused before any SQL. With no ACTIVE row the bind refuses `EXECUTION_GRANT_UNAVAILABLE` and nothing executes. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {parseToolGrantFacts} from '../../gateway/budget/tool-budget-binding.mjs';
import {executionFault} from './execution-capability.mjs';
/** The invocation id `bindTrustedGrant` parses with the facts; it names the admission, never an invocation. */
export const EXECUTION_GRANT_ADMISSION='execution-capability-admission';
const refuse=()=>{throw executionFault('EXECUTION_GRANT_REFUSED');};
/** `admitted` = `{allocationJson, grantFactsJsons}` of the run (the allocation record's admitted grant set). */
export function executionGrantFacts({verified,admitted}){
 let set;try{set=parseAdmittedGrantSet(own(admitted,['allocationJson','grantFactsJsons']));}catch{return refuse();}
 const first=set.facts[0],q=first.qualificationBinding,claims=verified?.claims;
 if(!claims||hash(first.binding)!==hash(claims.binding)||q.policyRevision!==claims.policyRevision||q.runId!==claims.binding.runId||q.fence!==claims.binding.writerFence||
  set.facts.some(f=>f.grantId===claims.capabilityId||f.capabilitySha256===verified.credentialSha256))refuse();
 const facts={grantId:claims.capabilityId,binding:claims.binding,qualificationBinding:{runId:q.runId,attempt:q.attempt,workerArn:q.workerArn,fence:q.fence,policyRevision:q.policyRevision},
  capabilitySha256:verified.credentialSha256,allocationSha256:hash(set.allocation)};
 try{parseToolGrantFacts(JSON.stringify(facts),set.allocation);}catch{return refuse();}
 return data(facts);
}
export async function bindExecutionGrant({bindTrustedGrant,facts,check}){
 if(typeof bindTrustedGrant!=='function'||typeof check!=='function')refuse();
 try{await bindTrustedGrant(JSON.stringify({...facts,invocationId:EXECUTION_GRANT_ADMISSION}),check);}
 catch{throw executionFault('EXECUTION_GRANT_UNAVAILABLE');}
}

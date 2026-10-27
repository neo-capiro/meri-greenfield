/** Existing journal delivery ownership; Core retains current access, policy and execution. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {clientRecordValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
export function createClientRecordPreparer({operation,binding,scopes,selectedClientId,client,currentRights,policyRevision,now,deadlineMs}){
 if(!['create_client','update_client_profile'].includes(operation))throw intentFault('INTENT_CONFIGURATION');
 return Object.freeze({binding,owner:'client-record',operation:{id:operation,version:'0.2.0'},async prepare(raw){
  const {arguments:input,signal}=own(raw,['arguments','deliveryId'],['signal']),request={operation,input:validators.normalizeInput(operation,input)};
  if(hash(input)!==hash(request.input))throw intentFault('INVALID_ARGUMENTS');
  if(operation==='update_client_profile'&&selectedClientId!==null&&request.input.clientId!==selectedClientId)throw intentFault('ACCESS_DENIED');
  const check=async()=>{const rights=await currentRights({signal,policyRevision});if(hash(rights.scopes)!==hash(scopes)||rights.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');};
  await check();const result=await client.prepare({binding,selectedClientId,request,signal,deadlineMs});await check();
  const {version,status,receipt,...prepared}=result;
  const bound={kind:'client_record_action',binding,scopes,operation,...prepared},proposal={...bound,commandSha256:hash(bound)};
  validators.assertProposal(proposal);if(status!=='proposed'||Date.parse(proposal.expiresAt)<=now())throw intentFault('REFUSED','unknown');
  return data({status:'approval_required',proposal});
 }});
}

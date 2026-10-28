/** Existing journal delivery ownership; Core retains current access, policy and execution. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {clientRecordValidators as validators} from '../../../packages/contracts/retrieval-0.3/client-record-action-validation.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
// The advertised version each operation is prepared at. `create_client` crossed to the 0.3 client-record
// input, which carries the partial per-field create provenance and the negotiated preflight;
// `update_client_profile`'s interface is unchanged and stays on 0.2.0. A stored 0.2.0 reference still
// resolves to the 0.2 descriptor and validator group through the catalog.
const OPERATION_VERSION=Object.freeze({create_client:'0.3.0',update_client_profile:'0.2.0'});
export function createClientRecordPreparer({operation,binding,scopes,selectedClientId,client,currentRights,policyRevision,now,deadlineMs}){
 if(!Object.hasOwn(OPERATION_VERSION,operation))throw intentFault('INTENT_CONFIGURATION');
 return Object.freeze({binding,owner:'client-record',operation:{id:operation,version:OPERATION_VERSION[operation]},async prepare(raw){
  const {arguments:input,signal}=own(raw,['arguments','deliveryId'],['signal']),request={operation,input:validators.normalizeInput(operation,input)};
  if(hash(input)!==hash(request.input))throw intentFault('INVALID_ARGUMENTS');
  if(operation==='update_client_profile'&&selectedClientId!==null&&request.input.clientId!==selectedClientId)throw intentFault('ACCESS_DENIED');
  const check=async()=>{const rights=await currentRights({signal,policyRevision});if(hash(rights.scopes)!==hash(scopes)||rights.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');};
  await check();const result=await client.prepare({binding,selectedClientId,request,signal,deadlineMs});await check();
  // `preflight` is current preparation evidence, never part of the immutable command: keeping it out of `bound`
  // leaves commandSha256 exactly as it was, so the same request still yields one proposal and one retained id,
  // and review reads the live preflight through the Core client instead of a prepare-time snapshot.
  const {version,status,receipt,preflight,...prepared}=result;
  const bound={kind:'client_record_action',binding,scopes,operation,...prepared},proposal={...bound,commandSha256:hash(bound)};
  validators.assertProposal(proposal);if(status!=='proposed'||Date.parse(proposal.expiresAt)<=now())throw intentFault('REFUSED','unknown');
  return data({status:'approval_required',proposal});
 }});
}

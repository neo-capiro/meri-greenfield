/** Raw mode-read selectors only; current tenant mode and grants belong to CONTROL. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
export const PUBLIC_DATA_MODE_OPERATION_IDS=Object.freeze(['search_federal_grants','search_federal_awards']);

export function assertPublicDataModeRequest(operation,request){
 try{
  const reference=ownFields(frozenData(operation),['id','version']);
  if(reference.version!=='0.2.0'||!PUBLIC_DATA_MODE_OPERATION_IDS.includes(reference.id))deny('INVALID_ARGUMENTS');
  const contract=resolveOperationContract(reference),raw=frozenData(request);
  if(contract.binding.group!=='public-data')deny('INVALID_ARGUMENTS');
  validateShape(contract.binding.input,raw);return raw;
 }catch{deny('INVALID_ARGUMENTS');}
}

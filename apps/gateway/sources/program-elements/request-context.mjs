/** Raw program-element selectors only; no mode selection or native business projections. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
export const PROGRAM_ELEMENT_OPERATION_IDS=Object.freeze(['search_program_elements','get_program_element','get_pe_budget_timeline']);

export function assertProgramElementRequest(operation,request){
 try{
  const reference=ownFields(frozenData(operation),['id','version']);
  if(reference.version!=='0.2.0'||!PROGRAM_ELEMENT_OPERATION_IDS.includes(reference.id))deny('INVALID_ARGUMENTS');
  const contract=resolveOperationContract(reference),raw=frozenData(request);
  if(contract.binding.group!=='program-elements')deny('INVALID_ARGUMENTS');
  validateShape(contract.binding.input,raw);return raw;
 }catch{deny('INVALID_ARGUMENTS');}
}

/** Pure full-family admission. The historical export name does not restrict native resolution branches. */
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData} from '../source-admission.mjs';

export function assertStoredStateRequest(operation,request){
 let contract;try{contract=resolveOperationContract(operation);}catch{deny('GATEWAY_CONFIGURATION');}
 if(contract.binding.group!=='state-status-votes')deny('GATEWAY_CONFIGURATION');
 let raw;
 try{raw=frozenData(request);contract.normalizeInput(raw,{});}
 catch{deny('INVALID_ARGUMENTS');}
 return raw;
}

/** Pure shared admission: stored canonical keys and the floor-vote route's no-bill branch only. */
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData} from '../source-admission.mjs';

export function assertStoredStateRequest(operation,request){
 let contract;try{contract=resolveOperationContract(operation);}catch{deny('GATEWAY_CONFIGURATION');}
 if(contract.binding.group!=='state-status-votes')deny('GATEWAY_CONFIGURATION');
 let raw,selector;
 try{raw=frozenData(request);selector=contract.normalizeInput(raw,{}).metadata.selector;}
 catch{deny('INVALID_ARGUMENTS');}
 if(selector.kind!=='canonical'&&!(operation.id==='search_state_floor_votes'&&selector.kind==='missing'))deny('UNAVAILABLE');
 return raw;
}

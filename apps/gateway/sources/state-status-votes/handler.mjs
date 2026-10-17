/** PARTIAL_INPUT: canonical stored keys only; designation resolution may reserve quota, fetch and write. */
import {inspectStateBillSelector} from '../../../../packages/contracts/retrieval-0.2/state-bill-identity.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';

const ROUTES=Object.freeze({
 get_state_bill_status:'/api/clio/tools/get_state_bill_status',
 search_state_floor_votes:'/api/clio/tools/search_state_floor_votes',
});
function storedRequest(current){
 if(inspectStateBillSelector(current.input.billId??null,current.input.state??null).kind!=='canonical')deny('UNAVAILABLE');
 return current.request;
}
export const createStateStatusVotesHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'state-status-votes',routes:ROUTES,requestBody:storedRequest});

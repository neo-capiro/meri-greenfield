/** Five distinct stored native market projections; forecasts retain global query semantics.
 * Contract-award pages are additionally held to the full award-identity rule: rows are distinct by their source row
 * id, a shared PIID never collapses two awards and a numeric or short PIID is never refused. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {assertAwardRowsDistinct} from './award-identity.mjs';
const routes=Object.freeze({
 search_federal_contract_awards:'/api/clio/tools/search_federal_contract_awards',
 search_federal_subawards:'/api/clio/tools/search_federal_subawards',
 search_contract_vehicles:'/api/clio/tools/search_contract_vehicles',
 search_procurement_forecasts:'/api/clio/tools/search_procurement_forecasts',
 get_district_federal_market:'/api/clio/tools/get_district_federal_market',
});
function identityDiscipline(current,result){
 if(current.operation.id==='search_federal_contract_awards'&&result!==null&&typeof result==='object'&&Array.isArray(result.items)){
  try{assertAwardRowsDistinct(result.items);}catch{deny('INVALID_RESULT');}
 }
 return result;
}
export function createFederalMarketHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'federal-market',routes,resultBody:identityDiscipline});
}

/** Five distinct stored native market projections; forecasts retain global query semantics. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({
 search_federal_contract_awards:'/api/clio/tools/search_federal_contract_awards',
 search_federal_subawards:'/api/clio/tools/search_federal_subawards',
 search_contract_vehicles:'/api/clio/tools/search_contract_vehicles',
 search_procurement_forecasts:'/api/clio/tools/search_procurement_forecasts',
 get_district_federal_market:'/api/clio/tools/get_district_federal_market',
});
export function createFederalMarketHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'federal-market',routes});
}

import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({semantic_search_bills:'/api/clio/tools/semantic_search_bills',semantic_search_grants:'/api/clio/tools/semantic_search_grants',
 semantic_search_contract_opportunities:'/api/clio/tools/semantic_search_contract_opportunities',
 semantic_search_dibbs_solicitations:'/api/clio/tools/semantic_search_dibbs_solicitations',
 semantic_search_sbir_topics:'/api/clio/tools/semantic_search_sbir_topics'});
export const createSemanticSearchHandlers=(configuration,operations)=>createStoredNativeReadHandlers(configuration,operations,{family:'semantic-search',routes});

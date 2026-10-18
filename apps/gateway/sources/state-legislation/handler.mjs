/** Stored state projections only; neighboring status/vote resolvers may have provider/write effects. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';

const ROUTES=Object.freeze({
 search_state_bills:'/api/clio/tools/search_state_bills',
 get_state_legislator:'/api/clio/tools/get_state_legislator',
});

export const createStateLegislationHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'state-legislation',routes:ROUTES});

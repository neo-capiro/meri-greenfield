/** Existing global stored-data aggregate; opaque prose carries no source completeness or client authority. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const ROUTES=Object.freeze({query_intelligence:'/api/clio/tools/query_intelligence'});
export const createIntelligenceSummaryHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'intelligence-summary',routes:ROUTES});

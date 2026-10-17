/** Existing stored docket list/deadline producer; Core owns its unprojected window clock. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const ROUTES=Object.freeze({query_regulatory_dockets:'/api/clio/tools/query_regulatory_dockets'});
export const createRegulatoryDocketsHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'regulatory-dockets',routes:ROUTES});

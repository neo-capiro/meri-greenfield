/** Native Core owns authenticated ContextPlane retrieval, per-page grants, source coverage and cursors. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';

const ROUTES=Object.freeze({search_capiro_data:'/api/clio/tools/search_capiro_data'});
export const createDataSearchHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'data-search',routes:ROUTES});

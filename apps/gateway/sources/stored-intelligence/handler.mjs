/** Stored global article excerpts, over the existing Core tool; no feed fetch or private monitor. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const ROUTES=Object.freeze({search_intel_articles:'/api/clio/tools/search_intel_articles'});
export const createStoredIntelligenceHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'stored-intelligence',routes:ROUTES});

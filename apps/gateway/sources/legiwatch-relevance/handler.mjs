/** Current interactive source preview through Core's existing finite Intel read owner. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
export const createLegiwatchRelevanceHandlers=(configuration,operations)=>createStoredNativeReadHandlers(configuration,operations,{
 family:'legiwatch-relevance',routes:{preview_legiwatch_relevance:'/api/clio/tools/preview_legiwatch_relevance'},requirePerCall:()=>true});

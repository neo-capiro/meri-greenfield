/** One existing read-only Intel owner, reached through current interactive Core authority. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
export const createLegiwatchReviewHandlers=(configuration,operations)=>createStoredNativeReadHandlers(configuration,operations,{
 family:'legiwatch-review',routes:{get_legiwatch_review:'/api/clio/tools/get_legiwatch_review'},requirePerCall:()=>true});

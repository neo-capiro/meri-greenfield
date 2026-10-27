/** Existing Intel comparison owners reached through the current Core read boundary. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
export const createLegislativeComparisonHandlers=(configuration,operations)=>createStoredNativeReadHandlers(configuration,operations,{
 family:'legislative-comparisons',routes:{
  compare_florida_budget_amounts:'/api/clio/tools/compare_florida_budget_amounts',
  compare_legislative_versions:'/api/clio/tools/compare_legislative_versions',
 },requirePerCall:()=>true});

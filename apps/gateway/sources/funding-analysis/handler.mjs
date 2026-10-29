/** Three read-only analyses use the same current client and trusted observation owner as funding reads. */
import {createFundingReadHandlers} from '../funding-opportunities/handler.mjs';
export function createFundingAnalysisHandlers(configuration,operations){
 return createFundingReadHandlers(configuration,operations,'funding-analysis',{
  explain_opportunity_match:'/api/clio/tools/explain_opportunity_match',
  compare_funding_opportunities:'/api/clio/tools/compare_funding_opportunities',
  build_opportunity_action_plan:'/api/clio/tools/build_opportunity_action_plan',
 });
}

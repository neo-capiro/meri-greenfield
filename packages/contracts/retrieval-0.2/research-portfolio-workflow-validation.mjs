/** MO-05 conversation-scoped Research Portfolio workflow reads. Closed DTO boundary over Core's current-turn transport;
 * validation supplies no authority: Core owns the portfolio grant, client walls and revision facts behind every row. */
import {snapshotOperationData} from './operation-contracts.mjs';
export const RESEARCH_WORKFLOW_READS=Object.freeze(['get_research_portfolio_analytics','get_research_portfolio_bookmarks','get_research_portfolio_fit',
 'get_research_portfolio_reviews','get_research_portfolio_rules','get_research_portfolio_imports','get_research_portfolio_operations']);
const INPUT=Object.freeze({get_research_portfolio_analytics:'ResearchWorkflowConversationInput',get_research_portfolio_bookmarks:'ResearchWorkflowConversationInput',
 get_research_portfolio_fit:'ResearchWorkflowConversationInput',get_research_portfolio_reviews:'ResearchWorkflowReviewsInput',get_research_portfolio_rules:'ResearchWorkflowConversationInput',
 get_research_portfolio_imports:'ResearchWorkflowImportsInput',get_research_portfolio_operations:'ResearchWorkflowOperationInput'});
const OUTPUT=Object.freeze({get_research_portfolio_analytics:'ResearchWorkflowAnalyticsOutput',get_research_portfolio_bookmarks:'ResearchWorkflowBookmarksOutput',
 get_research_portfolio_fit:'ResearchWorkflowFitOutput',get_research_portfolio_reviews:'ResearchWorkflowReviewsOutput',get_research_portfolio_rules:'ResearchWorkflowRulesOutput',
 get_research_portfolio_imports:'ResearchWorkflowImportsOutput',get_research_portfolio_operations:'ResearchWorkflowOperationOutput'});
const fail=()=>{throw Error('RESEARCH_WORKFLOW_CONTRACT');};
const unique=values=>{if(new Set(values).size!==values.length)fail();};
const samePortfolio=rows=>{if(new Set(rows.map(row=>row.portfolioId)).size>1)fail();};
export function createResearchWorkflowValidators({validateShape}){
 const shape=(name,value)=>validateShape(name,snapshotOperationData(value));
 function normalizeInput(operation,request,context={}){
  if(!Object.hasOwn(INPUT,operation))fail();
  const input=shape(INPUT[operation],request);
  if(context.binding&&input.conversationId!==context.binding.conversationId)fail();
  return input;
 }
 /** Rows must belong to one portfolio and, where they name the tenant or a client, to this run's tenant and visible clients. Nothing is trimmed. */
 function assertOutput(operation,value,request,context={}){
  const input=normalizeInput(operation,request,context),result=shape(OUTPUT[operation],value),tenantId=context.binding?.tenantId;
  const tenant=row=>{if(tenantId!==undefined&&row.tenantId!==tenantId)fail();};
  if(operation==='get_research_portfolio_bookmarks'){unique(result.map(row=>row.id));samePortfolio(result);}
  if(operation==='get_research_portfolio_fit'){
   unique(result.clientFits.map(row=>row.clientId));
   for(const fit of result.clientFits){if(fit.portfolioId!==result.portfolioId||context.visibleClientIds&&!context.visibleClientIds.includes(fit.clientId))fail();}
  }
  if(operation==='get_research_portfolio_reviews'){unique(result.map(row=>row.id));samePortfolio(result);result.forEach(tenant);}
  if(operation==='get_research_portfolio_rules'){unique(result.map(row=>row.id));unique(result.map(row=>row.version));}
  if(operation==='get_research_portfolio_imports'){
   const rows=Array.isArray(result)?result:[result];
   if(input.jobId!==undefined&&(Array.isArray(result)||result.id!==input.jobId))fail();
   if(input.jobId===undefined&&!Array.isArray(result))fail();
   unique(rows.map(row=>row.id));samePortfolio(rows);
   for(const job of rows){tenant(job);for(const row of job.rows){tenant(row);if(row.importJobId!==job.id||row.portfolioId!==job.portfolioId)fail();}}
  }
  if(operation==='get_research_portfolio_operations'&&result.id!==input.operationId)fail();
  return result;
 }
 return Object.freeze({normalizeInput,assertOutput});
}

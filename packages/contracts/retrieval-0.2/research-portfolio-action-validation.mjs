/** MO-05 governed Research Portfolio writes. Closed DTOs over Core action proposals: Core owns proposal creation, the
 * signed-in user decision, idempotent effects and receipts. Validation supplies no authority and never reconstructs one. */
import {snapshotOperationData} from './operation-contracts.mjs';
export const RESEARCH_ACTION_INTENTS=Object.freeze(['manage_research_portfolio','create_research_portfolio_snapshot','request_research_portfolio_output',
 'save_research_portfolio_output_to_client','watch_research_portfolio','update_research_portfolio_change_state','create_research_portfolio_bookmark',
 'add_research_portfolio_review_note','prepare_research_portfolio_brief','prepare_research_portfolio_meeting']);
const SHAPE=Object.freeze({manage_research_portfolio:'Manage',create_research_portfolio_snapshot:'Snapshot',request_research_portfolio_output:'Output',
 save_research_portfolio_output_to_client:'SaveOutput',watch_research_portfolio:'Watch',update_research_portfolio_change_state:'ChangeState',
 create_research_portfolio_bookmark:'Bookmark',add_research_portfolio_review_note:'ReviewNote',prepare_research_portfolio_brief:'Brief',prepare_research_portfolio_meeting:'Meeting'});
/** Operations whose Core owner takes the idempotent operation key at the top level of its input. */
const KEYED=Object.freeze(['create_research_portfolio_snapshot','request_research_portfolio_output','save_research_portfolio_output_to_client',
 'create_research_portfolio_bookmark','add_research_portfolio_review_note','prepare_research_portfolio_brief','prepare_research_portfolio_meeting']);
/** Management actions whose Core parameters carry `idempotencyKey`, and the two whose parameters carry `operationKey`. The key is
 * always derived from the intent delivery; a model-supplied key is refused. Read-only management actions carry none. */
export const RESEARCH_MANAGEMENT_IDEMPOTENT_ACTIONS=Object.freeze(['portfolio_create','portfolio_update','portfolio_archive','portfolio_restore','grant_upsert','grant_delete',
 'client_link_create','client_link_delete','member_create','members_decide','member_resolve','rule_publish','review_assign','review_decide','reviews_bulk_decide',
 'annual_review_refresh','annual_review_reopen','watch_conversion_apply']);
export const RESEARCH_MANAGEMENT_OPERATION_KEY_ACTIONS=Object.freeze(['import_create','import_action']);
export const RESEARCH_MANAGEMENT_READ_ONLY_ACTIONS=Object.freeze(['grants_list','client_links_list','members_list','rule_preview','annual_review_get','subscriptions_list',
 'deliveries_list','watch_conversion_preview','output_get','snapshots_list','snapshot_get','taxonomy_get','templates_list','template_version_get','comparison_list','comparison_get']);
const KEY=/^meri-rp-[a-f0-9]{64}$/u,fail=()=>{throw Error('RESEARCH_ACTION_CONTRACT');};
export function createResearchActionValidators({validateShape,canonicalSha256}){
 const shape=(name,value)=>validateShape(name,snapshotOperationData(value));
 const kind=operation=>{if(!Object.hasOwn(SHAPE,operation))fail();return SHAPE[operation];};
 function normalizeInput(operation,request,context={}){
  const input=shape('ResearchAction'+kind(operation)+'Input',request);
  if(context.binding&&input.conversationId!==context.binding.conversationId)fail();
  if(operation==='manage_research_portfolio'&&['idempotencyKey','operationKey','tenantId','userId','portfolioId','researchPortfolioId','scopeVersion'].some(key=>Object.hasOwn(input.parameters,key)))fail();
  return input;
 }
 /** The exact Core request: the admitted input plus the delivery-derived key where the owner takes one. */
 function bind(operation,input,operationKey){
  if(typeof operationKey!=='string'||!KEY.test(operationKey))fail();
  let bound=input;
  if(KEYED.includes(operation))bound={...input,operationKey};
  else if(operation==='manage_research_portfolio'){
   const parameters=RESEARCH_MANAGEMENT_IDEMPOTENT_ACTIONS.includes(input.action)?{...input.parameters,idempotencyKey:operationKey}
    :RESEARCH_MANAGEMENT_OPERATION_KEY_ACTIONS.includes(input.action)?{...input.parameters,operationKey}:input.parameters;
   bound={...input,parameters};
  }
  return shape('ResearchAction'+kind(operation)+'Bound',bound);
 }
 /** The admitted input a bound request was prepared from, with the derived key removed. */
 function unbind(operation,request){
  if(operation==='manage_research_portfolio'){const {idempotencyKey,operationKey,...parameters}=request.parameters;return {...request,parameters};}
  const {operationKey,...input}=request;return input;
 }
 function assertProposal(value){
  const p=shape('ResearchActionProposal',value),{commandSha256,...bound}=p;
  if(canonicalSha256(bound)!==commandSha256||p.request.conversationId!==p.binding.conversationId||p.scopes.some(s=>s.tenantId!==p.binding.tenantId)||Date.parse(p.expiresAt)<=Date.parse(p.createdAt))fail();
  shape('ResearchAction'+kind(p.operation)+'Bound',p.request);
  if(KEYED.includes(p.operation)&&!KEY.test(p.request.operationKey))fail();
  if(p.operation==='save_research_portfolio_output_to_client'&&p.scopes[0].kind==='client'&&p.request.clientId!==p.scopes[0].resourceId)fail();
  return p;
 }
 function assertOutput(operation,value,request,context={}){
  const input=normalizeInput(operation,request,context),result=shape('ResearchActionPrepared',value),p=assertProposal(result.proposal);
  if(p.operation!==operation||canonicalSha256(unbind(operation,p.request))!==canonicalSha256(input))fail();
  return result;
 }
 const decided=value=>shape('ResearchActionDecided',value);
 return Object.freeze({normalizeInput,bind,unbind,assertProposal,assertOutput,decided});
}

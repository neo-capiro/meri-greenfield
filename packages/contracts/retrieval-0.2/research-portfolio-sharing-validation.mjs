/** Closed sharing DTOs. Validation supplies no authority and never reconstructs a capability. */
import {snapshotOperationData} from './operation-contracts.mjs';
export const RESEARCH_SHARE_LIST='get_research_portfolio_share_links';
export const RESEARCH_SHARE_INTENTS=Object.freeze(['publish_research_portfolio_share_link','revoke_research_portfolio_share_link']);
const fail=()=>{throw Error('RESEARCH_SHARE_CONTRACT');};
export function createResearchShareValidators({validateShape,canonicalSha256}){
 const shape=(name,value)=>validateShape(name,snapshotOperationData(value));
 function normalizeInput(operation,request,context={}){
  const name=operation===RESEARCH_SHARE_LIST?'List':operation===RESEARCH_SHARE_INTENTS[0]?'Publish':operation===RESEARCH_SHARE_INTENTS[1]?'Revoke':null;
  if(name===null)fail();const input=shape('ResearchShare'+name+'Input',request);
  if(context.binding&&input.conversationId!==context.binding.conversationId)fail();return input;
 }
 function assertProposal(value){
  const p=shape('ResearchShareProposal',value),{commandSha256,...bound}=p;
  if(canonicalSha256(bound)!==commandSha256||p.request.conversationId!==p.binding.conversationId||p.scopes.some(s=>s.tenantId!==p.binding.tenantId)||Date.parse(p.expiresAt)<=Date.parse(p.createdAt))fail();
  const publishing=p.operation===RESEARCH_SHARE_INTENTS[0];
  if(publishing!==Object.hasOwn(p.request,'previewHash')||publishing!==Object.hasOwn(p.preview,'portfolioId')||p.preview.label!==(publishing?'Publish client share link':'Revoke client share link'))fail();
  if(publishing&&p.scopes[0].kind==='client'&&p.request.clientId!==p.scopes[0].resourceId)fail();
  return p;
 }
 function assertOutput(operation,value,request,context={}){
  const input=normalizeInput(operation,request,context);
  if(operation===RESEARCH_SHARE_LIST){
   const result=shape('ResearchShareListOutput',value),ids=new Set();
   for(const link of result.links){if(ids.has(link.id)||link.portfolioId!==result.sharing.portfolioId||Date.parse(link.expiresAt)-Date.parse(link.publishedAt)!==168*3600000||
    context.selectedClientId&&link.clientId!==context.selectedClientId||context.visibleClientIds&&!context.visibleClientIds.includes(link.clientId))fail();ids.add(link.id);}
   return result;
  }
  const result=shape('ResearchSharePrepared',value),p=assertProposal(result.proposal);
  if(p.operation!==operation||Object.keys(input).some(key=>input[key]!==p.request[key]))fail();return result;
 }
 return Object.freeze({normalizeInput,assertOutput,assertProposal});
}

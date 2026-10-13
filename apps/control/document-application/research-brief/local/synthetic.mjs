/** Fixed original synthetic corpus only. Not an authentic congressional source adapter. */
import {randomUUID} from 'node:crypto';
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {briefSkillPin} from '../skill.mjs';
import {sha,filterName} from '../evidence.mjs';
export const syntheticText=Object.freeze({bill_text:'SYNTHETIC BILL TEXT. Section 101 authorizes a research demonstration for fiscal year 2027. This authorization does not itself appropriate funding.',
  federal_legislation:'SYNTHETIC STATUS NOTE. A separate summary describes the demonstration as funded. This conflicts with the authorization-only bill passage.'});
const operations={bill_text:'read_bill_text',federal_legislation:'get_bill_status',program_elements:'get_pe_budget_timeline'};
export function syntheticRead(call){
  const sourceId=call.sourceId,available=sourceId!=='program_elements',stamp=call.selector.asOf,decision=randomUUID();
  const content=syntheticText[sourceId],recordId=sourceId==='bill_text'?'119-hr-4242':'synthetic-status-4242',version=sourceId==='bill_text'?'synthetic-ih-v1':'synthetic-status-v1';
  const evidence=available?{sourceId,recordId,sourceVersionId:version,observedAt:stamp,sourceUpdatedAt:stamp,
    citationId:randomUUID(),scopes:structuredClone(call.scopes),contentSha256:sha(Buffer.from(content)),authorizationDecisionId:decision}:null;
  return {envelope:{contractVersion:'0.2.0',requestId:randomUUID(),traceId:randomUUID(),
    operation:{id:operations[sourceId],version:'0.2.0'},binding:call.binding,
    subject:{kind:'client',entityType:'client',entityIds:[call.scopes.find(x=>x.kind==='client').resourceId],
      tenantId:call.binding.tenantId,actorId:call.binding.actorId,authorizationDecisionId:decision,
      policyRevision:call.scopes[0].policyRevision,scopes:call.scopes,rosterVersionId:null},
    window:{basis:'unbounded'},argumentsSha256:v.hash(call.selector),appliedFilters:Object.entries(call.selector.subject).map(([name,value])=>({name:filterName(name),valueSha256:v.hash(value)})),
    method:'source-read',status:available?'complete':'unavailable',reasonCode:available?'OK':'SOURCE_UNAVAILABLE',retryable:false,
    sources:[{sourceId,authority:'derived',snapshotVersionId:available?'synthetic-snapshot-1':null,adapterVersion:'1.0.0',
      status:available?'checked':'unavailable',synchronizedAt:available?stamp:null,asOf:available?stamp:null,retrievedAt:stamp,freshness:available?'fresh':'unknown'}],
    data:available?{kind:'source-read',records:[{sourceId,recordId,recordVersionId:version,citationId:evidence.citationId,
      contentSha256:evidence.contentSha256,scopes:call.scopes,content:{kind:'full-read',text:content}}]}:null,
    coverage:{sourcesRequested:[sourceId],sourcesChecked:available?[sourceId]:[],sourcesUnavailable:available?[]:[sourceId],
      enumeration:available?'complete':'unknown',enumerableTotal:available?1:null,returnedCount:available?1:0,truncated:false,
      historySupport:available?'supported':'unsupported',limitations:available?['Synthetic exact record only; no claim of corpus completeness.']:['Synthetic budget evidence is unavailable; no appropriation or amount verified.']},
    continuation:{cursor:null,requiredReads:[],remainingSources:available?[]:[sourceId]},negativeAssertion:{kind:'none'}},evidence:available?[evidence]:[]};
}
export const syntheticInput=asOf=>({skill:briefSkillPin(),title:'Synthetic congressional research brief',
  subject:{congress:119,session:2,billId:'119-hr-4242',billVersion:'ih',fiscalYear:2027,budgetStage:'authorized'},asOf,
  facts:[{id:'F1',kind:'excerpt',text:syntheticText.bill_text,citations:[{sourceId:'bill_text',recordId:'119-hr-4242',sourceVersionId:'synthetic-ih-v1',start:0,end:syntheticText.bill_text.length,url:'https://example.invalid/synthetic/bill/ih'}]},
    {id:'F2',kind:'claim',text:'The demonstration is fully funded. This claim needs verification.',citations:[
      {sourceId:'bill_text',recordId:'119-hr-4242',sourceVersionId:'synthetic-ih-v1',start:0,end:syntheticText.bill_text.length},
      {sourceId:'federal_legislation',recordId:'synthetic-status-4242',sourceVersionId:'synthetic-status-v1',start:0,end:syntheticText.federal_legislation.length}]},
    {id:'F3',kind:'excerpt',text:'No fiscal-year budget amount has been read.',citations:[{sourceId:'program_elements',recordId:'synthetic-pe-1',sourceVersionId:'synthetic-budget-v1',start:0,end:42}]}],
  proposedLanguage:['Proposed: Request confirmation of the demonstration authority and the separate appropriations basis before describing the program as funded.']});

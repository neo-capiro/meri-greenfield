/** Receiving rules for canonical funding facts. No scores, dates or authority are invented here. */
import {snapshotOperationData} from './operation-contracts.mjs';
import {fundingInstant,assertFundingEnvelope,assertFundingFacts} from './funding-envelope-validation.mjs';
import {canonicalSha256} from '../validate.mjs';
export const FUNDING_ANALYSIS_DEFINITIONS=Object.freeze({
 explain_opportunity_match:'FundingMatch',compare_funding_opportunities:'FundingCompare',build_opportunity_action_plan:'FundingPlan',
});
export const FUNDING_ANALYSIS_OPERATION_IDS=Object.freeze(Object.keys(FUNDING_ANALYSIS_DEFINITIONS));
const fail=()=>{throw Error('FUNDING_ANALYSIS_INVALID');};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const supported=source=>['grants_gov','sam_gov'].includes(source);
function loss(envelope,collection,kept,total){
 const expected=total>kept?[{collection,kept,total}]:undefined;
 if(expected?!same(envelope.truncated??null,expected):envelope.truncated!==undefined)fail();
}
function facts(row,request,asOf){
 if(!supported(request.source)||row.clientId!==request.clientId||row.ref.source!==request.source||row.ref.sourceRecordId!==request.sourceRecordId||!row.deadline)fail();
 assertFundingFacts(row,asOf);
}
function match(data,envelope,input){
 facts(data.facts,input,envelope.asOf);
 for(const field of ['ref','title','relevanceScore','eligibility','recommendation','humanDecision','acquisitionPosition','missingProfileFields'])if(!same(data[field],data.facts[field]))fail();
 const rank={strong:0,moderate:1,weak:2},signals=data.facts.matchedSignals
  .filter(row=>!['applicantType','stateRestriction'].includes(row.signal)).sort((a,b)=>rank[a.strength]-rank[b.strength]);
 if(data.signals.length!==Math.min(12,signals.length)||data.fitBand!==(signals[0]?.strength??'weak'))fail();
 data.signals.forEach((signal,index)=>{for(const field of ['signal','matchedOn','strength'])if(signal[field]!==signals[index][field])fail();});
 loss(envelope,'signals',data.signals.length,signals.length);
}
function comparison(data,envelope,input){
 if(data.clientId!==input.clientId||data.rows.length!==Math.min(5,input.opportunities.length))fail();
 loss(envelope,'rows',data.rows.length,input.opportunities.length);
 data.rows.forEach((row,index)=>{
  const requested=input.opportunities[index];if(!same(row.requested,requested))fail();
  if(row.state==='available'){if(!row.facts)fail();facts(row.facts,{...requested,clientId:input.clientId},envelope.asOf);}
  else if(row.facts!==null||((row.state==='unsupported_source')===supported(requested.source)))fail();
 });
}
function plan(data,envelope,input){
 if(!supported(input.source)||!same(data.ref,{source:input.source,sourceRecordId:input.sourceRecordId})||data.clientId!==input.clientId||data.generatedAt!==envelope.asOf)fail();
 const seen=new Set();
 for(const action of data.actions){
  if(seen.has(action.id)||(action.dueDate===null)!==(action.dueDateBasis===null))fail();seen.add(action.id);
  if(action.dueDate!==null)fundingInstant(action.dueDate);
  if(['forecast','closed_or_informational'].includes(data.stage)&&(action.intent==='pursuit'||action.dueDate!==null))fail();
  if(action.suggestedTarget!==null&&action.evidence.length===0)fail();
 }
 const truncated=envelope.truncated;
 if(truncated&&(truncated.length!==1||truncated[0].collection!=='actions'||truncated[0].kept!==12||data.actions.length!==12))fail();
 if((data.feasibility===undefined)!==(data.proposedSchedule===undefined))fail();
 const scheduled=new Set();
 for(const milestone of data.proposedSchedule??[]){
  if(scheduled.has(milestone.id)||!seen.has(milestone.id)||data.feasibility.feasible!==true)fail();scheduled.add(milestone.id);
  if(milestone.date<envelope.asOf.slice(0,10))fail();
 }
}
export function createFundingAnalysisValidators({validateShape}){
 function normalizeInput(id,request,context){
  if(!Object.hasOwn(FUNDING_ANALYSIS_DEFINITIONS,id))fail();
  const input=snapshotOperationData(request),observed=snapshotOperationData(context);
  if(!observed||Object.keys(observed).length!==1||!Object.hasOwn(observed,'asOf'))fail();fundingInstant(observed.asOf);
  validateShape(`${FUNDING_ANALYSIS_DEFINITIONS[id]}Input`,input);
  return {input};
 }
 function assertOutput(id,value,request,context){
  const {input}=normalizeInput(id,request,context),out=snapshotOperationData(value);
  validateShape(`${FUNDING_ANALYSIS_DEFINITIONS[id]}Output`,out);assertFundingEnvelope(out);
  if(out.asOf!==context.asOf)fail();
  if(out.state==='available')({explain_opportunity_match:match,compare_funding_opportunities:comparison,build_opportunity_action_plan:plan})[id](out.data,out,input);
  return value;
 }
 return Object.freeze({normalizeInput,assertOutput});
}

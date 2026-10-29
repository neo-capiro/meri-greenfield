import {storedCase,facts,clientId,recordId} from '../../funding-opportunities/test/fixture.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {FUNDING_ANALYSIS_OPERATION_IDS} from '../../../../../packages/contracts/retrieval-0.2/funding-analysis-validation.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {createFundingAnalysisHandlers} from '../handler.mjs';
import {readContext} from '../../bill-text/test/fixture.mjs';
export const ids=FUNDING_ANALYSIS_OPERATION_IDS;
export const requests=Object.fromEntries(ids.map(id=>[id,id==='compare_funding_opportunities'?{clientId,opportunities:[{source:'sam_gov',sourceRecordId:recordId},{source:'grants_gov',sourceRecordId:'grant-1'}]}:{clientId,source:'sam_gov',sourceRecordId:recordId}]));
const fact=input=>({...facts(input),deadline:{at:null,dateOnly:null,timeZone:null,basis:'unknown',daysRemaining:null,status:'unknown'}});
export function page(id,input,asOf){
 const out={tool:id,state:'available',explanation:'Synthetic canonical source projection. Proposals only; nothing committed.',asOf,data:null};
 if(id==='explain_opportunity_match'){
  const row=fact(input);out.data={facts:row,...Object.fromEntries(['ref','title','relevanceScore','eligibility','recommendation','humanDecision','acquisitionPosition','missingProfileFields'].map(k=>[k,row[k]])),fitBand:'weak',fitLabel:'Weak fit',weakEvidenceOnly:true,signals:[]};
 }else if(id==='compare_funding_opportunities'){
  out.data={clientId:input.clientId,rows:input.opportunities.slice(0,5).map(requested=>({requested,state:['sam_gov','grants_gov'].includes(requested.source)?'available':'unsupported_source',explanation:'Synthetic source row',facts:['sam_gov','grants_gov'].includes(requested.source)?fact({...requested,clientId:input.clientId}):null}))};
  if(input.opportunities.length>5)out.truncated=[{collection:'rows',kept:5,total:input.opportunities.length}];
 }else out.data={clientId:input.clientId,ref:{source:input.source,sourceRecordId:input.sourceRecordId},generatedAt:asOf,stage:'solicitation',stageExplanation:'Synthetic open notice.',fingerprint:'a'.repeat(64),acceptance:{wired:true,explanation:'Only explicit acceptance through the canonical owner can create a task.'},actions:[{id:'review-1',category:'qualify',title:'Review source requirements',rationale:'Confirm source eligibility before committing work.',intent:'review',evidence:[],suggestedTarget:null,dueDate:null,dueDateBasis:null,unresolvedPrerequisites:['Requirements have not been reviewed.']}]};
 return out;
}
export function analysisCase(id=ids[0],request=requests[id]){
 const scene=storedCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation);
 scene.authority.decision.operation=`${id}@0.2.0`;
 scene.authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(r=>r.sourceId))];
 const currentPage=page(id,request,scene.normalizationContext.asOf);scene.state.page=currentPage;
 const originalFetch=scene.transport.fetchImpl;
 scene.transport.fetchImpl=async(url,options)=>{
  const body=JSON.parse(options.body),context=decodeNativeReadObservation(options.headers[HEADER],{operation,request:body}).context;
  scene.state.page=page(id,body,context.asOf);return originalFetch(url,options);
 };
 const call=(raw=request,authority=scene.authority,normalizationContext=scene.normalizationContext)=>{
  const normalized=contract.normalizeInput(raw,normalizationContext);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,authority:readContext(authority),normalizationContext};
 };
 return {...scene,family:'funding-analysis',operation,contract,arguments:request,page:currentPage,call,handler:(changes={})=>createFundingAnalysisHandlers({...scene.transport,now:scene.now,...changes},[operation])[0].execute};
}

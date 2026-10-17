/** Synthetic stored economic DTOs; no economic provider, SQL or audit execution. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createPublicDataHandlers} from '../handler.mjs';

export const id='query_economic_data',ids=[id];
export function storedPage(input,at){
 const generatedAt=new Date(at).toISOString();
 if(input.source==='census')return {tool:id,source:'census',generatedAt,data:[{
  id:'synthetic-district',state:input.state??'CA',district:input.district??'AL',congress:119,
  totalPopulation:null,medianHouseholdIncome:null,medianAge:null,percentBachelorPlus:null,percentPoverty:null,
  unemploymentRate:null,laborForceSize:null,topIndustries:{reported:['Synthetic industry',null,3]},
 }]};
 if(input.source==='bls')return {tool:id,source:'bls',generatedAt,data:[{
  seriesId:input.seriesId??'synthetic-series',title:'Synthetic stored indicator',surveyName:null,periodType:'reported-period',
  recentDataPoints:[{year:2026,period:'M13',value:-2.5},{year:2025,period:'M12',value:1}],
 }]};
 if(input.source==='bea')return {tool:id,source:'bea',generatedAt,data:[{
  datasetName:input.datasetName??'Synthetic dataset',tableName:'Synthetic table',description:'Synthetic stored economic measure',
  year:input.year??2026,period:'Annual',value:17.31,units:null,
 }]};
 return {tool:id,error:`Unknown source "${input.source}". Use "census", "bls", or "bea".`};
}

export function storedCase(selected=id,{request={}}={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene;
 authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=storedPage(contract.normalizeInput(request,{}).input,now()),transport={...scene.transport,
  async fetchImpl(url,configuration){
   wire.push({url,options:configuration,body:JSON.parse(configuration.body)});
   const value=structuredClone(state.page??page);state.nativeValue=value;
   state.resultMutator?.(value);state.afterSource?.();
   return state.responseFactory?state.responseFactory(value):Response.json(value);
  },
 };
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{
  const normalized=contract.normalizeInput(raw,context);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};
 };
 return {...scene,family:'public-data',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createPublicDataHandlers({...transport,now,...changes},[operation])[0].execute};
}

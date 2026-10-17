/** Synthetic opaque aggregate prose and native HTTP; no provider or private client lookup. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createIntelligenceSummaryHandlers} from '../handler.mjs';
export const id='query_intelligence';
export function storedCase(selected=id,{request={clientName:'Synthetic public contractor'}}={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene;
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];
 const page={tool:id,generatedAt:new Date(now()).toISOString(),data:'Available intelligence data sources: News articles: 1'};
 const transport={...scene.transport,async fetchImpl(url,options){
  wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(original=request,current=authority,context={})=>{const normalized=contract.normalizeInput(original,context);return {request:original,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'intelligence-summary',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createIntelligenceSummaryHandlers({...transport,now,...changes},[operation])[0].execute};
}

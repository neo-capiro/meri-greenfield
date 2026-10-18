/** Synthetic source-shaped JSON and correlated native credentials; no source execution. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createStoredIntelligenceHandlers} from '../handler.mjs';
export const id='search_intel_articles';
export function storedCase(selected=id,{request={query:'Stored',source:'synthetic-source',limit:1}}={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene,input=contract.normalizeInput(request,{}).input;
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];
 const stamp=new Date(now()).toISOString(),page={tool:id,generatedAt:stamp,total:1,data:[{id:'synthetic-article',source:input.source??'synthetic-source',title:'Stored article',url:'opaque stored URL',author:null,publishedAt:stamp,summary:'Stored summary',categories:[],topics:['Stored']}]};
 const transport={...scene.transport,async fetchImpl(url,options){
  wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(original=request,current=authority,context={})=>{const normalized=contract.normalizeInput(original,context);return {request:original,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'stored-intelligence',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createStoredIntelligenceHandlers({...transport,now,...changes},[operation])[0].execute};
}

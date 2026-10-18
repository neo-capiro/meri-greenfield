/** Synthetic stored docket JSON, including dates serialized by native HTTP. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createRegulatoryDocketsHandlers} from '../handler.mjs';
export const id='query_regulatory_dockets';
export function storedCase(selected=id,{request={agencyId:'Synthetic',documentType:'Notice',limit:1}}={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene,input=contract.normalizeInput(request,{}).input;
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];
 const stamp=new Date(now()).toISOString(),row={id:'synthetic-docket',documentId:'synthetic-document',agencyId:input.upcomingOnly?'Synthetic':input.agencyId??'Synthetic',docketId:null,documentType:input.upcomingOnly?'Notice':input.documentType??'Notice',title:' Stored raw\n docket title ',postedDate:stamp,commentStartDate:null,commentEndDate:input.upcomingOnly?new Date(now()+86400000).toISOString():null,frDocNum:null,subtype:null,withdrawn:false,lastModified:null,syncedAt:stamp};
 const page={tool:id,generatedAt:stamp,total:1,results:[row],...(input.upcomingOnly?{windowDays:input.days}:{})};
 const transport={...scene.transport,async fetchImpl(url,options){
  wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(original=request,current=authority,context={})=>{const normalized=contract.normalizeInput(original,context);return {request:original,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'regulatory-dockets',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createRegulatoryDocketsHandlers({...transport,now,...changes},[operation])[0].execute};
}

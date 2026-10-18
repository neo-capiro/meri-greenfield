/** Synthetic manual tracking DTO and echo-only context; no client resolver or database. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createTrackedBillsHandlers} from '../handler.mjs';

export const id='search_tracked_bills',ids=[id],clientId='a1234567-b123-4c12-8d12-e123456789ab';
export function trackedRow(index=1){
 const billId=`synthetic-bill:${index}`;
 return {id:`00000000-0000-4000-8000-${String(index).padStart(12,'0')}`,billId,note:null,createdAt:'2026-10-12T01:00:00.000Z',
  bill:{identifier:billId,title:'Synthetic stored bill',latestActionDate:null,latestActionText:null,status:null,
   actionTexts:[],sponsorName:null,sponsorParty:null,subjectNames:[]},
 };
}

export function storedCase(selected=id,{request={clientId}}={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,now,wire}=scene;
 const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:authority.policyRevision};
 Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[clientId],scopes:[scope]});
 authority.claims.scopes=[scope];authority.decision.scopes=[scope];authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const normalizationContext={binding:authority.binding,subject:authority.subject,clientReference:request.clientId.trim().slice(0,80)};
 const input=contract.normalizeInput(request,normalizationContext).input;
 const page={tool:id,generatedAt:new Date(now()).toISOString(),clientId:input.clientId,total:1,bills:[trackedRow()]};
 const transport={...scene.transport,async fetchImpl(url,configuration){
  wire.push({url,options:configuration,body:JSON.parse(configuration.body)});
  const value=structuredClone(state.page??page);state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();
  return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{
  const normalized=contract.normalizeInput(raw,context);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};
 };
 return {...scene,family:'tracked-bills',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,visibleClientIds:[clientId],
  handler:(changes={})=>createTrackedBillsHandlers({...transport,now,...changes},[operation])[0].execute};
}

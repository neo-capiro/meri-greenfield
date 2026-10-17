/** Synthetic client-owned campaign projections and echo-only context; no native source or campaign action. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createOutreachQueryHandlers} from '../handler.mjs';
import {captureOutreachListClientSelection} from '../request-context.mjs';
export const id='query_outreach',ids=[id],clientId='a1234567-b123-4c12-8d12-e123456789ab';
export function storedCase(selected=id,{request={clientId,status:'draft',limit:2},resolution}={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,now,wire}=scene;
 const normalizationContext={clientResolution:captureOutreachListClientSelection(request,resolution)},selectedClient=normalizationContext.clientResolution.clientId;
 const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:selectedClient,policyRevision:authority.policyRevision};
 Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[selectedClient],scopes:[scope]});
 authority.claims.scopes=[scope];authority.decision.scopes=[scope];authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const input=contract.normalizeInput(request,normalizationContext).input,stamp=new Date(now()).toISOString();
 const page={tool:id,generatedAt:stamp,total:1,campaigns:[{id:'00000000-0000-4000-8000-000000000001',clientId:selectedClient,name:'Synthetic campaign',type:'custom',status:input.status??'draft',subject:null,sentAt:null,createdAt:stamp,clientName:'Synthetic client',recipientCount:3,createdBy:'synthetic@example.invalid'}]};
 const transport={...scene.transport,async fetchImpl(url,options){
  wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(raw,context);return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'outreach-query',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,visibleClientIds:[selectedClient],
  handler:(changes={})=>createOutreachQueryHandlers({...transport,now,...changes},[operation])[0].execute};
}

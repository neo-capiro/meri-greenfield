/** Synthetic stored facility rows and native HTTP only; no geography or access qualification. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createFacilityRepresentationHandlers} from '../handler.mjs';
export const id='get_representation',clientId='99999999-9999-4999-8999-999999999999';
export function facility(){return {facilityId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',facilityName:'Synthetic facility',city:null,state:'CA',
 representation:{federal:{house:null,senate:[]},state:{lower:null,upper:null}}};}
export function storedCase(selected=id,{request={clientId}}={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,now,wire}=scene;
 const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:authority.policyRevision};
 Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[clientId],scopes:[scope]});authority.claims.scopes=[scope];authority.decision.scopes=[scope];
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];
 const normalizationContext={binding:authority.binding,subject:authority.subject},input=contract.normalizeInput(request,normalizationContext).input;
 const page={tool:id,generatedAt:new Date(now()).toISOString(),facilities:input.clientId===null?[]:[facility()],note:input.clientId===null?'Provide a client UUID.':null};
 const transport={...scene.transport,async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);}};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});}};
 const call=(raw=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(raw,context);return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'facility-representation',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,visibleClientIds:[clientId],
  handler:(changes={})=>createFacilityRepresentationHandlers({...transport,now,...changes},[operation])[0].execute};
}

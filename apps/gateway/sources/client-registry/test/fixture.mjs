/** Synthetic registry DTO and current visibility callback; no Core/client database query. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {createClientRegistryHandlers} from '../handler.mjs';
export const id='lookup_client_registry',clientId='99999999-9999-4999-8999-999999999999';
export function candidate(ldaClientId=7){return {ldaClientId,name:'Synthetic public registry entity',state:null,description:null,totalFilings:0,latestFilingYear:null};}
export function storedCase(selected=id,{request={name:'Synthetic client'}}={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={},visibleClientIds=[clientId],{authority,state,now,wire}=scene;
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];
 state.visibilityCalls=[];
 const page={existingClient:{id:clientId,name:'Synthetic client',website:null},ldaExactMatch:candidate(),ldaCandidates:[candidate(8)],
  guidance:`A client named "Synthetic client" already exists (id ${clientId}) — do NOT propose create_client; use get_client_context or update_client_profile.`};
 const transport={...scene.transport,authorizeResultForCall(operation,originalCall){state.visibilityFactory={operation,originalCall};return async selection=>{
  state.visibilityCalls.push(structuredClone(selection));await state.beforeVisibility?.(selection);
  if(state.visibilityDenied||selection.clientIds.some(id=>!visibleClientIds.includes(id)))deny('ACCESS_DENIED');
 }},async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);}};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});}};
 const call=(raw=request,current=authority,context={})=>{const normalized=contract.normalizeInput(raw,context);return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'client-registry',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,visibleClientIds,
  handler:(changes={})=>createClientRegistryHandlers({...transport,now,...changes},[operation])[0].execute};
}

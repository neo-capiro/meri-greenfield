/** Synthetic fixed native JSON transport; no live mode, catalog or funding source qualification. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {createProgramElementHandlers} from '../handler.mjs';
import {PROGRAM_ELEMENT_OPERATION_IDS} from '../request-context.mjs';
import {storedPage,peCode} from './pages.mjs';
export {storedPage,peCode};
export const ids=PROGRAM_ELEMENT_OPERATION_IDS;
export const requests={search_program_elements:{query:'  énergie 🚀  ',q:'ignored alias',service:' Army ',budgetActivity:null,hasData:true,page:'2.9',limit:'2.9'},
 get_program_element:{peCode:' 0601000A '},get_pe_budget_timeline:{peCode:' 0601000A '}};

export function storedCase(id=ids[0],options={}){
 if(!ids.includes(id))throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,now,wire}=scene;
 const request=options.request??requests[id],normalizationContext={evidenceAccuracyMode:options.evidenceAccuracyMode??'off'};
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=storedPage(id,contract.normalizeInput(request,normalizationContext).input,normalizationContext.evidenceAccuracyMode,now());
 const {getCredentials,...passive}=scene.transport;
 const transport={...passive,credentialsForCall(selected,original){state.credentialOwnerCalls??=[];state.credentialOwnerCalls.push({operation:selected,call:original});
  if(state.resourceDenied)deny('ACCESS_DENIED');return getCredentials;
 },async fetchImpl(url,options){
  const body=JSON.parse(options.body);wire.push({url,options,body});
  const observation=decodeNativeReadObservation(options.headers[NATIVE_READ_OBSERVATION_HEADER],{operation,request:body});
  state.observations??=[];state.observations.push(observation);
  const input=contract.normalizeInput(body,observation.context).input,value=structuredClone(state.page??storedPage(id,input,observation.context.evidenceAccuracyMode,now()));
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(raw,context);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 return {...scene,family:'program-elements',operation,contract,arguments:request,normalizationContext,transport,page,call,nativeReadContextPorts,
  handler:(changes={})=>createProgramElementHandlers({...transport,now,...changes},[operation])[0].execute};
}

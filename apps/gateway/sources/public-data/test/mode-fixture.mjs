/** Synthetic stored grant/award DTOs; the verified private carrier selects a fixture variant, never live policy. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {createPublicDataHandlers} from '../handler.mjs';
import {PUBLIC_DATA_MODE_OPERATION_IDS} from '../request-context.mjs';
export const modeIds=PUBLIC_DATA_MODE_OPERATION_IDS;
export const modeRequests={search_federal_grants:{query:'  énergie 🚀  ',agency:' Synthetic agency ',status:'posted',limit:'2.9'},
 search_federal_awards:{query:'  énergie 🚀  ',agency:null,peCode:' 0601000a ',page:'2',limit:'2.9'}};

export function storedModePage(id,input,mode,at){
 const generatedAt=new Date(at).toISOString();
 if(id==='search_federal_grants')return {tool:id,generatedAt,asOf:generatedAt,total:1,data:[{
  id:'synthetic-grant',title:'Synthetic reported grant',agency:'Synthetic agency',subAgency:null,opportunityNumber:null,category:null,
  awardCeiling:null,awardFloor:null,estimatedFunding:null,openDate:null,closeDate:null,deadlineStatus:'unknown',syncedStatus:input.status??'posted',eligibility:[],url:null,
  ...(mode==='enforce'?{deadline:{at:null,dateOnly:null,timeZone:null,basis:'unknown',daysRemaining:null,status:'unknown'}}:{}),
 }]};
 if(id==='search_federal_awards')return {tool:id,generatedAt,total:input.page*input.limit,page:input.page,pageSize:input.limit,hasMore:false,nextPage:null,paginationLimitReached:false,data:[{
  id:'11111111-1111-4111-8111-111111111111',contractorName:null,awardingAgency:null,awardingSubTier:null,amount:null,description:'Synthetic reported award',
  peCode:input.peCode??null,recipientState:null,popCongressionalDistrict:null,actionDate:null,piid:null,latestActionDate:null,baseAwardSignedDate:null,
  sourceLastModifiedDate:null,popStartDate:null,popEndDate:null,lastSyncedAt:generatedAt,
  ...(mode==='enforce'?{dates:{latestActionDate:null,baseAwardSignedDate:null,sourceLastModifiedDate:null,popStartDate:null,popEndDate:null,capiroSyncedAt:generatedAt,
   semantics:'Reported source date labels, never interchangeable.'}}:{}),
 }]};
 throw Error('SYNTHETIC_OPERATION_MISMATCH');
}

export function storedModeCase(id=modeIds[0],options={}){
 if(!modeIds.includes(id))throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,now,wire}=scene;
 const request=options.request??modeRequests[id],normalizationContext={evidenceAccuracyMode:options.evidenceAccuracyMode??'off'};
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=storedModePage(id,contract.normalizeInput(request,normalizationContext).input,normalizationContext.evidenceAccuracyMode,now());
 const {getCredentials,...passive}=scene.transport;
 const transport={...passive,credentialsForCall(selected,original){state.credentialOwnerCalls??=[];state.credentialOwnerCalls.push({operation:selected,call:original});
  if(state.resourceDenied)deny('ACCESS_DENIED');return getCredentials;
 },async fetchImpl(url,configuration){
  const body=JSON.parse(configuration.body);wire.push({url,options:configuration,body});
  const observation=decodeNativeReadObservation(configuration.headers[NATIVE_READ_OBSERVATION_HEADER],{operation,request:body});
  state.observations??=[];state.observations.push(observation);
  const input=contract.normalizeInput(body,observation.context).input;
  const value=structuredClone(state.page??storedModePage(id,input,observation.context.evidenceAccuracyMode,now()));state.nativeValue=value;
  state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(raw,context);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 return {...scene,family:'public-data',operation,contract,arguments:request,normalizationContext,transport,page,call,nativeReadContextPorts,
  handler:(changes={})=>createPublicDataHandlers({...transport,now,...changes},[operation])[0].execute};
}

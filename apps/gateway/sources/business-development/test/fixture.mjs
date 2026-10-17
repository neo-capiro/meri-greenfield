/** Synthetic stored projections and call-bound credential receipts. No native authority, source data or provider is accessed. */
import schema from '../../../../../packages/contracts/retrieval-0.2/business-development.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createBusinessDevelopmentHandlers} from '../handler.mjs';
import {captureBusinessDevelopmentResource} from '../request-context.mjs';
export const ids=['get_business_development_context','get_business_development_recent_changes'];
export const clientId='a1234567-b123-4c12-8d12-e123456789ab';
export const conversationId='b1234567-b123-4c12-8d12-e123456789ab';
export const prospectId='c1234567-b123-4c12-8d12-e123456789ab';
export const requests=Object.fromEntries(ids.map(id=>[id,{conversationId}]));
const historyId='d1234567-b123-4c12-8d12-e123456789ab';

export function storedPage(id,input,at){
 const stamp=new Date(at).toISOString();
 if(id===ids[0])return {tool:id,generatedAt:stamp,prospect:{id:prospectId,displayName:'Synthetic prospect',ownerUserId:null,stage:'research',
  serviceHypothesis:'Stored hypothesis',geography:null,nextAction:null,canonicalEntityId:null,linkedClientId:clientId},
  firmPreferences:{practiceServiceAreas:['Synthetic practice'],agenciesIssues:[],geographies:[]},
  history:{entries:[{id:historyId,kind:'note',body:'Stored prospect activity',at:stamp,actorUserId:null}],total:1,returned:1,truncated:false}};
 if(id!==ids[1])throw Error('SYNTHETIC_OPERATION_MISMATCH');
 return {tool:id,generatedAt:stamp,prospect:{id:prospectId,name:'Synthetic prospect'},alerts:{items:[{id:'synthetic-alert',sourceFamily:'stored-source',
  category:'change',title:'Synthetic stored change',summary:null,materiality:null,dates:{eventAt:'Source date wording',effectiveAt:null,publishedAt:null,firstObservedAt:stamp},
  sourceLocator:'https://source.example.invalid/change',implication:{text:'A conditional inference',inference:true,note:schema.$defs.BizDevRecentAlert.properties.implication.properties.note.const},
  changedFields:[{field:'status',before:null,after:{stored:'changed'}}]}],returned:1,unreadCount:3,truncated:true,limit:input.limit,
  note:schema.$defs.BusinessDevelopmentRecentChangesOutput.properties.alerts.properties.note.const}};
}

export function storedCase(id=ids[0],{request=requests[id],personal=false}={}){
 if(!ids.includes(id))throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene,scope={tenantId:authority.binding.tenantId,kind:personal?'tenant':'client',resourceId:personal?authority.binding.tenantId:clientId,policyRevision:authority.policyRevision};
 Object.assign(authority.subject,{kind:personal?'personal':'client',entityType:personal?'user':'client',entityIds:[personal?authority.binding.actorId:clientId],scopes:[scope]});
 authority.claims.scopes=[scope];authority.decision.scopes=[scope];authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const input=contract.normalizeInput(request,normalizationContext).input,page=storedPage(id,input,now());
 if(personal&&id===ids[0])page.prospect.linkedClientId=null;
 const {getCredentials,...passive}=scene.transport;
 const transport={...passive,credentialsForCall(selected,originalCall){
  state.credentialOwnerCalls??=[];state.credentialOwnerCalls.push({operation:selected,call:originalCall});
  if(state.resourceDenied)deny('ACCESS_DENIED');
  return getCredentials;
 },async fetchImpl(url,options){
  wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(raw,context);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 return {...scene,family:'business-development',operation,contract,arguments:request,normalizationContext,transport,page,call,nativeReadContextPorts,
  visibleClientIds:personal?[]:[clientId],...(personal?{}:{nativeConversation:captureBusinessDevelopmentResource(operation,request,authority.subject)}),
  handler:(changes={})=>createBusinessDevelopmentHandlers({...transport,now,...changes},[operation])[0].execute};
}

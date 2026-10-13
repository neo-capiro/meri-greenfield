/** Synthetic projection fixtures only; no native records or usable credentials. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
export const NOW=Date.parse('2026-10-13T14:00:00.000Z');
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const endpoints=Object.freeze({resolve_entity:'https://identity-projection.example.invalid/entities',find_contacts:'https://identity-projection.example.invalid/contacts'});
export const member=(change={})=>({entityType:'member',canonicalIdType:'bioguide',canonicalId:'A000001',display:'Example member',party:null,state:null,district:null,chamber:'house',lisId:null,isCurrent:true,matchedBy:'name-search',...change});
export const committee=(change={})=>({entityType:'committee',canonicalIdType:'committee',canonicalId:'hsag00',display:'Example committee',chamber:'house',parentSystemCode:null,isCurrent:true,matchedBy:'name-search',...change});
export const bill=(change={})=>({entityType:'bill',canonicalIdType:'billId',canonicalId:'119-hr-1',display:'Example bill',congress:119,sponsorName:null,sponsorBioguideId:null,latestActionText:null,latestActionDate:null,matchedBy:'bill-id',...change});
export const contact=(change={})=>({name:'Example correspondent',email:'example@example.invalid',phone:null,title:null,organization:null,lastContact:null,messageCount:0,source:'synced-mail-and-calendar',onProfile:false,...change});
export function createIdentityContactsFixture(operationId='resolve_entity',{linked=false,defaultCongress=119}={}){
 const operation={id:operationId,version:'0.2.0'},contract=resolveOperationContract(operation),state={now:NOW},calls=[],wire=[],credentialCalls=[];
 const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},clientId=id(5);
 const scopes=[{tenantId:binding.tenantId,kind:linked?'client':'tenant',resourceId:linked?clientId:binding.tenantId,policyRevision:'synthetic-policy'}];
 const subject={kind:linked?'client':'personal',entityType:linked?'client':'user',entityIds:[linked?clientId:binding.actorId],tenantId:binding.tenantId,actorId:binding.actorId,authorizationDecisionId:id(6),policyRevision:scopes[0].policyRevision,scopes,rosterVersionId:null};
 const claims={capabilityId:id(7),issuer:'synthetic-issuer',audience:'meri-gateway',binding,actions:['tool.read'],scopes,issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+10000).toISOString(),policyRevision:subject.policyRevision,budgets:{maxTurns:1,maxRuntimeSeconds:10,maxCostMicrousd:1,maxOutputBytes:1048576}};
 const decision={decisionId:subject.authorizationDecisionId,actor:{tenantId:binding.tenantId,actorId:binding.actorId},operation:`${operationId}@0.2.0`,scopes,policyRevision:subject.policyRevision,evaluatedAt:new Date(NOW).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'};
 const sourceIds=contract.descriptor.sourceRequirements.map(row=>row.sourceId),authority={binding,subject,claims,decision,policyRevision:subject.policyRevision,sourceIds,deadlineMs:NOW+10000};
 const normalizationContext=operationId==='resolve_entity'?{defaultCongress}:{};
 const args=operationId==='resolve_entity'?{query:'Example',limit:5}:linked?{clientId}:{query:'Example'};
 const normalize=(request=args,context=normalizationContext)=>contract.normalizeInput(request,context);
 const input=(request=args,context=normalizationContext)=>normalize(request,context).input;
 function rawResult(selection=input(),metadata=normalize().metadata){
  if(operationId==='resolve_entity'){
   const rows=!selection.query?[]:metadata.bioguideId?[member({canonicalId:metadata.bioguideId,matchedBy:'bioguide-id'})]:metadata.committeeId?[committee({canonicalId:metadata.committeeId,matchedBy:'system-code'})]:metadata.billId?[bill({canonicalId:metadata.billId,congress:defaultCongress})]:selection.type==='company'?[]:[member(),member({canonicalId:'B000002',isCurrent:false}),committee()];
   const selected=selection.type?rows.filter(row=>row.entityType===selection.type):rows;
   return {tool:operationId,generatedAt:new Date(state.now).toISOString(),matchesFound:Math.min(selected.length,selection.limit),matches:selected.slice(0,selection.limit),...(selected.length?{}:{note:selection.query?`No canonical entity matched "${selection.query}". Say so explicitly — do NOT fabricate a member, committee, or bill identifier.`:'resolve_entity requires a query (an id, bill designation, or name).'})};
  }
  if(!selection.clientId&&!selection.domain&&!selection.query)return {tool:operationId,generatedAt:new Date(state.now).toISOString(),contacts:[],note:'Pass a clientId, a domain, or a query — find_contacts will not dump the whole contact table.'};
  const rows=[contact()],linked=selection.clientId!==null;
  return {tool:operationId,generatedAt:new Date(state.now).toISOString(),clientId:linked?clientId:null,clientName:linked?'Synthetic client':null,matchedOn:{domain:selection.domain,query:selection.query,linkedClient:linked},contacts:rows,
   note:linked?`${rows.length} correspondent(s) found; ${rows.filter(row=>!row.onProfile).length} not yet on the People tab. These come from synced mail and calendar — cite them as such. Propose only the missing ones via update_client_profile people[].`:`${rows.length} correspondent(s) found from synced mail and calendar.`};
 }
 const page=(selection=input(),current=authority,metadata=normalize().metadata)=>({binding:structuredClone(current.binding),subject:structuredClone(current.subject),operation:structuredClone(operation),argumentsSha256:canonicalSha256(selection),result:rawResult(selection,metadata)});
 const credentials=pins=>({operation:structuredClone(pins.operation),metadata:structuredClone(pins.metadata),normalizationContext:structuredClone(pins.normalizationContext),argumentsSha256:pins.argumentsSha256,requestSha256:pins.requestSha256,binding:structuredClone(pins.binding),subject:structuredClone(pins.subject),policyRevision:pins.policyRevision,sourceIds:structuredClone(pins.sourceIds),bearerToken:'SYNTHETIC_IDENTITY_TOKEN',serviceSecret:'SYNTHETIC_SERVICE_SECRET',expiresAtMs:NOW+10000});
 const config={endpoints,now:()=>state.now,maxRequestMs:1000,maxResponseBytes:1048576,async getCredentials(pins){calls.push('credentials');credentialCalls.push(pins);return credentials(pins);},async fetchImpl(url,options){calls.push('fetch');const request=new Request(url,options);wire.push({url,options,request});const body=JSON.parse(options.body);return new Response(JSON.stringify(page(body.input,authority,body.metadata)),{headers:{'content-type':'application/json'}});}};
 const call=(request=args,current=authority,context=normalizationContext)=>({input:input(request,context),request,authority:current,normalizationContext:context,argumentsSha256:normalize(request,context).argumentsSha256});
 return {operation,contract,state,calls,wire,credentialCalls,binding,subject,claims,decision,authority,clientId,normalizationContext,args,input,normalize,rawResult,page,credentials,config,call};
}

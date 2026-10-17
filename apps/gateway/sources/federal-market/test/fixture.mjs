/** Synthetic stored market page variants; no SQL, private client query, or live source. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createFederalMarketHandlers} from '../handler.mjs';
export const ids=['search_federal_contract_awards','search_federal_subawards','search_contract_vehicles','search_procurement_forecasts','get_district_federal_market'];
export const clientId='99999999-9999-4999-8999-999999999999';
export function marketRow(id){
 if(id===ids[0])return {id:'synthetic-contract',awardId:null,recipientName:null,recipientUei:null,awardingAgency:null,amount:100.0001,description:null,
  actionDate:null,latestActionDate:null,baseAwardSignedDate:null,sourceLastModifiedDate:null,popStartDate:null,popEndDate:null,state:null,district:null,districtKey:null,source:'usaspending',sourceUpdatedAt:null};
 if(id===ids[1])return {id:'synthetic-subaward',providerKey:'provider-one',awardKey:null,primeRecipientName:null,primeRecipientUei:null,subawardeeName:null,subawardeeUei:null,
  awardingAgency:null,awardingOffice:null,amount:null,description:null,actionDate:null,fiscalYear:null,naicsCode:null,state:null,district:null,districtKey:null,sourceUrl:null,source:'tango',sourceUpdatedAt:null};
 if(id===ids[2])return {id:'synthetic-vehicle',vehicleId:'vehicle-one',name:null,solicitationIdentifier:null,vehicleType:null,agency:null,naicsCode:null,pscCode:null,setAside:null,
  lastDateToOrder:null,awardeeCount:null,orderCount:null,totalObligated:null,relationship:'parent',recipientUei:null,source:'tango',sourceUpdatedAt:null};
 return {id:'synthetic-forecast',forecastId:'forecast-one',title:'Synthetic future opportunity',description:null,agency:null,department:null,office:null,anticipatedAwardDate:null,
  estimatedPeriod:null,fiscalYear:null,naicsCode:null,pscCode:null,setAside:null,contractVehicle:null,placeOfPerformance:null,contactName:null,contactEmail:null,status:null,active:null,sourceSystem:null,sourceUrl:null,source:'tango',sourceUpdatedAt:null};
}
export function storedCase(id=ids[0],{request=id===ids[4]?{state:'NY',district:'AL'}:{}}={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={},visibleClientIds=request.clientId?[request.clientId.trim()]:[],{authority,state,now,wire}=scene;
 if(request.clientId){const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:request.clientId.trim(),policyRevision:authority.policyRevision};
  Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[request.clientId.trim()],scopes:[scope]});authority.claims.scopes=[scope];authority.decision.scopes=[scope];}
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];
 const input=contract.normalizeInput(request,{}).input,generatedAt=new Date(now()).toISOString();
 const page=id===ids[4]?{tool:id,generatedAt,districts:[{districtKey:'NY-00',state:'NY',district:'00',contractCount:1,contractAmount:100,subawardCount:0,subawardAmount:null}],
  futureSignals:[{id:'synthetic-future',source:'agency_forecast',title:'Future opportunity',agency:null,state:'NY',districtKey:null,date:null,geographyBasis:'state_text',sourceUrl:null}],
  awardedMoneyIncludesFutureOpportunities:false,warnings:[]}:
  {tool:id,generatedAt,items:[marketRow(id)],total:1,page:input.page,pageSize:input.limit,source:'Synthetic source claim',asOf:null,hasMore:false,nextPage:null,paginationLimitReached:false};
 const transport={...scene.transport,async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);}};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});}};
 const call=(raw=request,current=authority,context={})=>{const normalized=contract.normalizeInput(raw,context);return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'federal-market',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,visibleClientIds,
  handler:(changes={})=>createFederalMarketHandlers({...transport,now,...changes},[operation])[0].execute};
}

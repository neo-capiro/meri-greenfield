/** Synthetic exact District Nexus DTOs crossing native JSON bytes; no SQL/geography/provider execution. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createDistrictNexusHandlers} from '../handler.mjs';
export const ids=['get_district_nexus_context','get_district_nexus_changes'],clientId='99999999-9999-4999-8999-999999999999';
export const at='2026-10-12T01:00:00.000Z';
export function fact(){return {id:'synthetic-source:requested:one',section:'cpf_cds',label:'Synthetic district request',value:0,unit:'USD',amountStage:'requested',basis:'public_context',
 source:{type:'cpf_cds',label:'Synthetic source',recordId:'one',url:null},asOf:{date:null,fiscalYear:2027,sourceYear:null},
 geography:{state:'FL',district:'08',scope:'district',basis:null,boundaryCongress:null},freshness:{lastSyncedAt:null,stale:true,unavailable:true},coverage:'unknown',caveats:['Synthetic source coverage only']};}
export function change(){return {changeKind:'request_updated',source:'cpf_cds',sourceRecordId:'one',observedAt:at,effectiveAt:null,severity:'notable'};}
export function storedCase(id=ids[0],{request={clientId,state:'FL',district:'08'}}={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,now,wire}=scene;
 const scope={tenantId:authority.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:authority.policyRevision};
 Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[clientId],scopes:[scope]});authority.claims.scopes=[scope];authority.decision.scopes=[scope];
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];
 const normalizationContext={binding:authority.binding,subject:authority.subject},input=contract.normalizeInput(request,normalizationContext).input;
 const base={available:true,clientId:input.clientId,state:input.state,district:input.district,generatedAt:at,gaps:[],truncated:false};
 const page=id===ids[0]?{...base,clientName:'Synthetic client',facts:[{...fact(),geography:{...fact().geography,state:input.state,district:input.district}}]}:{...base,changes:[change()]};
 const transport={...scene.transport,async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);}};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});}};
 const call=(raw=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(raw,context);return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'district-nexus',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,visibleClientIds:[clientId],
  handler:(changes={})=>createDistrictNexusHandlers({...transport,now,...changes},[operation])[0].execute};
}

import wire from '../../../../../packages/contracts/test/fixtures/graph-paths.wire.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
import {createGraphPathsHandlers} from '../handler.mjs';
export const operation=Object.freeze({id:'find_path_to',version:'0.2.0'});
export function graphCase({client=false,explicitClient=client}={}){
 const scene=billTextCase(),vector=structuredClone(explicitClient?wire:wire.general),contract=resolveOperationContract(operation);
 scene.state.now=Date.parse(vector.response.observedAt)+60000;
 scene.authority.deadlineMs=scene.now()+10000;
 scene.authority.decision.operation=operation.id+'@'+operation.version;
 scene.authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(row=>row.sourceId))];
 if(client){scene.authority.subject.kind='client';scene.authority.subject.entityType='client';scene.authority.subject.entityIds=[wire.request.clientId];
  scene.authority.subject.scopes=[{tenantId:scene.binding.tenantId,kind:'client',resourceId:wire.request.clientId,policyRevision:scene.authority.policyRevision}];}
 scene.state.page=vector.response;
 scene.transport.fetchImpl=async(url,options)=>{
  const body=JSON.parse(options.body);scene.wire.push({url,options,body});const value=structuredClone(scene.state.page);
  scene.state.resultMutator?.(value);scene.state.nativeValue=value;await scene.state.afterSource?.();return Response.json(value);
 };
 const call=(request=vector.request)=>{const normalized=contract.normalizeInput(request);return {request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,authority:readContext(scene.authority),normalizationContext:{}};};
 return {...scene,operation,contract,arguments:vector.request,normalizationContext:{},visibleClientIds:[wire.request.clientId],call,
  handler:()=>createGraphPathsHandlers({...scene.transport,now:scene.now},[operation])[0].execute};
}

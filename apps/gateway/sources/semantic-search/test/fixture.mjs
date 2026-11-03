import wire from '../../../../../packages/contracts/test/fixtures/semantic-search.wire.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
import {createSemanticSearchHandlers} from '../handler.mjs';
export const VECTORS=Object.freeze({semantic_search_bills:wire.bills,semantic_search_grants:wire.grants,semantic_search_contract_opportunities:wire.contractOpportunities,
 semantic_search_dibbs_solicitations:wire.dibbs,semantic_search_sbir_topics:wire.sbirTopics});
export function semanticCase(id='semantic_search_bills',{client=false}={}){
 const scene=billTextCase(),vector=structuredClone(VECTORS[id]),operation=Object.freeze({id,version:'0.2.0'}),contract=resolveOperationContract(operation);
 scene.state.now=Date.parse(vector.response.generatedAt)+60000;
 scene.authority.deadlineMs=scene.now()+10000;
 scene.authority.decision.operation=operation.id+'@'+operation.version;
 scene.authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(row=>row.sourceId))];
 if(client){const clientId='00000003-0000-4000-8000-000000000001';scene.authority.subject.kind='client';scene.authority.subject.entityType='client';scene.authority.subject.entityIds=[clientId];
  scene.authority.subject.scopes=[{tenantId:scene.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:scene.authority.policyRevision}];}
 scene.state.page=vector.response;
 scene.transport.fetchImpl=async(url,options)=>{
  const body=JSON.parse(options.body);scene.wire.push({url,options,body});const value=structuredClone(scene.state.page);
  scene.state.resultMutator?.(value);scene.state.nativeValue=value;await scene.state.afterSource?.();return Response.json(value);
 };
 const call=(request=vector.request)=>{const normalized=contract.normalizeInput(request);return {request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,authority:readContext(scene.authority),normalizationContext:{}};};
 return {...scene,family:'semantic-search',operation,contract,arguments:vector.request,normalizationContext:{},call,
  handler:()=>createSemanticSearchHandlers({...scene.transport,now:scene.now},[operation])[0].execute};
}

/** Actual Core serialized reader outputs with synthetic source ports. No live data. */
import vectors from '../../../../../packages/contracts/test/fixtures/buyer-workspace.wire.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
import {createBuyerWorkspaceHandlers} from '../handler.mjs';
export const operation=Object.freeze({id:'get_pe_buyer_workspace',version:'0.2.0'});
export function buyerCase(index=0){
 const scene=billTextCase(),contract=resolveOperationContract(operation),vector=structuredClone(vectors.vectors[index]);
 const request=vector.request,context={};
 scene.authority.decision.operation=operation.id+'@'+operation.version;
 scene.authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(r=>r.sourceId))];
 scene.state.page=vector.response;
 scene.transport.fetchImpl=async(url,options)=>{
  const body=JSON.parse(options.body);scene.wire.push({url,options,body});
  const value=structuredClone(scene.state.page);scene.state.resultMutator?.(value);scene.state.nativeValue=value;
  await scene.state.afterSource?.();
  return scene.state.responseFactory?scene.state.responseFactory(value):Response.json(value);
 };
 const call=(raw=request,authority=scene.authority,normalizationContext=context)=>{
  const normalized=contract.normalizeInput(raw,normalizationContext);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,authority:readContext(authority),normalizationContext};
 };
 return {...scene,family:'buyer-workspace',operation,contract,arguments:request,page:vector.response,normalizationContext:context,call,
  handler:(changes={})=>createBuyerWorkspaceHandlers({...scene.transport,now:scene.now,...changes},[operation])[0].execute};
}

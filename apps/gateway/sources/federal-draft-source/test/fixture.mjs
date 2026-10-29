import wire from '../../../../../packages/contracts/test/fixtures/federal-draft-source.wire.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
import {createFederalDraftSourceHandlers} from '../handler.mjs';
import {textSha256} from '../../../../artifacts/federal-drafting/engine.mjs';
export const operation=Object.freeze({id:'prepare_federal_draft',version:'0.2.0'});
export function preparationCase(){
 const f=billTextCase(),contract=resolveOperationContract(operation),request={selection:wire.request,operations:[{id:'amount',kind:'replace',scopeId:'document',expectedScopeSha256:wire.request.textHash,expectedText:'$20',expectedTextSha256:textSha256('$20'),dependsOn:[],text:'$30'}]};
 f.authority.decision.operation=operation.id+'@'+operation.version;f.authority.sourceIds=contract.descriptor.sourceRequirements.map(r=>r.sourceId);f.state.page=structuredClone(wire.response);
 f.transport.fetchImpl=async(url,options)=>{f.wire.push({url,options,body:JSON.parse(options.body)});const result=structuredClone(f.state.page);f.state.resultMutator?.(result);await f.state.afterSource?.();return Response.json(result);};
 const call=(input=request)=>{const normalized=contract.normalizeInput(input);return {request:input,input:normalized.input,argumentsSha256:normalized.argumentsSha256,authority:readContext(f.authority),normalizationContext:{}};};
 return {...f,operation,contract,sourcePath:'/api/clio/tools/read_federal_draft_source',arguments:request,normalizationContext:{},call,handler:()=>createFederalDraftSourceHandlers({...f.transport,now:f.now},[operation])[0].execute};
}

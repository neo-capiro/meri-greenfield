/** Separate private version. Reuse4d8's Draft/shared fields; initial Request remains unchanged. */
import {candidateSchema as initialSchema} from '../strategy-operations-candidate/schema.mjs';
import {regenerationRequestKeys,regenerationBasisKeys,REGENERATION_REQUEST_VERSION,REGENERATION_RESULT_VERSION,CORE_STRATEGY_BASIS_NAMESPACE} from '../../runtime/objective-strategy-protocol.mjs';
export const requestVersion=REGENERATION_REQUEST_VERSION,resultVersion=REGENERATION_RESULT_VERSION;
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),sha={type:'string',pattern:'^[a-f0-9]{64}$'},uuid={type:'string',pattern:'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'};
export function candidateSchema(){
 const initial=initialSchema(),defs=initial.$defs,p=defs.Request.properties,draft=defs.Request.oneOf.find(b=>b.properties.operation.const==='strategy.draft').properties;
 // Core owns the exact snapshot/archive/source-index/history shapes and their server reconstruction. Meri binds inert JSON whole-component digests.
 const basis=Object.fromEntries(regenerationBasisKeys.map(k=>[k,{}]));Object.assign(basis,{schemaVersion:{const:1},namespace:{const:CORE_STRATEGY_BASIS_NAMESPACE},sourceAdmissionSha256:sha,strategyId:uuid,expectedStrategyVersionId:uuid,snapshotSha256:sha,archiveIndexSha256:sha,sourceIndexSha256:sha});
 const request=Object.fromEntries(regenerationRequestKeys.map(k=>[k,p[k]??{}]));Object.assign(request,{requestVersion:{const:requestVersion},operation:{const:'strategy.draft'},applicationTarget:object({mode:{const:'regenerate'},canonical:{type:'object'},expectedStrategyVersionId:uuid}),basis:object(basis),basisSha256:sha,input:draft.input});
 const {candidateVersion,...result}=defs.Result.properties;Object.assign(result,{resultVersion:{const:resultVersion},operation:{const:'strategy.draft'},basisSha256:sha,state:{enum:['succeeded','needs-information','refused']},payload:{anyOf:[defs.Draft,{type:'null'}]},execution:defs.ExecutionProvenance});
 return {$schema:initial.$schema,$id:'urn:meri:private:objective-regeneration:20261016:1',title:'Private data only; no authority or runtime mount',$defs:{...defs,RegenerationRequest:object(request),RegenerationResult:object(result)}};
}

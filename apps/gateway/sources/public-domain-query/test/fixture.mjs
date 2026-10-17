/** Synthetic typed rows and native SQL-bearing HTTP DTOs; never executes analytics or audit writes. */
import {resolveOperationContract,publicDomainDatasetRegistry} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createPublicDomainQueryHandlers} from '../handler.mjs';
export const id='query_global_data',nativeSql='SELECT synthetic_projection FROM synthetic_global_dataset';
export function storedCase(selected=id,options={}){
 if(selected!==id)throw Error('SYNTHETIC_OPERATION_MISMATCH');
 const {request={dataset:'federal_grants',select:[{field:'agency'}],limit:2}}=options;
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,now,wire}=scene;
 const snapshot=publicDomainDatasetRegistry.resolveDatasetSnapshot(request.dataset),stamp=new Date(now()).toISOString();
 const normalizationContext={defaultAsOf:Object.hasOwn(options,'defaultAsOf')?options.defaultAsOf:snapshot.metadata.supportsAsOf&&!Object.hasOwn(request,'asOfDate')?stamp:null};
 const {input}=contract.normalizeInput(request,normalizationContext),fields=new Map(snapshot.metadata.fields.map(field=>[field.name,field]));
 const row=Object.fromEntries(input.select.map(item=>{
  const alias=item.agg?`${item.agg}_${item.field||'all'}`:item.field,type=fields.get(item.field)?.type;
  const value=item.agg==='count'||item.agg==='count_distinct'?1:type==='number'?17:type==='boolean'?false:type==='date'||type==='timestamp'?stamp:type==='string[]'?['Synthetic',null]:'Synthetic';
  return [alias,value];
 }));
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];
 const page={tool:id,generatedAt:stamp,dataset:input.dataset,rowCount:1,rows:[row]},nativePage={...page,sql:nativeSql};
 const transport={...scene.transport,async fetchImpl(url,options){
  wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??nativePage);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 // Echo-only synthetic context. The trusted credential owner supplies the real once-captured observation.
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(original=request,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(original,context);return {request:original,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};};
 return {...scene,family:'public-domain-query',operation,contract,arguments:request,normalizationContext,transport,page,nativePage,nativeReadContextPorts,call,
  handler:(changes={})=>createPublicDomainQueryHandlers({...transport,now,...changes},[operation])[0].execute};
}

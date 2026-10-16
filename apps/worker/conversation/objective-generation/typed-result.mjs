/** One candidate ModelOutcome -> immutable result bytes. Core owns DTO normalization/application. No custody or authority is minted here. */
import {own,data,hash,typedFault,MAX_TYPED_RESULT_BYTES,rawTypedSha256,typedExecutionWitness,assertTypedResult,assertTypedResultBytes,assertObjectiveExecutionContext} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {objectiveRequestProtocol,REGENERATION_REQUEST_VERSION,REGENERATION_RESULT_VERSION,OBJECTIVE_DRAFT_PROTOCOL,OBJECTIVE_REGENERATION_PROTOCOL} from '../../../../packages/runtime/objective-strategy-protocol.mjs';
const refuse=()=>{throw typedFault();};
let loaded;
let regenerationLoaded;
/** The exact private4d8 dependency is separately reviewed; absent distribution fails only this opt-in path. */
export async function loadTypedDraftCodec(){
 loaded??=Promise.all([import('../../../../packages/contracts/strategy-operations-candidate/validate.mjs'),import('../../../../packages/contracts/strategy-operations-candidate/schema.mjs')]).then(([v,s])=>createTypedDraftCodec({...v,...s}));
 try{return await loaded;}catch{throw Error('OBJECTIVE_TYPED_CONTRACT_UNAVAILABLE');}
}
export async function loadObjectiveStrategyCodec(request){
 if(objectiveRequestProtocol(request).kind==='objective.strategy.draft')return loadTypedDraftCodec();
 regenerationLoaded??=import('../../../../packages/contracts/objective-regeneration-private/validate.mjs').then(createTypedRegenerationCodec);
 try{return await regenerationLoaded;}catch{throw Error('OBJECTIVE_TYPED_CONTRACT_UNAVAILABLE');}
}
/** Contract functions must be the canonical candidate owner, never supplied by a request/model. */
export function createTypedDraftCodec(contract){
 if(contract.candidateVersion!==OBJECTIVE_DRAFT_PROTOCOL.version)refuse();return createCodec(contract,OBJECTIVE_DRAFT_PROTOCOL);
}
export function createTypedRegenerationCodec(contract){
 if(contract.requestVersion!==REGENERATION_REQUEST_VERSION||contract.resultVersion!==REGENERATION_RESULT_VERSION)refuse();return createCodec(contract,OBJECTIVE_REGENERATION_PROTOCOL);
}
function createCodec(contract,protocol){
 if(['assertRequest','assertSdkPayload','assertRetainedResult','candidateSchema'].some(k=>typeof contract?.[k]!=='function'))refuse();
 function selection(value){
  const v=own(value,['binding','acceptedRequest','sourceAdmissionSha256','strategy'],['sourceRequestSha256']),s=data(own(v.strategy,['schemaVersion','operation','request','requestSha256','executionContext','queuedType','executionSelection'])),r=contract.assertRequest(s.request);
  if(s.schemaVersion!==1||s.operation!=='strategy.draft'||objectiveRequestProtocol(r,{sourceAdmissionSha256:v.sourceAdmissionSha256}).kind!==protocol.kind||r.source.kind!=='objective'||hash(r)!==s.requestSha256||r.requestId!==v.acceptedRequest.requestId||r.principal.tenantId!==v.binding.tenantId||r.principal.actorId!==v.binding.actorId||r.input.typeHint===null||r.input.typeHint!==s.queuedType)refuse();
  const e=data(own(s.executionSelection,['provider','model']));if(Object.values(e).some(x=>typeof x!=='string'||!x.trim()||x.length>128)||typeof v.sourceAdmissionSha256!=='string'||v.sourceAdmissionSha256.length!==64||!/^[a-f0-9]{64}$/u.test(v.sourceAdmissionSha256)||v.sourceRequestSha256!==undefined&&v.sourceRequestSha256!==hash(v.acceptedRequest))refuse();
  assertObjectiveExecutionContext(s.executionContext,{request:r,acceptedRequest:v.acceptedRequest});return data({binding:v.binding,acceptedRequest:v.acceptedRequest,sourceAdmissionSha256:v.sourceAdmissionSha256,strategy:s,sourceRequestSha256:hash(v.acceptedRequest)});
 }
 function outputFormat(){const defs=contract.candidateSchema().$defs,outcome=data(defs.ModelOutcome),schema={...outcome,properties:{...outcome.properties,operation:{const:'strategy.draft'},payload:{anyOf:[defs.Draft,{type:'null'}]}}};return data({type:'json_schema',schema});}
 function encode(value){
  const v=own(value,['selection','executionSelection','sdkResult','sessionId','receiptRef','resultRef','completedAtMs']),s=selection(v.selection),actual=data(own(v.executionSelection,['provider','model'])),r=s.strategy.request,m=contract.assertSdkPayload(v.sdkResult,{request:r});
  // Runtime must obtain this from its actual query/proxy owner; these data checks grant no authority by themselves.
  if(hash(actual)!==hash(s.strategy.executionSelection))refuse();
  if(m.state==='succeeded'&&m.payload.type!==s.strategy.queuedType||!Number.isSafeInteger(v.completedAtMs)||v.completedAtMs<r.requestedAtMs||v.completedAtMs>=r.originalExpiresAtMs)refuse();
  const execution={...actual,receiptRef:v.receiptRef,receiptSha256:'0'.repeat(64),bindingSha256:hash(s.binding)},observation={sessionId:v.sessionId,completedAtMs:v.completedAtMs,state:m.state,payloadSha256:hash(m.payload)};
  const witness={sourceAdmissionSha256:s.sourceAdmissionSha256,sourceRequestSha256:s.sourceRequestSha256,typedRequestSha256:s.strategy.requestSha256,execution,observation};execution.receiptSha256=hash(typedExecutionWitness(witness));
  const body=data({[protocol.versionKey]:protocol.version,operation:'strategy.draft',requestId:r.requestId,jobId:r.jobId,requestSha256:s.strategy.requestSha256,inputSha256:r.inputSha256,sourceSha256:hash(r.source),contextSha256:r.context.contextSha256,basisSha256:r.basis===null?null:r.basisSha256,binding:s.binding,execution,resultRef:v.resultRef,completedAtMs:v.completedAtMs,state:m.state,payload:m.payload,payloadSha256:hash(m.payload),issues:m.issues});
  const result=data({...body,resultSha256:hash(body)});contract.assertRetainedResult(result,{request:r,binding:s.binding,execution,resultRef:v.resultRef,resultSha256:result.resultSha256});
  const bytes=Buffer.from(JSON.stringify(result),'utf8');if(bytes.length>MAX_TYPED_RESULT_BYTES)refuse();
  const descriptor=assertTypedResult({schemaVersion:1,kind:protocol.kind,path:protocol.path,sourceAdmissionSha256:s.sourceAdmissionSha256,sourceRequestSha256:s.sourceRequestSha256,typedRequestSha256:s.strategy.requestSha256,resultRef:v.resultRef,resultSha256:result.resultSha256,fileSha256:rawTypedSha256(bytes),bytes:bytes.length,execution,observation},{binding:s.binding,sourceRequestSha256:s.sourceRequestSha256,sessionId:v.sessionId});
  return {result,descriptor,bytes};
 }
 function decode(bytes,descriptor,value){const s=selection(value),d=assertTypedResult(descriptor,{binding:s.binding,sourceRequestSha256:s.sourceRequestSha256});assertTypedResultBytes(bytes,d);
  if(d.kind!==protocol.kind||d.sourceAdmissionSha256!==s.sourceAdmissionSha256||d.typedRequestSha256!==s.strategy.requestSha256||d.execution.provider!==s.strategy.executionSelection.provider||d.execution.model!==s.strategy.executionSelection.model)refuse();
  let r;try{r=data(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{refuse();}
  // This writer serializes once with JSON.stringify; reject duplicate keys, whitespace rewrites and alternate spellings.
  if(!Buffer.from(JSON.stringify(r),'utf8').equals(bytes)||r[protocol.versionKey]!==protocol.version||r.basisSha256!==(s.strategy.request.basis===null?null:s.strategy.request.basisSha256)||r.completedAtMs!==d.observation.completedAtMs||r.state!==d.observation.state||r.payloadSha256!==d.observation.payloadSha256)refuse();
  contract.assertRetainedResult(r,{request:s.strategy.request,binding:s.binding,execution:d.execution,resultRef:d.resultRef,resultSha256:d.resultSha256});
  if(r.state==='succeeded'&&r.payload.type!==s.strategy.queuedType)refuse();return r;
 }
 return Object.freeze({selection,outputFormat,encode,decode});
}

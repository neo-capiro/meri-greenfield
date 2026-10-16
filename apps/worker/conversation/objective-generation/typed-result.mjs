/** One candidate ModelOutcome -> immutable result bytes. Core owns DTO normalization/application. No custody or authority is minted here. */
import {own,data,hash,typedFault,OBJECTIVE_DRAFT_PATH,MAX_TYPED_RESULT_BYTES,rawTypedSha256,typedExecutionWitness,assertTypedResult,assertTypedResultBytes,assertObjectiveExecutionContext} from '../../../../packages/runtime/objective-generation-custody.mjs';
const refuse=()=>{throw typedFault();};
let loaded;
/** The exact private4d8 dependency is separately reviewed; absent distribution fails only this opt-in path. */
export async function loadTypedDraftCodec(){
 loaded??=Promise.all([import('../../../../packages/contracts/strategy-operations-candidate/validate.mjs'),import('../../../../packages/contracts/strategy-operations-candidate/schema.mjs')]).then(([v,s])=>createTypedDraftCodec({...v,...s}));
 try{return await loaded;}catch{throw Error('OBJECTIVE_TYPED_CONTRACT_UNAVAILABLE');}
}
/** Contract functions must be the canonical candidate owner, never supplied by a request/model. */
export function createTypedDraftCodec(contract){
 if(['assertRequest','assertSdkPayload','assertRetainedResult','candidateSchema'].some(k=>typeof contract?.[k]!=='function')||contract.candidateVersion!=='strategy-candidate/20261015.2')refuse();
 function selection(value){
  const v=own(value,['binding','acceptedRequest','sourceAdmissionSha256','strategy'],['sourceRequestSha256']),s=data(own(v.strategy,['schemaVersion','operation','request','requestSha256','executionContext','queuedType','executionSelection'])),r=contract.assertRequest(s.request);
  if(s.schemaVersion!==1||s.operation!=='strategy.draft'||r.operation!=='strategy.draft'||r.basis!==null||r.source.kind!=='objective'||hash(r)!==s.requestSha256||r.requestId!==v.acceptedRequest.requestId||r.principal.tenantId!==v.binding.tenantId||r.principal.actorId!==v.binding.actorId||r.input.typeHint===null||r.input.typeHint!==s.queuedType)refuse();
  const e=data(own(s.executionSelection,['provider','model']));if(Object.values(e).some(x=>typeof x!=='string'||!x.trim()||x.length>128)||typeof v.sourceAdmissionSha256!=='string'||v.sourceAdmissionSha256.length!==64||!/^[a-f0-9]{64}$/u.test(v.sourceAdmissionSha256)||v.sourceRequestSha256!==undefined&&v.sourceRequestSha256!==hash(v.acceptedRequest))refuse();
  assertObjectiveExecutionContext(s.executionContext,{request:r,acceptedRequest:v.acceptedRequest});return data({binding:v.binding,acceptedRequest:v.acceptedRequest,sourceAdmissionSha256:v.sourceAdmissionSha256,strategy:s,sourceRequestSha256:hash(v.acceptedRequest)});
 }
 function outputFormat(){const defs=contract.candidateSchema().$defs,outcome=data(defs.ModelOutcome),schema={...outcome,properties:{...outcome.properties,operation:{const:'strategy.draft'},payload:{anyOf:[defs.Draft,{type:'null'}]}}};return data({type:'json_schema',schema});}
 function encode(value){
  const v=own(value,['selection','sdkResult','sessionId','receiptRef','resultRef','completedAtMs']),s=selection(v.selection),r=s.strategy.request,m=contract.assertSdkPayload(v.sdkResult,{request:r});
  if(m.state==='succeeded'&&m.payload.type!==s.strategy.queuedType||!Number.isSafeInteger(v.completedAtMs)||v.completedAtMs<r.requestedAtMs||v.completedAtMs>=r.originalExpiresAtMs)refuse();
  const execution={...s.strategy.executionSelection,receiptRef:v.receiptRef,receiptSha256:'0'.repeat(64),bindingSha256:hash(s.binding)},observation={sessionId:v.sessionId,completedAtMs:v.completedAtMs,state:m.state,payloadSha256:hash(m.payload)};
  const witness={sourceAdmissionSha256:s.sourceAdmissionSha256,sourceRequestSha256:s.sourceRequestSha256,typedRequestSha256:s.strategy.requestSha256,execution,observation};execution.receiptSha256=hash(typedExecutionWitness(witness));
  const body=data({candidateVersion:contract.candidateVersion,operation:'strategy.draft',requestId:r.requestId,jobId:r.jobId,requestSha256:s.strategy.requestSha256,inputSha256:r.inputSha256,sourceSha256:hash(r.source),contextSha256:r.context.contextSha256,basisSha256:null,binding:s.binding,execution,resultRef:v.resultRef,completedAtMs:v.completedAtMs,state:m.state,payload:m.payload,payloadSha256:hash(m.payload),issues:m.issues});
  const result=data({...body,resultSha256:hash(body)});contract.assertRetainedResult(result,{request:r,binding:s.binding,execution,resultRef:v.resultRef,resultSha256:result.resultSha256});
  const bytes=Buffer.from(JSON.stringify(result),'utf8');if(bytes.length>MAX_TYPED_RESULT_BYTES)refuse();
  const descriptor=assertTypedResult({schemaVersion:1,kind:'objective.strategy.draft',path:OBJECTIVE_DRAFT_PATH,sourceAdmissionSha256:s.sourceAdmissionSha256,sourceRequestSha256:s.sourceRequestSha256,typedRequestSha256:s.strategy.requestSha256,resultRef:v.resultRef,resultSha256:result.resultSha256,fileSha256:rawTypedSha256(bytes),bytes:bytes.length,execution,observation},{binding:s.binding,sourceRequestSha256:s.sourceRequestSha256,sessionId:v.sessionId});
  return {result,descriptor,bytes};
 }
 function decode(bytes,descriptor,value){const s=selection(value),d=assertTypedResult(descriptor,{binding:s.binding,sourceRequestSha256:s.sourceRequestSha256});assertTypedResultBytes(bytes,d);
  if(d.sourceAdmissionSha256!==s.sourceAdmissionSha256||d.typedRequestSha256!==s.strategy.requestSha256||d.execution.provider!==s.strategy.executionSelection.provider||d.execution.model!==s.strategy.executionSelection.model)refuse();
  let r;try{r=data(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{refuse();}
  // This writer serializes once with JSON.stringify; reject duplicate keys, whitespace rewrites and alternate spellings.
  if(!Buffer.from(JSON.stringify(r),'utf8').equals(bytes)||r.completedAtMs!==d.observation.completedAtMs||r.state!==d.observation.state||r.payloadSha256!==d.observation.payloadSha256)refuse();
  contract.assertRetainedResult(r,{request:s.strategy.request,binding:s.binding,execution:d.execution,resultRef:d.resultRef,resultSha256:d.resultSha256});
  if(r.state==='succeeded'&&r.payload.type!==s.strategy.queuedType)refuse();return r;
 }
 return Object.freeze({selection,outputFormat,encode,decode});
}

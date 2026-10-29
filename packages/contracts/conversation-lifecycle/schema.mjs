import {lifecycleErrorStatuses} from './protocol.mjs';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const nullable=v=>({anyOf:[v,{type:'null'}]});
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'},sha256={type:'string',pattern:'^[a-f0-9]{64}$'},binding={$ref:'urn:meri:contracts:0.1.0#/$defs/RunBinding'};
// One answer per asked question: an option label or the user's own text, or — for a multi-select question only — the
// selected labels. The worker maps these onto the native `AskUserQuestion` answer record; the control plane stores them
// and grants nothing by itself.
const answers={type:'object',minProperties:1,maxProperties:4,propertyNames:{type:'string',minLength:1,maxLength:1000},
 additionalProperties:{anyOf:[{type:'string',minLength:1,maxLength:10000},{type:'array',minItems:1,maxItems:4,uniqueItems:true,items:{type:'string',minLength:1,maxLength:10000}}]}};
export function lifecycleSchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:meri:conversation-lifecycle:0.1.0',$defs:{
 ConversationLifecycleControlRequest:{oneOf:[object({controlId:uuid,intent:{const:'steer'},text:{type:'string',minLength:1,maxLength:100000,allOf:[{pattern:'\\S'},{pattern:'^[^\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]*$'}]}}),object({controlId:uuid,intent:{const:'pause'}}),object({controlId:uuid,intent:{const:'approval.wait'},proposalId:uuid}),object({controlId:uuid,intent:{const:'answer'},questionId:uuid,answers}),...['resume','fork'].map(intent=>object({controlId:uuid,intent:{const:intent},checkpointId:uuid,checkpointSha256:sha256}))]},
 ConversationLifecycleControlReceipt:object({controlId:uuid,intent:{enum:['steer','pause','approval.wait','answer','resume','fork']},sourceBinding:binding,inputSha256:sha256,state:{enum:['PENDING','DISPATCHING','APPLIED','UNKNOWN']},checkpointId:nullable(uuid),targetBinding:nullable(binding),admissionReceiptId:nullable(uuid),retirementReceiptId:nullable(uuid),replayed:{type:'boolean'}}),
 ConversationCheckpointInspectionRequest:object({checkpointId:uuid}),
 ConversationCheckpointInspectionReceipt:object({checkpointId:uuid,checkpointSha256:sha256,sourceBinding:binding,lastEventSequence:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER}}),
 ConversationLifecycleErrorResponse:object({error:object({code:{enum:Object.keys(lifecycleErrorStatuses)},outcome:{enum:['NOT_DISPATCHED','UNKNOWN']}})})
}};}

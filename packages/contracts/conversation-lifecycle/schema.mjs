import {lifecycleErrorStatuses} from './protocol.mjs';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const nullable=v=>({anyOf:[v,{type:'null'}]});
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'},sha256={type:'string',pattern:'^[a-f0-9]{64}$'},binding={$ref:'urn:meri:contracts:0.1.0#/$defs/RunBinding'};
export function lifecycleSchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:meri:conversation-lifecycle:0.1.0',$defs:{
 ConversationLifecycleControlRequest:{oneOf:[object({controlId:uuid,intent:{const:'steer'},text:{type:'string',minLength:1,maxLength:100000,allOf:[{pattern:'\\S'},{pattern:'^[^\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]*$'}]}}),object({controlId:uuid,intent:{const:'pause'}}),object({controlId:uuid,intent:{const:'approval.wait'},proposalId:uuid}),...['resume','fork'].map(intent=>object({controlId:uuid,intent:{const:intent},checkpointId:uuid,checkpointSha256:sha256}))]},
 ConversationLifecycleControlReceipt:object({controlId:uuid,intent:{enum:['steer','pause','approval.wait','resume','fork']},sourceBinding:binding,inputSha256:sha256,state:{enum:['PENDING','DISPATCHING','APPLIED','UNKNOWN']},checkpointId:nullable(uuid),targetBinding:nullable(binding),admissionReceiptId:nullable(uuid),retirementReceiptId:nullable(uuid),replayed:{type:'boolean'}}),
 ConversationCheckpointInspectionRequest:object({checkpointId:uuid}),
 ConversationCheckpointInspectionReceipt:object({checkpointId:uuid,checkpointSha256:sha256,sourceBinding:binding,lastEventSequence:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER}}),
 ConversationLifecycleErrorResponse:object({error:object({code:{enum:Object.keys(lifecycleErrorStatuses)},outcome:{enum:['NOT_DISPATCHED','UNKNOWN']}})})
}};}

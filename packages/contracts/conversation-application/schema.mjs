import {conversationErrorStatuses} from './protocol.mjs';
const pub = name => ({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const common = name => ({$ref:'urn:meri:retrieval:common:0.2.0#/$defs/'+name});
const skill = property => ({$ref:'urn:meri:retrieval:skill:0.2.0#/$defs/SkillInvocation/properties/'+property});
const ref = name => ({$ref:'#/$defs/'+name});
const object = (properties, required=Object.keys(properties)) => ({type:'object',properties,required,additionalProperties:false});
const nullable = schema => ({anyOf:[schema,{type:'null'}]});
const sequence = {type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER};
const uuid = {type:'string',format:'uuid'};
const requestId = {type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
const prompt = {type:'string',minLength:1,maxLength:100000,pattern:'\\S'};
const sha256 = {type:'string',pattern:'^[a-f0-9]{64}$'};
export function conversationSchema(){
 const selection=object({skillId:skill('skillId'),skillVersion:skill('skillVersion')});
 return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:meri:conversation-application:0.1.0',$defs:{
  ConversationSubmitRequest:object({requestId,prompt,windowRequest:common('WindowRequest'),skill:selection},['requestId','prompt']),
  ConversationHistoryRequest:object({after:sequence,limit:{type:'integer',minimum:1,maximum:100}},[]),
  ConversationCancelRequest:object({}),
  ConversationEventsRequest:object({command:object({conversationId:uuid,intent:{const:'view.subscribe'}})}),
  ConversationSkillAssetPin:object({skillId:skill('skillId'),skillVersion:skill('skillVersion'),manifestSha256:sha256,proseSha256:sha256,catalogSha256:sha256}),
  ConversationStoredRequest:object({requestId,prompt,skill:nullable(ref('ConversationSkillAssetPin')),window:nullable(common('NormalizedWindow')),windowRequest:nullable(common('WindowRequest'))}),
  ConversationSubmittedResponse:object({run:pub('Run'),requestId,lastSequence:{...sequence,minimum:1},replayed:{type:'boolean'}}),
  ConversationHistoryResponse:object({run:pub('Run'),request:ref('ConversationStoredRequest'),events:{type:'array',items:pub('UIEvent'),maxItems:100},nextSequence:sequence,hasMore:{type:'boolean'},lastSequence:{...sequence,minimum:1}}),
  ConversationCancelledResponse:object({state:{enum:['completed','failed','cancelled']}}),
  ConversationEvent:pub('UIEvent'),
  ConversationErrorResponse:object({error:object({code:{enum:Object.keys(conversationErrorStatuses)}})}),
 }};
}

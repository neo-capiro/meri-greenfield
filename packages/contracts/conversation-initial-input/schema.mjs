import {conversationInitialInputMetadata,initialInputErrorStatuses} from './protocol.mjs';
const ref=name=>({$ref:'#/$defs/'+name}),input=name=>({$ref:'urn:meri:conversation-input:1.0.0#/$defs/'+name});
const pub=name=>({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const integer=minimum=>({type:'integer',minimum,maximum:Number.MAX_SAFE_INTEGER});
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'},digest={type:'string',pattern:'^[a-f0-9]{64}$'};
export function initialInputSchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:conversationInitialInputMetadata.schemaId,$defs:{
 ConversationInitialInputRequest:input('ConversationInputRequest'),
 ConversationInitialInputExpectedContext:input('ConversationInputExpectedContext'),
 ConversationInitialInputAllocation:object({binding:pub('RunBinding'),scopes:{type:'array',items:pub('Scope'),minItems:1,maxItems:100,uniqueItems:true},versions:pub('RuntimeVersions'),selectedClientId:uuid,requestId:uuid,inputSha256:digest,requestSha256:digest,allocatedAtMs:integer(0),expiresAtMs:integer(1)}),
 ConversationInitialInputAllocatedResponse:object({allocation:ref('ConversationInitialInputAllocation'),state:{enum:['RESERVED','ACCEPTED']},created:{type:'boolean'}}),
 ConversationInitialInputErrorResponse:object({error:object({code:{enum:Object.keys(initialInputErrorStatuses)},outcome:{enum:['NOT_DISPATCHED','UNKNOWN']}})}),
 }};}

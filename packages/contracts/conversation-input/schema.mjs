import {conversationInputMetadata} from './protocol.mjs';
const canonical=name=>({$ref:'urn:meri:conversation-application:0.1.0#/$defs/'+name});
const pub=name=>({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
const principal={type:'string',minLength:1,maxLength:128};
export function inputSchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:conversationInputMetadata.schemaId,$defs:{
 ConversationInputRequest:canonical('ConversationSubmitRequest'),
 ConversationInputStoredRequest:canonical('ConversationStoredRequest'),
 ConversationInputAdmittedResponse:object({run:pub('Run'),request:canonical('ConversationStoredRequest'),lastSequence:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},replayed:{type:'boolean'}}),
 ConversationInputExpectedContext:object({tenantId:principal,actorId:principal,conversationId:uuid,runId:uuid,clientId:uuid}),
 ConversationInputErrorResponse:canonical('ConversationErrorResponse'),
 }};}

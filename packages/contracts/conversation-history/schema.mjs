import {conversationHistoryMetadata,DISCOVERY_SCHEMA,HISTORY_SCHEMA,TURN_SCHEMA,historyErrorStatuses} from './protocol.mjs';
const ref=name=>({$ref:'#/$defs/'+name}),pub=name=>({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const stored=name=>({$ref:'urn:meri:conversation-application:0.1.0#/$defs/ConversationStoredRequest/properties/'+name});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const nullable=schema=>({anyOf:[schema,{type:'null'}]});
const integer=(minimum=0)=>({type:'integer',minimum,maximum:Number.MAX_SAFE_INTEGER});
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'},limit={type:'integer',minimum:1,maximum:100};
const items=name=>({type:'array',items:ref(name),maxItems:100});
export function historySchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:conversationHistoryMetadata.schemaId,$defs:{
 ConversationHistoryBefore:object({createdAt:{type:'string',format:'date-time'},conversationId:uuid}),
 ConversationHistoryListRequest:object({before:nullable(ref('ConversationHistoryBefore')),limit},[]),
 ConversationHistoryTranscriptRequest:object({conversationId:uuid,after:integer(),limit},['conversationId']),
 ConversationHistoryNextTurnRequest:object({conversationId:uuid,sourceRunId:uuid}),
 ConversationHistoryStoredRequest:object({requestId:stored('requestId'),prompt:stored('prompt'),skill:stored('skill'),window:stored('window'),windowRequest:stored('windowRequest')},['requestId','prompt','skill','window']),
 ConversationPromptLineage:{oneOf:[object({kind:{const:'submission'},logicalRequestId:uuid,sourceBinding:{type:'null'},sourceRequestId:{type:'null'}}),object({kind:{enum:['resume','fork']},logicalRequestId:uuid,sourceBinding:pub('RunBinding'),sourceRequestId:uuid})]},
 ConversationHistoryTurn:object({run:pub('Run'),request:ref('ConversationHistoryStoredRequest'),promptLineage:ref('ConversationPromptLineage'),sequenceBase:integer(),sequenceEnd:nullable(integer()),lastSequence:integer(1)}),
 ConversationHistoryEvent:object({sequence:integer(1),event:pub('UIEvent')}),
 ConversationHistoryPendingTurn:object({sourceBinding:pub('RunBinding'),targetBinding:pub('RunBinding'),state:{const:'RESERVED'}}),
 ConversationHistoryListResponse:object({schema:{const:DISCOVERY_SCHEMA},conversations:{type:'array',items:pub('Conversation'),maxItems:100},nextBefore:nullable(ref('ConversationHistoryBefore'))}),
 ConversationHistoryTranscriptResponse:object({schema:{const:HISTORY_SCHEMA},conversation:pub('Conversation'),latestRun:pub('Run'),latestSequenceBase:integer(),turns:items('ConversationHistoryTurn'),events:items('ConversationHistoryEvent'),nextSequence:integer(),lastSequence:integer(1),hasMore:{type:'boolean'},pendingTurn:nullable(ref('ConversationHistoryPendingTurn'))}),
 ConversationHistoryNextTurnResponse:object({schema:{const:TURN_SCHEMA},sourceBinding:pub('RunBinding'),targetBinding:pub('RunBinding'),state:{enum:['RESERVED','ACCEPTED']},replayed:{type:'boolean'}}),
 ConversationHistoryErrorResponse:object({error:object({code:{enum:Object.keys(historyErrorStatuses)},outcome:{enum:conversationHistoryMetadata.errorOutcomes},field:{type:'string',pattern:'^[A-Za-z][A-Za-z0-9_.-]{0,127}$'}},['code'])})
}};}

import {conversationHistoryMetadata,DISCOVERY_SCHEMA,HISTORY_SCHEMA,TURN_SCHEMA,EXPORT_SCHEMA,MANAGEMENT_VERSION,historyErrorStatuses} from './protocol.mjs';
import {SELECTED_DOCUMENT_REVISION_SKILL_SCHEMA} from '../document-revision.mjs';
const ref=name=>({$ref:'#/$defs/'+name}),pub=name=>({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const stored=name=>({$ref:'urn:meri:conversation-application:0.4.0#/$defs/ConversationStoredRequest/properties/'+name});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const nullable=schema=>({anyOf:[schema,{type:'null'}]});
const integer=(minimum=0)=>({type:'integer',minimum,maximum:Number.MAX_SAFE_INTEGER});
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'},limit={type:'integer',minimum:1,maximum:100};
const items=name=>({type:'array',items:ref(name),maxItems:100});
const date={type:'string',format:'date-time'},revision={type:'string',pattern:'^(0|[1-9][0-9]{0,17})$'},title={type:'string',minLength:1,maxLength:200};
const managementFields={version:{const:MANAGEMENT_VERSION},requestId:uuid,conversationId:uuid,expectedRevision:revision};
const deletionReference={requestId:uuid,createdAt:date,conversationId:uuid,revision,restoreUntil:date};
const metadata={conversationId:uuid,title,status:{enum:['active','archived','trashed']},revision,scopeKind:{enum:['client','general']},clientId:nullable(uuid),updatedAt:date,archivedAt:nullable(date),trashedAt:nullable(date),restoreUntil:nullable(date)};
export function historySchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:conversationHistoryMetadata.schemaId,$defs:{
 ConversationDeletionReference:object(deletionReference),
 ConversationDeletionBefore:object({createdAt:date,requestId:uuid}),
 ConversationDeletionReadback:object({version:{const:MANAGEMENT_VERSION},...deletionReference,metadataState:{enum:['present','absent','superseded']},checkedAtMs:integer()}),
 ConversationHistoryDeletionsRequest:object({version:{const:MANAGEMENT_VERSION},before:nullable(ref('ConversationDeletionBefore'))}),
 ConversationHistoryDeletionsResponse:object({version:{const:MANAGEMENT_VERSION},requests:{type:'array',maxItems:20,items:ref('ConversationDeletionReference')},olderRequestsUnavailable:{type:'boolean'},nextBefore:nullable(ref('ConversationDeletionBefore'))}),
 ConversationHistoryDeletionStatusRequest:object({version:{const:MANAGEMENT_VERSION},requestId:uuid}),
 ConversationHistoryDeletionStatusResponse:object({version:{const:MANAGEMENT_VERSION},...deletionReference,state:{enum:['pending','blocked','unknown','completed','superseded']},reasons:{type:'array',uniqueItems:true,maxItems:9,items:{enum:['restore_period','legal_hold','object_lock','shared_reference','policy','cleanup_pending','verification_unavailable','cleanup_disabled']}},checkedAtMs:integer(),retainedSharedCopies:{type:'boolean'}}),
 ConversationHistoryExportRequest:object({conversationId:uuid}),
 ConversationHistoryExportResponse:object({schema:{const:EXPORT_SCHEMA},conversation:pub('Conversation'),throughSequence:integer(1),exportedAt:date,expiresAt:date,
 turns:{type:'array',minItems:1,maxItems:1000,items:object({runId:uuid,prompt:nullable({type:'string',maxLength:1048576}),messages:{type:'array',maxItems:2000,items:object({messageId:uuid,text:{type:'string',maxLength:1048576}})}})}}),
 ConversationMetadata:object(metadata),
 ConversationSummary:object({...metadata,hasTranscript:{type:'boolean'},canManage:{type:'boolean'}}),
 ConversationSummaryBefore:object({updatedAt:date,conversationId:uuid}),
 ConversationHistorySummariesRequest:object({version:{const:MANAGEMENT_VERSION},status:{enum:['active','archived','trashed']},title:{type:'string',maxLength:200},before:nullable(ref('ConversationSummaryBefore'))}),
 ConversationHistorySummariesResponse:object({version:{const:MANAGEMENT_VERSION},conversations:{type:'array',items:ref('ConversationSummary'),maxItems:20},nextBefore:nullable(ref('ConversationSummaryBefore'))}),
 ConversationHistoryManageRequest:{oneOf:[object({...managementFields,operation:{const:'rename'},title}),object({...managementFields,operation:{enum:['archive','restore','trash']}})]},
 ConversationHistoryManageResponse:object({version:{const:MANAGEMENT_VERSION},requestId:uuid,conversation:ref('ConversationMetadata')}),
 ConversationHistoryBefore:object({createdAt:{type:'string',format:'date-time'},conversationId:uuid}),
 ConversationHistoryListRequest:object({before:nullable(ref('ConversationHistoryBefore')),limit},[]),
 ConversationHistoryTranscriptRequest:object({conversationId:uuid,after:integer(),limit},['conversationId']),
 ConversationHistoryNextTurnRequest:object({conversationId:uuid,sourceRunId:uuid}),
 ConversationHistoryStoredRequest:{...object({requestId:stored('requestId'),prompt:stored('prompt'),skill:stored('skill'),window:stored('window'),windowRequest:stored('windowRequest'),modelSelection:stored('modelSelection'),documentRevision:stored('documentRevision'),uploads:stored('uploads'),procedure:stored('procedure'),siteWorkflow:stored('siteWorkflow'),work:stored('work')},['requestId','prompt','skill','window']),allOf:[{if:{properties:{documentRevision:{}},required:['documentRevision']},then:{properties:{skill:nullable(SELECTED_DOCUMENT_REVISION_SKILL_SCHEMA)}}},{if:{properties:{procedure:{}},required:['procedure']},then:{properties:{skill:{type:'null'}}}}]},
 ConversationPromptLineage:{oneOf:[object({kind:{const:'submission'},logicalRequestId:uuid,sourceBinding:{type:'null'},sourceRequestId:{type:'null'}}),object({kind:{enum:['resume','fork']},logicalRequestId:uuid,sourceBinding:pub('RunBinding'),sourceRequestId:uuid})]},
 ConversationHistoryTurn:object({run:pub('Run'),request:ref('ConversationHistoryStoredRequest'),promptLineage:ref('ConversationPromptLineage'),sequenceBase:integer(),sequenceEnd:nullable(integer()),lastSequence:integer(1)}),
 BrowserReceiptEvent:object({contractVersion:{const:'0.1.0'},eventId:uuid,binding:pub('RunBinding'),sequence:integer(),createdAt:{type:'string',format:'date-time'},scopes:{type:'array',items:pub('Scope'),minItems:1},type:{const:'browser.receipt'},data:{oneOf:[object({schema:{const:'meri-browser-receipt/1'},kind:{const:'browser.action'},binding:pub('RunBinding'),sessionId:uuid,toolUseId:{anyOf:[{type:'string',maxLength:256},{type:'null'}]},action:{type:'string',minLength:1,maxLength:128},urlHost:{type:'string',minLength:1,maxLength:255},atMs:{type:'integer',minimum:1},reference:{anyOf:[{type:'string',minLength:1,maxLength:1024},{type:'null'}]},outcome:{enum:['ok','error']}}),object({schema:{const:'meri-browser-receipt/1'},kind:{const:'browser.download'},binding:pub('RunBinding'),urlHost:{type:'string',minLength:1,maxLength:255},atMs:{type:'integer',minimum:1},reference:{anyOf:[{type:'string',minLength:1,maxLength:128},{type:'null'}]},sha256:{anyOf:[{type:'string',pattern:'^[a-f0-9]{64}$'},{type:'null'}]},bytes:{anyOf:[{type:'integer',minimum:0},{type:'null'}]},mimeType:{type:'string',minLength:1,maxLength:255}})]}}),
 ConversationHistoryEvent:object({sequence:integer(1),event:{oneOf:[pub('UIEvent'),{$ref:'urn:meri:native-bill-text-source:1.0.0#/$defs/NativeBillTextSourceEvent'},{$ref:'urn:meri:native-hearing-source:1.0.0#/$defs/NativeHearingSourceEvent'},{$ref:'urn:meri:native-upload-source:1.0.0#/$defs/NativeUploadSourceEvent'},{$ref:'urn:meri:native-user-question:1.0.0#/$defs/NativeUserQuestionEvent'},{$ref:'urn:meri:native-user-question:1.0.0#/$defs/NativeUserQuestionAnsweredEvent'},ref('BrowserReceiptEvent')]}}),
 ConversationHistoryPendingTurn:object({sourceBinding:pub('RunBinding'),targetBinding:pub('RunBinding'),state:{const:'RESERVED'}}),
 ConversationHistoryListResponse:object({schema:{const:DISCOVERY_SCHEMA},conversations:{type:'array',items:pub('Conversation'),maxItems:100},nextBefore:nullable(ref('ConversationHistoryBefore'))}),
 ConversationHistoryTranscriptResponse:object({schema:{const:HISTORY_SCHEMA},conversation:pub('Conversation'),latestRun:pub('Run'),latestSequenceBase:integer(),turns:items('ConversationHistoryTurn'),events:items('ConversationHistoryEvent'),nextSequence:integer(),lastSequence:integer(1),hasMore:{type:'boolean'},pendingTurn:nullable(ref('ConversationHistoryPendingTurn'))}),
 ConversationHistoryNextTurnResponse:object({schema:{const:TURN_SCHEMA},sourceBinding:pub('RunBinding'),targetBinding:pub('RunBinding'),state:{enum:['RESERVED','ACCEPTED']},replayed:{type:'boolean'}}),
 ConversationHistoryErrorResponse:object({error:object({code:{enum:Object.keys(historyErrorStatuses)},outcome:{enum:conversationHistoryMetadata.errorOutcomes},field:{type:'string',pattern:'^[A-Za-z][A-Za-z0-9_.-]{0,127}$'}},['code'])})
}};}

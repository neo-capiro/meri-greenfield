import {SITE_WORKFLOW_SELECTION_SCHEMA} from '../site-workflow-selection.mjs';
import {PROCEDURE_SELECTION_SCHEMA} from '../procedure-selection.mjs';
import {UPLOAD_SELECTIONS_SCHEMA} from '../upload-selection.mjs';
import {WORK_SELECTION_SCHEMA} from '../work-selection.mjs';
import {conversationErrorStatuses} from './protocol.mjs';
import {DOCUMENT_REVISION_SELECTION_SCHEMA,SELECTED_DOCUMENT_REVISION_SKILL_SCHEMA} from '../document-revision.mjs';
import addedSkills from '../retrieval-0.3/skill-manifest.schema.json' with {type:'json'};
import {MODEL_SELECTION_SCHEMA} from '../model-selection.mjs';
import {feedbackDefinitions} from './feedback-schema.mjs';
const pub = name => ({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const common = name => ({$ref:'urn:meri:retrieval:common:0.2.0#/$defs/'+name});
const skill = property => {const prior={$ref:'urn:meri:retrieval:skill:0.2.0#/$defs/SkillInvocation/properties/'+property};return property==='skillId'?{anyOf:[prior,addedSkills.$defs.AddedSkillId]}:prior;};
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
 return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:meri:conversation-application:0.4.0',$defs:{
  ...feedbackDefinitions,
  ConversationSubmitRequest:{...object({requestId,prompt,windowRequest:common('WindowRequest'),skill:selection,modelSelection:MODEL_SELECTION_SCHEMA,documentRevision:DOCUMENT_REVISION_SELECTION_SCHEMA,uploads:UPLOAD_SELECTIONS_SCHEMA,procedure:PROCEDURE_SELECTION_SCHEMA,siteWorkflow:SITE_WORKFLOW_SELECTION_SCHEMA,work:WORK_SELECTION_SCHEMA},['requestId','prompt']),not:{properties:{skill:{},procedure:{}},required:['skill','procedure']},if:{properties:{skill:{},documentRevision:{}},required:['skill','documentRevision']},then:{properties:{skill:SELECTED_DOCUMENT_REVISION_SKILL_SCHEMA}}},
  ConversationHistoryRequest:object({after:sequence,limit:{type:'integer',minimum:1,maximum:100}},[]),
  ConversationCancelRequest:object({}),
  ConversationEventsRequest:object({command:object({conversationId:uuid,intent:{const:'view.subscribe'}})}),
  ConversationSkillAssetPin:object({skillId:skill('skillId'),skillVersion:skill('skillVersion'),manifestSha256:sha256,proseSha256:sha256,catalogSha256:sha256}),
  ConversationStoredRequest:{...object({requestId,prompt,skill:nullable(ref('ConversationSkillAssetPin')),window:nullable(common('NormalizedWindow')),windowRequest:nullable(common('WindowRequest')),modelSelection:MODEL_SELECTION_SCHEMA,documentRevision:DOCUMENT_REVISION_SELECTION_SCHEMA,uploads:UPLOAD_SELECTIONS_SCHEMA,procedure:PROCEDURE_SELECTION_SCHEMA,siteWorkflow:SITE_WORKFLOW_SELECTION_SCHEMA,work:WORK_SELECTION_SCHEMA},['requestId','prompt','skill','window','windowRequest']),allOf:[{if:{properties:{documentRevision:{}},required:['documentRevision']},then:{properties:{skill:nullable(SELECTED_DOCUMENT_REVISION_SKILL_SCHEMA)}}},{if:{properties:{procedure:{}},required:['procedure']},then:{properties:{skill:{type:'null'}}}}]},
  ConversationSubmittedResponse:object({run:pub('Run'),requestId,lastSequence:{...sequence,minimum:1},replayed:{type:'boolean'}}),
  ConversationHistoryResponse:object({run:pub('Run'),request:ref('ConversationStoredRequest'),events:{type:'array',items:{oneOf:[pub('UIEvent'),{$ref:'urn:meri:native-bill-text-source:1.0.0#/$defs/NativeBillTextSourceEvent'},{$ref:'urn:meri:native-hearing-source:1.0.0#/$defs/NativeHearingSourceEvent'},{$ref:'urn:meri:native-upload-source:1.0.0#/$defs/NativeUploadSourceEvent'},{$ref:'urn:meri:native-user-question:1.0.0#/$defs/NativeUserQuestionEvent'},{$ref:'urn:meri:native-user-question:1.0.0#/$defs/NativeUserQuestionAnsweredEvent'},ref('BrowserReceiptEvent')]},maxItems:100},nextSequence:sequence,hasMore:{type:'boolean'},lastSequence:{...sequence,minimum:1}}),
  ConversationCancelledResponse:object({state:{enum:['completed','failed','cancelled']}}),
  ConversationEvent:{oneOf:[pub('UIEvent'),{$ref:'urn:meri:native-bill-text-source:1.0.0#/$defs/NativeBillTextSourceEvent'},{$ref:'urn:meri:native-hearing-source:1.0.0#/$defs/NativeHearingSourceEvent'},{$ref:'urn:meri:native-upload-source:1.0.0#/$defs/NativeUploadSourceEvent'},{$ref:'urn:meri:native-user-question:1.0.0#/$defs/NativeUserQuestionEvent'},{$ref:'urn:meri:native-user-question:1.0.0#/$defs/NativeUserQuestionAnsweredEvent'},ref('BrowserReceiptEvent')]},
  BrowserActionReceiptData:object({schema:{const:'meri-browser-receipt/1'},kind:{const:'browser.action'},binding:pub('RunBinding'),sessionId:uuid,toolUseId:{anyOf:[{type:'string',maxLength:256},{type:'null'}]},action:{type:'string',minLength:1,maxLength:128},urlHost:{type:'string',minLength:1,maxLength:255},atMs:{type:'integer',minimum:1},reference:{anyOf:[{type:'string',minLength:1,maxLength:1024},{type:'null'}]},outcome:{enum:['ok','error']}}),
  BrowserDownloadReceiptData:object({schema:{const:'meri-browser-receipt/1'},kind:{const:'browser.download'},binding:pub('RunBinding'),urlHost:{type:'string',minLength:1,maxLength:255},atMs:{type:'integer',minimum:1},reference:{anyOf:[{type:'string',minLength:1,maxLength:128},{type:'null'}]},sha256:{anyOf:[sha256,{type:'null'}]},bytes:{anyOf:[{type:'integer',minimum:0},{type:'null'}]},mimeType:{type:'string',minLength:1,maxLength:255}}),
  BrowserReceiptData:{oneOf:[ref('BrowserActionReceiptData'),ref('BrowserDownloadReceiptData')]},
  BrowserReceiptEvent:object({contractVersion:{const:'0.1.0'},eventId:uuid,binding:pub('RunBinding'),sequence,createdAt:{type:'string',format:'date-time'},scopes:{type:'array',items:pub('Scope'),minItems:1},type:{const:'browser.receipt'},data:ref('BrowserReceiptData')}),
  ConversationErrorResponse:object({error:object({code:{enum:Object.keys(conversationErrorStatuses)},sources:ref('SkillRefusalSources'),requiredScope:ref('SkillRequiredScope')},['code'])}),
  SkillRefusalSources:{type:'array',items:{type:'string',minLength:1,maxLength:128},minItems:1,maxItems:32,uniqueItems:true},
  SkillRequiredScope:{enum:['client']},
 }};
}

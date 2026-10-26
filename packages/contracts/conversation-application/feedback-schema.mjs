/** Feedback is an immutable user observation, never an approval or applied correction. */
const object = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const ref = name => ({$ref:'#/$defs/'+name});
const uuid = {type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
const sha = {type:'string',pattern:'^[a-f0-9]{64}$'};
const sequence = {type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER};
const note = {type:'string',minLength:1,maxLength:2000,pattern:'\\S'};
const nullable = schema => ({anyOf:[schema,{type:'null'}]});
export const MAX_RUN_FEEDBACK = 50;
export const feedbackDefinitions = {
 ConversationFeedbackTarget:{oneOf:[
  object({kind:{const:'message'},runId:uuid,throughSequence:sequence,messageId:uuid}),
  object({kind:{const:'artifact'},runId:uuid,throughSequence:sequence,artifactId:uuid,versionId:uuid}),
 ]},
 ConversationFeedbackSignal:{oneOf:[
  object({kind:{const:'preference'},value:{enum:['helpful','not_helpful']},note:nullable(note)}),
  object({kind:{const:'factual_correction'},proposedCorrection:note}),
  object({kind:{const:'recommendation'},recommendation:note}),
 ]},
 ConversationFeedbackRequest:object({requestId:uuid,target:ref('ConversationFeedbackTarget'),sourceEventId:nullable(uuid),signal:ref('ConversationFeedbackSignal')}),
 ConversationFeedbackReadRequest:object({runId:uuid}),
 ConversationFeedbackReceipt:object({
  feedbackId:uuid,requestId:uuid,conversationId:uuid,actorId:{type:'string',minLength:1,maxLength:256},
  recordedAt:{type:'string',format:'date-time',pattern:'Z$'},
  target:ref('ConversationFeedbackTarget'),signal:ref('ConversationFeedbackSignal'),
  revision:object({sha256:sha,artifact:{oneOf:[
   object({status:{const:'bound'},artifactId:uuid,versionId:uuid}),
   object({status:{const:'not_applicable'},reason:{const:'message_target'}}),
  ]}}),
  sourceRevision:{oneOf:[
   object({status:{const:'bound'},eventId:uuid,eventSha256:sha}),
   object({status:{const:'not_applicable'},reason:{const:'no_source_selected'}}),
  ]},
  taskRevision:object({status:{const:'not_applicable'},reason:{const:'no_native_task_revision_on_target'}}),
  execution:{oneOf:[
   object({status:{const:'recorded'},basis:{const:'run_sdk_usage'},usageSha256:sha,sessionId:uuid,
    models:{type:'array',minItems:1,maxItems:32,uniqueItems:true,items:{type:'string',minLength:1,maxLength:200}},
    attribution:{const:'run_including_subagents'}}),
   object({status:{const:'unavailable'},reason:{enum:['usage_not_recorded','run_model_delta_unavailable']}}),
  ]},
  disposition:object({status:{const:'recorded'},review:{const:'not_reviewed'},effect:{const:'none'}}),
  linkedReceipts:{type:'array',maxItems:100,items:object({kind:{enum:['approval_request','completion']},eventId:uuid,eventSha256:sha})},
 }),
 ConversationFeedbackResponse:object({receipt:ref('ConversationFeedbackReceipt'),replayed:{type:'boolean'}}),
 ConversationFeedbackReadResponse:object({runId:uuid,receipts:{type:'array',maxItems:MAX_RUN_FEEDBACK,items:ref('ConversationFeedbackReceipt')}}),
};

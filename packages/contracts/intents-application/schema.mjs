export const INTENTS_SCHEMA_ID='urn:meri:intents-application:0.1.0';
const UUID='^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',DELIVERY='^sdk:[a-f0-9]{64}$',MILLIS='^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$';
/** Decision phases are readings of the durable owners (`approval.mjs` item()), never decisions themselves. */
export const INTENT_PHASES=Object.freeze(['awaiting_approval','approved','rejected','expired','executing','completed','unknown','unknown_decision']);
const pub=name=>({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const task=name=>({$ref:'urn:meri:commands:task-create:0.2.0#/$defs/'+name});
const update=name=>({$ref:'urn:meri:commands:task-update:0.2.0#/$defs/'+name});
const document=name=>({$ref:'urn:meri:commands:document-draft:0.2.0#/$defs/'+name});
const memory=name=>({$ref:'urn:meri:commands:memory-propose:0.2.0#/$defs/'+name});
const artifact=name=>({$ref:'urn:meri:artifacts:0.2.0#/$defs/'+name});
const ref=name=>({$ref:'#/$defs/'+name});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const item=(extra,required)=>object({deliveryId:ref('IntentsDeliveryId'),createdAt:{type:'string',pattern:MILLIS},operation:ref('IntentsOperation'),...extra},['deliveryId','createdAt','operation',...required??Object.keys(extra)]);
export function intentsSchema({errorStatuses,errorOutcomes,failureCodes,fieldPattern}){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:INTENTS_SCHEMA_ID,$defs:{
 IntentsConversationId:{type:'string',pattern:UUID},
 IntentsDeliveryId:{type:'string',pattern:DELIVERY},
 IntentsOperation:object({id:{type:'string',pattern:'^[a-z][a-z_]{0,62}$'},version:{const:'0.2.0'}}),
 IntentsListRequest:object({conversationId:ref('IntentsConversationId'),after:{anyOf:[ref('IntentsDeliveryId'),{type:'null'}]},limit:{type:'integer',minimum:1,maximum:50}},['conversationId']),
 IntentsDecideRequest:object({conversationId:ref('IntentsConversationId'),deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},commandSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},decision:{enum:['approved','rejected']}}),
 IntentsProposal:{oneOf:[pub('ApprovalProposal'),update('TaskUpdateApprovalProposal'),document('DocumentDraftApprovalProposal')]},
 IntentsDecision:pub('ApprovalDecision'),
 IntentsTaskCreateArguments:task('TaskCreateArguments'),
 IntentsTaskUpdateArguments:update('TaskUpdateArguments'),
 IntentsNativeTaskOutcome:object({execution:object({kind:{const:'native-task'},proposalId:{type:'string',pattern:UUID},commandSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},
  idempotencyKey:{type:'string',minLength:1},binding:pub('RunBinding'),completedAt:{type:'string',pattern:MILLIS},approvalDecisionSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}),
  result:{oneOf:[task('TaskCreateResult'),update('TaskUpdateResult')]}}),
 IntentsExecutionOutcome:{oneOf:[object({receipt:pub('CommandReceipt'),result:task('TaskCreateResult')}),ref('IntentsNativeTaskOutcome'),artifact('ArtifactCreatedResult')]},
 IntentsExecution:{oneOf:[object({state:{const:'executing'}}),object({state:{const:'unknown'}}),object({state:{const:'completed'},outcome:ref('IntentsExecutionOutcome')})]},
 IntentsPendingItem:item({state:{const:'pending'}}),
 IntentsUnknownItem:item({state:{const:'unknown'}}),
 IntentsFailedItem:item({state:{const:'failed'},code:{enum:[...failureCodes]}}),
 IntentsDraftItem:item({state:{const:'prepared'},kind:{const:'draft'},versionId:{type:'string',format:'uuid'}}),
 IntentsWithheldDraftItem:item({state:{const:'prepared'},kind:{const:'draft'},withheld:{const:true}}),
 IntentsMemoryReview:object({status:{const:'review_pending'},binding:pub('RunBinding'),scopes:{type:'array',items:pub('Scope'),minItems:1,maxItems:1},result:memory('MemoryProposeResult')}),
 IntentsMemoryReviewItem:item({state:{const:'prepared'},kind:{const:'memory_review'},review:ref('IntentsMemoryReview')}),
 IntentsWithheldMemoryReviewItem:item({state:{const:'prepared'},kind:{const:'memory_review'},withheld:{const:true}}),
 IntentsScheduleProposalItem:item({state:{const:'prepared'},kind:{const:'schedule_proposal'},proposalId:{anyOf:[{type:'string',minLength:1,maxLength:128},{type:'null'}]}}),
 IntentsWithheldProposalItem:item({state:{const:'prepared'},kind:{const:'proposal'},withheld:{const:true}}),
 IntentsProposalItem:item({state:{const:'prepared'},kind:{const:'proposal'},proposal:ref('IntentsProposal'),decision:{anyOf:[ref('IntentsDecision'),{type:'null'},{const:'unavailable'}]},
  execution:{anyOf:[ref('IntentsExecution'),{type:'null'},{const:'unavailable'}]},phase:{enum:[...INTENT_PHASES]}}),
 IntentsItem:{oneOf:['Pending','Unknown','Failed','Draft','WithheldDraft','MemoryReview','WithheldMemoryReview','ScheduleProposal','WithheldProposal','Proposal'].map(name=>ref('Intents'+name+'Item'))},
 IntentsListResponse:object({conversationId:ref('IntentsConversationId'),intents:{type:'array',items:ref('IntentsItem'),maxItems:50},next:{anyOf:[ref('IntentsDeliveryId'),{type:'null'}]}}),
 IntentsDecideResponse:{oneOf:[
  object({status:{const:'rejected'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},decision:ref('IntentsDecision')}),
  object({status:{const:'executed'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},decision:ref('IntentsDecision'),outcome:ref('IntentsExecutionOutcome')}),
  object({status:{const:'indeterminate'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},decision:ref('IntentsDecision')}),
 ]},
 IntentsErrorResponse:object({error:object({code:{type:'string',enum:Object.keys(errorStatuses)},outcome:{type:'string',enum:[...errorOutcomes]},field:{type:'string',pattern:fieldPattern}},['code'])}),
 }};}

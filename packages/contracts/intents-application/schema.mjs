export const INTENTS_SCHEMA_ID='urn:meri:intents-application:0.1.0';
const UUID='^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',DELIVERY='^sdk:[a-f0-9]{64}$',MILLIS='^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$';
/** Decision phases are readings of the durable owners (`approval.mjs` item()), never decisions themselves. */
export const INTENT_PHASES=Object.freeze(['awaiting_approval','approved','rejected','expired','executing','completed','unknown','unknown_decision']);
const pub=name=>({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const task=name=>({$ref:'urn:meri:commands:task-create:0.2.0#/$defs/'+name});
const mail=name=>({$ref:'urn:meri:commands:mail-send:0.2.0#/$defs/'+name});
const update=name=>({$ref:'urn:meri:commands:task-update:0.2.0#/$defs/'+name});
const document=name=>({$ref:'urn:meri:commands:document-draft:0.2.0#/$defs/'+name});
const memory=name=>({$ref:'urn:meri:commands:memory-propose:0.2.0#/$defs/'+name});
const filing=name=>({$ref:'urn:meri:commands:artifact-file:0.2.0#/$defs/'+name});
const artifact=name=>({$ref:'urn:meri:artifacts:0.2.0#/$defs/'+name});
const schedule=name=>({$ref:'urn:meri:schedules:tool-interface:0.2.0#/$defs/'+name});
const legislativeDocument=name=>({$ref:'urn:meri:retrieval:legislative-document-action:0.2.0#/$defs/'+name});
const clientRecord=name=>({$ref:'urn:meri:retrieval:client-record-action:0.2.0#/$defs/'+name});
const legiwatch=name=>({$ref:'urn:meri:retrieval:legiwatch-action:0.2.0#/$defs/'+name});
const bizdev=name=>({$ref:'urn:meri:retrieval:bizdev-action:0.2.0#/$defs/'+name});
const sharing=name=>({$ref:'urn:meri:retrieval:research-portfolio-sharing:0.2.0#/$defs/'+name});
const researchAction=name=>({$ref:'urn:meri:retrieval:research-portfolio-action:0.2.0#/$defs/'+name});
const watch=name=>({$ref:'urn:meri:retrieval:watch-action:0.2.0#/$defs/'+name});
const note=name=>({$ref:'urn:meri:retrieval:note-action:0.2.0#/$defs/'+name});
const ref=name=>({$ref:'#/$defs/'+name});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const item=(extra,required)=>object({deliveryId:ref('IntentsDeliveryId'),createdAt:{type:'string',pattern:MILLIS},operation:ref('IntentsOperation'),...extra},['deliveryId','createdAt','operation',...required??Object.keys(extra)]);
export function intentsSchema({errorStatuses,errorOutcomes,failureCodes,fieldPattern}){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:INTENTS_SCHEMA_ID,$defs:{
 IntentsConversationId:{type:'string',pattern:UUID},
 IntentsDeliveryId:{type:'string',pattern:DELIVERY},
 IntentsOperation:object({id:{type:'string',pattern:'^[a-z][a-z_]{0,62}$'},version:{const:'0.2.0'}}),
 IntentsListRequest:object({conversationId:ref('IntentsConversationId'),after:{anyOf:[ref('IntentsDeliveryId'),{type:'null'}]},limit:{type:'integer',minimum:1,maximum:50}},['conversationId']),
 IntentsDecideRequest:object({conversationId:ref('IntentsConversationId'),deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},commandSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},decision:{enum:['approved','rejected']}}),
 IntentsNativeProposal:{oneOf:[pub('ApprovalProposal'),update('TaskUpdateApprovalProposal'),mail('MailSendApprovalProposal'),document('DocumentDraftApprovalProposal')]},
 IntentsProposal:{oneOf:[ref('IntentsNativeProposal'),sharing('ResearchShareProposal'),researchAction('ResearchActionProposal'),legiwatch('LegiwatchProposal'),watch('WatchProposal'),clientRecord('ClientRecordProposal'),bizdev('BizdevProposal'),legislativeDocument('LegislativeDocumentProposal')]},
 IntentsClientRecordProposal:clientRecord('ClientRecordProposal'),
 IntentsLegiwatchProposal:legiwatch('LegiwatchProposal'),
 IntentsBizdevProposal:bizdev('BizdevProposal'),
 IntentsWatchProposal:watch('WatchProposal'),
 IntentsResearchShareProposal:sharing('ResearchShareProposal'),
 IntentsResearchActionProposal:researchAction('ResearchActionProposal'),
 IntentsDecision:pub('ApprovalDecision'),
 IntentsTaskCreateArguments:task('TaskCreateArguments'),
 IntentsTaskUpdateArguments:update('TaskUpdateArguments'),
 IntentsMailSendArguments:mail('MailSendArguments'),
 IntentsMailSendContext:mail('MailSendContext'),
 IntentsMailSendCommand:mail('MailSendCommand'),
 IntentsMailSendResult:mail('MailSendResult'),
 IntentsNativeMailOutcome:object({execution:object({kind:{const:'native-mail'},proposalId:{type:'string',pattern:UUID},commandSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:1},binding:pub('RunBinding'),approvalDecisionSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}),result:mail('MailSendResult')}),
 IntentsArtifactFileArguments:filing('ArtifactFileArguments'),
 IntentsNativeTaskOutcome:object({execution:object({kind:{const:'native-task'},proposalId:{type:'string',pattern:UUID},commandSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},
  idempotencyKey:{type:'string',minLength:1},binding:pub('RunBinding'),completedAt:{type:'string',pattern:MILLIS},approvalDecisionSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}),
  result:{oneOf:[task('TaskCreateResult'),update('TaskUpdateResult')]}}),
 IntentsNativeArtifactFileOutcome:object({execution:object({kind:{const:'native-artifact-file'},proposalId:{type:'string',pattern:UUID},commandSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},
  idempotencyKey:{type:'string',minLength:1},binding:pub('RunBinding'),completedAt:{type:'string',pattern:MILLIS},approvalDecisionSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}),result:filing('ArtifactFileResult')}),
 IntentsExecutionOutcome:{oneOf:[object({receipt:pub('CommandReceipt'),result:task('TaskCreateResult')}),ref('IntentsNativeTaskOutcome'),ref('IntentsNativeMailOutcome'),ref('IntentsNativeArtifactFileOutcome'),artifact('ArtifactCreatedResult')]},
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
 IntentsScheduleReviewItem:item({state:{const:'prepared'},kind:{const:'schedule_proposal'},binding:pub('RunBinding'),request:ref('RoutinesMutationRequest'),proposal:schedule('PendingProposal')}),
 IntentsWithheldScheduleItem:item({state:{const:'prepared'},kind:{const:'schedule_proposal'},withheld:{const:true}}),
 IntentsWithheldProposalItem:item({state:{const:'prepared'},kind:{const:'proposal'},withheld:{const:true}}),
 IntentsLegiwatchItem:item({state:{const:'prepared'},kind:{const:'legiwatch_action'},proposal:legiwatch('LegiwatchProposal'),result:{anyOf:[legiwatch('LegiwatchCoreResult'),{const:'unavailable'}]}}),
 IntentsLegislativeDocumentItem:item({state:{const:'prepared'},kind:{const:'legislative_document_action'},proposal:legislativeDocument('LegislativeDocumentProposal'),result:{anyOf:[legislativeDocument('LegislativeDocumentCoreResult'),{const:'unavailable'}]}}),
 IntentsWithheldLegislativeDocumentItem:item({state:{const:'prepared'},kind:{const:'legislative_document_action'},withheld:{const:true}}),
 IntentsClientRecordItem:item({state:{const:'prepared'},kind:{const:'client_record_action'},proposal:clientRecord('ClientRecordProposal'),result:{anyOf:[clientRecord('ClientRecordCoreResult'),{const:'unavailable'}]}}),
 IntentsWithheldLegiwatchItem:item({state:{const:'prepared'},kind:{const:'legiwatch_action'},withheld:{const:true}}),
 IntentsWithheldClientRecordItem:item({state:{const:'prepared'},kind:{const:'client_record_action'},withheld:{const:true}}),
 IntentsBizdevItem:item({state:{const:'prepared'},kind:{const:'bizdev_action'},proposal:bizdev('BizdevProposal'),result:{anyOf:[bizdev('BizdevCoreResult'),{const:'unavailable'}]}}),
 IntentsWithheldBizdevItem:item({state:{const:'prepared'},kind:{const:'bizdev_action'},withheld:{const:true}}),
 IntentsWatchItem:item({state:{const:'prepared'},kind:{const:'watch_action'},proposal:watch('WatchProposal'),result:{anyOf:[watch('WatchCoreResult'),{const:'unavailable'}]}}),
 IntentsWithheldWatchItem:item({state:{const:'prepared'},kind:{const:'watch_action'},withheld:{const:true}}),
 IntentsResearchActionItem:item({state:{const:'prepared'},kind:{const:'research_action'},proposal:researchAction('ResearchActionProposal'),result:{anyOf:[researchAction('ResearchActionDecided'),{const:'unavailable'}]}}),
 IntentsWithheldResearchActionItem:item({state:{const:'prepared'},kind:{const:'research_action'},withheld:{const:true}}),
 IntentsResearchShareItem:item({state:{const:'prepared'},kind:{const:'research_share'},proposal:sharing('ResearchShareProposal'),proposalStatus:{anyOf:[sharing('ResearchShareProposalStatus'),{const:'unavailable'}]}}),
IntentsSavedNoteItem:item({state:{const:'prepared'},kind:{const:'saved_note'},result:note('SavedNoteResult')}),
IntentsWithheldSavedNoteItem:item({state:{const:'prepared'},kind:{const:'saved_note'},withheld:{const:true}}),
 IntentsWithheldResearchShareItem:item({state:{const:'prepared'},kind:{const:'research_share'},withheld:{const:true}}),
 IntentsProposalItem:item({state:{const:'prepared'},kind:{const:'proposal'},proposal:ref('IntentsNativeProposal'),decision:{anyOf:[ref('IntentsDecision'),{type:'null'},{const:'unavailable'}]},
  execution:{anyOf:[ref('IntentsExecution'),{type:'null'},{const:'unavailable'}]},phase:{enum:[...INTENT_PHASES]}}),
 IntentsItem:{oneOf:['SavedNote','WithheldSavedNote','Pending','Unknown','Failed','Draft','WithheldDraft','MemoryReview','WithheldMemoryReview','ScheduleProposal','ScheduleReview','WithheldSchedule','WithheldProposal','Proposal','ResearchShare','WithheldResearchShare','ResearchAction','WithheldResearchAction','Legiwatch','WithheldLegiwatch','Watch','WithheldWatch','ClientRecord','WithheldClientRecord','Bizdev','WithheldBizdev','LegislativeDocument','WithheldLegislativeDocument'].map(name=>ref('Intents'+name+'Item'))},
 IntentsListResponse:object({conversationId:ref('IntentsConversationId'),intents:{type:'array',items:ref('IntentsItem'),maxItems:50},next:{anyOf:[ref('IntentsDeliveryId'),{type:'null'}]}}),
 IntentsDecideResponse:{oneOf:[
  object({status:{const:'legislative_document_decided'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},result:legislativeDocument('LegislativeDocumentCoreResult')}),
  object({status:{const:'legiwatch_decided'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},result:legiwatch('LegiwatchCoreResult')}),
  object({status:{const:'client_record_decided'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},result:clientRecord('ClientRecordCoreResult')}),
  object({status:{const:'bizdev_decided'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},result:bizdev('BizdevCoreResult')}),
  object({status:{const:'watch_decided'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},result:watch('WatchCoreResult')}),
  object({status:{const:'rejected'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},decision:ref('IntentsDecision')}),
  object({status:{const:'executed'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},decision:ref('IntentsDecision'),outcome:ref('IntentsExecutionOutcome')}),
  object({status:{const:'indeterminate'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},decision:ref('IntentsDecision')}),
  object({status:{const:'research_action_decided'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},proposalStatus:researchAction('ResearchActionProposalStatus'),resultSummary:researchAction('ResearchActionResultSummary')},['status','deliveryId','proposalId','proposalStatus']),
  object({status:{const:'research_share_decided'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},proposalStatus:sharing('ResearchShareProposalStatus'),oneTimeResult:sharing('ResearchShareOneTimeResult')},['status','deliveryId','proposalId','proposalStatus']),
 ]},
 IntentsErrorResponse:object({error:object({code:{type:'string',enum:Object.keys(errorStatuses)},outcome:{type:'string',enum:[...errorOutcomes]},field:{type:'string',pattern:fieldPattern}},['code'])}),
 RoutinesMutationRequest:{oneOf:[schedule('ScheduleTaskRequest'),schedule('UpdateScheduledTaskRequest'),schedule('CancelScheduledTaskRequest')]},
 RoutinesProposal:schedule('PendingProposal'),
 RoutinesPrepareRequest:{oneOf:['ScheduleTask','UpdateScheduledTask','CancelScheduledTask'].map((name,index)=>object({requestId:{type:'string',pattern:'^[A-Za-z0-9._-]{1,128}$'},operation:{const:['schedule_task','update_scheduled_task','cancel_scheduled_task'][index]},request:schedule(name+'Request')}))},
 RoutinesPrepareResponse:object({status:{const:'approval_required'},proposal:schedule('PendingProposal')}),
 RoutinesApproveRequest:{oneOf:['ScheduleTask','UpdateScheduledTask','CancelScheduledTask'].map((name,index)=>object({operation:{const:['schedule_task','update_scheduled_task','cancel_scheduled_task'][index]},request:schedule(name+'Request'),proposalId:{type:'string',pattern:UUID},intentSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},decision:{const:'approved'}}))},
 RoutinesApproveResponse:schedule('Acknowledged'),
 RoutinesReconcileRequest:{oneOf:['ScheduleTask','UpdateScheduledTask','CancelScheduledTask'].map((name,index)=>object({operation:{const:['schedule_task','update_scheduled_task','cancel_scheduled_task'][index]},request:schedule(name+'Request'),proposalId:{type:'string',pattern:UUID},intentSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}))},
 RoutinesReconcileResponse:object({intentId:{type:'string',pattern:UUID},operation:{enum:['schedule_task','update_scheduled_task','cancel_scheduled_task']},generation:{type:'integer',minimum:1},outcome:{enum:['ACKNOWLEDGED','UNRESOLVED']},code:{anyOf:[{type:'null'},{enum:['SCHEDULE_INTENT_NEVER_DISPATCHED','SCHEDULE_INTENT_EFFECT_NOT_COMPARABLE','SCHEDULE_INTENT_EFFECT_NOT_OBSERVED']}]},reconciled:{type:'boolean'}}),
 RoutinesListRequest:schedule('ListScheduledTasksRequest'),RoutinesListResponse:schedule('ListScheduledTasksOutput'),
 RoutinesErrorResponse:object({error:object({code:{type:'string',pattern:'^[A-Z][A-Z0-9_]{0,63}$'},outcome:{enum:['NOT_DISPATCHED','UNKNOWN','ACKNOWLEDGED_NOT_RELEASED','UNRESOLVED']}},['code'])}),
 }};}

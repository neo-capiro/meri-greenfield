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
const schedule=name=>({$ref:'urn:meri:schedules:tool-interface:0.3.0#/$defs/'+name});
const legacySchedule=name=>({$ref:'urn:meri:schedules:tool-interface:0.2.0#/$defs/'+name});
const scheduleInspection=name=>({$ref:'urn:meri:schedules:inspection:0.3.0#/$defs/'+name});
const scheduleLifecycle=name=>({$ref:'urn:meri:schedules:lifecycle:0.3.0#/$defs/'+name});
const legislativeDocument=name=>({$ref:'urn:meri:retrieval:legislative-document-action:0.2.0#/$defs/'+name});
const officeEdit=name=>({$ref:'urn:meri:retrieval:office-edit-action:0.2.0#/$defs/'+name});
// Client-record moved to its disjoint 0.3 family: the retained proposal shape is unchanged, and only this owner
// carries the bounded source provenance on a create input and the bounded preflight on a live answer.
const clientRecord=name=>({$ref:'urn:meri:retrieval:client-record-action:0.3.0#/$defs/'+name});
const legiwatch=name=>({$ref:'urn:meri:retrieval:legiwatch-action:0.2.0#/$defs/'+name});
const bizdev=name=>({$ref:'urn:meri:retrieval:bizdev-action:0.2.0#/$defs/'+name});
const sharing=name=>({$ref:'urn:meri:retrieval:research-portfolio-sharing:0.2.0#/$defs/'+name});
const researchAction=name=>({$ref:'urn:meri:retrieval:research-portfolio-action:0.2.0#/$defs/'+name});
const watch=name=>({$ref:'urn:meri:retrieval:watch-action:0.2.0#/$defs/'+name});
const note=name=>({$ref:'urn:meri:retrieval:note-action:0.2.0#/$defs/'+name});
const ref=name=>({$ref:'#/$defs/'+name});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const item=(extra,required,operation='IntentsOperation')=>object({deliveryId:ref('IntentsDeliveryId'),createdAt:{type:'string',pattern:MILLIS},operation:ref(operation),...extra},['deliveryId','createdAt','operation',...required??Object.keys(extra)]);
export function intentsSchema({errorStatuses,errorOutcomes,failureCodes,fieldPattern,inboxKinds}){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:INTENTS_SCHEMA_ID,$defs:{
 // The actor-wide inbox: the same journal items `list` publishes, read across every conversation of the caller and projected to
 // what a cross-conversation list needs. A row names its conversation; the conversation's list/decide routes decide.
 IntentsInboxCursor:object({conversationId:ref('IntentsConversationId'),deliveryId:{anyOf:[ref('IntentsDeliveryId'),ref('IntentsBrowserDeliveryId')]}}),
 IntentsInboxRequest:object({after:{anyOf:[ref('IntentsInboxCursor'),{type:'null'}]},limit:{type:'integer',minimum:1,maximum:50}},[]),
 IntentsInboxKind:{enum:[...inboxKinds]},
 IntentsInboxRow:{oneOf:[
  object({conversationId:ref('IntentsConversationId'),deliveryId:{anyOf:[ref('IntentsDeliveryId'),ref('IntentsBrowserDeliveryId')]},createdAt:{type:'string',pattern:MILLIS},operation:ref('IntentsClientRecordOperation'),kind:ref('IntentsInboxKind'),withheld:{const:true}}),
  object({conversationId:ref('IntentsConversationId'),deliveryId:{anyOf:[ref('IntentsDeliveryId'),ref('IntentsBrowserDeliveryId')]},createdAt:{type:'string',pattern:MILLIS},operation:ref('IntentsClientRecordOperation'),kind:ref('IntentsInboxKind'),withheld:{const:false},
   clientId:{anyOf:[{type:'string',minLength:1,maxLength:256},{type:'null'}]},expiresAt:{type:'string',format:'date-time'},phase:{enum:[...INTENT_PHASES]}}),
 ]},
 IntentsInboxResponse:object({rows:{type:'array',items:ref('IntentsInboxRow'),maxItems:50},next:{anyOf:[ref('IntentsInboxCursor'),{type:'null'}]},pending:object({count:{type:'integer',minimum:0,maximum:50},complete:{type:'boolean'}})}),
 // The badge count: prepared inbox rows still inside their release window, counted before any decision owner is read.
 IntentsInboxCountRequest:object({},[]),
 IntentsInboxCountResponse:object({open:{type:'integer',minimum:0},checkedAt:{type:'string',pattern:MILLIS}}),
 IntentsConversationId:{type:'string',pattern:UUID},
 IntentsDeliveryId:{type:'string',pattern:DELIVERY},
 IntentsOperation:object({id:{type:'string',pattern:'^[a-z][a-z_]{0,62}$'},version:{const:'0.2.0'}}),
// The client-record owner now publishes a successor beside its retained version, so its list item accepts
// both. Every other intent keeps the single published operation ref above; this changes no other family.
 IntentsClientRecordOperation:object({id:{type:'string',pattern:'^[a-z][a-z_]{0,62}$'},version:{enum:['0.2.0','0.3.0']}}),
 IntentsListRequest:object({conversationId:ref('IntentsConversationId'),after:{anyOf:[ref('IntentsDeliveryId'),ref('IntentsBrowserDeliveryId'),{type:'null'}]},limit:{type:'integer',minimum:1,maximum:50}},['conversationId']),
 IntentsDecideRequest:{oneOf:[
  object({conversationId:ref('IntentsConversationId'),deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},commandSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},decision:{enum:['approved','rejected']}}),
  // Browser decisions bind the SUBJECT digest (S), never a command digest: the retained preparation is the
  // only proposal identity, and the decision is recorded against it unchanged.
  object({conversationId:ref('IntentsConversationId'),deliveryId:ref('IntentsBrowserDeliveryId'),proposalId:{type:'string',pattern:UUID},subjectSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},decision:{enum:['approved','rejected']}}),
 ]},
 IntentsNativeProposal:{oneOf:[pub('ApprovalProposal'),update('TaskUpdateApprovalProposal'),mail('MailSendApprovalProposal'),document('DocumentDraftApprovalProposal')]},
 IntentsProposal:{oneOf:[ref('IntentsNativeProposal'),ref('IntentsBrowserProposal'),sharing('ResearchShareProposal'),researchAction('ResearchActionProposal'),legiwatch('LegiwatchProposal'),watch('WatchProposal'),clientRecord('ClientRecordProposal'),bizdev('BizdevProposal'),legislativeDocument('LegislativeDocumentProposal'),officeEdit('OfficeEditProposal')]},
 IntentsClientRecordProposal:clientRecord('ClientRecordProposal'),
 IntentsLegiwatchProposal:legiwatch('LegiwatchProposal'),
 IntentsBizdevProposal:bizdev('BizdevProposal'),
 IntentsWatchProposal:watch('WatchProposal'),
 IntentsResearchShareProposal:sharing('ResearchShareProposal'),
 IntentsResearchActionProposal:researchAction('ResearchActionProposal'),
 IntentsDecision:pub('ApprovalDecision'),
 // Browser-action intents are their own closed family: the delivery domain is `browser:` (execution custody
 // keys on the MCP request, approval preparation on binding+tool use), the decision binds S (subject) rather
 // than a command digest, and the display is the already-reviewed bounded context only.
 IntentsBrowserDeliveryId:{type:'string',pattern:'^browser:[a-f0-9]{64}$'},
 IntentsBrowserDisplay:object({tool:{type:'string',minLength:1,maxLength:128},pageOrigin:{type:'string',minLength:1,maxLength:255},server:{type:'string',minLength:1,maxLength:128},inputSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},policySha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}),
 IntentsBrowserDecision:object({proposalId:{type:'string',pattern:UUID},subjectSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},decision:{enum:['approved','rejected']},decidedAt:{type:'string',pattern:MILLIS},approver:pub('Identity'),policyRevision:{type:'string',minLength:1,maxLength:256}}),
 IntentsBrowserProposal:object({kind:{const:'browser_action'},proposalId:{type:'string',pattern:UUID},subjectSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},operation:object({id:{const:'browser_action'},version:{const:'0.2.0'}}),binding:pub('RunBinding'),display:ref('IntentsBrowserDisplay'),requiredApprover:pub('Identity'),scopes:{type:'array',items:pub('Scope'),minItems:1,maxItems:100},requestedAtMs:{type:'integer',minimum:0},expiresAtMs:{type:'integer',minimum:1},createdAt:{type:'string',pattern:MILLIS}}),
 // A recorded approval means AWAITING EXECUTION. `execution` is the SEPARATE canonical read of what the
 // browser actually reported; it is never implied by the decision.
 IntentsBrowserExecution:object({state:{const:'completed'},outcome:{enum:['ok','error']},reference:{anyOf:[{type:'string',minLength:1,maxLength:1024},{type:'null'}]}}),
 IntentsBrowserActionItem:object({deliveryId:ref('IntentsBrowserDeliveryId'),createdAt:{type:'string',pattern:MILLIS},operation:ref('IntentsOperation'),state:{const:'prepared'},kind:{const:'browser_action'},proposal:ref('IntentsBrowserProposal'),decision:{anyOf:[ref('IntentsBrowserDecision'),{type:'null'},{const:'unavailable'}]},execution:{anyOf:[ref('IntentsBrowserExecution'),{type:'null'},{const:'unavailable'}]},phase:{enum:['awaiting_approval','approved','rejected','expired','unknown','unknown_decision']}}),
 IntentsWithheldBrowserActionItem:object({deliveryId:ref('IntentsBrowserDeliveryId'),createdAt:{type:'string',pattern:MILLIS},operation:ref('IntentsOperation'),state:{const:'prepared'},kind:{const:'browser_action'},withheld:{const:true}}),
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
 IntentsMemoryProposeArguments:memory('MemoryProposeArguments'),
 IntentsNativeMemoryOutcome:object({execution:object({kind:{const:'native-memory'},proposalId:{type:'string',pattern:UUID},commandSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},
  idempotencyKey:{type:'string',minLength:1},binding:pub('RunBinding'),completedAt:{type:'string',pattern:MILLIS},approvalDecisionSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}),
  result:object({candidateId:{type:'string',pattern:UUID},candidateSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},reviewId:{type:'string',pattern:UUID},
   review:object({status:{enum:['pending','approved','rejected','withdrawn','not_found']},decidedAt:{anyOf:[{type:'string',pattern:MILLIS},{type:'null'}]},
    publishedMemoryId:{anyOf:[{type:'string',pattern:'^(clio|item):[a-f0-9-]{36}$'},{type:'null'}]},checkedAt:{type:'string',pattern:MILLIS}})})}),
 IntentsNativeArtifactFileOutcome:object({execution:object({kind:{const:'native-artifact-file'},proposalId:{type:'string',pattern:UUID},commandSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},
  idempotencyKey:{type:'string',minLength:1},binding:pub('RunBinding'),completedAt:{type:'string',pattern:MILLIS},approvalDecisionSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}),result:filing('ArtifactFileResult')}),
 IntentsExecutionOutcome:{oneOf:[object({receipt:pub('CommandReceipt'),result:task('TaskCreateResult')}),ref('IntentsNativeTaskOutcome'),ref('IntentsNativeMemoryOutcome'),ref('IntentsNativeMailOutcome'),ref('IntentsNativeArtifactFileOutcome'),artifact('ArtifactCreatedResult')]},
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
 IntentsScheduleReviewItem:item({state:{const:'prepared'},kind:{const:'schedule_proposal'},binding:pub('RunBinding'),request:{oneOf:['ScheduleTaskRequest','UpdateScheduledTaskRequest','CancelScheduledTaskRequest'].map(legacySchedule)},proposal:legacySchedule('PendingProposal')}),
 IntentsWithheldScheduleItem:item({state:{const:'prepared'},kind:{const:'schedule_proposal'},withheld:{const:true}}),
 IntentsWithheldProposalItem:item({state:{const:'prepared'},kind:{const:'proposal'},withheld:{const:true}}),
 IntentsLegiwatchItem:item({state:{const:'prepared'},kind:{const:'legiwatch_action'},proposal:legiwatch('LegiwatchProposal'),result:{anyOf:[legiwatch('LegiwatchCoreResult'),{const:'unavailable'}]}}),
 IntentsLegislativeDocumentItem:item({state:{const:'prepared'},kind:{const:'legislative_document_action'},proposal:legislativeDocument('LegislativeDocumentProposal'),result:{anyOf:[legislativeDocument('LegislativeDocumentCoreResult'),{const:'unavailable'}]}}),
 IntentsWithheldLegislativeDocumentItem:item({state:{const:'prepared'},kind:{const:'legislative_document_action'},withheld:{const:true}}),
 IntentsOfficeEditItem:item({state:{const:'prepared'},kind:{const:'office_edit'},proposal:officeEdit('OfficeEditProposal'),result:{anyOf:[officeEdit('OfficeEditResult'),{const:'unavailable'}]}}),
 IntentsWithheldOfficeEditItem:item({state:{const:'prepared'},kind:{const:'office_edit'},withheld:{const:true}}),
 IntentsClientRecordItem:item({state:{const:'prepared'},kind:{const:'client_record_action'},proposal:clientRecord('ClientRecordProposal'),result:{anyOf:[clientRecord('ClientRecordCoreResult'),{const:'unavailable'}]}},undefined,'IntentsClientRecordOperation'),
 IntentsWithheldLegiwatchItem:item({state:{const:'prepared'},kind:{const:'legiwatch_action'},withheld:{const:true}}),
 IntentsWithheldClientRecordItem:item({state:{const:'prepared'},kind:{const:'client_record_action'},withheld:{const:true}},undefined,'IntentsClientRecordOperation'),
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
 IntentsItem:{oneOf:['SavedNote','WithheldSavedNote','Pending','Unknown','Failed','Draft','WithheldDraft','MemoryReview','WithheldMemoryReview','ScheduleProposal','ScheduleReview','WithheldSchedule','WithheldProposal','Proposal','ResearchShare','WithheldResearchShare','ResearchAction','WithheldResearchAction','Legiwatch','WithheldLegiwatch','Watch','WithheldWatch','ClientRecord','WithheldClientRecord','Bizdev','WithheldBizdev','LegislativeDocument','WithheldLegislativeDocument','OfficeEdit','WithheldOfficeEdit','BrowserAction','WithheldBrowserAction'].map(name=>ref('Intents'+name+'Item'))},
 IntentsListResponse:object({conversationId:ref('IntentsConversationId'),intents:{type:'array',items:ref('IntentsItem'),maxItems:50},next:{anyOf:[ref('IntentsDeliveryId'),ref('IntentsBrowserDeliveryId'),{type:'null'}]}}),
 IntentsDecideResponse:{oneOf:[
  object({status:{const:'browser_decision_recorded'},deliveryId:ref('IntentsBrowserDeliveryId'),proposalId:{type:'string',pattern:UUID},decision:ref('IntentsBrowserDecision')}),
  object({status:{const:'browser_rejected'},deliveryId:ref('IntentsBrowserDeliveryId'),proposalId:{type:'string',pattern:UUID},decision:ref('IntentsBrowserDecision')}),
  object({status:{const:'legislative_document_decided'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},result:legislativeDocument('LegislativeDocumentCoreResult')}),
  object({status:{const:'office_edit_decided'},deliveryId:ref('IntentsDeliveryId'),proposalId:{type:'string',pattern:UUID},result:officeEdit('OfficeEditResult')}),
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
 RoutinesManagementSessionRequest:object({clientId:{anyOf:[{type:'string',pattern:UUID},{type:'null'}]}}),
 RoutinesManagementContext:object({tenantId:{type:'string',minLength:1,maxLength:256},actorId:{type:'string',minLength:1,maxLength:256},selectedClientId:{anyOf:[{type:'string',pattern:UUID},{type:'null'}]}}),
 RoutinesManagementSessionReceipt:object({kind:{const:'routine-management'},credential:{type:'string',pattern:'^routine_session_[A-Za-z0-9_-]{43}$'},expiresAtMs:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},context:ref('RoutinesManagementContext')}),
 RoutinesMutationRequest:{oneOf:[schedule('ScheduleTaskRequest'),schedule('UpdateScheduledTaskRequest'),schedule('CancelScheduledTaskRequest')]},
 RoutinesProposal:schedule('PendingProposal'),
 RoutinesPrepareRequest:{oneOf:['ScheduleTask','UpdateScheduledTask','CancelScheduledTask'].map((name,index)=>object({requestId:{type:'string',pattern:'^[A-Za-z0-9._-]{1,128}$'},operation:{const:['schedule_task','update_scheduled_task','cancel_scheduled_task'][index]},request:schedule(name+'Request')}))},
 RoutinesPrepareResponse:object({status:{const:'approval_required'},proposal:schedule('PendingProposal')}),
 RoutinesApproveRequest:{oneOf:['ScheduleTask','UpdateScheduledTask','CancelScheduledTask'].map((name,index)=>object({operation:{const:['schedule_task','update_scheduled_task','cancel_scheduled_task'][index]},request:schedule(name+'Request'),proposalId:{type:'string',pattern:UUID},intentSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},decision:{const:'approved'}}))},
 RoutinesApproveResponse:schedule('Acknowledged'),
 RoutinesReconcileRequest:{oneOf:['ScheduleTask','UpdateScheduledTask','CancelScheduledTask'].map((name,index)=>object({operation:{const:['schedule_task','update_scheduled_task','cancel_scheduled_task'][index]},request:schedule(name+'Request'),proposalId:{type:'string',pattern:UUID},intentSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}))},
 RoutinesReconcileResponse:object({intentId:{type:'string',pattern:UUID},operation:{enum:['schedule_task','update_scheduled_task','cancel_scheduled_task']},generation:{type:'integer',minimum:1},outcome:{enum:['ACKNOWLEDGED','UNRESOLVED']},code:{anyOf:[{type:'null'},{enum:['SCHEDULE_INTENT_NEVER_DISPATCHED','SCHEDULE_INTENT_EFFECT_NOT_COMPARABLE','SCHEDULE_INTENT_EFFECT_NOT_OBSERVED']}]},reconciled:{type:'boolean'}}),
 // MR-04 receiving boundary: the list request, its page and its rows are declared HERE rather than borrowed from the
 // schedules tool interface. The tool interface is the MODEL's own closed input, so the observation opt-in and the
 // observation facet belong to the receiving boundary alone; the canonical rows are mirrored member for member, and the
 // mirrored members are asserted against the canonical tool interface by the public receiving test.
 RoutinesListRequest:object({afterScheduleId:{anyOf:[{type:'string',format:'uuid'},{type:'null'}]},limit:{type:'integer',minimum:1,maximum:20},
  historyLimit:{type:'integer',minimum:0,maximum:10},observation:{const:'consent'}},[]),
 RoutinesListRow:object({projection:pub('ScheduleProjection'),generation:{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},unresolved:{type:'boolean'},
  inspection:{anyOf:[scheduleInspection('ScheduleInspectionOutput'),{type:'null'}]},inspectionState:{enum:['unavailable','observed']},trigger:schedule('TriggerObservation'),
  consent:ref('RoutinesConsentObservation')},['projection','generation','unresolved','inspection','inspectionState']),
 RoutinesListPage:object({operation:{const:'list_scheduled_tasks'},rows:{type:'array',items:ref('RoutinesListRow'),maxItems:20},hasMore:{type:'boolean'},
  nextAfterScheduleId:{anyOf:[{type:'string',format:'uuid'},{type:'null'}]},originalRuns:schedule('OriginalRuns'),
  coverage:object({complete:{const:false},currentRetryVerified:{const:false}})}),
 RoutinesListResponse:object({operation:{const:'list_scheduled_tasks'},status:{const:'listed'},page:ref('RoutinesListPage')}),
 // The closed observation facet of one row. Every member is always present: `unknown` is the answer for anything the
 // observation cannot read as itself, and `absent` is only ever Core's own statement about a row it could look for.
 RoutinesConsentObservation:object({state:{enum:['active','expired','revoked','absent','unknown']},pinsMatched:{type:'boolean'},stale:{type:'boolean'},
  observedAtMs:{anyOf:[{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},{type:'null'}]},generation:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},
  consentGeneration:{anyOf:[{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},{type:'null'}]},
  issuedAtMs:{anyOf:[{type:'integer',minimum:-Number.MAX_SAFE_INTEGER,maximum:Number.MAX_SAFE_INTEGER},{type:'null'}]},
  expiresAtMs:{anyOf:[{type:'integer',minimum:-Number.MAX_SAFE_INTEGER,maximum:Number.MAX_SAFE_INTEGER},{type:'null'}]},
  scopeCount:{anyOf:[{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},{type:'null'}]},
  cause:{anyOf:[{enum:['revocation','membership','client-scope']},{type:'null'}]},rightsSha256:{anyOf:[{type:'string',pattern:'^[a-f0-9]{64}$'},{type:'null'}]}}),
 RoutinesRenewalLimits:object({maxCostMicrousd:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},maxRuntimeSeconds:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},
  retryLimit:{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER}}),
 // The review is read-only and carries the exact original intent, its scopes' digest and its EFFECTIVE limits. It grants
 // no approval: the decision is a separate explicit operation over the review digest the caller was shown.
 RoutinesConsentReviewRequest:object({scheduleId:{type:'string',pattern:UUID}}),
 RoutinesConsentReviewResponse:object({status:{const:'review_required'},scheduleId:{type:'string',pattern:UUID},generation:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},
  intentSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},projectionSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},scopesSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},
  limits:ref('RoutinesRenewalLimits'),intent:scheduleLifecycle('Intent'),consent:{anyOf:[ref('RoutinesConsentObservation'),{type:'null'}]},
  reviewSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}),
 RoutinesConsentApproveRequest:object({scheduleId:{type:'string',pattern:UUID},reviewSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},
  requestId:{type:'string',pattern:'^[A-Za-z0-9._-]{1,128}$'},decision:{const:'approved'}}),
 RoutinesConsentApproveResponse:object({status:{const:'renewed'},state:{enum:['active','expired']},generation:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},
  policyRevision:{type:'string',minLength:1,maxLength:256},
  issuedAtMs:{type:'integer',minimum:-Number.MAX_SAFE_INTEGER,maximum:Number.MAX_SAFE_INTEGER},
  expiresAtMs:{type:'integer',minimum:-Number.MAX_SAFE_INTEGER,maximum:Number.MAX_SAFE_INTEGER},
  observedAtMs:{type:'integer',minimum:-Number.MAX_SAFE_INTEGER,maximum:Number.MAX_SAFE_INTEGER},idempotent:{type:'boolean'}}),
 RoutinesErrorResponse:object({error:object({code:{type:'string',pattern:'^[A-Z][A-Z0-9_]{0,63}$'},outcome:{enum:['NOT_DISPATCHED','UNKNOWN','ACKNOWLEDGED_NOT_RELEASED','UNRESOLVED']}},['code'])}),
 }};}

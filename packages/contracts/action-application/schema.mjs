// Build-time receiving envelopes. Nested owners remain canonical references.
const pub = name => ({$ref:`urn:meri:contracts:0.1.0#/$defs/${name}`});
const ops = name => ({$ref:`urn:meri:retrieval:operational-reads:0.2.0#/$defs/${name}`});
const task = name => ({$ref:`urn:meri:commands:task-create:0.2.0#/$defs/${name}`});
const ref = name => ({$ref:`#/$defs/${name}`});
const object = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const uuid = {type:'string',format:'uuid'}, hash={type:'string',pattern:'^[a-f0-9]{64}$'};
export function actionSchema(errorCodes) {
 const source=object({resultReference:uuid,resultSha256:hash,actionId:{type:'string',minLength:1,maxLength:256},lookupId:uuid,actionSha256:hash,originalBinding:pub('RunBinding'),clientId:uuid});
 return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:meri:action-application:0.1.0',$defs:{
 ActionQueryResponse:object({lookupId:uuid,resultReference:uuid,resultSha256:hash,classification:{const:'recommendations'},acceptedTasks:{const:false},
  events:{type:'array',items:pub('UIEvent'),minItems:2,maxItems:2},observation:object({binding:pub('RunBinding'),subject:{$ref:'urn:meri:retrieval:common:0.2.0#/$defs/ResolvedSubject'},operation:object({id:{const:'actions.query'},version:{const:'0.2.0'}}),argumentsSha256:hash,result:ops('ActionItemClientScopedPage')})}),
 ActionDraftResponse:object({status:{const:'draft'},source,recommendation:ops('ActionItemReadRow'),task:task('TaskCreateArguments'),draftSha256:hash}),
 ActionPrepareResponse:object({status:{const:'approval_required'},draft:ref('ActionDraftResponse'),proposal:pub('ApprovalProposal')}),
 ActionExecuteResponse:{oneOf:[object({status:{const:'observed'},outcome:object({receipt:pub('CommandReceipt'),result:task('TaskCreateResult')})}),object({status:{const:'indeterminate'},outcome:{type:'null'}})]},
 ActionErrorResponse:object({error:object({code:{type:'string',enum:errorCodes},outcome:{type:'string',enum:['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED','STORED_NOT_RELEASED','NOT_STORED','READ_UNAVAILABLE']}})})
 }};
}

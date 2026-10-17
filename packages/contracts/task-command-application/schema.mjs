import {taskCommandSchemaId} from './protocol.mjs';
const pub=name=>({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const task=name=>({$ref:'urn:meri:commands:task-update:0.2.0#/$defs/'+name});
const ref=name=>({$ref:'#/$defs/'+name});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function taskCommandSchema(errorStatuses,errorOutcomes){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:taskCommandSchemaId,$defs:{
 TaskUpdateRaw:task('TaskUpdateRaw'),TaskUpdateArguments:task('TaskUpdateArguments'),TaskUpdateApprovalProposal:task('TaskUpdateApprovalProposal'),TaskUpdateResult:task('TaskUpdateResult'),
 TaskCommandPrepareRequest:object({arguments:ref('TaskUpdateRaw')}),TaskCommandExecuteRequest:object({proposal:ref('TaskUpdateApprovalProposal')}),
 TaskCommandPrepareResponse:object({status:{const:'approval_required'},proposal:ref('TaskUpdateApprovalProposal')}),
 TaskCommandExecuteResponse:{oneOf:[object({status:{const:'observed'},outcome:object({receipt:pub('CommandReceipt'),result:ref('TaskUpdateResult')})}),object({status:{const:'indeterminate'},outcome:{type:'null'}})]},
 TaskCommandErrorResponse:object({error:object({code:{type:'string',enum:Object.keys(errorStatuses)},outcome:{type:'string',enum:errorOutcomes}})}),
 TaskCommandExpectedBinding:{type:'object',properties:Object.fromEntries(['tenantId','actorId'].map(name=>[name,{type:'string',minLength:1,maxLength:128}]).concat(['conversationId','runId'].map(name=>[name,{type:'string',format:'uuid'}]))),required:['tenantId','actorId','conversationId','runId'],additionalProperties:false},
 TaskUpdateContext:task('TaskUpdateContext'),TaskUpdateCommand:task('TaskUpdateCommand'),RunBinding:pub('RunBinding'),
 }};}

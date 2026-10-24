/** Native Core execution evidence, shared by public task response envelopes. */
export function nativeTaskOutcomeSchema(result){
 const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
 const digest={type:'string',pattern:'^[a-f0-9]{64}$'};
 return object({execution:object({kind:{const:'native-task'},proposalId:{type:'string',format:'uuid'},commandSha256:digest,
  idempotencyKey:{type:'string',minLength:1},binding:{$ref:'urn:meri:contracts:0.1.0#/$defs/RunBinding'},
  completedAt:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$'},approvalDecisionSha256:digest}),result});
}

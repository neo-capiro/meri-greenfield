/** Explicit preview receiver definitions. The producer's immutable record remains separate from ArtifactVersion.previewStatus. */
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const uuid={type:'string',pattern:'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$'};
const sha={type:'string',pattern:'^[a-f0-9]{64}$'},nullable=value=>({anyOf:[{type:'null'},value]});
export function documentPreviewDefinitions(){return {
 DocumentPreviewRequest:object({versionId:uuid}),
 DocumentPreviewRecord:object({recordVersion:{const:'meri.artifact-preview.proposal-1'},previewId:uuid,versionId:uuid,artifactId:uuid,
  tenantId:{type:'string',minLength:1},conversationId:uuid,source:object({sha256:sha,bytes:{type:'integer',minimum:0,maximum:16777216},mimeType:{type:'string',minLength:1}}),
  preview:object({object:{$ref:'urn:meri:contracts:0.1.0#/$defs/ObjectReference'},mimeType:{const:'application/pdf'},pages:{type:'integer',minimum:1,maximum:500}}),
  conversion:object({method:{enum:['source-pdf','office-pdf']},inputSha256:sha,outputSha256:sha,
   qualificationId:nullable({type:'string',minLength:1,maxLength:128}),imageDigest:nullable({type:'string',pattern:'^sha256:[a-f0-9]{64}$'})}),
  status:{const:'published'},nativeQualified:{const:false},createdAt:{type:'string',format:'date-time'}}),
 DocumentPreviewPublication:object({status:{enum:['existing','published']},preview:{$ref:'#/$defs/DocumentPreviewRecord'}}),
};}

/** Additive workbench wire. Compiler and artifact fields remain canonical schema references. */
import nativeFederalSchema from '../retrieval-0.2/federal-draft-source.schema.json' with {type:'json'};
// The retained compiler also admits explicitly partial sources. Native official-source
// preparation still requires complete coverage; its frozen contract is unchanged.
export const retainedFederalSchema=structuredClone(nativeFederalSchema);
retainedFederalSchema.$id='urn:meri:federal-retained-source:1';
retainedFederalSchema.$defs.FederalDraftCompilerSource.properties.coverage.properties.complete={type:'boolean'};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const ref=name=>({$ref:'#/$defs/'+name});
const sha={type:'string',pattern:'^[a-f0-9]{64}$'},uuid={type:'string',format:'uuid'};
const artifact=name=>({$ref:'urn:meri:artifacts:0.2.0#/$defs/'+name});
const federal=name=>({$ref:'urn:meri:federal-retained-source:1#/$defs/'+name});
export const federalWorkbenchSchema={
 $schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:meri:federal-workbench:1',title:'Federal workbench',
 $defs:{
  FederalCompilerSource:federal('FederalDraftCompilerSource'),
  FederalNativeSelection:{$ref:nativeFederalSchema.$id+'#/$defs/FederalDraftSourceInput'},
  FederalSourceEnvelope:object({schema:{const:'meri.federal-source.v1'},selection:ref('FederalNativeSelection'),source:ref('FederalCompilerSource')}),
  FederalImportRequest:object({selection:ref('FederalNativeSelection'),deliveryId:{type:'string',pattern:'^[A-Za-z0-9_.:@/-]{1,255}$'}}),
  FederalImportResult:object({schema:{const:'meri.federal-source.v1'},selection:ref('FederalNativeSelection'),source:ref('FederalCompilerSource'),publication:artifact('ArtifactCreatedResult')}),
  FederalSelection:object({versionId:uuid,expectedArtifactSha256:sha,operations:{type:'array',minItems:1,maxItems:64,items:federal('FederalDraftOperation')}}),
  FederalSourceArtifact:object({versionId:uuid,sha256:sha,specSha256:sha}),
  FederalPrepareRequest:object({selection:ref('FederalSelection')}),
  FederalLoadRequest:object({versionId:uuid,expectedArtifactSha256:sha}),
  FederalPublishRequest:object({selection:ref('FederalSelection'),revisionSha256:sha,output:{enum:['draft','operative','consolidated','redline']},
   deliveryId:{type:'string',pattern:'^[A-Za-z0-9_.:@/-]{1,255}$'},baseVersionId:{anyOf:[uuid,{type:'null'}]},baseRevisionSha256:{anyOf:[sha,{type:'null'}]}}),
  FederalRetainedPreparation:object({sourceArtifact:ref('FederalSourceArtifact'),draft:federal('FederalDraftCompilation'),revisionSha256:sha,approval:{const:'unapproved'}}),
  FederalReview:object({schema:{const:'meri.federal-review.v1'},selection:ref('FederalSelection'),prepared:ref('FederalRetainedPreparation'),
   savedDraft:{anyOf:[artifact('ArtifactVersion'),{type:'null'}]}}),
  FederalPublication:object({schema:{const:'meri.federal-review.v1'},sourceArtifact:ref('FederalSourceArtifact'),revisionSha256:sha,
   output:{enum:['draft','operative','consolidated','redline']},review:{enum:['unapproved','confirmed-for-export']},publication:artifact('ArtifactCreatedResult')}),
  FederalError:object({error:object({code:{type:'string',pattern:'^[A-Z_]{1,80}$'},outcome:{enum:['NOT_DISPATCHED','READ_UNAVAILABLE','UNKNOWN','RESULT_NOT_RELEASED']}})})
 }
};

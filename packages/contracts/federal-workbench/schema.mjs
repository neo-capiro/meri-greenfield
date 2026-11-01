/** Additive workbench wire. Compiler and artifact fields remain canonical schema references. */
import nativeFederalSchema from '../retrieval-0.2/federal-draft-source.schema.json' with {type:'json'};
import {USLM_SCHEMA_PROFILE,USLM_SCHEMA_SHA256} from './schema-receipt.mjs';
import rawFederalSchema from './raw-source.schema.json' with {type:'json'};
// The retained compiler also admits explicitly partial sources. Native official-source
// preparation still requires complete coverage; its frozen contract is unchanged.
export const retainedFederalSchema=structuredClone(nativeFederalSchema);
retainedFederalSchema.$id='urn:meri:federal-retained-source:1';
retainedFederalSchema.$defs.FederalDraftCompilerSource.properties.coverage.properties.complete={type:'boolean'};
// Native official imports keep their frozen flat-text contract. Only retained,
// explicitly versioned envelopes admit declared nested text locations.
const flat=retainedFederalSchema.$defs.FederalDraftCompilerSource;
const scoped=structuredClone(flat);
scoped.properties.parserVersion={const:'federal-scoped-text/2'};
scoped.properties.scopes.items.properties.ancestorPath={type:'array',maxItems:127,items:{type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'}};
scoped.properties.scopes.items.required.push('ancestorPath');
// Raw USLM XML: the same declared nested locations, derived from element identifiers by the server compiler.
const uslm=structuredClone(scoped);
uslm.properties.parserVersion={const:'federal-uslm-xml/1'};
uslm.properties.scopes.maxItems=1024;
const schemaReceipt={type:'object',additionalProperties:false,required:['profile','schemaSha256','sourceSha256','bytes','valid'],properties:{
 profile:{const:USLM_SCHEMA_PROFILE},schemaSha256:{const:USLM_SCHEMA_SHA256},sourceSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},bytes:{type:'integer',minimum:1,maximum:131072},valid:{const:true}}};
const schemaUslm=structuredClone(uslm);
schemaUslm.properties.parserVersion={const:'federal-uslm-xml/2'};
schemaUslm.properties.validation=schemaReceipt;schemaUslm.required.push('validation');
retainedFederalSchema.$defs.FederalDraftCompilerSource={oneOf:[flat,scoped,uslm,schemaUslm]};
retainedFederalSchema.$defs.FederalDraftCompilation.properties.parserVersion={enum:['federal-plain-text/1','federal-scoped-text/2','federal-uslm-xml/1','federal-uslm-xml/2']};

const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const ref=name=>({$ref:'#/$defs/'+name});
const sha={type:'string',pattern:'^[a-f0-9]{64}$'},uuid={type:'string',format:'uuid'},nullable=schema=>({anyOf:[schema,{type:'null'}]});
const deliveryId={type:'string',pattern:'^[A-Za-z0-9_.:@/-]{1,255}$'},operationId={type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'};
// The dedicated workbench admits a terminal full-source operation. The SDK's original schema stays frozen.
const amendment=retainedFederalSchema.$defs.FederalDraftOperation;
const removal=object({id:operationId,kind:{const:'remove_source_text'},expectedSourceSha256:sha,expectedTextSha256:sha,
 dependsOn:{type:'array',maxItems:64,uniqueItems:true,items:operationId}});
retainedFederalSchema.$defs.FederalDraftOperation={oneOf:[amendment,removal]};
const compilation=retainedFederalSchema.$defs.FederalDraftCompilation;
const removedCompilation=structuredClone(compilation);
removedCompilation.properties.resultKind={const:'source-text-removed'};
removedCompilation.required.push('resultKind');
removedCompilation.properties.outputs.properties.consolidated={const:''};
removedCompilation.properties.outputHashes.properties.consolidated={const:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'};
retainedFederalSchema.$defs.FederalDraftCompilation={oneOf:[compilation,removedCompilation]};
const outputs=['draft','operative','consolidated','redline','docx'];
const artifact=name=>({$ref:'urn:meri:artifacts:0.2.0#/$defs/'+name});
const federal=name=>({$ref:'urn:meri:federal-retained-source:1#/$defs/'+name});
const representation={const:'retained-raw-utf8/1'};
const legacyEnvelope={schema:{const:'meri.federal-source.v1'},selection:ref('FederalNativeSelection'),source:ref('FederalCompilerSource')};
const rawEnvelope={schema:{const:'meri.federal-source.v2'},representation,capture:{$ref:rawFederalSchema.$id+'#/$defs/FederalSourceCapture'},selection:ref('FederalNativeSelection'),source:ref('FederalCompilerSource')};
export const federalWorkbenchSchema={
 $schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:meri:federal-workbench:1',title:'Federal workbench',
 $defs:{
  FederalCompilerSource:federal('FederalDraftCompilerSource'),
  FederalNativeSelection:{$ref:nativeFederalSchema.$id+'#/$defs/FederalDraftSourceInput'},
  FederalSourceEnvelope:{oneOf:[object(legacyEnvelope),object(rawEnvelope)]},
  FederalImportRequest:{...object({selection:ref('FederalNativeSelection'),deliveryId}),properties:{selection:ref('FederalNativeSelection'),deliveryId,representation,validationProfile:{const:USLM_SCHEMA_PROFILE}}},
  FederalImportResult:{oneOf:[object({...legacyEnvelope,publication:artifact('ArtifactCreatedResult')}),object({...rawEnvelope,publication:artifact('ArtifactCreatedResult')})]},
  FederalSelection:object({versionId:uuid,expectedArtifactSha256:sha,operations:{type:'array',minItems:1,maxItems:64,items:federal('FederalDraftOperation')}}),
  FederalSourceArtifact:object({versionId:uuid,sha256:sha,specSha256:sha}),
  FederalPrepareRequest:object({selection:ref('FederalSelection')}),
  FederalLoadRequest:object({versionId:uuid,expectedArtifactSha256:sha}),
  // `reviewVersionId` names the saved review an export comes from; only that exact version's own approval, for this
  // exact revision, makes the export approved. Absent or null is the ordinary unapproved export (the deployed client
  // sends no field); a draft save never names one.
  FederalPublishRequest:{type:'object',properties:{selection:ref('FederalSelection'),revisionSha256:sha,output:{enum:outputs},deliveryId,
   baseVersionId:nullable(uuid),baseRevisionSha256:nullable(sha),reviewVersionId:nullable(uuid)},
   required:['selection','revisionSha256','output','deliveryId','baseVersionId','baseRevisionSha256'],additionalProperties:false},
  FederalApproveRequest:object({versionId:uuid,expectedArtifactSha256:sha,revisionSha256:sha,deliveryId}),
  FederalHistoryRequest:object({versionId:uuid,limit:{type:'integer',minimum:1,maximum:100},cursor:nullable(sha)}),
  FederalRetainedPreparation:{...object({sourceArtifact:ref('FederalSourceArtifact'),draft:federal('FederalDraftCompilation'),revisionSha256:sha,approval:{const:'unapproved'}}),properties:{sourceArtifact:ref('FederalSourceArtifact'),draft:federal('FederalDraftCompilation'),revisionSha256:sha,approval:{const:'unapproved'},schemaValidation:object({source:schemaReceipt,consolidated:nullable(schemaReceipt)})}},
  // An approval binds exactly one compiled revision hash to the saved review version it approved; it is recorded as
  // that version's own immutable child and never carried by a later revision.
  FederalApproval:object({revisionSha256:sha,reviewVersionId:uuid}),
  FederalReview:object({schema:{const:'meri.federal-review.v1'},selection:ref('FederalSelection'),prepared:ref('FederalRetainedPreparation'),
   savedDraft:nullable(artifact('ArtifactVersion')),approval:nullable(ref('FederalApproval'))}),
  FederalPublication:object({schema:{const:'meri.federal-review.v1'},sourceArtifact:ref('FederalSourceArtifact'),revisionSha256:sha,
   output:{enum:outputs},review:{enum:['unapproved','confirmed-for-export','approved']},approval:nullable(ref('FederalApproval')),publication:artifact('ArtifactCreatedResult')}),
  FederalHistoryEntry:object({version:artifact('ArtifactVersion'),revisionSha256:sha,sourceArtifact:ref('FederalSourceArtifact'),approval:nullable(ref('FederalApproval'))}),
  FederalHistory:object({schema:{const:'meri.federal-review.v1'},artifactId:uuid,anchorVersionId:uuid,headVersionId:uuid,
   revisions:{type:'array',minItems:1,maxItems:100,items:ref('FederalHistoryEntry')},nextCursor:nullable(sha)}),
  // `code` is the exact refusal reason (for example DRAFT_SCOPE_INVALIDATED or DRAFT_SOURCE_FORMAT_UNSUPPORTED);
  // `operationId` names the refused operation when the compiler identified one.
  FederalError:{type:'object',properties:{error:{type:'object',properties:{code:{type:'string',pattern:'^[A-Z_]{1,80}$'},
   outcome:{enum:['NOT_DISPATCHED','READ_UNAVAILABLE','UNKNOWN','RESULT_NOT_RELEASED']},operationId:nullable(operationId)},
   required:['code','outcome'],additionalProperties:false}},required:['error'],additionalProperties:false}
 }
};

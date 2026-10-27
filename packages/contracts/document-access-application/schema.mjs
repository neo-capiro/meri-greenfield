// Build-time projection of the canonical artifact contract (artifacts-0.2) onto the document read routes. Unlike the frozen
// document-application projection (docx/txt/xlsx), every canonical inspection variant is admitted: docx, txt, xlsx, pptx, pdf and zip.
import {ARTIFACT_MIME_TYPES} from '../artifacts-0.2/artifact-formats.mjs';
export const DOCUMENT_ACCESS_SCHEMA_ID='urn:meri:document-access-application:0.2.0';
/** The artifact vocabulary's own formats; the canonical schema must supply exactly one inspection variant for each. */
export const DOCUMENT_ACCESS_FORMATS=Object.freeze(Object.keys(ARTIFACT_MIME_TYPES));
const ref=name=>({$ref:'#/$defs/'+name});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const uuid={type:'string',pattern:'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$'};
const cursor={anyOf:[{type:'null'},{type:'string',pattern:'^[a-f0-9]{64}$'}]};
function absolute(value){if(Array.isArray(value))return value.map(absolute);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='$ref'&&v.startsWith('#')?'urn:meri:artifacts:0.2.0'+v:absolute(v)]));}
export function documentAccessSchema(artifact,errorStatuses){
 const inspections=artifact.$defs.ArtifactInspection.oneOf.filter(x=>DOCUMENT_ACCESS_FORMATS.includes(x.properties.format.const)).map(absolute);
 if(inspections.length!==DOCUMENT_ACCESS_FORMATS.length||new Set(inspections.map(x=>x.properties.format.const)).size!==DOCUMENT_ACCESS_FORMATS.length)throw Error('Canonical artifact inspection variants do not match the artifact format vocabulary');
 const inspected=structuredClone(inspections);for(const x of inspected){x.properties.currentBytesVerified={const:true};x.required.push('currentBytesVerified');}
 // The document application releases only draft/pending versions (apps/control/document-application/index.mjs version()); a status the producer never emits is not admitted.
 const version={allOf:[{$ref:'urn:meri:artifacts:0.2.0#/$defs/ArtifactVersion'},{type:'object',properties:{generationStatus:{const:'draft'},previewStatus:{const:'pending'},filename:{type:'string',pattern:'^[A-Za-z0-9._ -]{1,125}$'},mimeType:{enum:Object.values(ARTIFACT_MIME_TYPES)}}}]};
 return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:DOCUMENT_ACCESS_SCHEMA_ID,$defs:{
  DocumentVersion:version,
  DocumentInspectRequest:object({versionId:uuid}),DocumentDownloadRequest:object({versionId:uuid}),
  DocumentHistoryRequest:object({versionId:uuid,limit:{type:'integer',minimum:1,maximum:100},cursor}),
  DocumentHistoryResponse:object({anchorVersionId:uuid,artifactId:uuid,headVersionId:uuid,versions:{type:'array',minItems:1,maxItems:100,items:ref('DocumentVersion')},nextCursor:cursor}),
  NativeArtifactFileMetadata:{$ref:'urn:meri:artifacts:0.2.0#/$defs/NativeArtifactFileMetadata'},
 DocumentInspectionResponse:{oneOf:[object({version:ref('DocumentVersion'),inspection:{oneOf:inspected}}),object({kind:{const:'native-file'},version:ref('NativeArtifactFileMetadata'),integrity:{$ref:'urn:meri:artifacts:0.2.0#/$defs/NativeArtifactFileInspection/properties/integrity'}})]},
  DocumentErrorResponse:object({error:object({code:{enum:Object.keys(errorStatuses)},outcome:{enum:['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED','READ_UNAVAILABLE']}})}),
 }};
}

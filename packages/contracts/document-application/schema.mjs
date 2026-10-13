// Build-time projection: source DTOs stay owned by public0.1 and artifacts0.2.
const ref=name=>({$ref:'#/$defs/'+name});
const pub=name=>({$ref:'urn:meri:contracts:0.1.0#/$defs/'+name});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const uuid={type:'string',pattern:'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$'};
const admitted=new Set(['docx','txt','xlsx']);
function absolute(value){if(Array.isArray(value))return value.map(absolute);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='$ref'&&v.startsWith('#')?'urn:meri:artifacts:0.2.0'+v:absolute(v)]));}
export function documentSchema(artifact,errorStatuses){
 const requests=artifact.$defs.ArtifactRequest.oneOf.filter(x=>['create_word','create_excel'].includes(x.properties.operation.const)).map(absolute);
 for(const request of requests)if(request.properties.format.enum)request.properties.format.enum=request.properties.format.enum.filter(x=>admitted.has(x));
 const inspections=artifact.$defs.ArtifactInspection.oneOf.filter(x=>admitted.has(x.properties.format.const)).map(absolute);
 const inspected=structuredClone(inspections);for(const x of inspected){x.properties.currentBytesVerified={const:true};x.required.push('currentBytesVerified');}
 const version={allOf:[pub('ArtifactVersion'),{type:'object',properties:{generationStatus:{const:'draft'},previewStatus:{const:'pending'},filename:{type:'string',pattern:'^[A-Za-z0-9._ -]{1,125}$'},mimeType:{enum:['text/plain; charset=utf-8','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']}}}]};
 return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:meri:document-application:0.1.0',$defs:{
 DocumentContentRequest:{oneOf:requests},DocumentVersion:version,
 DocumentCreateRequest:object({deliveryId:{type:'string',pattern:'^[A-Za-z0-9_.:@/-]{1,255}$'},request:ref('DocumentContentRequest')}),
 DocumentReviseRequest:object({deliveryId:{type:'string',pattern:'^[A-Za-z0-9_.:@/-]{1,255}$'},baseVersionId:uuid,request:ref('DocumentContentRequest')}),
 DocumentInspectRequest:object({versionId:uuid}),DocumentDownloadRequest:object({versionId:uuid}),
 DocumentCreatedResponse:object({version:ref('DocumentVersion'),inspection:{oneOf:inspections},execution:{$ref:'urn:meri:artifacts:0.2.0#/$defs/ArtifactExecution'}}),
 DocumentInspectionResponse:object({version:ref('DocumentVersion'),inspection:{oneOf:inspected}}),
 DocumentErrorResponse:object({error:object({code:{enum:Object.keys(errorStatuses)},outcome:{enum:['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED','READ_UNAVAILABLE']}})})
 }};
}

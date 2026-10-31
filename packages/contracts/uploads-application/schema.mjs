import canonical from '../meri.schema.json' with {type:'json'};
import {uploadApplicationMetadata,UPLOAD_LIMITS,UPLOAD_MIME,uploadErrorStatuses} from './protocol.mjs';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const ref=name=>({$ref:'#/$defs/'+name}),nullable=value=>({anyOf:[value,{type:'null'}]});
export function uploadApplicationSchema(){
 const uuid=structuredClone(canonical.$defs.RunBinding.properties.conversationId);
 const declaration={filename:{type:'string',minLength:1,maxLength:255},mimeType:{enum:[...new Set(Object.values(UPLOAD_MIME))]},
  bytes:{type:'integer',minimum:1,maximum:UPLOAD_LIMITS.originalBytes},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'}};
 return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:uploadApplicationMetadata.schemaId,$defs:{
  UploadInitiateRequest:object({requestId:uuid,...declaration}),UploadIdRequest:object({uploadId:uuid}),
  UploadStatusRequest:{oneOf:[object({uploadId:uuid}),object({requestId:uuid})]},
  UploadOriginal:object({...declaration,versionId:nullable({type:'string',minLength:1,maxLength:1024,pattern:'^[^\\u0000-\\u001f\\u007f]+$'})}),
  UploadReceipt:object({uploadId:uuid,requestId:uuid,original:ref('UploadOriginal'),storageStatus:{enum:['awaiting_upload','unknown','stored','removing','removed']},
   scanStatus:{enum:['pending','clean','infected','unavailable']},scanReason:nullable({type:'string',pattern:'^[A-Z][A-Z0-9_]{0,79}$'}),extraction:object({status:{enum:['pending','available','partial','unavailable','blocked']},
    limitations:{type:'array',maxItems:17,uniqueItems:true,items:{type:'string',pattern:'^[A-Z][A-Z0-9_]{0,79}$'}}}),originalBytesAvailable:{type:'boolean'}}),
  UploadError:object({error:object({code:{enum:Object.keys(uploadErrorStatuses)},outcome:{enum:['NOT_DISPATCHED','UNKNOWN','READ_UNAVAILABLE']}})})
 }};
}

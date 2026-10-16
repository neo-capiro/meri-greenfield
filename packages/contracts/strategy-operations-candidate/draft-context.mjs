/** Pure legacy-input observations. No identity authority, resolver call or ID/document attribution. */
import {canonicalSha256 as hash} from '../validate.mjs';
import {data,own} from '../commands-0.2/execution-boundary.mjs';
import {createHash} from 'node:crypto';
export function normalizedDraftDto(value){
 const d=own(data(value),['clientId','type'],['goal','meriContext','ownerUserId','targetDate','attachmentIds']);
 return {clientId:d.clientId,input:{typeHint:d.type,goal:d.goal??null,meriContext:d.meriContext??null,ownerUserId:d.ownerUserId??null,targetDate:d.targetDate??null,attachmentIds:d.attachmentIds??[]}};
}
const textHash=text=>createHash('sha256').update(text,'utf8').digest('hex');
export function draftContextPacket({clientId,input,ownerActorId,resolvedDocuments,coreResolution}){
 let attachments;
 if(coreResolution!==undefined){
  const response=data(coreResolution);
  attachments={correlation:'explicit-core-document-id',coverage:'prompt-excerpt-only',responseSha256:hash(response),unavailableAttachmentIds:response.unavailableAttachmentIds??[],documents:response.documents.map(d=>{const snapshotSha256=hash(d);return {id:d.id,filename:d.filename,kind:d.kind,status:d.status,truncated:d.truncated,reason:d.reason,promptTextSha256:textHash(d.text),promptTextUtf8Bytes:Buffer.byteLength(d.text,'utf8'),snapshotSha256,versionRef:{kind:'content-snapshot',sha256:snapshotSha256},fullExtractedTextSha256:null,originalFileSha256:null};})};
 }else{
  const docs=data(resolvedDocuments);
  attachments={correlation:'unattributed-legacy-bundle',coverage:'not-proven-by-legacy-resolver',state:docs.length?'observed':input.attachmentIds.length?'unavailable':'not-requested',documentsSha256:hash(docs),documents:docs.map(d=>({filename:d.filename,textSha256:textHash(d.text),textUtf8Bytes:Buffer.byteLength(d.text,'utf8')}))};
 }
 return {mappingVersion:'legacy-draft-observation/1',clientId,input:data(input),selectedOwnerActorId:ownerActorId,attachments};
}

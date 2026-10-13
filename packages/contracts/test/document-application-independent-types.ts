import {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload,DocumentResponseError} from '@capiro/meri-contracts/document-application';
import type {DocumentRoute,DocumentRequestMap,DocumentResponseMap,DocumentCreateRequest,DocumentReviseRequest,DocumentInspectRequest,DocumentDownloadRequest,DocumentCreatedResponse,DocumentInspectionResponse,DocumentErrorResponse,AdmittedDocumentVersion,DocumentDownload} from '@capiro/meri-contracts/document-application';
const encoded=new TextEncoder().encode('{}');
const request=receiveDocumentRequest('create',encoded);
const create:DocumentCreateRequest=request;
const route:DocumentRoute='inspect';
const inspect:DocumentInspectRequest=receiveDocumentRequest(route,encoded);
const download:DocumentDownloadRequest=receiveDocumentRequest('download',encoded);
const revise:DocumentReviseRequest=receiveDocumentRequest('revise',encoded);
async function consume(response:Response){
 const out=await receiveDocumentResponse('create',response.status,new Uint8Array(await response.arrayBuffer()),request);
 if('error' in out){const denied:DocumentErrorResponse=out;const code:string=denied.error.code;void code;}
 else {const created:DocumentCreatedResponse=out;const version:AdmittedDocumentVersion=out.version;const file:DocumentDownload=await receiveDocumentDownload(response,version,{maxBytes:1024,timeoutMs:1000,signal:new AbortController().signal});const bytes:Uint8Array=file.bytes;void bytes;
 // @ts-expect-error raw shape annotation cannot preserve receiver integrity brand
 const forged:AdmittedDocumentVersion=created.version;
 // @ts-expect-error receiving shape is not a grant
 const authorized:true=created.authorized;
 // @ts-expect-error draft is not a completed generation claim
 const done:'completed'=created.version.generationStatus;
 }
}
// @ts-expect-error unknown operation is not a document route
receiveDocumentRequest('execute',encoded);
// @ts-expect-error document download is binary not an action result
const invalid:DocumentInspectionResponse={acceptedTasks:false};
void[create,inspect,download,revise,consume,invalid,DocumentResponseError];
type Maps=[DocumentRequestMap,DocumentResponseMap];export type ConsumerMaps=Maps;

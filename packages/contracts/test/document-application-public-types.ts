import {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload,type DocumentCreateRequest,type DocumentInspectionResponse,type DocumentContentRequest,type AdmittedDocumentVersion} from '@capiro/meri-contracts/document-application';
const dto:DocumentCreateRequest={deliveryId:'one',request:{operation:'create_word',format:'txt',title:'Text',content:{text:'Hello'}}};
const request=receiveDocumentRequest('create',new TextEncoder().encode(JSON.stringify(dto)));
const result=await receiveDocumentResponse('create',200,new Uint8Array(),request);
if(!('error' in result)){const version:AdmittedDocumentVersion=result.version;const bytes=await receiveDocumentDownload(new Response(),version,{timeoutMs:1000});void bytes.bytes;}
// @ts-expect-error ordinary version DTOs cannot bypass receiving admission
await receiveDocumentDownload(new Response(),{});
// @ts-expect-error PDF is not admitted by the document application
const pdf:DocumentContentRequest={operation:'create_word',format:'pdf',title:'PDF',content:{blocks:[]}};
// @ts-expect-error caller context is not a public request field
const bad:DocumentCreateRequest={...dto,context:{}};
const inspect=null as unknown as DocumentInspectionResponse;void inspect.inspection.currentBytesVerified;void pdf;void bad;

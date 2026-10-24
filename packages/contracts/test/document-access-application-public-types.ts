import {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload,documentAccessMetadata,DocumentResponseError,type AdmittedDocumentVersion,type DocumentInspectionResponse,type DocumentErrorResponse} from '@capiro/meri-contracts/document-access-application';
const request=receiveDocumentRequest('inspect',new Uint8Array());
const response=await receiveDocumentResponse('inspect',200,new Uint8Array(),request);
const exact:DocumentErrorResponse|DocumentInspectionResponse=response;void exact;
if(!('error'in response)){
  const version:AdmittedDocumentVersion=response.version;
  if('kind' in response){const path:string=response.version.path;const verified:true=response.integrity.currentBytesVerified;void [path,verified];}else{
  const format:'txt'|'docx'|'xlsx'|'pptx'|'pdf'|'zip'=response.inspection.format;void format;
  if(response.inspection.format==='pptx'){const visual:'pending'=response.inspection.details.visualInspection;void visual;}
  if(response.inspection.format==='pdf'){const render:'pending'=response.inspection.details.renderInspection;void render;}
  if(response.inspection.format==='zip'){const columns:string[]=response.inspection.details.columns;void columns;}
  const flags:{nativeOpened:false;rendered:false;recalculated:false}={nativeOpened:response.inspection.nativeOpened,rendered:response.inspection.rendered,recalculated:response.inspection.recalculated};void flags;}
  const file=await receiveDocumentDownload(new Response(),version,{maxBytes:1024});const bytes:Uint8Array<ArrayBuffer>=file.bytes;void bytes;
}
const route:'/api/documents/inspect'=documentAccessMetadata.routes.inspect.path;void route;
const preview:'docx'|'xlsx'|'pptx'|'pdf'=documentAccessMetadata.previewFormats[0];void preview;
const error:DocumentResponseError|undefined=undefined;void error;
// @ts-expect-error receiving a response never issues authority
const authorized:{authorized:true}=response;void authorized;
// @ts-expect-error create and revise are not routes of the access contract
receiveDocumentRequest('create',new Uint8Array());
// @ts-expect-error a download needs a version admitted from an inspect answer, not a raw object
await receiveDocumentDownload(new Response(),{versionId:'x'});

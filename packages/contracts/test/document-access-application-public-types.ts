import {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload,documentAccessMetadata,DocumentResponseError,type AdmittedDocumentVersion,type DocumentInspectionResponse,type DocumentErrorResponse} from '@capiro/meri-contracts/document-access-application';
import {receiveDocumentPreviewRequest,receiveDocumentPreviewPublication,receiveDocumentPreview,documentPreviewMetadata} from '@capiro/meri-contracts/document-access-application';
const request=receiveDocumentRequest('inspect',new Uint8Array());
const response=await receiveDocumentResponse('inspect',200,new Uint8Array(),request);
const exact:DocumentErrorResponse|DocumentInspectionResponse=response;void exact;
if(!('error'in response)){
  const version:AdmittedDocumentVersion=response.version;
  if('kind' in response){const path:string=response.version.path;const verified:true=response.integrity.currentBytesVerified;void [path,verified];
  // @ts-expect-error native files do not use the generated-artifact preview identity contract
  await receiveDocumentPreview(new Response(),response.version);
  }else{
  const publication=receiveDocumentPreviewRequest('publish',new Uint8Array());
  const receipt=receiveDocumentPreviewPublication(200,new Uint8Array(),publication,response.version);void receipt;
  const rendered=await receiveDocumentPreview(new Response(),response.version);const nativeQualified:false=rendered.preview.nativeQualified;void nativeQualified;
  // @ts-expect-error reading cannot be passed as a publication request
  receiveDocumentPreviewPublication(200,new Uint8Array(),receiveDocumentPreviewRequest('read',new Uint8Array()),response.version);
  const format:'txt'|'docx'|'xlsx'|'pptx'|'pdf'|'zip'=response.inspection.format;void format;
  if(response.inspection.format==='pptx'){const visual:'pending'=response.inspection.details.visualInspection;void visual;}
  if(response.inspection.format==='pdf'){const render:'pending'=response.inspection.details.renderInspection;void render;}
  if(response.inspection.format==='zip'){const columns:string[]=response.inspection.details.columns;void columns;}
  const flags:{nativeOpened:false;rendered:false;recalculated:false}={nativeOpened:response.inspection.nativeOpened,rendered:response.inspection.rendered,recalculated:response.inspection.recalculated};void flags;}
  const file=await receiveDocumentDownload(new Response(),version,{maxBytes:1024});const bytes:Uint8Array<ArrayBuffer>=file.bytes;void bytes;
}
const route:'/api/documents/inspect'=documentAccessMetadata.routes.inspect.path;void route;
const historyRequest=receiveDocumentRequest('history',new Uint8Array());
const history=await receiveDocumentResponse('history',200,new Uint8Array(),historyRequest);
if(!('error'in history)){
  const anchor:string=history.anchorVersionId;const cursor:string|null=history.nextCursor;void [anchor,cursor];
  // @ts-expect-error metadata history does not admit object bytes for download
  await receiveDocumentDownload(new Response(),history.versions[0]!);
}
const preview:'docx'|'xlsx'|'pptx'|'pdf'=documentAccessMetadata.previewFormats[0];void preview;
const previewEffect:'write'=documentPreviewMetadata.publish.effect;void previewEffect;
// @ts-expect-error explicit preview routes retain a separate closed receiver
receiveDocumentRequest('preview',new Uint8Array());
const listRequest=receiveDocumentRequest('list',new Uint8Array());
const library=await receiveDocumentResponse('list',200,new Uint8Array(),listRequest);
if(!('error'in library)){
  const scope:'conversation'|'client'|'owner'=library.scope;const cursor:string|null=library.nextCursor;void [scope,cursor];
  // @ts-expect-error library metadata is not admitted for byte download
  await receiveDocumentDownload(new Response(),library.versions[0]!);
}
const error:DocumentResponseError|undefined=undefined;void error;
// @ts-expect-error receiving a response never issues authority
const authorized:{authorized:true}=response;void authorized;
// @ts-expect-error create and revise are not routes of the access contract
receiveDocumentRequest('create',new Uint8Array());
// @ts-expect-error a download needs a version admitted from an inspect answer, not a raw object
await receiveDocumentDownload(new Response(),{versionId:'x'});

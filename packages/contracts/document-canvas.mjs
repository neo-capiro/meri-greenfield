/** Native document canvas receiving boundary. Validation conveys no access. */
import {parseBytes,fail} from './document-application/boundary.mjs';
import {receiveDocumentRequest,receiveDocumentResponse} from './dist/document-application.mjs';
import {receiveConversationRequest} from './dist/conversation-application.mjs';
import {artifactFilename} from './artifacts-0.2/artifact-formats.mjs';
export {DocumentResponseError as CanvasResponseError} from './document-application/boundary.mjs';
export const DOCUMENT_CANVAS_SCHEMA='meri.document-canvas/1';
export const DOCUMENT_CANVAS_PATHS=Object.freeze({'canvas-read':'/api/documents/canvas-read','canvas-save':'/api/documents/canvas-save'});
const requests=new WeakMap(),encode=value=>new TextEncoder().encode(JSON.stringify(value));
function closed(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail('INVALID_CANVAS_SHAPE');}
function route(value){if(typeof value!=='string'||!Object.hasOwn(DOCUMENT_CANVAS_PATHS,value))fail('INVALID_ROUTE');}
function selection(value){
 // Reuse the published conversation selector's exact schema. This synthetic
 // validation input never leaves this process or admits a conversation/run.
 receiveConversationRequest('submit',encode({requestId:'00000000-0000-4000-8000-000000000001',prompt:'Document canvas',documentRevision:value}));
}
function content(request){
 if(request?.operation!=='create_word'||!['docx','txt'].includes(request.format))fail('UNSUPPORTED_CANVAS_FORMAT');
 return receiveDocumentRequest('create',encode({deliveryId:'canvas-source-validation',request})).request;
}
export function receiveCanvasRequest(name,bytes){
 route(name);const q=parseBytes(bytes,name==='canvas-read'?8192:2*1024*1024);
 closed(q,name==='canvas-read'?['selection']:['selection','deliveryId','request']);selection(q.selection);
 const document=name==='canvas-read'
  ?receiveDocumentRequest('inspect',encode({versionId:q.selection.versionId}))
  :receiveDocumentRequest('revise',encode({deliveryId:q.deliveryId,baseVersionId:q.selection.versionId,request:content(q.request)}));
 requests.set(q,{name,document});return q;
}
export async function receiveCanvasResponse(name,status,bytes,q){
 route(name);const admitted=requests.get(q);if(admitted?.name!==name)fail('UNADMITTED_REQUEST');
 const underlying=name==='canvas-read'?'inspect':'revise';
 if(status!==200)return receiveDocumentResponse(underlying,status,bytes,admitted.document);
 if(name==='canvas-save'){
  const result=await receiveDocumentResponse('revise',status,bytes,admitted.document);
  if(result.version.artifactId!==q.selection.artifactId||result.version.versionId===q.selection.versionId)fail('VERSION_MISMATCH');
  return result;
 }
 const source=parseBytes(bytes,16*1024*1024);closed(source,['version','inspection','request','headVersionId']);
 const document=await receiveDocumentResponse('inspect',status,encode({version:source.version,inspection:source.inspection}),admitted.document);
 const request=content(source.request);
 receiveDocumentRequest('inspect',encode({versionId:source.headVersionId}));
 if(document.version.artifactId!==q.selection.artifactId||document.version.object.sha256!==q.selection.objectSha256||
  document.inspection.format!==request.format||document.version.filename!==artifactFilename(request))fail('SOURCE_MISMATCH');
 return Object.freeze({...document,request,headVersionId:source.headVersionId});
}

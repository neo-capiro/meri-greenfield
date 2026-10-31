/** Versioned browser receiver; validation conveys no current access. The legacy
 * document schema stays frozen. Only this Office reader admits edited XLSX. */
import {parseBytes,fail} from '../document-application/boundary.mjs';
import {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload} from '../dist/document-access-application.mjs';
export {DocumentResponseError as OfficeResponseError} from '../document-application/boundary.mjs';
export {receiveDocumentDownload as receiveOfficeDownload};
export const OFFICE_SCHEMA='meri.office-application/1';
export const OFFICE_ROUTES=Object.freeze(['open','read','launch','renew','release','discard','publish','inspect','import']);
export const OFFICE_ERROR_STATUSES=Object.freeze({INVALID_REQUEST:400,UNAUTHENTICATED:401,ACCESS_DENIED:403,NOT_FOUND:404,METHOD_NOT_ALLOWED:405,
 DEADLINE:408,CONFLICT:409,PUBLISH_UNRESOLVED:409,IMPORT_UNRESOLVED:409,TOO_LARGE:413,UNSUPPORTED_MEDIA_TYPE:415,CANCELLED:499,REFUSED:502,UNAVAILABLE:503});
const requests=new WeakMap(),uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v),sequence=v=>Number.isInteger(v)&&v>=0&&v<=2147483647;
const instant=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
function closed(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))fail('INVALID_OFFICE_SHAPE');}
function route(value){if(typeof value!=='string'||!OFFICE_ROUTES.includes(value))fail('INVALID_ROUTE');}
export function receiveOfficeRequest(name,bytes){
 route(name);const q=parseBytes(bytes,8192),editor=['launch','renew','release'].includes(name);
 if(name==='import'){
  closed(q,['schema','uploadId','sha256','operation']);
  if(q.schema!==OFFICE_SCHEMA||!uuid(q.uploadId)||!sha(q.sha256)||!['import','recover'].includes(q.operation))fail('INVALID_REQUEST');
  requests.set(q,name);return Object.freeze(q);
 }
 const extra=editor?['editorId','expectedEpoch',...(name==='release'?[]:['mode']),...(name==='launch'?['operation']:[])]:name==='publish'?['sequence','sha256']:[];
 closed(q,['schema','versionId',...(name==='inspect'?[]:['draftId']),...extra]);
 if(q.schema!==OFFICE_SCHEMA||!uuid(q.versionId)||name!=='inspect'&&!uuid(q.draftId))fail('INVALID_REQUEST');
 if(editor&&(!uuid(q.editorId)||!sequence(q.expectedEpoch)||name!=='launch'&&q.expectedEpoch<1))fail('INVALID_REQUEST');
 if(q.mode!==undefined&&!['edit','view'].includes(q.mode)||name==='launch'&&!['acquire','takeover'].includes(q.operation))fail('INVALID_REQUEST');
 if(name==='publish'&&(!sequence(q.sequence)||q.sequence<1||!sha(q.sha256)))fail('INVALID_REQUEST');
 requests.set(q,name);return q;
}
function draft(value,q){
 closed(value,['draftId','conversationId','artifactId','baseVersionId','baseSha256','format','filename','sequence','sha256','byteLength','state','publishIntent','publishedVersionId','savedAt','expiresAt']);
 if(value.draftId!==q.draftId||value.baseVersionId!==q.versionId||!uuid(value.conversationId)||!uuid(value.artifactId)||!sha(value.baseSha256)||
  !['docx','xlsx','pptx'].includes(value.format)||typeof value.filename!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,190}$/u.test(value.filename)||!value.filename.endsWith('.'+value.format)||
  !sequence(value.sequence)||!Number.isInteger(value.byteLength)||value.byteLength<0||value.byteLength>20*1024*1024||
  !instant(value.savedAt)||!instant(value.expiresAt)||value.expiresAt<=value.savedAt)fail('INVALID_DRAFT');
 if(value.sequence===0?value.sha256!==null||value.byteLength!==0:!sha(value.sha256)||value.byteLength<1)fail('INVALID_DRAFT');
 if(!['draft','publish-pending','publish-unknown','publish-refused','conflict','published'].includes(value.state)||
  (value.state==='draft'?value.publishIntent!==null:value.sequence<1||value.publishIntent!==`office:${value.draftId}:${value.sequence}`)||
  (value.state==='published'?!uuid(value.publishedVersionId):value.publishedVersionId!==null))fail('INVALID_DRAFT');
}
function editor(value){
 closed(value,['editorId','epoch','expiresAt']);
 if(!sequence(value.epoch)||(value.editorId===null?value.expiresAt!==null:!uuid(value.editorId)||value.epoch<1||!instant(value.expiresAt)))fail('INVALID_EDITOR');
}
function launch(value,q,lease){
 closed(value,['edition','editorOrigin','actionUrl','method','fields','expiresAtMs']);closed(value.fields,['access_token','access_token_ttl']);
 let origin,action,source;try{origin=new URL(value.editorOrigin);action=new URL(value.actionUrl);source=new URL(action.searchParams.get('WOPISrc'));}catch{fail('INVALID_LAUNCH');}
 if(value.edition!=='collabora-code'||value.method!=='POST'||typeof value.editorOrigin!=='string'||origin.origin!==value.editorOrigin||origin.protocol!=='https:'||
  typeof value.actionUrl!=='string'||value.actionUrl.length>8192||action.origin!==origin.origin||action.username||action.password||action.hash||
  !action.pathname.startsWith('/browser/')||!action.pathname.endsWith('/cool.html')||action.searchParams.getAll('WOPISrc').length!==1||
  [...action.searchParams.keys()].some(k=>['access_token','access_token_ttl'].includes(k.toLowerCase())||k.toLowerCase()==='wopisrc'&&k!=='WOPISrc')||
  source.protocol!=='https:'||source.origin===origin.origin||source.username||source.password||source.hash||source.search||source.pathname!==`/api/meri/office/wopi/files/${q.draftId}`||
  typeof value.fields.access_token!=='string'||!/^[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{43}$/u.test(value.fields.access_token)||
  !Number.isSafeInteger(value.expiresAtMs)||value.expiresAtMs<1||value.expiresAtMs>Date.parse(lease.expiresAt)||value.fields.access_token_ttl!==String(value.expiresAtMs))fail('INVALID_LAUNCH');
}
async function document(value,versionId){
 closed(value,['version','inspection']);
 const q=receiveDocumentRequest('inspect',encode({versionId}));
 const nativeExcel=value.inspection?.format==='xlsx'&&value.inspection?.details?.formulaCache==='editor-provided/unverified; recalculation required';
 if(nativeExcel&&Object.hasOwn(value.inspection.details,'revisionMethod'))fail('INVALID_INSPECTION');
 // Validate the shared shape using its frozen cache enum, then return the
 // original truthful inspection. Never label edited caches removed/recalculated.
 const check=nativeExcel?{...value,inspection:{...value.inspection,details:{...value.inspection.details,formulaCache:'removed/unverified; recalculation required'}}}:value;
 const received=await receiveDocumentResponse('inspect',200,encode(check),q);
 if(!['docx','xlsx','pptx'].includes(value.inspection.format))fail('INVALID_INSPECTION');
 return Object.freeze({version:received.version,inspection:value.inspection});
}
export async function receiveOfficeResponse(name,status,bytes,q){
 route(name);if(requests.get(q)!==name)fail('UNADMITTED_REQUEST');
 if(!Number.isInteger(status)||status<100||status>599)fail('INVALID_STATUS');
 const r=parseBytes(bytes,2*1024*1024);
 if(status!==200){
  closed(r,['schema','error']);closed(r.error,['code','outcome']);
  if(r.schema!==OFFICE_SCHEMA||typeof r.error.code!=='string'||!Object.hasOwn(OFFICE_ERROR_STATUSES,r.error.code)||OFFICE_ERROR_STATUSES[r.error.code]!==status||
   !['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED','READ_UNAVAILABLE'].includes(r.error.outcome))fail('INVALID_ERROR_RESPONSE');
  return r;
 }
 if(name==='discard'){closed(r,['schema','discarded']);if(r.schema!==OFFICE_SCHEMA||r.discarded!==true)fail('INVALID_RESPONSE');return r;}
 if(name==='inspect'){closed(r,['schema','document']);if(r.schema!==OFFICE_SCHEMA)fail('INVALID_RESPONSE');return Object.freeze({...r,document:await document(r.document,q.versionId)});}
 if(name==='import'){
  closed(r,['schema','uploadId','sha256','document']);
  if(r.schema!==OFFICE_SCHEMA||r.uploadId!==q.uploadId||r.sha256!==q.sha256||!uuid(r.document?.version?.versionId))fail('IMPORT_MISMATCH');
  const imported=await document(r.document,r.document.version.versionId);
  if(imported.version.parentVersionId!==null||imported.version.object.sha256!==q.sha256)fail('IMPORT_MISMATCH');
  return Object.freeze({...r,document:imported});
 }
 closed(r,name==='publish'?['schema','draft','publication']:['schema','draft','editor','launch']);
 if(r.schema!==OFFICE_SCHEMA)fail('INVALID_RESPONSE');draft(r.draft,q);
 if(name==='publish'){
  if(r.draft.state!=='published'||r.draft.sequence!==q.sequence||r.draft.sha256!==q.sha256)fail('PUBLICATION_MISMATCH');
  const publication=await document(r.publication,r.draft.publishedVersionId),v=publication.version;
  if(v.artifactId!==r.draft.artifactId||v.parentVersionId!==q.versionId||v.binding.conversationId!==r.draft.conversationId||v.object.sha256!==q.sha256||v.object.bytes!==r.draft.byteLength||
   v.filename!==r.draft.filename||publication.inspection.format!==r.draft.format)fail('PUBLICATION_MISMATCH');
  return Object.freeze({...r,publication});
 }
 editor(r.editor);
 if(['launch','renew'].includes(name)){
  if(r.editor.editorId!==q.editorId||r.editor.epoch!==q.expectedEpoch+(name==='renew'?0:1)||!['draft','publish-refused'].includes(r.draft.state))fail('EDITOR_MISMATCH');
  launch(r.launch,q,r.editor);
 }else if(r.launch!==null)fail('UNEXPECTED_LAUNCH');
 if(name==='release'&&(r.editor.editorId!==null||r.editor.epoch!==q.expectedEpoch))fail('EDITOR_MISMATCH');
 return r;
}

/** Additive metadata-only upload source event; grants no authority and carries no extracted text. */
import {fail} from './semantics.mjs';
export const UPLOAD_SOURCE_EVENT='source.native-upload';
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
const text=(v,min,max)=>typeof v==='string'&&v.length>=min&&v.length<=max;
const code=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/u.test(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const DATA_KEYS=['schemaVersion','deliveryId','operation','requestSha256','argumentsSha256','resultSha256','executionSha256','policyRevision','source','page'];
const SOURCE_KEYS=['authoritativeOwner','uploadId','sha256','versionId','filename','mimeType','bytes','extractedSourceSha256','extractionStatus','limitations'];
const PAGE_KEYS=['number','count','sha256','nextPage','fragmentCount','extractionStatus','limitations'];
const FORBIDDEN=new Set(['fragments','text','content','extractedText','pageText','payload','records','selection','authorizationDecisionId','sourceLocator','citation','claim']);
const limitations=value=>Array.isArray(value)&&value.length<=16&&value.every(code);
function carriesText(value){if(!value||typeof value!=='object')return false;return Object.keys(value).some(k=>FORBIDDEN.has(k))||Object.values(value).some(carriesText);}
/** Coherent metadata-only scopes/page/version/source hashes; unknown or foreign shapes are refused. */
export function assertUploadSourceEventSemantics(event){
 if(!event||typeof event!=='object'||Array.isArray(event)||event.type!==UPLOAD_SOURCE_EVENT)fail('INVALID_SOURCE_EVENT');
 if(event.contractVersion!=='0.1.0'||!uuid(event.eventId)||!integer(event.sequence,1,Number.MAX_SAFE_INTEGER)||!text(event.createdAt,1,64)||!/Z$/u.test(event.createdAt))fail('INVALID_SOURCE_EVENT');
 const binding=event.binding;
 if(!binding||typeof binding!=='object'||!text(binding.tenantId,1,128))fail('INVALID_SOURCE_EVENT');
 const data=event.data;
 if(!exact(data,DATA_KEYS))fail('INVALID_SOURCE_EVENT');
 if(carriesText(data))fail('INVALID_SOURCE_EVENT');
 const {source,page,policyRevision,operation,deliveryId}=data;
 if(data.schemaVersion!=='meri.native-upload-source/1'||!text(deliveryId,1,255)||!/^[-A-Za-z0-9_.:@/]{1,255}$/u.test(deliveryId))fail('INVALID_SOURCE_EVENT');
 if(!operation||typeof operation!=='object'||operation.id!=='read_upload_source'||operation.version!=='0.2.0')fail('INVALID_SOURCE_EVENT');
 if(![data.requestSha256,data.argumentsSha256,data.resultSha256,data.executionSha256].every(hex)||!text(policyRevision,1,255))fail('INVALID_SOURCE_EVENT');
 if(!exact(source,SOURCE_KEYS)||!exact(page,PAGE_KEYS))fail('INVALID_SOURCE_EVENT');
 if(source.authoritativeOwner!=='upload_custody'||!uuid(source.uploadId)||!hex(source.sha256)||!hex(source.extractedSourceSha256)||!text(source.versionId,1,1024)||
  !text(source.filename,1,255)||!text(source.mimeType,0,128)||!integer(source.bytes,1,10485760)||!['available','partial'].includes(source.extractionStatus)||!limitations(source.limitations))fail('INVALID_SOURCE_EVENT');
 if(!integer(page.number,0,255)||!integer(page.count,1,256)||page.number>=page.count||!hex(page.sha256)||
  !(page.nextPage===null||integer(page.nextPage,1,255))||page.nextPage!==(page.number+1<page.count?page.number+1:null)||
  !integer(page.fragmentCount,0,64)||!['available','partial'].includes(page.extractionStatus)||!limitations(page.limitations))fail('INVALID_SOURCE_EVENT');
 if(page.extractionStatus!==source.extractionStatus)fail('INVALID_SOURCE_EVENT');
 const scopes=event.scopes;
 if(!Array.isArray(scopes)||scopes.length<1||scopes.some(s=>!s||typeof s!=='object'||s.tenantId!==binding.tenantId||s.policyRevision!==policyRevision))fail('INVALID_SOURCE_EVENT');
 return event;
}

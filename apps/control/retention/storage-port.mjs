/** Version-specific object absence semantics over an injected storage `send` port (no SDK import; the product adapter maps the
 * descriptors to AWS SDK commands). Ambiguity is never proof of deletion. */
import {own,data,fail,text,clock} from './boundary.mjs';
export const outcomes=Object.freeze(['PRESENT','ABSENT','UNKNOWN']);
const status=e=>e?.$metadata?.httpStatusCode??e?.httpStatusCode??null;
const deleteMarkerHeader=e=>String(e?.$metadata?.httpHeaders?.['x-amz-delete-marker']??e?.$response?.headers?.['x-amz-delete-marker']??'').toLowerCase()==='true';
/** Permission assumptions recorded with every classification: without version-list permission a 404 is not evidence. */
export function parsePermissions(value){const p=own(data(value),['getObjectVersion','listBucketVersions','deleteObjectVersion']);for(const k of Object.keys(p))if(typeof p[k]!=='boolean')fail('RETENTION_CONFIGURATION');return p;}
export function classifyHeadOutcome({response=null,error=null,versionId,permissions}){
 const p=parsePermissions(permissions);text(versionId,1024);
 if(error){const code=status(error),name=String(error?.name??'');
  if(deleteMarkerHeader(error)||code===405)return {outcome:'UNKNOWN',reason:'DELETE_MARKER_NOT_PROOF',status:code,name};
  if(code===404||['NotFound','NoSuchVersion','NoSuchKey'].includes(name)){if(p.getObjectVersion&&p.listBucketVersions)return {outcome:'ABSENT',reason:'VERSION_NOT_FOUND_WITH_LIST_PERMISSION',status:code??404,name};return {outcome:'UNKNOWN',reason:'NOT_FOUND_WITHOUT_LIST_PERMISSION',status:code??404,name};}
  if(code===403||name==='AccessDenied'||name==='Forbidden')return {outcome:'UNKNOWN',reason:'ACCESS_DENIED_MAY_MASK_ABSENCE',status:code??403,name};
  return {outcome:'UNKNOWN',reason:'AMBIGUOUS_ERROR',status:code,name:name||'Error'};
 }
 if(!response||typeof response!=='object')return {outcome:'UNKNOWN',reason:'NO_RESPONSE',status:null,name:null};
 if(response.DeleteMarker===true||deleteMarkerHeader(response))return {outcome:'UNKNOWN',reason:'DELETE_MARKER_NOT_PROOF',status:status(response),name:null};
 if(response.VersionId!==versionId)return {outcome:'UNKNOWN',reason:'VERSION_MISMATCH',status:status(response),name:null};
 return {outcome:'PRESENT',reason:'VERSION_PRESENT',status:status(response)??200,name:null};
}
export function createVersionStorage({send,bucket,expectedBucketOwner,permissions,now,maxRequestMs=15000}){
 if(typeof send!=='function'||typeof bucket!=='string'||!bucket||!/^[0-9]{12}$/u.test(String(expectedBucketOwner))||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1)fail('RETENTION_CONFIGURATION');
 const p=parsePermissions(permissions),tick=clock(now);
 /** Bounded call: the deadline wins even when the handler ignores its abort signal; a late result is discarded, never classified. */
 async function call(operation,input){const controller=new AbortController();let timer;const timeout=Object.assign(new Error('TIMEOUT'),{name:'TimeoutError'});
  const deadline=new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve({error:timeout});},maxRequestMs);});
  const attempt=Promise.resolve().then(()=>send({operation,input:{Bucket:bucket,ExpectedBucketOwner:expectedBucketOwner,...input}},{signal:controller.signal})).then(response=>({response}),error=>({error:controller.signal.aborted?timeout:error}));
  try{return await Promise.race([attempt,deadline]);}finally{clearTimeout(timer);}}
 async function headVersion({key,versionId}){text(key,1024);text(versionId,1024);const r=await call('HeadObject',{Key:key,VersionId:versionId});return Object.freeze({...classifyHeadOutcome({...r,versionId,permissions:p}),key,versionId,checkedAtMs:tick(),permissions:p});}
 /** Exact-version delete; the receipt is a request record, never proof. A delete marker in the response fails the step. */
 async function deleteVersion({key,versionId}){text(key,1024);text(versionId,1024);if(!p.deleteObjectVersion)fail('RETENTION_STORAGE_PERMISSION');
  const r=await call('DeleteObject',{Key:key,VersionId:versionId});if(r.error)return Object.freeze({key,versionId,outcome:'UNKNOWN',status:status(r.error),name:String(r.error?.name??'Error'),requestId:r.error?.$metadata?.requestId??null,requestedAtMs:tick()});
  if(r.response?.DeleteMarker===true)fail('RETENTION_DELETE_MARKER');
  return Object.freeze({key,versionId,outcome:'REQUESTED',status:status(r.response)??204,returnedVersionId:r.response?.VersionId??null,requestId:r.response?.$metadata?.requestId??null,requestedAtMs:tick()});}
 return Object.freeze({headVersion,deleteVersion,permissions:p});
}

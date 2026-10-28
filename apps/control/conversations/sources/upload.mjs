/** CONTROL-owned upload read evidence. The durable event records observed metadata, never source text or authority. */
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertSourceShape} from '../../../../packages/contracts/conversation-sources/validate.mjs';
import {uploadSourcePage} from '../../../../packages/runtime/upload-sources.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
const schemaVersion='meri.native-upload-source/1',type='source.native-upload';
const operation=Object.freeze({id:'read_upload_source',version:'0.2.0'});
const keys=['selection','versionId','filename','mimeType','bytes','extractionStatus','limitations','sourceSha256','pageCount','scopes'];
const same=(a,b)=>hash(a)===hash(b);
function referenceId(value){const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
/** The hashes bind the actual stored run context, selected input and observed private page; they are not grants. */
export function projectUploadSource({binding,selection,page,raw,scopes}){
 validateShape('RunBinding',binding);
 if(!Array.isArray(scopes)||!scopes.length||scopes.some(scope=>scope.tenantId!==binding.tenantId||scope.policyRevision!==scopes[0].policyRevision))throw nativeReadFault('INVALID_RESULT');
 const expected=Object.fromEntries(keys.map(key=>[key,raw?.[key]]));expected.selection=selection;expected.scopes=scopes;
 let value;try{value=uploadSourcePage(raw,expected,page);}catch{throw nativeReadFault('INVALID_RESULT');}
 const argumentsValue={selection,page},context={binding,scopes},deliveryId='upload-'+hash({binding,selection,page,versionId:value.versionId,sourceSha256:value.sourceSha256,pageSha256:value.pageSha256});
 const source=assertSourceShape('NativeUploadSource',{schemaVersion,deliveryId,operation,requestSha256:hash({binding,...argumentsValue}),argumentsSha256:hash(argumentsValue),resultSha256:hash(value),executionSha256:hash(context),policyRevision:scopes[0].policyRevision,
  source:{authoritativeOwner:'upload_custody',uploadId:selection.uploadId,sha256:selection.sha256,versionId:value.versionId,filename:value.filename,mimeType:value.mimeType,bytes:value.bytes,extractedSourceSha256:value.sourceSha256,extractionStatus:value.extractionStatus,limitations:value.limitations},
  page:{number:page,count:value.pageCount,sha256:value.pageSha256,nextPage:value.nextPage,fragmentCount:value.fragments.length,extractionStatus:value.extractionStatus,limitations:value.limitations}});
 return {source,value};
}
export function createUploadSourceCapture({store}){
 if(typeof store?.appendSource!=='function')throw nativeReadFault('CONFIGURATION');
 return async function capture({binding,selection,page,raw,scopes,signal,check}){
  const {source,value}=projectUploadSource({binding,selection,page,raw,scopes}),eventId=referenceId({schemaVersion,binding,deliveryId:source.deliveryId});
  const verify=()=>{signal?.throwIfAborted();check();};verify();
  try{await store.appendSource(binding,{eventId,type,data:source},verify,scopes);verify();}
  catch(error){if(['STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN'].includes(error?.code))throw nativeReadFault('SOURCE_PUBLICATION_UNKNOWN');
   if(error?.code==='EVENT_REPLAY_REFUSED')throw nativeReadFault('SOURCE_PUBLICATION_CONFLICT');throw error;}
  return value;
 };
}
/** Revalidation can withhold a recorded observation; it never rewrites that observation or substitutes new source bytes. */
export function assertSameUploadSource(first,current,context){
 const {value}=projectUploadSource({...context,raw:current});if(!same(first,value))throw nativeReadFault('INVALID_RESULT');return value;
}
